// Server-side MCP Manager - Handles actual Node.js processes and MCP communication

import { spawn, ChildProcess } from 'child_process'
import { EventEmitter } from 'events'
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
        error: undefined
      }

      this.servers.set(serverName, serverInfo)

      // Start the MCP server process
      await this.startServerProcess(serverName)

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
   * Start the MCP server process
   */
  private async startServerProcess(serverName: string): Promise<void> {
    const serverInfo = this.servers.get(serverName)
    if (!serverInfo) {
      throw new Error(`Server ${serverName} not found`)
    }

    return new Promise((resolve, reject) => {
      try {
        const childProcess = spawn(serverInfo.config.command, serverInfo.config.args, {
          env: { ...process.env, ...serverInfo.config.env },
          stdio: ['pipe', 'pipe', 'pipe']
        })

        serverInfo.process = childProcess

        childProcess.on('error', (error: Error) => {
          serverInfo.status = 'error'
          serverInfo.error = `Process error: ${error.message}`
          reject(error)
        })

        childProcess.on('exit', (code: number | null, signal: string | null) => {
          serverInfo.status = 'disconnected'
          serverInfo.error = `Process exited with code ${code}, signal ${signal}`
          console.log(`MCP server ${serverName} exited`)
        })

        // Give the process a moment to start
        setTimeout(() => {
          if (childProcess && !childProcess.killed) {
            resolve()
          } else {
            reject(new Error('Process failed to start'))
          }
        }, 1000)
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

    // For now, simulate with default tools based on server name
    if (serverName === 'gurddy') {
      serverInfo.tools = [
        {
          name: 'run_example',
          description: 'Run an example computation',
          inputSchema: {
            type: 'object',
            properties: {
              example_type: { type: 'string', description: 'Type of example to run' }
            },
            required: ['example_type']
          }
        },
        {
          name: 'solve_n_queens',
          description: 'Solve the N-Queens problem',
          inputSchema: {
            type: 'object',
            properties: {
              n: { type: 'number', description: 'Size of the chessboard' }
            },
            required: ['n']
          }
        },
        {
          name: 'solve_sudoku',
          description: 'Solve a Sudoku puzzle',
          inputSchema: {
            type: 'object',
            properties: {
              puzzle: { type: 'array', description: 'Sudoku puzzle as 9x9 array' }
            },
            required: ['puzzle']
          }
        }
      ]
    } else {
      // Default tools for other servers
      serverInfo.tools = [
        {
          name: 'echo',
          description: 'Echo back the input',
          inputSchema: {
            type: 'object',
            properties: {
              message: { type: 'string', description: 'Message to echo' }
            },
            required: ['message']
          }
        }
      ]
    }
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

    // For now, simulate tool execution
    return this.simulateToolExecution(toolName, args)
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

      serverInfo.status = 'disconnected'
      serverInfo.process = null
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
            command: mcpConfig.command,
            args: mcpConfig.args || [],
            env: mcpConfig.env || {},
            autoApprove: mcpConfig.autoApprove || [],
            disabled: mcpConfig.disabled || false
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