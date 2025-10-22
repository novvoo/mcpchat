// Tool Call Orchestrator - Manages the complete tool call workflow

import { ToolCall, ToolResult, ChatMessage, ChatResponse, Message } from '@/types'
import { getLLMService } from './llm-service'
import { getMCPToolsService } from './mcp-tools'
import { getConversationManager } from './conversation'

/**
 * Tool call orchestrator for managing the complete tool execution workflow
 */
export class ToolCallOrchestrator {
  private static instance: ToolCallOrchestrator

  private constructor() {}

  /**
   * Get singleton instance
   */
  public static getInstance(): ToolCallOrchestrator {
    if (!ToolCallOrchestrator.instance) {
      ToolCallOrchestrator.instance = new ToolCallOrchestrator()
    }
    return ToolCallOrchestrator.instance
  }

  /**
   * Process a user message that may trigger tool calls
   */
  async processMessage(
    userMessage: string,
    conversationId?: string,
    options: {
      enableTools?: boolean
      maxToolCalls?: number
      toolTimeout?: number
    } = {}
  ): Promise<{
    response: string
    toolCalls?: ToolCall[]
    toolResults?: ToolResult[]
    conversationId: string
  }> {
    const {
      enableTools = true,
      maxToolCalls = 5,
      toolTimeout = 30000
    } = options

    const conversationManager = getConversationManager()
    const llmService = getLLMService()
    
    // Ensure we have a conversation
    let activeConversationId = conversationId
    if (!activeConversationId) {
      activeConversationId = conversationManager.createConversation()
    }

    // Add user message to conversation
    const userMsg = conversationManager.createUserMessage(userMessage)
    conversationManager.addMessage(activeConversationId, userMsg)

    try {
      // Get conversation context for LLM
      const messages = conversationManager.getMessagesForLLM(activeConversationId)
      
      // Add tool definitions if tools are enabled
      if (enableTools) {
        await this.addToolDefinitionsToMessages(messages)
      }

      // Send to LLM
      let llmResponse = await llmService.sendMessage(messages)
      let toolCallCount = 0
      let allToolResults: ToolResult[] = []

      // Handle tool calls iteratively
      while (llmResponse.toolCalls && llmResponse.toolCalls.length > 0 && toolCallCount < maxToolCalls) {
        console.log(`Processing ${llmResponse.toolCalls.length} tool calls (iteration ${toolCallCount + 1})`)
        
        // Execute tool calls
        const toolResults = await this.executeToolCalls(llmResponse.toolCalls, toolTimeout)
        allToolResults.push(...toolResults)
        
        // Add assistant message with tool calls to conversation
        const assistantMsg = conversationManager.createAssistantMessage(
          llmResponse.content || 'Executing tools...',
          llmResponse.toolCalls
        )
        conversationManager.addMessage(activeConversationId, assistantMsg)

        // Add tool results as system messages
        for (const result of toolResults) {
          const toolResultMsg = conversationManager.createSystemMessage(
            `Tool ${result.toolCallId} result: ${JSON.stringify(result.result)}`
          )
          conversationManager.addMessage(activeConversationId, toolResultMsg)
        }

        // Get updated conversation context
        const updatedMessages = conversationManager.getMessagesForLLM(activeConversationId)
        
        // Send back to LLM with tool results
        llmResponse = await llmService.sendMessage(updatedMessages)
        toolCallCount++
      }

      // Add final assistant response to conversation
      const finalAssistantMsg = conversationManager.createAssistantMessage(llmResponse.content)
      conversationManager.addMessage(activeConversationId, finalAssistantMsg)

      return {
        response: llmResponse.content,
        toolCalls: llmResponse.toolCalls,
        toolResults: allToolResults.length > 0 ? allToolResults : undefined,
        conversationId: activeConversationId
      }

    } catch (error) {
      console.error('Error in tool call orchestration:', error)
      
      // Add error message to conversation
      const errorMsg = conversationManager.createSystemMessage(
        `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
      conversationManager.addMessage(activeConversationId, errorMsg)

      throw error
    }
  }

  /**
   * Execute multiple tool calls
   */
  private async executeToolCalls(toolCalls: ToolCall[], timeout: number): Promise<ToolResult[]> {
    const mcpToolsService = getMCPToolsService()
    const results: ToolResult[] = []

    // Execute tool calls in parallel for better performance
    const executionPromises = toolCalls.map(async (toolCall) => {
      try {
        const executionResult = await mcpToolsService.executeTool(
          toolCall.name,
          toolCall.parameters,
          {
            timeout,
            retryAttempts: 2,
            validateInput: true
          }
        )

        if (executionResult.success) {
          return {
            toolCallId: toolCall.id,
            result: executionResult.result
          }
        } else {
          return {
            toolCallId: toolCall.id,
            result: null,
            error: executionResult.error?.message || 'Tool execution failed'
          }
        }
      } catch (error) {
        return {
          toolCallId: toolCall.id,
          result: null,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    })

    const executionResults = await Promise.all(executionPromises)
    results.push(...executionResults)

    return results
  }

  /**
   * Add tool definitions to messages for LLM context
   */
  private async addToolDefinitionsToMessages(messages: ChatMessage[]): Promise<void> {
    try {
      const mcpToolsService = getMCPToolsService()
      const availableTools = await mcpToolsService.getAvailableTools()

      if (availableTools.length > 0) {
        // Add system message with tool definitions
        const toolDefinitions = availableTools.map(tool => ({
          name: tool.name,
          description: tool.description,
          parameters: tool.inputSchema
        }))

        const systemMessage: ChatMessage = {
          role: 'system',
          content: `You have access to the following tools. Use them when appropriate to help the user:

${JSON.stringify(toolDefinitions, null, 2)}

When you need to use a tool, respond with a tool call. The user will see the tool results and you can then provide a final response based on those results.`
        }

        // Insert at the beginning (after any existing system messages)
        const firstNonSystemIndex = messages.findIndex(msg => msg.role !== 'system')
        if (firstNonSystemIndex === -1) {
          messages.push(systemMessage)
        } else {
          messages.splice(firstNonSystemIndex, 0, systemMessage)
        }
      }
    } catch (error) {
      console.warn('Failed to add tool definitions to messages:', error)
      // Continue without tool definitions
    }
  }

  /**
   * Check if a message might trigger tool calls
   */
  async shouldEnableTools(message: string): Promise<boolean> {
    try {
      const mcpToolsService = getMCPToolsService()
      const availableTools = await mcpToolsService.getAvailableTools()
      
      if (availableTools.length === 0) {
        return false
      }

      // Simple heuristics to determine if tools might be useful
      const toolKeywords = [
        'solve', 'calculate', 'compute', 'run', 'execute', 'analyze',
        'queens', 'sudoku', 'puzzle', 'problem', 'optimization',
        'graph', 'algorithm', 'search', 'find'
      ]

      const messageLower = message.toLowerCase()
      return toolKeywords.some(keyword => messageLower.includes(keyword))
    } catch (error) {
      console.warn('Error checking if tools should be enabled:', error)
      return false
    }
  }

  /**
   * Get tool usage statistics
   */
  getToolUsageStats(): {
    totalToolCalls: number
    successfulCalls: number
    failedCalls: number
    averageExecutionTime: number
    mostUsedTools: Array<{ name: string; count: number }>
  } {
    const mcpToolsService = getMCPToolsService()
    const stats = mcpToolsService.getExecutionStats()
    
    return {
      totalToolCalls: stats.totalExecutions,
      successfulCalls: stats.successfulExecutions,
      failedCalls: stats.failedExecutions,
      averageExecutionTime: stats.averageExecutionTime,
      mostUsedTools: stats.mostUsedTools.map(tool => ({
        name: tool.toolName,
        count: tool.count
      }))
    }
  }

  /**
   * Validate tool call format
   */
  validateToolCall(toolCall: any): toolCall is ToolCall {
    return (
      typeof toolCall === 'object' &&
      toolCall !== null &&
      typeof toolCall.id === 'string' &&
      typeof toolCall.name === 'string' &&
      typeof toolCall.parameters === 'object'
    )
  }

  /**
   * Format tool result for display
   */
  formatToolResult(result: ToolResult): string {
    if (result.error) {
      return `❌ Tool execution failed: ${result.error}`
    }

    if (result.result && typeof result.result === 'object') {
      if (result.result.content && Array.isArray(result.result.content)) {
        // Handle MCP response format
        return result.result.content
          .map((item: any) => item.text || JSON.stringify(item))
          .join('\n')
      }
      return JSON.stringify(result.result, null, 2)
    }

    return String(result.result || 'No result')
  }

  /**
   * Create tool call from LLM response
   */
  createToolCall(id: string, name: string, parameters: Record<string, any>): ToolCall {
    return {
      id,
      name,
      parameters
    }
  }

  /**
   * Extract tool calls from LLM response
   */
  extractToolCalls(response: ChatResponse): ToolCall[] {
    return response.toolCalls || []
  }

  /**
   * Check if response contains tool calls
   */
  hasToolCalls(response: ChatResponse): boolean {
    return !!(response.toolCalls && response.toolCalls.length > 0)
  }
}

/**
 * Convenience function to get tool orchestrator instance
 */
export const getToolOrchestrator = () => ToolCallOrchestrator.getInstance()

/**
 * Convenience function to process a message with tool calls
 */
export const processMessageWithTools = async (
  message: string,
  conversationId?: string,
  options?: Parameters<ToolCallOrchestrator['processMessage']>[2]
) => {
  const orchestrator = getToolOrchestrator()
  return orchestrator.processMessage(message, conversationId, options)
}