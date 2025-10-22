// MCP Server Manager - Client-side interface for MCP operations

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
import { getClientConfigLoader } from './config-client'

/**
 * Client-side MCP Server Manager - communicates with server via API
 */
export class MCPServer implements MCPServerManager {
  private config: MCPServerConfig
  private status: ServerStatus
  private tools: Tool[] = []
  private lastPing: Date | null = null
  private metrics: MCPMetrics
  private eventListeners: MCPEventListener[] = []

  constructor(config: MCPServerConfig) {
    this.config = config
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
   * Initialize the MCP server via API
   */
  async initialize(): Promise<void> {
    try {
      this.status.status = 'initializing'
      this.emitEvent('server_connected', { config: this.config })

      // Initialize via API call to server
      const response = await fetch('/api/mcp/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serverName: this.config.name, config: this.config })
      })

      if (!response.ok) {
        throw new Error(`Failed to initialize server: ${response.statusText}`)
      }

      const result = await response.json()
      
      this.status.status = 'connected'
      this.status.lastPing = new Date()
      this.status.capabilities = result.capabilities
      this.lastPing = new Date()

      // Load available tools
      await this.loadTools()

      console.log(`MCP server ${this.config.name} initialized successfully`)
    } catch (error) {
      this.status.status = 'error'
      this.status.error = error instanceof Error ? error.message : 'Unknown error'
      this.emitEvent('server_error', { error: this.status.error })
      throw error
    }
  }



  /**
   * Load available tools from the server via API
   */
  private async loadTools(): Promise<void> {
    try {
      const response = await fetch(`/api/mcp/tools?server=${this.config.name}`)
      if (response.ok) {
        const data = await response.json()
        this.tools = data.tools || []
      }
    } catch (error) {
      console.error(`Failed to load tools for server ${this.config.name}:`, error)
      this.tools = []
    }
  }

  /**
   * Shutdown the MCP server via API
   */
  async shutdown(): Promise<void> {
    try {
      await fetch('/api/mcp/shutdown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serverName: this.config.name })
      })

      this.status.status = 'disconnected'
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
   * Call a tool on the MCP server via API
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

      this.emitEvent('tool_called', { toolName: name, args })

      const response = await fetch('/api/mcp/call-tool', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serverName: this.config.name,
          toolName: name,
          args
        })
      })

      if (!response.ok) {
        throw new Error(`Tool call failed: ${response.statusText}`)
      }

      const result = await response.json()

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
    this.eventListeners.push(listener)
  }

  /**
   * Remove event listener
   */
  removeEventListener(listener: MCPEventListener): void {
    const index = this.eventListeners.indexOf(listener)
    if (index > -1) {
      this.eventListeners.splice(index, 1)
    }
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
    this.eventListeners.forEach(listener => listener(event))
  }

  // Placeholder methods for future implementation
  async listResources() { return [] }
  async listPrompts() { return [] }
}

/**
 * Client-side MCP Server Registry implementation
 */
export class MCPRegistry implements MCPServerRegistry {
  public servers: Map<string, MCPServerManager> = new Map()
  private eventListeners: MCPEventListener[] = []

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
   * Initialize MCP manager with configuration via API
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return
    }

    try {
      // Load configuration via client config loader
      const configLoader = getClientConfigLoader()
      await configLoader.loadConfig()
      
      const serverConfigs = configLoader.getAllMCPServerConfigs()
      const enabledServers = configLoader.getEnabledServers()

      // Initialize via API call to server
      const response = await fetch('/api/mcp/initialize-manager', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })

      if (!response.ok) {
        throw new Error(`Failed to initialize MCP Manager: ${response.statusText}`)
      }

      // Register enabled servers
      for (const serverName of enabledServers) {
        const config = serverConfigs[serverName]
        if (config) {
          const server = new MCPServer(config)
          this.registry.servers.set(serverName, server)
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