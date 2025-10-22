// MCP Tools Service - High-level interface for tool execution

import { Tool } from '@/types'
import { MCPCallToolResponse, MCPToolExecutionContext, MCPToolExecutionResult } from '@/types/mcp'
import { getMCPManager } from './mcp-manager'
import { getConfigLoader } from './config'
import { validateMCPExecuteRequest } from '@/types/validation'
import { ERROR_CODES } from '@/types/constants'

/**
 * MCP Tools Service for high-level tool operations
 */
export class MCPToolsService {
  private static instance: MCPToolsService
  private executionHistory: MCPToolExecutionResult[] = []
  private readonly MAX_HISTORY_SIZE = 100

  private constructor() {}

  /**
   * Get singleton instance
   */
  public static getInstance(): MCPToolsService {
    if (!MCPToolsService.instance) {
      MCPToolsService.instance = new MCPToolsService()
    }
    return MCPToolsService.instance
  }

  /**
   * Get all available tools from all connected servers
   */
  async getAvailableTools(): Promise<Tool[]> {
    try {
      const mcpManager = getMCPManager()
      const tools = await mcpManager.listTools()
      
      // Add server information to tools
      const enrichedTools: Tool[] = []
      const registry = mcpManager.getRegistry()
      
      for (const tool of tools) {
        // Find which server provides this tool
        let serverName = 'unknown'
        for (const [name, server] of registry.servers) {
          if (server.isConnected()) {
            try {
              const serverTools = await server.listTools()
              if (serverTools.some(t => t.name === tool.name)) {
                serverName = name
                break
              }
            } catch (error) {
              // Continue checking other servers
            }
          }
        }
        
        enrichedTools.push({
          ...tool,
          // Add server metadata
          description: `${tool.description} (Server: ${serverName})`
        })
      }
      
      return enrichedTools
    } catch (error) {
      console.error('Error getting available tools:', error)
      throw new Error(`Failed to get available tools: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Execute a tool with comprehensive error handling and logging
   */
  async executeTool(
    toolName: string, 
    parameters: Record<string, any>,
    options: {
      timeout?: number
      retryAttempts?: number
      validateInput?: boolean
    } = {}
  ): Promise<MCPToolExecutionResult> {
    const {
      timeout = 30000,
      retryAttempts = 1,
      validateInput = true
    } = options

    const context: MCPToolExecutionContext = {
      toolName,
      parameters,
      serverId: 'unknown',
      requestId: this.generateRequestId(),
      timestamp: new Date(),
      timeout
    }

    const startTime = Date.now()

    try {
      // Validate input if requested
      if (validateInput) {
        const validation = validateMCPExecuteRequest({ toolName, parameters })
        if (!validation.isValid) {
          throw new Error(`Invalid tool execution request: ${validation.errors?.map(e => e.message).join(', ')}`)
        }
      }

      // Check if tool is available and auto-approved
      await this.validateToolExecution(toolName)

      // Find the server that provides this tool
      const serverId = await this.findToolServer(toolName)
      context.serverId = serverId

      // Execute tool with retry logic
      let lastError: Error | null = null
      for (let attempt = 1; attempt <= retryAttempts; attempt++) {
        try {
          const result = await this.executeWithTimeout(toolName, parameters, timeout)
          
          const executionResult: MCPToolExecutionResult = {
            success: true,
            result: result,
            executionTime: Date.now() - startTime,
            context
          }

          this.addToHistory(executionResult)
          return executionResult
        } catch (error) {
          lastError = error instanceof Error ? error : new Error('Unknown error')
          
          if (attempt < retryAttempts) {
            console.warn(`Tool execution attempt ${attempt} failed, retrying...`, error)
            // Wait before retry (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000))
          }
        }
      }

      // All attempts failed
      throw lastError || new Error('Tool execution failed after all retry attempts')

    } catch (error) {
      const executionResult: MCPToolExecutionResult = {
        success: false,
        error: {
          code: this.getErrorCode(error),
          message: error instanceof Error ? error.message : 'Unknown error',
          data: { toolName, parameters }
        },
        executionTime: Date.now() - startTime,
        context
      }

      this.addToHistory(executionResult)
      throw error
    }
  }

  /**
   * Execute tool with timeout
   */
  private async executeWithTimeout(
    toolName: string, 
    parameters: Record<string, any>, 
    timeout: number
  ): Promise<MCPCallToolResponse> {
    const mcpManager = getMCPManager()
    
    return Promise.race([
      mcpManager.executeTool(toolName, parameters),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Tool execution timeout after ${timeout}ms`)), timeout)
      })
    ])
  }

  /**
   * Validate that a tool can be executed
   */
  private async validateToolExecution(toolName: string): Promise<void> {
    // Check if any server has this tool
    const tools = await this.getAvailableTools()
    const tool = tools.find(t => t.name === toolName)
    
    if (!tool) {
      throw new Error(`Tool '${toolName}' is not available on any connected server`)
    }

    // Check if tool is auto-approved on at least one server
    const configLoader = getConfigLoader()
    const serverConfigs = configLoader.getAllMCPServerConfigs()
    
    let isAutoApproved = false
    for (const [serverName, config] of Object.entries(serverConfigs)) {
      if (config.autoApprove.includes(toolName)) {
        isAutoApproved = true
        break
      }
    }

    if (!isAutoApproved) {
      throw new Error(`Tool '${toolName}' is not auto-approved on any server`)
    }
  }

  /**
   * Find which server provides a specific tool
   */
  private async findToolServer(toolName: string): Promise<string> {
    const mcpManager = getMCPManager()
    const registry = mcpManager.getRegistry()
    
    for (const [serverName, server] of registry.servers) {
      if (server.isConnected()) {
        try {
          const tools = await server.listTools()
          if (tools.some(tool => tool.name === toolName)) {
            return serverName
          }
        } catch (error) {
          // Continue checking other servers
        }
      }
    }
    
    throw new Error(`No connected server found for tool '${toolName}'`)
  }

  /**
   * Get error code based on error type
   */
  private getErrorCode(error: any): number {
    if (error instanceof Error) {
      if (error.message.includes('timeout')) {
        return -32603 // Internal error
      } else if (error.message.includes('not found')) {
        return -32601 // Method not found
      } else if (error.message.includes('not approved')) {
        return -32602 // Invalid params
      }
    }
    return -32603 // Internal error
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Add execution result to history
   */
  private addToHistory(result: MCPToolExecutionResult): void {
    this.executionHistory.unshift(result)
    
    // Keep history size manageable
    if (this.executionHistory.length > this.MAX_HISTORY_SIZE) {
      this.executionHistory = this.executionHistory.slice(0, this.MAX_HISTORY_SIZE)
    }
  }

  /**
   * Get execution history
   */
  getExecutionHistory(limit?: number): MCPToolExecutionResult[] {
    if (limit) {
      return this.executionHistory.slice(0, limit)
    }
    return [...this.executionHistory]
  }

  /**
   * Get execution statistics
   */
  getExecutionStats(): {
    totalExecutions: number
    successfulExecutions: number
    failedExecutions: number
    successRate: number
    averageExecutionTime: number
    mostUsedTools: Array<{ toolName: string; count: number }>
  } {
    const total = this.executionHistory.length
    const successful = this.executionHistory.filter(r => r.success).length
    const failed = total - successful
    const successRate = total > 0 ? (successful / total) * 100 : 0
    
    const totalTime = this.executionHistory.reduce((sum, r) => sum + r.executionTime, 0)
    const averageExecutionTime = total > 0 ? totalTime / total : 0
    
    // Count tool usage
    const toolCounts = new Map<string, number>()
    for (const result of this.executionHistory) {
      const toolName = result.context.toolName
      toolCounts.set(toolName, (toolCounts.get(toolName) || 0) + 1)
    }
    
    const mostUsedTools = Array.from(toolCounts.entries())
      .map(([toolName, count]) => ({ toolName, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
    
    return {
      totalExecutions: total,
      successfulExecutions: successful,
      failedExecutions: failed,
      successRate,
      averageExecutionTime,
      mostUsedTools
    }
  }

  /**
   * Clear execution history
   */
  clearHistory(): void {
    this.executionHistory = []
  }

  /**
   * Get tool by name with detailed information
   */
  async getToolInfo(toolName: string): Promise<Tool | null> {
    try {
      const tools = await this.getAvailableTools()
      return tools.find(tool => tool.name === toolName) || null
    } catch (error) {
      console.error(`Error getting tool info for ${toolName}:`, error)
      return null
    }
  }

  /**
   * Check if a tool is available and executable
   */
  async isToolAvailable(toolName: string): Promise<boolean> {
    try {
      await this.validateToolExecution(toolName)
      return true
    } catch (error) {
      return false
    }
  }

  /**
   * Get tools grouped by server
   */
  async getToolsByServer(): Promise<Record<string, Tool[]>> {
    const mcpManager = getMCPManager()
    const registry = mcpManager.getRegistry()
    const toolsByServer: Record<string, Tool[]> = {}
    
    for (const [serverName, server] of registry.servers) {
      if (server.isConnected()) {
        try {
          const tools = await server.listTools()
          toolsByServer[serverName] = tools
        } catch (error) {
          console.error(`Error getting tools from server ${serverName}:`, error)
          toolsByServer[serverName] = []
        }
      } else {
        toolsByServer[serverName] = []
      }
    }
    
    return toolsByServer
  }
}

/**
 * Convenience function to get MCP tools service instance
 */
export const getMCPToolsService = () => MCPToolsService.getInstance()

/**
 * Convenience function to execute a tool
 */
export const executeMCPTool = async (
  toolName: string, 
  parameters: Record<string, any>,
  options?: Parameters<MCPToolsService['executeTool']>[2]
): Promise<MCPToolExecutionResult> => {
  const service = getMCPToolsService()
  return service.executeTool(toolName, parameters, options)
}