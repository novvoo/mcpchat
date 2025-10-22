// Server-side MCP Manager - Handles actual Node.js processes and MCP communication

import { spawn, ChildProcess } from 'child_process'
import { MCPServerConfig, Tool } from '@/types'
import { MCPCallToolResponse } from '@/types/mcp'

/**
 * Server-side MCP Server Manager - runs on Node.js server
 */
export class MCPServerManager {
  private static instance: MCPServerManager
  private servers: Map<string, {
    config: MCPServerConfig
    process: ChildProcess | null
    status: 'disconnected' | 'initializing' | 'connected' | 'error'
    tools: Tool[]
    error?: string
    httpClient?: any // For HTTP transport
  }> = new Map()

  private constructor() {}

  public static getInstance(): MCPServerManager {
    if (!MCPServerManager.instance) {
      MCPServerManager.instance = new MCPServerManager()
    }
    return MCPServerManager.instance
  }

  /**
   * Initialize a specific MCP server
   */
  async initializeServer(serverName: string, config: MCPServerConfig): Promise<void> {
    try {
      const serverInfo = {
        config,
        process: null as ChildProcess | null,
        status: 'initializing' as 'disconnected' | 'initializing' | 'connected' | 'error',
        tools: [] as Tool[],
        error: undefined,
        httpClient: undefined
      }

      this.servers.set(serverName, serverInfo)

      // Initialize based on transport type
      if (config.transport === 'http') {
        await this.initializeHttpServer(serverName)
      } else {
        // Default to stdio
        await this.startServerProcess(serverName)
      }

      // Load tools
      await this.loadServerTools(serverName)

      serverInfo.status = 'connected'
      console.log(`MCP server ${serverName} initialized successfully`)
    } catch (error) {
      const serverInfo = this.servers.get(serverName)
      if (serverInfo) {
        serverInfo.status = 'error'
        serverInfo.error = error instanceof Error ? error.message : 'Unknown error'
      }
      throw error
    }
  }

  /**
   * Initialize HTTP-based MCP server
   */
  private async initializeHttpServer(serverName: string): Promise<void> {
    const serverInfo = this.servers.get(serverName)
    if (!serverInfo) {
      throw new Error(`Server ${serverName} not found`)
    }

    if (!serverInfo.config.url) {
      throw new Error(`HTTP URL is required for server ${serverName}`)
    }

    console.log(`Initializing HTTP MCP server ${serverName} at ${serverInfo.config.url}`)

    try {
      // Create HTTP client for MCP JSON-RPC communication
      serverInfo.httpClient = {
        url: serverInfo.config.url,
        timeout: serverInfo.config.timeout || 30000,
        requestId: 1
      }

      // Test basic connectivity first
      console.log(`Testing connectivity to ${serverInfo.config.url}`)
      const testResponse = await fetch(serverInfo.config.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 0,
          method: 'ping',
          params: {}
        }),
        signal: AbortSignal.timeout(5000)
      })

      console.log(`Connectivity test response: ${testResponse.status} ${testResponse.statusText}`)

      // Initialize MCP connection using JSON-RPC
      console.log(`Sending MCP initialize request to ${serverName}`)
      const initResponse = await this.sendMCPRequest(serverInfo, 'initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {}
        },
        clientInfo: {
          name: 'mcpchat',
          version: '1.0.0'
        }
      })

      if (!initResponse.result) {
        throw new Error(`MCP initialization failed: ${JSON.stringify(initResponse)}`)
      }

      console.log(`HTTP MCP server ${serverName} initialized successfully:`, initResponse.result)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error(`Failed to initialize HTTP MCP server ${serverName}:`, {
        url: serverInfo.config.url,
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined
      })
      throw new Error(`Failed to initialize HTTP MCP server ${serverName} at ${serverInfo.config.url}: ${errorMessage}`)
    }
  }

  /**
   * Start the MCP server process
   */
  private async startServerProcess(serverName: string): Promise<void> {
    const serverInfo = this.servers.get(serverName)
    if (!serverInfo) {
      throw new Error(`Server ${serverName} not found`)
    }

    if (!serverInfo.config.command) {
      throw new Error(`Command is required for stdio transport for server ${serverName}`)
    }

    return new Promise((resolve, reject) => {
      try {
        const childProcess = spawn(serverInfo.config.command!, serverInfo.config.args || [], {
          env: { ...process.env, ...serverInfo.config.env },
          stdio: ['pipe', 'pipe', 'pipe']
        })

        serverInfo.process = childProcess

        childProcess.on('error', (error: Error) => {
          serverInfo.status = 'error'
          serverInfo.error = `Process error: ${error.message}`
          console.error(`MCP server ${serverName} process error:`, error)
          reject(error)
        })

        childProcess.on('exit', (code: number | null, signal: string | null) => {
          serverInfo.status = 'disconnected'
          serverInfo.error = `Process exited with code ${code}, signal ${signal}`
          console.log(`MCP server ${serverName} exited with code ${code}, signal ${signal}`)
        })

        // Log stderr for debugging
        if (childProcess.stderr) {
          childProcess.stderr.on('data', (data) => {
            console.error(`MCP server ${serverName} stderr:`, data.toString())
          })
        }

        // Log stdout for debugging
        if (childProcess.stdout) {
          childProcess.stdout.on('data', (data) => {
            console.log(`MCP server ${serverName} stdout:`, data.toString())
          })
        }

        console.log(`Starting MCP server ${serverName} with command: ${serverInfo.config.command} ${serverInfo.config.args?.join(' ')}`)

        // Give the process more time to start (uvx needs time to download packages)
        const timeout = serverInfo.config.timeout || 30000 // Default 30 seconds
        const timeoutId = setTimeout(() => {
          if (childProcess && !childProcess.killed) {
            resolve()
          } else {
            reject(new Error(`Process failed to start within ${timeout}ms`))
          }
        }, timeout)

        // Clear timeout if process exits early
        childProcess.on('exit', () => {
          clearTimeout(timeoutId)
        })
      } catch (error) {
        reject(error)
      }
    })
  }

  /**
   * Load tools for a specific server
   */
  private async loadServerTools(serverName: string): Promise<void> {
    const serverInfo = this.servers.get(serverName)
    if (!serverInfo) {
      throw new Error(`Server ${serverName} not found`)
    }

    try {
      if (serverInfo.config.transport === 'http') {
        // Load tools via MCP JSON-RPC over HTTP
        const response = await this.sendMCPRequest(serverInfo, 'tools/list', {})
        
        if (response.result && response.result.tools) {
          serverInfo.tools = response.result.tools.map((tool: any) => ({
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema
          }))
        } else {
          serverInfo.tools = []
        }
      } else {
        // Load tools via MCP JSON-RPC over stdio
        await this.loadStdioServerTools(serverName, serverInfo)
      }
    } catch (error) {
      console.error(`Failed to load tools for server ${serverName}:`, error)
      serverInfo.tools = []
    }
  }

  /**
   * Load tools for stdio-based MCP server using JSON-RPC protocol
   */
  private async loadStdioServerTools(serverName: string, serverInfo: any): Promise<void> {
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

      const dataHandler = (data: Buffer) => {
        responseBuffer += data.toString()
        const lines = responseBuffer.split('\n')
        responseBuffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.trim()) continue

          try {
            const response = JSON.parse(line)
            console.log(`Received MCP response from ${serverName}:`, response)

            // Handle initialize response
            if (response.id === 1 && !initResponseReceived) {
              initResponseReceived = true
              console.log(`${serverName} initialized, sending notifications/initialized`)
              
              // Send notifications/initialized
              const initializedNotification = JSON.stringify({
                jsonrpc: '2.0',
                method: 'notifications/initialized'
              }) + '\n'
              process.stdin?.write(initializedNotification)

              // Now request tools list
              console.log(`Requesting tools/list from ${serverName}`)
              const toolsRequest = JSON.stringify({
                jsonrpc: '2.0',
                id: 2,
                method: 'tools/list',
                params: {}
              }) + '\n'
              process.stdin?.write(toolsRequest)
            }
            // Handle tools/list response
            else if (response.id === 2 && !toolsResponseReceived) {
              toolsResponseReceived = true
              
              if (response.result && response.result.tools) {
                serverInfo.tools = response.result.tools.map((tool: any) => ({
                  name: tool.name,
                  description: tool.description,
                  inputSchema: tool.inputSchema
                }))
                console.log(`Loaded ${serverInfo.tools.length} tools from ${serverName}:`, serverInfo.tools.map((t: Tool) => t.name))
              } else {
                serverInfo.tools = []
                console.warn(`No tools found in response from ${serverName}`)
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

      // Send initialize request
      console.log(`Sending MCP initialize request to ${serverName}`)
      const initRequest = JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {}
          },
          clientInfo: {
            name: 'mcpchat',
            version: '1.0.0'
          }
        }
      }) + '\n'

      process.stdin?.write(initRequest)
    })
  }

  /**
   * Get tools for a specific server
   */
  async getServerTools(serverName: string): Promise<Tool[]> {
    const serverInfo = this.servers.get(serverName)
    if (!serverInfo) {
      throw new Error(`Server ${serverName} not found`)
    }

    if (serverInfo.status !== 'connected') {
      throw new Error(`Server ${serverName} is not connected`)
    }

    return [...serverInfo.tools]
  }

  /**
   * Call a tool on a specific server
   */
  async callTool(serverName: string, toolName: string, args: Record<string, any>): Promise<MCPCallToolResponse> {
    const serverInfo = this.servers.get(serverName)
    if (!serverInfo) {
      throw new Error(`Server ${serverName} not found`)
    }

    if (serverInfo.status !== 'connected') {
      throw new Error(`Server ${serverName} is not connected`)
    }

    // Check if tool exists
    const tool = serverInfo.tools.find(t => t.name === toolName)
    if (!tool) {
      throw new Error(`Tool ${toolName} not found on server ${serverName}`)
    }

    // Execute based on transport type
    if (serverInfo.config.transport === 'http') {
      return this.callHttpTool(serverInfo, toolName, args)
    } else {
      // For stdio, simulate for now (would need real MCP protocol implementation)
      return this.simulateToolExecution(toolName, args)
    }
  }

  /**
   * Call tool via HTTP transport using MCP JSON-RPC
   */
  private async callHttpTool(serverInfo: any, toolName: string, args: Record<string, any>): Promise<MCPCallToolResponse> {
    if (!serverInfo.httpClient) {
      throw new Error('HTTP client not initialized')
    }

    try {
      const response = await this.sendMCPRequest(serverInfo, 'tools/call', {
        name: toolName,
        arguments: args
      })

      if (response.error) {
        throw new Error(`MCP tool call error: ${response.error.message}`)
      }

      return response.result
    } catch (error) {
      throw new Error(`HTTP tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Send MCP JSON-RPC request
   */
  private async sendMCPRequest(serverInfo: any, method: string, params: any): Promise<any> {
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

    console.log(`Sending MCP request to ${serverInfo.httpClient.url}:`, {
      method,
      id: requestId,
      paramsKeys: Object.keys(params)
    })

    try {
      const response = await fetch(serverInfo.httpClient.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(serverInfo.httpClient.timeout)
      })

      console.log(`MCP response status: ${response.status} ${response.statusText}`)

      if (!response.ok) {
        const responseText = await response.text()
        console.error(`HTTP request failed with response:`, responseText)
        throw new Error(`HTTP request failed: ${response.status} ${response.statusText} - ${responseText}`)
      }

      const result = await response.json()
      console.log(`MCP response result:`, result)
      
      if (result.error) {
        console.error(`MCP error response:`, result.error)
        throw new Error(`MCP error: ${result.error.message || JSON.stringify(result.error)}`)
      }

      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error(`MCP request failed:`, {
        url: serverInfo.httpClient.url,
        method,
        error: errorMessage,
        request
      })
      throw new Error(`MCP request to ${method} failed: ${errorMessage}`)
    }
  }

  /**
   * Simulate tool execution (replace with real MCP communication)
   */
  private async simulateToolExecution(name: string, args: Record<string, any>): Promise<MCPCallToolResponse> {
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500))

    switch (name) {
      case 'run_example':
        return {
          content: [{
            type: 'text',
            text: `Example execution completed for type: ${args.example_type}`
          }]
        }
      
      case 'solve_n_queens':
        const n = args.n || 8
        return {
          content: [{
            type: 'text',
            text: `N-Queens solution for ${n}x${n} board: Found ${n > 0 ? 'solution' : 'no solution'}`
          }]
        }
      
      case 'solve_sudoku':
        return {
          content: [{
            type: 'text',
            text: 'Sudoku puzzle solved successfully'
          }]
        }
      
      case 'echo':
        return {
          content: [{
            type: 'text',
            text: `Echo: ${args.message}`
          }]
        }
      
      default:
        return {
          content: [{
            type: 'text',
            text: `Tool ${name} executed with args: ${JSON.stringify(args)}`
          }]
        }
    }
  }

  /**
   * Shutdown a specific server
   */
  async shutdownServer(serverName: string): Promise<void> {
    const serverInfo = this.servers.get(serverName)
    if (!serverInfo) {
      return // Server not found, nothing to shutdown
    }

    try {
      if (serverInfo.config.transport === 'http') {
        // For HTTP, just clear the client
        serverInfo.httpClient = undefined
      } else {
        // For stdio, terminate the process
        if (serverInfo.process && !serverInfo.process.killed) {
          serverInfo.process.kill('SIGTERM')
          
          // Wait for graceful shutdown or force kill after timeout
          await new Promise<void>((resolve) => {
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

  /**
   * Initialize from configuration file
   */
  async initializeFromConfig(): Promise<Record<string, MCPServerConfig>> {
    try {
      // Load configuration from mcp.json
      const fs = await import('fs/promises')
      const path = await import('path')
      
      const configPath = path.join(process.cwd(), 'mcp.json')
      const configData = await fs.readFile(configPath, 'utf-8')
      const config = JSON.parse(configData)
      
      const servers: Record<string, MCPServerConfig> = {}
      
      // Initialize enabled servers
      for (const [serverName, serverConfig] of Object.entries(config.mcpServers || {})) {
        const mcpConfig = serverConfig as any
        if (!mcpConfig.disabled) {
          const fullConfig: MCPServerConfig = {
            name: serverName,
            transport: mcpConfig.transport || 'stdio',
            command: mcpConfig.command,
            args: mcpConfig.args || [],
            env: mcpConfig.env || {},
            autoApprove: mcpConfig.autoApprove || [],
            disabled: mcpConfig.disabled || false,
            url: mcpConfig.url,
            timeout: mcpConfig.timeout,
            retryAttempts: mcpConfig.retryAttempts,
            retryDelay: mcpConfig.retryDelay
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

  /**
   * Shutdown all servers
   */
  async shutdown(): Promise<void> {
    const shutdownPromises = Array.from(this.servers.keys()).map(serverName => 
      this.shutdownServer(serverName)
    )
    await Promise.all(shutdownPromises)
    this.servers.clear()
  }
}