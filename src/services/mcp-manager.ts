// MCP Server Manager - Handles MCP server lifecycle and operations

import { MCPServerConfig, Tool } from '@/types'
import { 
  ServerStatus,
  MCPServerManager,
  MCPServerRegistry,
  MCPEvent,
  MCPEventListener,
  MCPEventType,
  MCPCallToolResponse,
  MCPMetrics
} from '@/types/mcp'
import { getConfigLoader } from './config'
import { spawn, ChildProcess } from 'child_process'
import { EventEmitter } from 'events'

/**
 * Individual MCP Server Manager implementation
 */
export class MCPServer implements MCPServerManager {
  private config: MCPServerConfig
  private process: ChildProcess | null = null
  private status: ServerStatus
  private eventEmitter: EventEmitter
  private tools: Tool[] = []
  private lastPing: Date | null = null
  private metrics: MCPMetrics

  constructor(config: MCPServerConfig) {
    this.config = config
    this.eventEmitter = new EventEmitter()
    this.status = {
      name: config.name,
      status: 'disconnected',
      lastPing: undefined,
      error: undefined,
      capabilities: undefined
    }
    this.metrics = {
      toolCallCount: 0,
      toolCallSuccessRate: 0,
      averageExecutionTime: 0,
      errorCount: 0,
      connectionUptime: 0,
      lastActivity: new Date()
    }
  }

  /**
   * Initialize the MCP server
   */
  async initialize(): Promise<void> {
    try {
      this.status.status = 'initializing'
      this.emitEvent('server_connected', { config: this.config })

      // Spawn the MCP server process
      await this.startProcess()

      // Initialize MCP protocol
      await this.initializeProtocol()

      // Load available tools
      await this.loadTools()

      this.status.status = 'connected'
      this.status.lastPing = new Date()
      this.lastPing = new Date()

      console.log(`MCP server ${this.config.name} initialized successfully`)
    } catch (error) {
      this.status.status = 'error'
      this.status.error = error instanceof Error ? error.message : 'Unknown error'
      this.emitEvent('server_error', { error: this.status.error })
      throw error
    }
  }

  /**
   * Start the MCP server process
   */
  private async startProcess(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.process = spawn(this.config.command, this.config.args, {
          env: { ...process.env, ...this.config.env },
          stdio: ['pipe', 'pipe', 'pipe']
        })

        this.process.on('error', (error) => {
          this.status.status = 'error'
          this.status.error = `Process error: ${error.message}`
          reject(error)
        })

        this.process.on('exit', (code, signal) => {
          this.status.status = 'disconnected'
          this.status.error = `Process exited with code ${code}, signal ${signal}`
          this.emitEvent('server_disconnected', { code, signal })
        })

        // Give the process a moment to start
        setTimeout(() => {
          if (this.process && !this.process.killed) {
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
   * Initialize MCP protocol communication
   */
  private async initializeProtocol(): Promise<void> {
    // In a real implementation, this would establish JSON-RPC communication
    // For now, we'll simulate the protocol initialization
    
    const initRequest = {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: { listChanged: true },
          resources: { subscribe: true, listChanged: true },
          prompts: { listChanged: true },
          logging: {}
        },
        clientInfo: {
          name: 'mcpchat-client',
          version: '0.1.0'
        }
      }
    }

    // Simulate successful initialization
    this.status.capabilities = {
      tools: { listChanged: true },
      resources: { subscribe: true, listChanged: true },
      prompts: { listChanged: true },
      logging: {}
    }
  }

  /**
   * Load available tools from the server
   */
  private async loadTools(): Promise<void> {
    // In a real implementation, this would send a tools/list request
    // For now, we'll simulate with default tools based on the gurddy server
    
    if (this.config.name === 'gurddy') {
      this.tools = [
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
        // Add more tools as needed
      ]
    }
  }

  /**
   * Shutdown the MCP server
   */
  async shutdown(): Promise<void> {
    try {
      if (this.process && !this.process.killed) {
        this.process.kill('SIGTERM')
        
        // Wait for graceful shutdown or force kill after timeout
        await new Promise<void>((resolve) => {
          const timeout = setTimeout(() => {
            if (this.process && !this.process.killed) {
              this.process.kill('SIGKILL')
            }
            resolve()
          }, 5000)

          this.process?.on('exit', () => {
            clearTimeout(timeout)
            resolve()
          })
        })
      }

      this.status.status = 'disconnected'
      this.process = null
      this.emitEvent('server_disconnected', {})
    } catch (error) {
      console.error(`Error shutting down MCP server ${this.config.name}:`, error)
    }
  }

  /**
   * List available tools
   */
  async listTools(): Promise<Tool[]> {
    if (this.status.status !== 'connected') {
      throw new Error(`Server ${this.config.name} is not connected`)
    }
    return [...this.tools]
  }

  /**
   * Call a tool on the MCP server
   */
  async callTool(name: string, args: Record<string, any>): Promise<MCPCallToolResponse> {
    const startTime = Date.now()
    
    try {
      if (this.status.status !== 'connected') {
        throw new Error(`Server ${this.config.name} is not connected`)
      }

      // Check if tool exists
      const tool = this.tools.find(t => t.name === name)
      if (!tool) {
        throw new Error(`Tool ${name} not found on server ${this.config.name}`)
      }

      // Check if tool is auto-approved
      if (!this.config.autoApprove.includes(name)) {
        throw new Error(`Tool ${name} is not auto-approved for server ${this.config.name}`)
      }

      this.emitEvent('tool_called', { toolName: name, args })

      // In a real implementation, this would send a tools/call request
      // For now, we'll simulate tool execution
      const result = await this.simulateToolExecution(name, args)

      const executionTime = Date.now() - startTime
      this.updateMetrics(true, executionTime)
      this.emitEvent('tool_completed', { toolName: name, result, executionTime })

      return result
    } catch (error) {
      const executionTime = Date.now() - startTime
      this.updateMetrics(false, executionTime)
      this.emitEvent('tool_failed', { toolName: name, error: error instanceof Error ? error.message : 'Unknown error' })
      throw error
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
   * Update server metrics
   */
  private updateMetrics(success: boolean, executionTime: number): void {
    this.metrics.toolCallCount++
    this.metrics.lastActivity = new Date()
    
    if (!success) {
      this.metrics.errorCount++
    }
    
    // Update success rate
    this.metrics.toolCallSuccessRate = 
      ((this.metrics.toolCallCount - this.metrics.errorCount) / this.metrics.toolCallCount) * 100
    
    // Update average execution time
    this.metrics.averageExecutionTime = 
      (this.metrics.averageExecutionTime + executionTime) / 2
  }

  /**
   * Get server status
   */
  getStatus(): ServerStatus {
    return { ...this.status }
  }

  /**
   * Check if server is connected
   */
  isConnected(): boolean {
    return this.status.status === 'connected'
  }

  /**
   * Get server metrics
   */
  getMetrics(): MCPMetrics {
    return { ...this.metrics }
  }

  /**
   * Add event listener
   */
  addEventListener(listener: MCPEventListener): void {
    this.eventEmitter.on('mcp_event', listener)
  }

  /**
   * Remove event listener
   */
  removeEventListener(listener: MCPEventListener): void {
    this.eventEmitter.off('mcp_event', listener)
  }

  /**
   * Emit MCP event
   */
  private emitEvent(type: MCPEventType, data?: any): void {
    const event: MCPEvent = {
      type,
      serverId: this.config.name,
      timestamp: new Date(),
      data
    }
    this.eventEmitter.emit('mcp_event', event)
  }

  // Placeholder methods for future implementation
  async listResources() { return [] }
  async listPrompts() { return [] }
}

/**
 * MCP Server Registry implementation
 */
export class MCPRegistry implements MCPServerRegistry {
  public servers: Map<string, MCPServerManager> = new Map()
  private eventEmitter: EventEmitter = new EventEmitter()

  /**
   * Register a new MCP server
   */
  async register(name: string, config: MCPServerConfig): Promise<void> {
    try {
      if (this.servers.has(name)) {
        throw new Error(`Server ${name} is already registered`)
      }

      const server = new MCPServer(config)
      await server.initialize()
      
      this.servers.set(name, server)
      console.log(`MCP server ${name} registered successfully`)
    } catch (error) {
      console.error(`Failed to register MCP server ${name}:`, error)
      throw error
    }
  }

  /**
   * Unregister an MCP server
   */
  async unregister(name: string): Promise<void> {
    const server = this.servers.get(name)
    if (server) {
      await server.shutdown()
      this.servers.delete(name)
      console.log(`MCP server ${name} unregistered`)
    }
  }

  /**
   * Get MCP server by name
   */
  get(name: string): MCPServerManager | undefined {
    return this.servers.get(name)
  }

  /**
   * List all registered server names
   */
  list(): string[] {
    return Array.from(this.servers.keys())
  }

  /**
   * Get status of all servers
   */
  getStatus(): Record<string, ServerStatus> {
    const status: Record<string, ServerStatus> = {}
    for (const [name, server] of this.servers) {
      status[name] = server.getStatus()
    }
    return status
  }

  /**
   * Shutdown all servers
   */
  async shutdown(): Promise<void> {
    const shutdownPromises = Array.from(this.servers.values()).map(server => server.shutdown())
    await Promise.all(shutdownPromises)
    this.servers.clear()
  }
}

/**
 * Global MCP Manager - Singleton for managing all MCP servers
 */
export class MCPManager {
  private static instance: MCPManager
  private registry: MCPRegistry
  private initialized: boolean = false

  private constructor() {
    this.registry = new MCPRegistry()
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): MCPManager {
    if (!MCPManager.instance) {
      MCPManager.instance = new MCPManager()
    }
    return MCPManager.instance
  }

  /**
   * Initialize MCP manager with configuration
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return
    }

    try {
      const configLoader = getConfigLoader()
      await configLoader.loadConfig()
      
      const serverConfigs = configLoader.getAllMCPServerConfigs()
      const enabledServers = configLoader.getEnabledServers()

      // Register enabled servers
      for (const serverName of enabledServers) {
        const config = serverConfigs[serverName]
        if (config) {
          await this.registry.register(serverName, config)
        }
      }

      this.initialized = true
      console.log('MCP Manager initialized successfully')
    } catch (error) {
      console.error('Failed to initialize MCP Manager:', error)
      throw error
    }
  }

  /**
   * Get list of available tools from all servers
   */
  async listTools(): Promise<Tool[]> {
    const allTools: Tool[] = []
    
    for (const server of this.registry.servers.values()) {
      if (server.isConnected()) {
        try {
          const tools = await server.listTools()
          allTools.push(...tools)
        } catch (error) {
          console.error('Error listing tools from server:', error)
        }
      }
    }
    
    return allTools
  }

  /**
   * Execute a tool on the appropriate server
   */
  async executeTool(name: string, params: Record<string, any>): Promise<any> {
    // Find which server has this tool
    for (const [serverName, server] of this.registry.servers) {
      if (server.isConnected()) {
        try {
          const tools = await server.listTools()
          if (tools.some(tool => tool.name === name)) {
            const result = await server.callTool(name, params)
            return result
          }
        } catch (error) {
          console.error(`Error executing tool ${name} on server ${serverName}:`, error)
        }
      }
    }
    
    throw new Error(`Tool ${name} not found on any connected server`)
  }

  /**
   * Get server status for all servers
   */
  getServerStatus(): Record<string, ServerStatus> {
    return this.registry.getStatus()
  }

  /**
   * Get registry instance
   */
  getRegistry(): MCPServerRegistry {
    return this.registry
  }

  /**
   * Shutdown MCP manager
   */
  async shutdown(): Promise<void> {
    await this.registry.shutdown()
    this.initialized = false
  }
}

/**
 * Convenience function to get MCP manager instance
 */
export const getMCPManager = () => MCPManager.getInstance()