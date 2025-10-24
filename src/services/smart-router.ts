// Smart Router - 智能路由服务，决定是否使用MCP还是LLM

import { ChatMessage, ToolCall, ToolResult } from '@/types'
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

  private constructor() { }

  public static getInstance(): SmartRouter {
    if (!SmartRouter.instance) {
      SmartRouter.instance = new SmartRouter()
    }
    return SmartRouter.instance
  }

  /**
   * 智能处理用户消息 - 架构要求的正确流程
   * 
   * 重要架构原则：绝对不能在LLM请求中包含MCP工具信息
   * MCP工具选择和执行通过PostgreSQL/pgvector处理，与LLM完全分离
   * 
   * 正确流程步骤：
   * 1. Smart Router 通过PostgreSQL/pgvector分析用户输入，判断意图
   * 2. 如果识别出需要特定MCP工具：
   *    a. 直接执行MCP工具（通过PostgreSQL/pgvector选择）
   *    b. 返回工具执行结果
   * 3. 如果不需要特定工具或工具执行失败：
   *    a. 发送给LLM处理（纯对话模式，不包含任何工具信息）
   *    b. 返回LLM响应
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
      mcpConfidenceThreshold = 0.4,  // 调整为与新置信度系统匹配
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

      // 第1步：Smart Router 分析用户意图
      if (enableMCPFirst) {
        console.log('Step 1: Smart Router analyzing user intent for MCP tools')
        
        const intentRecognizer = getMCPIntentRecognizer()
        const intent = await intentRecognizer.recognizeIntent(userMessage)
        
        console.log(`Intent recognition result:`, {
          needsMCP: intent.needsMCP,
          confidence: intent.confidence,
          suggestedTool: intent.suggestedTool,
          reasoning: intent.reasoning
        })

        // 第2步：如果Smart Router识别出需要MCP工具且置信度足够
        if (intent.needsMCP && intent.confidence >= mcpConfidenceThreshold && intent.suggestedTool) {
          console.log(`Step 2: Smart Router decided to use MCP tool directly: ${intent.suggestedTool}`)
          
          try {
            const mcpResult = await this.executeMCPTool(
              intent.suggestedTool,
              intent.parameters || {},
              activeConversationId
            )

            console.log(`MCP tool ${intent.suggestedTool} executed successfully, returning result directly`)
            return {
              response: mcpResult.response,
              source: 'mcp',
              toolResults: mcpResult.toolResults,
              conversationId: activeConversationId,
              confidence: intent.confidence,
              reasoning: `Smart Router directly executed ${intent.suggestedTool} tool with ${(intent.confidence * 100).toFixed(1)}% confidence`
            }
          } catch (error) {
            console.error(`MCP tool execution failed:`, error)
            
            if (!enableLLMFallback) {
              throw error
            }
            console.log('Falling back to LLM due to tool execution failure')
            // 继续到LLM处理
          }
        } else {
          console.log(`Step 2: Smart Router decided NOT to use MCP tools directly (needsMCP: ${intent.needsMCP}, confidence: ${intent.confidence}, threshold: ${mcpConfidenceThreshold})`)
        }
      }

      // 第3步：使用LLM处理（当Smart Router没有识别到合适的工具，或工具执行失败时）
      console.log('Step 3: Using LLM to process message (either as primary path or fallback)')

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
        reasoning: llmResponse.toolResults && llmResponse.toolResults.length > 0
          ? 'LLM identified need for tools and executed them'
          : 'LLM handled directly without tools'
      }

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
   * 使用LLM处理消息（纯对话模式）
   * 
   * 重要：根据架构要求，LLM不处理工具选择和调用
   * 工具选择通过PostgreSQL/pgvector在Smart Router层面处理
   */
  private async processWithLLM(
    userMessage: string,
    conversationId: string,
    _maxToolCalls: number
  ): Promise<{
    response: string
    toolCalls?: ToolCall[]
    toolResults?: ToolResult[]
  }> {
    const llmService = getLLMService()
    const conversationManager = getConversationManager()

    // 确保会话存在
    const existingConversation = conversationManager.getConversation(conversationId)
    if (!existingConversation) {
      console.log(`Conversation ${conversationId} not found in processWithLLM, creating new one`)
      conversationManager.createConversation(conversationId)
    }

    // 获取会话上下文
    const messages = conversationManager.getMessagesForLLM(conversationId)

    // 添加基本系统消息（纯 LLM 模式，不涉及工具）
    this.addSystemMessageForLLM(messages)

    // 发送到LLM - 纯对话模式，不包含工具信息
    console.log('Sending message to LLM in pure conversation mode (no tool definitions)')
    const llmResponse = await llmService.sendMessage(messages)

    // 根据架构要求，LLM不应该返回工具调用
    // 如果LLM意外返回了工具调用，记录警告但不执行
    if (llmResponse.toolCalls && llmResponse.toolCalls.length > 0) {
      console.warn('LLM returned tool calls, but according to architecture, tools should be handled by Smart Router via PostgreSQL/pgvector')
      console.warn('Ignoring tool calls from LLM:', llmResponse.toolCalls)
    }

    // 添加最终响应到会话
    const finalAssistantMsg = conversationManager.createAssistantMessage(llmResponse.content)
    conversationManager.addMessage(conversationId, finalAssistantMsg)

    return {
      response: llmResponse.content,
      // 根据架构要求，不返回工具调用信息
      toolCalls: undefined,
      toolResults: undefined
    }
  }





  /**
   * 为纯 LLM 模式添加系统消息
   * 
   * 重要：纯 LLM 模式不使用任何 embedding 或工具定义
   * 只是简单的对话模式
   */
  private addSystemMessageForLLM(messages: ChatMessage[]): void {
    // 检查是否已经有系统消息，如果没有则添加
    const hasSystemMessage = messages.some(msg => msg.role === 'system')
    if (!hasSystemMessage) {
      const systemMessage: ChatMessage = {
        role: 'system',
        content: `你是一个智能助手，专注于回答用户的问题和提供帮助。

重要指示：
1. 仔细理解用户的问题并提供准确、有用的回答
2. 如果用户询问技术问题，提供详细的解释和建议
3. 保持友好、专业的语调
4. 如果不确定答案，诚实地说明并建议用户寻求更专业的帮助

你的主要职责是通过对话为用户提供信息和建议。`
      }
      messages.unshift(systemMessage)
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
      'run_example': `示例运行结果 (类型: ${params.example_name || 'basic'}):\n${result}`,
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