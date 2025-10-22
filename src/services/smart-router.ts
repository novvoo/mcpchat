// Smart Router - 智能路由服务，决定是否使用MCP还是LLM

import { ChatMessage, ChatResponse, ToolCall, ToolResult } from '@/types'
import { getMCPIntentRecognizer } from './mcp-intent-recognizer'
import { getMCPToolsService } from './mcp-tools'
import { getLLMService } from './llm-service'
import { getConversationManager } from './conversation'
import { getMCPInitializer, isMCPSystemReady } from './mcp-initializer'

/**
 * 智能路由响应接口
 */
export interface SmartRouterResponse {
  response: string
  source: 'mcp' | 'llm' | 'hybrid'
  toolCalls?: ToolCall[]
  toolResults?: ToolResult[]
  conversationId: string
  confidence?: number
  reasoning?: string
}

/**
 * 智能路由服务 - 根据用户输入智能选择处理方式
 */
export class SmartRouter {
  private static instance: SmartRouter

  private constructor() {}

  public static getInstance(): SmartRouter {
    if (!SmartRouter.instance) {
      SmartRouter.instance = new SmartRouter()
    }
    return SmartRouter.instance
  }

  /**
   * 智能处理用户消息 - 完整流程
   * 
   * 流程步骤：
   * 1. 初始化MCP配置和工具信息
   * 2. 动态初始化工具关键词映射
   * 3. 用户输入识别 - 判断是否匹配MCP工具
   * 4. 如果匹配MCP工具：
   *    a. 将用户prompt转换为MCP规定格式
   *    b. 调用MCP工具执行
   *    c. 整理MCP返回结果并输出
   * 5. 如果不匹配MCP工具：
   *    a. 调用LLM处理
   *    b. 如果LLM返回工具调用，再执行MCP工具
   *    c. 整理最终结果输出
   */
  async processMessage(
    userMessage: string,
    conversationId?: string,
    options: {
      enableMCPFirst?: boolean
      enableLLMFallback?: boolean
      mcpConfidenceThreshold?: number
      maxToolCalls?: number
    } = {}
  ): Promise<SmartRouterResponse> {
    const {
      enableMCPFirst = true,
      enableLLMFallback = true,
      mcpConfidenceThreshold = 0.6,
      maxToolCalls = 5
    } = options

    const conversationManager = getConversationManager()
    
    // 确保有会话ID并且会话存在
    let activeConversationId = conversationId
    if (!activeConversationId) {
      activeConversationId = conversationManager.createConversation()
    } else {
      // 检查会话是否存在，如果不存在则创建
      const existingConversation = conversationManager.getConversation(activeConversationId)
      if (!existingConversation) {
        console.log(`Conversation ${activeConversationId} not found, creating new one`)
        activeConversationId = conversationManager.createConversation(activeConversationId)
      }
    }

    // 添加用户消息到会话
    const userMsg = conversationManager.createUserMessage(userMessage)
    conversationManager.addMessage(activeConversationId, userMsg)

    console.log(`Processing message: "${userMessage.substring(0, 100)}..."`)

    try {
      // 第0步：确保MCP系统已初始化
      await this.ensureMCPSystemReady()

      // 第一步：MCP意图识别
      if (enableMCPFirst) {
        const intentRecognizer = getMCPIntentRecognizer()
        const intent = await intentRecognizer.recognizeIntent(userMessage)
        
        console.log(`MCP Intent Recognition:`, {
          shouldUseMCP: intent.shouldUseMCP,
          confidence: intent.confidence,
          matchedTool: intent.matchedTool,
          reasoning: intent.reasoning
        })

        // 如果置信度足够高，直接使用MCP
        if (intent.shouldUseMCP && intent.confidence >= mcpConfidenceThreshold && intent.matchedTool) {
          console.log(`Using MCP directly: ${intent.matchedTool}`)
          
          try {
            const mcpResponse = await this.executeMCPTool(
              intent.matchedTool,
              intent.extractedParams || {},
              activeConversationId
            )

            return {
              response: mcpResponse.response,
              source: 'mcp',
              toolResults: mcpResponse.toolResults,
              conversationId: activeConversationId,
              confidence: intent.confidence,
              reasoning: `Direct MCP execution: ${intent.reasoning}`
            }
          } catch (error) {
            console.error('MCP direct execution failed:', error)
            
            // 如果MCP执行失败，根据配置决定是否回退到LLM
            if (!enableLLMFallback) {
              throw error
            }
            
            console.log('Falling back to LLM due to MCP execution failure')
          }
        }
      }

      // 第二步：使用LLM处理
      if (enableLLMFallback) {
        console.log('Using LLM for processing')
        
        const llmResponse = await this.processWithLLM(
          userMessage,
          activeConversationId,
          maxToolCalls
        )

        return {
          response: llmResponse.response,
          source: llmResponse.toolResults && llmResponse.toolResults.length > 0 ? 'hybrid' : 'llm',
          toolCalls: llmResponse.toolCalls,
          toolResults: llmResponse.toolResults,
          conversationId: activeConversationId,
          reasoning: 'Processed via LLM' + (llmResponse.toolResults ? ' with tool calls' : '')
        }
      }

      // 如果两种方式都不可用
      throw new Error('No processing method available')

    } catch (error) {
      console.error('Error in smart router:', error)
      
      // 添加错误消息到会话
      const errorMsg = conversationManager.createSystemMessage(
        `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
      conversationManager.addMessage(activeConversationId, errorMsg)

      throw error
    }
  }

  /**
   * 直接执行MCP工具
   */
  private async executeMCPTool(
    toolName: string,
    params: Record<string, any>,
    conversationId: string
  ): Promise<{
    response: string
    toolResults: ToolResult[]
  }> {
    const mcpToolsService = getMCPToolsService()
    const conversationManager = getConversationManager()

    // 确保会话存在
    const existingConversation = conversationManager.getConversation(conversationId)
    if (!existingConversation) {
      console.log(`Conversation ${conversationId} not found in executeMCPTool, creating new one`)
      conversationManager.createConversation(conversationId)
    }

    console.log(`Executing MCP tool: ${toolName}`, params)

    try {
      const executionResult = await mcpToolsService.executeTool(
        toolName,
        params,
        {
          timeout: 30000,
          retryAttempts: 2,
          validateInput: true
        }
      )

      const toolResult: ToolResult = {
        toolCallId: `direct_${Date.now()}`,
        result: executionResult.success ? executionResult.result : null,
        error: executionResult.success ? undefined : executionResult.error?.message
      }

      // 添加工具执行结果到会话
      const toolResultMsg = conversationManager.createSystemMessage(
        `MCP Tool ${toolName} executed: ${JSON.stringify(toolResult.result)}`
      )
      conversationManager.addMessage(conversationId, toolResultMsg)

      // 格式化响应
      let response = ''
      if (executionResult.success && executionResult.result) {
        response = this.formatMCPResult(toolName, executionResult.result, params)
      } else {
        response = `工具执行失败: ${executionResult.error?.message || '未知错误'}`
      }

      // 添加助手响应到会话
      const assistantMsg = conversationManager.createAssistantMessage(response)
      conversationManager.addMessage(conversationId, assistantMsg)

      return {
        response,
        toolResults: [toolResult]
      }

    } catch (error) {
      console.error(`Error executing MCP tool ${toolName}:`, error)
      throw error
    }
  }

  /**
   * 使用LLM处理消息（包含可能的工具调用）
   */
  private async processWithLLM(
    userMessage: string,
    conversationId: string,
    maxToolCalls: number
  ): Promise<{
    response: string
    toolCalls?: ToolCall[]
    toolResults?: ToolResult[]
  }> {
    const llmService = getLLMService()
    const mcpToolsService = getMCPToolsService()
    const conversationManager = getConversationManager()

    // 确保会话存在
    const existingConversation = conversationManager.getConversation(conversationId)
    if (!existingConversation) {
      console.log(`Conversation ${conversationId} not found in processWithLLM, creating new one`)
      conversationManager.createConversation(conversationId)
    }

    // 获取会话上下文
    const messages = conversationManager.getMessagesForLLM(conversationId)
    
    // 添加工具定义
    await this.addToolDefinitionsToMessages(messages)

    // 发送到LLM
    let llmResponse = await llmService.sendMessage(messages)
    let toolCallCount = 0
    let allToolResults: ToolResult[] = []

    // 处理工具调用
    while (llmResponse.toolCalls && llmResponse.toolCalls.length > 0 && toolCallCount < maxToolCalls) {
      console.log(`Processing ${llmResponse.toolCalls.length} tool calls from LLM (iteration ${toolCallCount + 1})`)
      
      // 执行工具调用
      const toolResults = await this.executeToolCallsFromLLM(llmResponse.toolCalls)
      allToolResults.push(...toolResults)
      
      // 添加助手消息和工具结果到会话
      const assistantMsg = conversationManager.createAssistantMessage(
        llmResponse.content || 'Executing tools...',
        llmResponse.toolCalls
      )
      conversationManager.addMessage(conversationId, assistantMsg)

      for (const result of toolResults) {
        const toolResultMsg = conversationManager.createSystemMessage(
          `Tool ${result.toolCallId} result: ${JSON.stringify(result.result)}`
        )
        conversationManager.addMessage(conversationId, toolResultMsg)
      }

      // 获取更新的会话上下文并再次发送到LLM
      const updatedMessages = conversationManager.getMessagesForLLM(conversationId)
      llmResponse = await llmService.sendMessage(updatedMessages)
      toolCallCount++
    }

    // 添加最终响应到会话
    const finalAssistantMsg = conversationManager.createAssistantMessage(llmResponse.content)
    conversationManager.addMessage(conversationId, finalAssistantMsg)

    return {
      response: llmResponse.content,
      toolCalls: llmResponse.toolCalls,
      toolResults: allToolResults.length > 0 ? allToolResults : undefined
    }
  }

  /**
   * 执行来自LLM的工具调用
   */
  private async executeToolCallsFromLLM(toolCalls: ToolCall[]): Promise<ToolResult[]> {
    const mcpToolsService = getMCPToolsService()
    const results: ToolResult[] = []

    // 并行执行工具调用
    const executionPromises = toolCalls.map(async (toolCall) => {
      try {
        const executionResult = await mcpToolsService.executeTool(
          toolCall.name,
          toolCall.parameters,
          {
            timeout: 30000,
            retryAttempts: 2,
            validateInput: true
          }
        )

        return {
          toolCallId: toolCall.id,
          result: executionResult.success ? executionResult.result : null,
          error: executionResult.success ? undefined : executionResult.error?.message
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
   * 添加工具定义到消息中
   */
  private async addToolDefinitionsToMessages(messages: ChatMessage[]): Promise<void> {
    try {
      const mcpToolsService = getMCPToolsService()
      const availableTools = await mcpToolsService.getAvailableTools()

      if (availableTools.length > 0) {
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

        // 插入到系统消息之后
        const firstNonSystemIndex = messages.findIndex(msg => msg.role !== 'system')
        if (firstNonSystemIndex === -1) {
          messages.push(systemMessage)
        } else {
          messages.splice(firstNonSystemIndex, 0, systemMessage)
        }
      }
    } catch (error) {
      console.warn('Failed to add tool definitions to messages:', error)
    }
  }

  /**
   * 格式化MCP工具执行结果
   */
  private formatMCPResult(toolName: string, result: any, params: Record<string, any>): string {
    try {
      // 处理MCP标准响应格式
      if (result && result.content && Array.isArray(result.content)) {
        const textContent = result.content
          .filter((item: any) => item.type === 'text')
          .map((item: any) => item.text)
          .join('\n')
        
        if (textContent) {
          return this.addContextToResult(toolName, textContent, params)
        }
      }

      // 处理简单字符串结果
      if (typeof result === 'string') {
        return this.addContextToResult(toolName, result, params)
      }

      // 处理对象结果
      if (typeof result === 'object') {
        const formattedResult = JSON.stringify(result, null, 2)
        return this.addContextToResult(toolName, formattedResult, params)
      }

      return this.addContextToResult(toolName, String(result), params)
    } catch (error) {
      console.error('Error formatting MCP result:', error)
      return `工具 ${toolName} 执行完成，但结果格式化失败。`
    }
  }

  /**
   * 为结果添加上下文信息
   */
  private addContextToResult(toolName: string, result: string, params: Record<string, any>): string {
    const contextMap: Record<string, string> = {
      'solve_n_queens': `N皇后问题求解结果 (N=${params.n || 8}):\n${result}`,
      'solve_sudoku': `数独求解结果:\n${result}`,
      'run_example': `示例运行结果 (类型: ${params.example_type || 'basic'}):\n${result}`,
      'echo': `回显结果:\n${result}`
    }

    return contextMap[toolName] || `${toolName} 执行结果:\n${result}`
  }

  /**
   * 获取路由统计信息
   */
  getRoutingStats(): {
    totalRequests: number
    mcpDirectRequests: number
    llmRequests: number
    hybridRequests: number
    averageConfidence: number
  } {
    // 这里可以实现统计逻辑
    return {
      totalRequests: 0,
      mcpDirectRequests: 0,
      llmRequests: 0,
      hybridRequests: 0,
      averageConfidence: 0
    }
  }

  /**
   * 确保MCP系统已就绪
   */
  private async ensureMCPSystemReady(): Promise<void> {
    if (!isMCPSystemReady()) {
      console.log('MCP系统未就绪，开始初始化...')
      
      const initializer = getMCPInitializer()
      const status = await initializer.initialize()
      
      if (!status.ready) {
        throw new Error(`MCP系统初始化失败: ${status.error || '未知错误'}`)
      }
      
      console.log('MCP系统初始化完成')
    }
  }

  /**
   * 测试MCP连接
   */
  async testMCPConnection(): Promise<boolean> {
    try {
      await this.ensureMCPSystemReady()
      const mcpToolsService = getMCPToolsService()
      const tools = await mcpToolsService.getAvailableTools()
      return tools.length > 0
    } catch (error) {
      console.error('MCP connection test failed:', error)
      return false
    }
  }

  /**
   * 获取可用工具列表
   */
  async getAvailableTools(): Promise<Array<{
    name: string
    description: string
    source: 'mcp'
  }>> {
    try {
      const mcpToolsService = getMCPToolsService()
      const tools = await mcpToolsService.getAvailableTools()
      
      return tools.map(tool => ({
        name: tool.name,
        description: tool.description,
        source: 'mcp' as const
      }))
    } catch (error) {
      console.error('Failed to get available tools:', error)
      return []
    }
  }
}

/**
 * 便捷函数
 */
export const getSmartRouter = () => SmartRouter.getInstance()

/**
 * 快速消息处理
 */
export const processMessageSmart = async (
  message: string,
  conversationId?: string,
  options?: Parameters<SmartRouter['processMessage']>[2]
) => {
  const router = getSmartRouter()
  return router.processMessage(message, conversationId, options)
}