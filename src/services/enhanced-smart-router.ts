// Enhanced Smart Router - 集成LangChain的智能路由服务

import { ChatMessage, ToolCall, ToolResult } from '@/types'
import { getMCPToolsService } from './mcp-tools'
import { getLLMService } from './llm-service'
import { getConversationManager } from './conversation'
import { getMCPInitializer, isMCPSystemReady } from './mcp-initializer'
import { getLangChainTextProcessor } from './langchain-text-processor'
import { SmartRouterResponse } from './smart-router'

/**
 * 增强版智能路由服务 - 集成LangChain进行更精确的意图识别
 */
export class EnhancedSmartRouter {
  private static instance: EnhancedSmartRouter

  private constructor() { }

  public static getInstance(): EnhancedSmartRouter {
    if (!EnhancedSmartRouter.instance) {
      EnhancedSmartRouter.instance = new EnhancedSmartRouter()
    }
    return EnhancedSmartRouter.instance
  }

  /**
   * 使用LangChain增强的智能消息处理
   */
  async processMessage(
    userMessage: string,
    conversationId?: string,
    options: {
      enableMCPFirst?: boolean
      enableLLMFallback?: boolean
      mcpConfidenceThreshold?: number
      maxToolCalls?: number
      useLangChain?: boolean
    } = {}
  ): Promise<SmartRouterResponse> {
    const {
      enableMCPFirst = true,
      enableLLMFallback = true,
      mcpConfidenceThreshold = 0.4,
      maxToolCalls = 5,
      useLangChain = true
    } = options

    const conversationManager = getConversationManager()

    // 确保有会话ID
    let activeConversationId = conversationId
    if (!activeConversationId) {
      activeConversationId = conversationManager.createConversation()
    } else {
      const existingConversation = conversationManager.getConversation(activeConversationId)
      if (!existingConversation) {
        console.log(`Conversation ${activeConversationId} not found, creating new one`)
        activeConversationId = conversationManager.createConversation(activeConversationId)
      }
    }

    // 添加用户消息到会话
    const userMsg = conversationManager.createUserMessage(userMessage)
    conversationManager.addMessage(activeConversationId, userMsg)

    console.log(`Enhanced Smart Router processing: "${userMessage.substring(0, 100)}..."`)

    try {
      // 确保MCP系统已初始化
      await this.ensureMCPSystemReady()

      // 第1步：使用LangChain进行高级意图分析
      let enhancedIntent: any = null
      if (useLangChain && enableMCPFirst) {
        console.log('Step 1: Using LangChain for enhanced intent analysis')

        const langchainProcessor = getLangChainTextProcessor()
        await langchainProcessor.initialize()

        const tokenizedResult = await langchainProcessor.tokenizeText(userMessage)
        enhancedIntent = await this.analyzeIntentWithLangChain(tokenizedResult, userMessage)

        console.log('LangChain intent analysis:', {
          needsMCP: enhancedIntent.needsMCP,
          confidence: enhancedIntent.confidence,
          suggestedTool: enhancedIntent.suggestedTool,
          reasoning: enhancedIntent.reasoning
        })
      }

      // 第2步：如果LangChain识别出需要MCP工具
      if (enhancedIntent && enhancedIntent.needsMCP &&
        enhancedIntent.confidence >= mcpConfidenceThreshold &&
        enhancedIntent.suggestedTool) {

        console.log(`Step 2: LangChain suggested MCP tool: ${enhancedIntent.suggestedTool}`)

        try {
          const mcpResult = await this.executeMCPTool(
            enhancedIntent.suggestedTool,
            enhancedIntent.parameters || {},
            activeConversationId
          )

          return {
            response: mcpResult.response,
            source: 'mcp',
            toolResults: mcpResult.toolResults,
            conversationId: activeConversationId,
            confidence: enhancedIntent.confidence,
            reasoning: `LangChain-enhanced analysis suggested ${enhancedIntent.suggestedTool} with ${(enhancedIntent.confidence * 100).toFixed(1)}% confidence`
          }
        } catch (error) {
          console.error(`LangChain-suggested MCP tool execution failed:`, error)
          if (!enableLLMFallback) {
            throw error
          }
          console.log('Falling back to traditional intent recognition')
        }
      }

      // 第3步：如果LangChain没有识别出MCP工具需求，直接进入LLM处理
      console.log('Step 3: LangChain did not suggest MCP tool, proceeding to LLM processing')

      // 第4步：使用LLM处理
      console.log('Step 4: Processing with LLM (enhanced with LangChain context if available)')

      const llmResponse = await this.processWithLLM(
        userMessage,
        activeConversationId,
        maxToolCalls,
        enhancedIntent // 传递LangChain分析结果作为上下文
      )

      return {
        response: llmResponse.response,
        source: llmResponse.toolResults && llmResponse.toolResults.length > 0 ? 'hybrid' : 'llm',
        toolCalls: llmResponse.toolCalls,
        toolResults: llmResponse.toolResults,
        conversationId: activeConversationId,
        reasoning: enhancedIntent
          ? `LangChain-enhanced LLM processing (domain: ${enhancedIntent.domain}, complexity: ${enhancedIntent.complexity})`
          : 'Standard LLM processing'
      }

    } catch (error) {
      console.error('Error in enhanced smart router:', error)

      const errorMsg = conversationManager.createSystemMessage(
        `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
      conversationManager.addMessage(activeConversationId, errorMsg)

      throw error
    }
  }

  /**
   * 使用LangChain分析结果结合PostgreSQL/pgvector进行智能工具匹配
   */
  private async analyzeIntentWithLangChain(tokenizedResult: any, originalQuestion: string): Promise<{
    needsMCP: boolean
    suggestedTool?: string
    confidence: number
    parameters?: Record<string, any>
    reasoning?: string
    domain?: string
    complexity?: string
  }> {
    const { entities, intent, context } = tokenizedResult

    // 基于LangChain分析结果构建增强的查询字符串
    const enhancedQuery = this.buildEnhancedQuery(tokenizedResult, originalQuestion)

    console.log('Enhanced query for tool matching:', enhancedQuery)

    // 使用工具元数据服务进行智能工具匹配
    const { getToolMetadataService } = await import('./tool-metadata-service')
    const metadataService = getToolMetadataService()
    await metadataService.initialize()

    const toolSuggestions = await metadataService.getToolSuggestions(enhancedQuery)

    if (toolSuggestions.length > 0 && toolSuggestions[0].confidence > 0.3) {
      const topSuggestion = toolSuggestions[0]

      // 基于LangChain分析结果提取参数
      const parameters = this.extractParametersFromLangChain(tokenizedResult, topSuggestion.toolName, originalQuestion)

      return {
        needsMCP: true,
        suggestedTool: topSuggestion.toolName,
        confidence: topSuggestion.confidence,
        parameters,
        reasoning: `LangChain + PostgreSQL analysis suggested ${topSuggestion.toolName} (confidence: ${(topSuggestion.confidence * 100).toFixed(1)}%)`,
        domain: context.domain,
        complexity: context.complexity
      }
    }

    // 如果PostgreSQL没有返回好的建议，使用fallback逻辑
    console.log('PostgreSQL tool suggestions insufficient, using fallback analysis')
    const fallbackResult = this.simpleFallbackAnalysis(originalQuestion, tokenizedResult)

    if (fallbackResult.needsMCP && fallbackResult.confidence > 0.3) {
      // 基于LangChain分析结果提取参数
      const parameters = this.extractParametersFromLangChain(tokenizedResult, fallbackResult.suggestedTool!, originalQuestion)

      return {
        needsMCP: true,
        suggestedTool: fallbackResult.suggestedTool,
        confidence: fallbackResult.confidence,
        parameters,
        reasoning: `LangChain + Fallback analysis suggested ${fallbackResult.suggestedTool} (confidence: ${(fallbackResult.confidence * 100).toFixed(1)}%)`,
        domain: context.domain,
        complexity: context.complexity
      }
    }

    // 如果没有找到合适的工具，判断是否应该使用LLM
    const shouldUseLLM = this.shouldUseLLMBasedOnLangChain(tokenizedResult)

    return {
      needsMCP: false,
      confidence: shouldUseLLM.confidence,
      reasoning: `LangChain analysis: ${shouldUseLLM.reasoning}`,
      domain: context.domain,
      complexity: context.complexity
    }
  }

  /**
   * 基于LangChain分析结果构建增强的查询字符串
   */
  private buildEnhancedQuery(tokenizedResult: any, originalQuestion: string): string {
    const { entities, intent, context } = tokenizedResult

    // 构建增强查询的组件
    const queryParts = []

    // 1. 原始问题
    queryParts.push(originalQuestion)

    // 2. 领域信息
    if (context.domain && context.domain !== '其他') {
      queryParts.push(context.domain)
    }

    // 3. 主要意图
    if (intent.primary && intent.primary !== '信息查询') {
      queryParts.push(intent.primary)
    }

    // 4. 关键实体
    const keywordEntities = entities.filter((e: any) => e.type === 'keyword' || e.type === 'action')
    keywordEntities.forEach((entity: any) => {
      queryParts.push(entity.text)
    })

    // 5. 数字实体（用于参数化工具）
    const numberEntities = entities.filter((e: any) => e.type === 'number')
    if (numberEntities.length > 0) {
      queryParts.push(`数字: ${numberEntities.map((e: any) => e.text).join(' ')}`)
    }

    return queryParts.join(' ')
  }

  /**
   * 基于LangChain分析结果和工具名称提取参数
   */
  private extractParametersFromLangChain(tokenizedResult: any, toolName: string, originalQuestion: string): Record<string, any> {
    const { entities } = tokenizedResult
    const parameters: Record<string, any> = {}

    const numberEntities = entities.filter((e: any) => e.type === 'number')

    // 根据工具类型提取相关参数
    switch (toolName) {
      case 'solve_24_point_game':
        if (numberEntities.length >= 4) {
          const numbers = numberEntities.map((e: any) => parseInt(e.text)).filter((n: number) => !isNaN(n)).slice(0, 4)
          if (numbers.length === 4) {
            parameters.numbers = numbers
          }
        }
        break

      case 'solve_n_queens':
        const nValue = numberEntities.find((e: any) => {
          const num = parseInt(e.text)
          return num >= 4 && num <= 20
        })
        if (nValue) {
          parameters.n = parseInt(nValue.text)
        } else {
          parameters.n = 8 // 默认8皇后
        }
        break

      case 'solve_sudoku':
        const sudokuGrid = this.extractSudokuGrid(originalQuestion)
        if (sudokuGrid) {
          parameters.puzzle = sudokuGrid
        }
        break

      case 'run_example':
        parameters.example_name = 'basic'
        break
    }

    return parameters
  }

  /**
   * 基于LangChain分析判断是否应该使用LLM
   */
  private shouldUseLLMBasedOnLangChain(tokenizedResult: any): { confidence: number, reasoning: string } {
    const { intent, context } = tokenizedResult

    // 信息查询类型
    if (intent.primary === '信息查询' || context.domain === '其他') {
      return {
        confidence: 0.8,
        reasoning: 'Information query detected, suitable for LLM processing'
      }
    }

    // 复杂度较低的问题
    if (context.complexity === 'simple') {
      return {
        confidence: 0.7,
        reasoning: 'Simple question, suitable for LLM processing'
      }
    }

    // 默认情况
    return {
      confidence: 0.5,
      reasoning: 'No specific tool match found, defaulting to LLM'
    }
  }

  /**
   * 简单的fallback分析，当PostgreSQL工具匹配不足时使用
   */
  private simpleFallbackAnalysis(message: string, tokenizedResult?: any): {
    needsMCP: boolean
    suggestedTool?: string
    confidence: number
    reasoning: string
  } {
    const lowerMessage = message.toLowerCase()
    const numberEntities = tokenizedResult?.entities?.filter((e: any) => e.type === 'number') || []

    // 24点游戏检测 - 增强版
    if (lowerMessage.includes('24') && numberEntities.length >= 4) {
      return {
        needsMCP: true,
        suggestedTool: 'solve_24_point_game',
        confidence: 0.9,
        reasoning: 'Fallback detected 24-point game with sufficient numbers'
      }
    } else if (lowerMessage.includes('24') && /\d+.*\d+.*\d+.*\d+/.test(message)) {
      return {
        needsMCP: true,
        suggestedTool: 'solve_24_point_game',
        confidence: 0.8,
        reasoning: 'Fallback detected 24-point game keywords and numbers'
      }
    }

    // N皇后问题检测
    if (lowerMessage.includes('皇后') || lowerMessage.includes('queen')) {
      return {
        needsMCP: true,
        suggestedTool: 'solve_n_queens',
        confidence: 0.8,
        reasoning: 'Fallback detected N-Queens problem keywords'
      }
    }

    // 数独检测
    if (lowerMessage.includes('数独') || lowerMessage.includes('sudoku')) {
      return {
        needsMCP: true,
        suggestedTool: 'solve_sudoku',
        confidence: 0.8,
        reasoning: 'Fallback detected Sudoku keywords'
      }
    }

    // 示例代码检测
    if (lowerMessage.includes('示例') || lowerMessage.includes('example') || lowerMessage.includes('运行')) {
      return {
        needsMCP: true,
        suggestedTool: 'run_example',
        confidence: 0.7,
        reasoning: 'Fallback detected example or run keywords'
      }
    }

    // 问题求解类型
    if (lowerMessage.includes('解决') || lowerMessage.includes('solve') || lowerMessage.includes('计算')) {
      return {
        needsMCP: true,
        suggestedTool: undefined,
        confidence: 0.6,
        reasoning: 'Fallback detected problem-solving keywords'
      }
    }

    // 信息查询类型
    if (lowerMessage.includes('什么') || lowerMessage.includes('how') || lowerMessage.includes('为什么')) {
      return {
        needsMCP: false,
        confidence: 0.8,
        reasoning: 'Fallback detected information query, suitable for LLM'
      }
    }

    // 默认情况
    return {
      needsMCP: false,
      confidence: 0.3,
      reasoning: 'Fallback found no clear intent, defaulting to LLM'
    }
  }

  /**
   * 直接执行MCP工具（复用原有逻辑）
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
        toolCallId: `enhanced_${Date.now()}`,
        result: executionResult.success ? executionResult.result : null,
        error: executionResult.success ? undefined : executionResult.error?.message
      }

      // 添加工具执行结果到会话
      const toolResultMsg = conversationManager.createSystemMessage(
        `Enhanced MCP Tool ${toolName} executed: ${JSON.stringify(toolResult.result)}`
      )
      conversationManager.addMessage(conversationId, toolResultMsg)

      // 格式化响应
      let response = ''
      if (executionResult.success && executionResult.result) {
        response = await this.formatMCPResult(toolName, executionResult.result, params)
      } else {
        response = await this.formatMCPError(toolName, executionResult.error?.message || '未知错误', params)
      }

      // 添加助手响应到会话
      const assistantMsg = conversationManager.createAssistantMessage(response)
      conversationManager.addMessage(conversationId, assistantMsg)

      return {
        response,
        toolResults: [toolResult]
      }

    } catch (error) {
      console.error(`Error executing enhanced MCP tool ${toolName}:`, error)
      throw error
    }
  }

  /**
   * 使用LLM处理消息（增强版，包含LangChain上下文）
   */
  private async processWithLLM(
    userMessage: string,
    conversationId: string,
    _maxToolCalls: number,
    langchainContext?: any
  ): Promise<{
    response: string
    toolCalls?: ToolCall[]
    toolResults?: ToolResult[]
  }> {
    const llmService = getLLMService()
    const conversationManager = getConversationManager()

    // 获取会话上下文
    const messages = conversationManager.getMessagesForLLM(conversationId)

    // 添加增强的系统消息
    this.addEnhancedSystemMessage(messages, langchainContext)

    // 发送到LLM
    console.log('Sending message to LLM with LangChain context enhancement')
    const llmResponse = await llmService.sendMessage(messages)

    // 添加最终响应到会话
    const finalAssistantMsg = conversationManager.createAssistantMessage(llmResponse.content)
    conversationManager.addMessage(conversationId, finalAssistantMsg)

    return {
      response: llmResponse.content,
      toolCalls: undefined,
      toolResults: undefined
    }
  }

  /**
   * 添加增强的系统消息（包含LangChain分析上下文）
   */
  private addEnhancedSystemMessage(messages: ChatMessage[], langchainContext?: any): void {
    const hasSystemMessage = messages.some(msg => msg.role === 'system')
    if (!hasSystemMessage) {
      let systemContent = `你是一个智能助手，专注于回答用户的问题和提供帮助。`

      // 如果有LangChain分析上下文，添加相关信息
      if (langchainContext) {
        systemContent += `\n\n根据高级文本分析：`

        if (langchainContext.domain) {
          systemContent += `\n- 问题领域：${langchainContext.domain}`
        }

        if (langchainContext.complexity) {
          systemContent += `\n- 复杂程度：${langchainContext.complexity}`
        }

        systemContent += `\n\n请根据这些分析结果提供更精准的回答。`
      }

      systemContent += `\n\n重要指示：
1. 仔细理解用户的问题并提供准确、有用的回答
2. 如果用户询问技术问题，提供详细的解释和建议
3. 保持友好、专业的语调
4. 如果不确定答案，诚实地说明并建议用户寻求更专业的帮助`

      const systemMessage: ChatMessage = {
        role: 'system',
        content: systemContent
      }
      messages.unshift(systemMessage)
    }
  }

  // 复用原有的格式化方法
  private async formatMCPResult(toolName: string, result: any, params: Record<string, any>): Promise<string> {
    // 这里可以复用原有SmartRouter的formatMCPResult方法
    // 为了简化，这里提供基本实现
    if (typeof result === 'string') {
      return `✅ **${toolName} 执行成功**\n\n${result}`
    }

    if (typeof result === 'object' && result.output) {
      return `✅ **${toolName} 执行成功**\n\n${result.output}`
    }

    return `✅ **${toolName} 执行成功**\n\n${JSON.stringify(result, null, 2)}`
  }

  private async formatMCPError(toolName: string, errorMessage: string, params: Record<string, any>): Promise<string> {
    return `❌ **${toolName} 执行失败**\n\n错误信息：${errorMessage}`
  }

  /**
   * 提取数独网格 - 支持9x9数组格式识别
   */
  private extractSudokuGrid(input: string): number[][] | null {
    try {
      // 检查是否包含数组格式
      const gridPattern = /\[[\[\d\s,\]]+\]/
      if (!gridPattern.test(input)) {
        return null
      }

      // 尝试解析数组
      const gridMatch = input.match(gridPattern)
      if (gridMatch) {
        const grid = JSON.parse(gridMatch[0])

        // 验证是否为有效的9x9数独网格
        if (Array.isArray(grid) &&
          grid.length === 9 &&
          grid.every(row => Array.isArray(row) && row.length === 9)) {

          // 验证数字范围 (0-9)
          const allNumbers = grid.flat()
          const validNumbers = allNumbers.every(num =>
            typeof num === 'number' && num >= 0 && num <= 9
          )

          // 检查是否有空格 (0)
          const hasEmptySpaces = allNumbers.some(num => num === 0)

          if (validNumbers && hasEmptySpaces) {
            console.log('✅ 检测到有效的9x9数独网格')
            return grid
          }
        }
      }
    } catch (error) {
      console.warn('解析数独网格失败:', error)
    }

    return null
  }

  /**
   * 确保MCP系统已就绪 - 优化版本，避免重复初始化
   */
  private async ensureMCPSystemReady(): Promise<void> {
    const initializer = getMCPInitializer()

    // 首先检查当前状态
    if (initializer.isReady()) {
      return // 已经就绪，直接返回
    }

    // 检查是否正在初始化中
    const currentStatus = initializer.getStatus()
    if (currentStatus.configLoaded || currentStatus.serversConnected || currentStatus.toolsLoaded) {
      console.log('MCP系统正在初始化中，等待完成...')
      // 系统正在初始化，等待完成
      const status = await initializer.initialize(false) // 不强制重新初始化
      if (!status.ready) {
        console.warn(`MCP系统初始化未完全成功，但继续运行: ${status.error || '部分功能可能不可用'}`)
      }
      return
    }

    // 系统确实未初始化，开始初始化
    console.log('MCP系统未就绪，开始初始化...')
    try {
      const status = await initializer.initialize(false) // 不强制重新初始化

      if (status.ready) {
        console.log(`MCP系统初始化完成 (${status.details.totalTools} 个工具可用)`)
      } else {
        // 即使初始化不完全成功，也不阻塞请求处理
        console.warn(`MCP系统初始化未完全成功，但继续运行: ${status.error || '部分功能可能不可用'}`)
        console.warn('详细状态:', {
          configLoaded: status.configLoaded,
          serversConnected: status.serversConnected,
          toolsLoaded: status.toolsLoaded,
          keywordsMapped: status.keywordsMapped
        })
      }
    } catch (error) {
      // 初始化失败也不阻塞请求，降级到纯LLM模式
      console.error('MCP系统初始化失败，降级到纯LLM模式:', error instanceof Error ? error.message : error)
    }
  }
}

/**
 * 便捷函数
 */
export const getEnhancedSmartRouter = () => EnhancedSmartRouter.getInstance()