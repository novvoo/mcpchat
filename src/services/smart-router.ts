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

  private constructor() { }

  public static getInstance(): SmartRouter {
    if (!SmartRouter.instance) {
      SmartRouter.instance = new SmartRouter()
    }
    return SmartRouter.instance
  }

  /**
   * 智能处理用户消息 - 完整流程
   * 
   * 新流程步骤：
   * 1. 初始化MCP配置和工具信息
   * 2. 通过LLM分析用户输入，判断是否需要使用MCP工具
   * 3. LLM识别出需要的工具和参数
   * 4. 如果LLM返回工具调用：
   *    a. 执行MCP工具
   *    b. 将结果返回给LLM生成最终回复
   * 5. 如果LLM不返回工具调用：
   *    a. 直接返回LLM的回复
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

      // 核心流程：直接使用LLM处理，让LLM决定是否需要调用工具
      console.log('Using LLM to analyze user intent and decide tool usage')

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
   * 使用LLM处理消息（两阶段智能工具选择）
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

    // 使用向量搜索选择相关工具并添加到消息中
    await this.addToolDefinitionsToMessages(messages, userMessage)

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
   * 添加工具定义到消息中（使用向量搜索）
   */
  private async addToolDefinitionsToMessages(
    messages: ChatMessage[],
    userQuery: string
  ): Promise<void> {
    try {
      const mcpToolsService = getMCPToolsService()
      const allTools = await mcpToolsService.getAvailableTools()
      let relevantTools: Array<{ name: string; description: string; inputSchema: any }> = []

      // 如果工具数量少，直接使用所有工具
      if (allTools.length <= 5) {
        console.log('Tool count <= 5, using all tools')
        relevantTools = allTools
      } else {
        // 尝试使用向量搜索
        try {
          const { getToolVectorStore } = await import('./tool-vector-store')
          const vectorStore = getToolVectorStore()

          if (vectorStore.isReady()) {
            console.log('Using vector search to find relevant tools')
            const searchResults = await vectorStore.searchTools(userQuery, 5)

            if (searchResults.length > 0) {
              relevantTools = searchResults.map(result => result.tool)
              console.log(`Vector search found ${relevantTools.length} relevant tools:`)
              searchResults.forEach(result => {
                console.log(`  - ${result.tool.name} (similarity: ${result.similarity.toFixed(3)})`)
              })
            } else {
              console.log('Vector search returned no results, using keyword matching')
              relevantTools = this.filterRelevantTools(allTools, userQuery)
            }
          } else {
            console.log('Vector store not ready, using keyword matching')
            relevantTools = this.filterRelevantTools(allTools, userQuery)
          }
        } catch (error) {
          console.warn('Vector search failed, using keyword matching:', error)
          relevantTools = this.filterRelevantTools(allTools, userQuery)
        }
      }

      if (relevantTools.length > 0) {
        const toolDefinitions = relevantTools.map(tool => ({
          name: tool.name,
          description: tool.description,
          parameters: tool.inputSchema
        }))

        const systemMessage: ChatMessage = {
          role: 'system',
          content: `你是一个智能助手，可以使用工具来帮助用户解决问题。

你有以下工具可用：

${JSON.stringify(toolDefinitions, null, 2)}

重要指示：
1. 仔细分析用户的问题，判断是否需要使用工具
2. 如果用户的问题可以通过工具解决（如求解数学问题、运行算法等），你应该调用相应的工具
3. 如果用户只是在询问信息、寻求建议或进行一般对话，直接回答即可，不需要调用工具
4. 当你决定使用工具时，请准确提取用户输入中的参数
5. 工具执行后，你会收到结果，然后基于结果给用户一个友好的回复

示例：
- "解决8皇后问题" → 应该调用 solve_n_queens 工具，参数 n=8
- "什么是N皇后问题？" → 直接回答，不需要调用工具
- "帮我解这个数独" → 应该调用 solve_sudoku 工具
- "数独游戏的规则是什么？" → 直接回答，不需要调用工具`
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
   * 过滤与用户查询相关的工具
   */
  private filterRelevantTools(
    tools: Array<{ name: string; description: string; inputSchema: any }>,
    userQuery: string
  ): Array<{ name: string; description: string; inputSchema: any }> {
    // 如果工具数量较少，直接返回所有工具
    if (tools.length <= 5) {
      return tools
    }

    const queryLower = userQuery.toLowerCase()
    const queryWords = queryLower.split(/\s+/)

    // 为每个工具计算相关性分数
    const scoredTools = tools.map(tool => {
      let score = 0
      const toolText = `${tool.name} ${tool.description}`.toLowerCase()

      // 检查工具名称直接匹配
      if (queryLower.includes(tool.name.toLowerCase())) {
        score += 10
      }

      // 检查关键词匹配
      for (const word of queryWords) {
        if (word.length < 3) continue // 跳过太短的词
        if (toolText.includes(word)) {
          score += 2
        }
      }

      // 特殊关键词匹配
      const keywordMap: Record<string, string[]> = {
        'queens': ['皇后', 'queen', 'n-queen', 'n_queen'],
        'sudoku': ['数独', 'sudoku'],
        'graph': ['图', 'graph', '图论', '着色', 'coloring'],
        'map': ['地图', 'map', '着色', 'coloring'],
        'lp': ['线性规划', 'linear', 'programming', 'lp', 'optimization'],
        'production': ['生产', 'production', '规划', 'planning'],
        'minimax': ['极小极大', 'minimax', '博弈', 'game'],
        'portfolio': ['投资', 'portfolio', '组合'],
        'facility': ['设施', 'facility', '选址', 'location'],
        'statistical': ['统计', 'statistical', '拟合', 'fitting']
      }

      for (const [key, keywords] of Object.entries(keywordMap)) {
        if (tool.name.toLowerCase().includes(key)) {
          for (const keyword of keywords) {
            if (queryLower.includes(keyword)) {
              score += 5
            }
          }
        }
      }

      return { tool, score }
    })

    // 按分数排序并取前8个工具
    const sortedTools = scoredTools.sort((a, b) => b.score - a.score)
    const topTools = sortedTools.slice(0, 8).map(item => item.tool)

    // 如果没有任何工具得分，返回前8个工具
    if (sortedTools[0].score === 0) {
      return tools.slice(0, 8)
    }

    return topTools
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