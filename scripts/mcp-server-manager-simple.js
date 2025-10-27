// 简化的 MCP 服务器管理器 - 专门用于脚本
const { spawn } = require('child_process')
const fs = require('fs').promises
const path = require('path')

class SimpleMCPServerManager {
  constructor() {
    this.servers = new Map()
  }

  static getInstance() {
    if (!SimpleMCPServerManager.instance) {
      SimpleMCPServerManager.instance = new SimpleMCPServerManager()
    }
    return SimpleMCPServerManager.instance
  }

  async initializeFromConfig() {
    try {
      const configPath = path.join(process.cwd(), 'config', 'mcp.json')
      const configData = await fs.readFile(configPath, 'utf-8')
      const config = JSON.parse(configData)
      
      const servers = {}
      
      for (const [serverName, serverConfig] of Object.entries(config.mcpServers || {})) {
        if (!serverConfig.disabled) {
          const fullConfig = {
            name: serverName,
            transport: serverConfig.transport || 'stdio',
            command: serverConfig.command,
            args: serverConfig.args || [],
            env: serverConfig.env || {},
            autoApprove: serverConfig.autoApprove || [],
            disabled: serverConfig.disabled || false,
            url: serverConfig.url,
            timeout: serverConfig.timeout,
            retryAttempts: serverConfig.retryAttempts,
            retryDelay: serverConfig.retryDelay
          }
          
          servers[serverName] = fullConfig
          await this.initializeServer(serverName, fullConfig)
        }
      }
      
      return servers
    } catch (error) {
      console.error('Failed to initialize from config:', error)
      return {}
    }
  }

  async initializeServer(serverName, config) {
    try {
      const serverInfo = {
        config,
        process: null,
        status: 'initializing',
        tools: [],
        error: undefined,
        httpClient: undefined
      }

      this.servers.set(serverName, serverInfo)

      if (config.transport === 'http') {
        await this.initializeHttpServer(serverName)
      } else {
        await this.startServerProcess(serverName)
      }

      await this.loadServerTools(serverName)
      serverInfo.status = 'connected'
      console.log(`MCP server ${serverName} initialized successfully`)
    } catch (error) {
      const serverInfo = this.servers.get(serverName)
      if (serverInfo) {
        serverInfo.status = 'error'
        serverInfo.error = error.message
      }
      throw error
    }
  }

  async initializeHttpServer(serverName) {
    const serverInfo = this.servers.get(serverName)
    if (!serverInfo || !serverInfo.config.url) {
      throw new Error(`HTTP URL is required for server ${serverName}`)
    }

    serverInfo.httpClient = {
      url: serverInfo.config.url,
      timeout: serverInfo.config.timeout || 60000,
      requestId: 1
    }

    // Test connectivity
    const response = await fetch(serverInfo.config.url, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'User-Agent': 'MCPChat/1.0.0'
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 0,
        method: 'ping',
        params: {}
      }),
      signal: AbortSignal.timeout(serverInfo.httpClient.timeout)
    })

    // Initialize MCP connection
    const initResponse = await this.sendMCPRequest(serverInfo, 'initialize', {
      protocolVersion: '2024-11-05',
      capabilities: { tools: {} },
      clientInfo: { name: 'mcpchat', version: '1.0.0' }
    })

    if (!initResponse.result) {
      throw new Error(`MCP initialization failed: ${JSON.stringify(initResponse)}`)
    }
  }

  async startServerProcess(serverName) {
    const serverInfo = this.servers.get(serverName)
    if (!serverInfo || !serverInfo.config.command) {
      throw new Error(`Command is required for stdio transport for server ${serverName}`)
    }

    return new Promise((resolve, reject) => {
      try {
        const childProcess = spawn(serverInfo.config.command, serverInfo.config.args, {
          env: { ...process.env, ...serverInfo.config.env },
          stdio: ['pipe', 'pipe', 'pipe']
        })

        serverInfo.process = childProcess

        childProcess.on('error', (error) => {
          serverInfo.status = 'error'
          serverInfo.error = `Process error: ${error.message}`
          reject(error)
        })

        childProcess.on('exit', (code, signal) => {
          serverInfo.status = 'disconnected'
          serverInfo.error = `Process exited with code ${code}, signal ${signal}`
        })

        // Give the process time to start
        const timeout = serverInfo.config.timeout || 30000
        setTimeout(() => {
          if (childProcess && !childProcess.killed) {
            resolve()
          } else {
            reject(new Error(`Process failed to start within ${timeout}ms`))
          }
        }, timeout)
      } catch (error) {
        reject(error)
      }
    })
  }

  async loadServerTools(serverName) {
    const serverInfo = this.servers.get(serverName)
    if (!serverInfo) {
      throw new Error(`Server ${serverName} not found`)
    }

    try {
      if (serverInfo.config.transport === 'http') {
        const response = await this.sendMCPRequest(serverInfo, 'tools/list', {})
        if (response.result && response.result.tools) {
          serverInfo.tools = response.result.tools.map(tool => ({
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema
          }))
        } else {
          serverInfo.tools = []
        }
      } else {
        await this.loadStdioServerTools(serverName, serverInfo)
      }
    } catch (error) {
      console.error(`Failed to load tools for server ${serverName}:`, error)
      serverInfo.tools = []
    }
  }

  async loadStdioServerTools(serverName, serverInfo) {
    if (!serverInfo.process || serverInfo.process.killed) {
      throw new Error(`Server process for ${serverName} is not running`)
    }

    return new Promise((resolve, reject) => {
      const process = serverInfo.process
      let responseBuffer = ''
      let initResponseReceived = false
      let toolsResponseReceived = false

      const timeout = setTimeout(() => {
        cleanup()
        reject(new Error(`Timeout waiting for tools from ${serverName}`))
      }, 10000)

      const cleanup = () => {
        clearTimeout(timeout)
        if (process.stdout) {
          process.stdout.removeAllListeners('data')
        }
      }

      const dataHandler = (data) => {
        responseBuffer += data.toString()
        const lines = responseBuffer.split('\n')
        responseBuffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.trim()) continue

          try {
            const response = JSON.parse(line)

            if (response.id === 1 && !initResponseReceived) {
              initResponseReceived = true
              
              const initializedNotification = JSON.stringify({
                jsonrpc: '2.0',
                method: 'notifications/initialized'
              }) + '\n'
              process.stdin?.write(initializedNotification)

              const toolsRequest = JSON.stringify({
                jsonrpc: '2.0',
                id: 2,
                method: 'tools/list',
                params: {}
              }) + '\n'
              process.stdin?.write(toolsRequest)
            } else if (response.id === 2 && !toolsResponseReceived) {
              toolsResponseReceived = true
              
              if (response.result && response.result.tools) {
                serverInfo.tools = response.result.tools.map(tool => ({
                  name: tool.name,
                  description: tool.description,
                  inputSchema: tool.inputSchema
                }))
              } else {
                serverInfo.tools = []
              }
              
              cleanup()
              resolve()
            }
          } catch (error) {
            console.error(`Failed to parse MCP response from ${serverName}:`, line, error)
          }
        }
      }

      if (process.stdout) {
        process.stdout.on('data', dataHandler)
      }

      const initRequest = JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          clientInfo: { name: 'mcpchat', version: '1.0.0' }
        }
      }) + '\n'

      process.stdin?.write(initRequest)
    })
  }

  async sendMCPRequest(serverInfo, method, params) {
    if (!serverInfo.httpClient) {
      throw new Error('HTTP client not initialized')
    }

    const requestId = serverInfo.httpClient.requestId++
    const request = {
      jsonrpc: '2.0',
      id: requestId,
      method: method,
      params: params
    }

    const response = await fetch(serverInfo.httpClient.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(serverInfo.httpClient.timeout)
    })

    if (!response.ok) {
      const responseText = await response.text()
      throw new Error(`HTTP request failed: ${response.status} ${response.statusText} - ${responseText}`)
    }

    const result = await response.json()
    
    if (result.error) {
      throw new Error(`MCP error: ${result.error.message || JSON.stringify(result.error)}`)
    }

    return result
  }

  getServerStatus() {
    const status = {}
    
    for (const [serverName, serverInfo] of this.servers.entries()) {
      status[serverName] = {
        config: serverInfo.config,
        status: serverInfo.status,
        tools: [...serverInfo.tools],
        error: serverInfo.error
      }
    }
    
    return status
  }

  async shutdown() {
    const shutdownPromises = Array.from(this.servers.keys()).map(serverName => 
      this.shutdownServer(serverName)
    )
    await Promise.all(shutdownPromises)
    this.servers.clear()
  }

  async shutdownServer(serverName) {
    const serverInfo = this.servers.get(serverName)
    if (!serverInfo) return

    try {
      if (serverInfo.config.transport === 'http') {
        serverInfo.httpClient = undefined
      } else {
        if (serverInfo.process && !serverInfo.process.killed) {
          serverInfo.process.kill('SIGTERM')
          
          await new Promise((resolve) => {
            const timeout = setTimeout(() => {
              if (serverInfo.process && !serverInfo.process.killed) {
                serverInfo.process.kill('SIGKILL')
              }
              resolve()
            }, 5000)

            serverInfo.process?.on('exit', () => {
              clearTimeout(timeout)
              resolve()
            })
          })
        }
        serverInfo.process = null
      }

      serverInfo.status = 'disconnected'
    } catch (error) {
      console.error(`Error shutting down MCP server ${serverName}:`, error)
    }
  }
}

module.exports = { SimpleMCPServerManager }