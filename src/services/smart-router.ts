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
        response = this.formatMCPError(toolName, executionResult.error?.message || '未知错误', params)
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
          // 尝试解析文本内容是否为JSON格式的响应
          try {
            const parsedContent = JSON.parse(textContent)
            if (parsedContent && typeof parsedContent === 'object') {
              if ('output' in parsedContent) {
                // 如果是包含output字段的JSON，递归处理
                return this.formatMCPResult(toolName, parsedContent, params)
              } else {
                // 其他JSON对象，直接处理
                return this.formatMCPResult(toolName, parsedContent, params)
              }
            }
          } catch {
            // 不是JSON，直接处理文本
          }
          
          return this.addContextToResult(toolName, this.formatToolOutput(toolName, textContent), params)
        }
      }

      // 处理包含 rc 和 output 字段的响应格式
      if (result && typeof result === 'object' && 'output' in result) {
        const output = result.output || ''
        const returnCode = result.rc !== undefined ? result.rc : null
        
        // 如果执行成功 (rc = 0)，直接返回格式化的输出
        if (returnCode === 0 || returnCode === null) {
          return this.addContextToResult(toolName, this.formatToolOutput(toolName, output), params)
        } else {
          // 如果执行失败，显示错误信息
          return this.addContextToResult(toolName, `执行失败 (返回码: ${returnCode})\n${output}`, params)
        }
      }

      // 处理简单字符串结果
      if (typeof result === 'string') {
        return this.addContextToResult(toolName, this.formatToolOutput(toolName, result), params)
      }

      // 处理其他对象结果
      if (typeof result === 'object') {
        // 检查是否是错误对象
        if (result.error) {
          const errorMessage = typeof result.error === 'string' ? result.error : JSON.stringify(result.error)
          return this.formatMCPError(toolName, errorMessage, params)
        }
        
        // 特殊处理某些工具的JSON响应
        const specialFormatted = this.formatSpecialToolResponse(toolName, result)
        if (specialFormatted) {
          return this.addContextToResult(toolName, specialFormatted, params)
        }
        
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
   * 格式化工具输出内容，使其更易读
   */
  private formatToolOutput(toolName: string, output: string): string {
    if (!output || typeof output !== 'string') {
      return output
    }

    // 根据工具类型进行特定格式化
    switch (toolName) {
      case 'run_example':
        return this.formatExampleOutput(output)
      case 'solve_n_queens':
        return this.formatQueensOutput(output)
      case 'solve_sudoku':
        return this.formatSudokuOutput(output)
      case 'install':
        return this.formatInstallOutput(output)
      default:
        return this.formatGenericOutput(output)
    }
  }

  /**
   * 格式化示例运行输出
   */
  private formatExampleOutput(output: string): string {
    // 移除过多的等号分隔线，保持结构清晰
    let formatted = output
      .replace(/={60,}/g, '\n---\n')  // 长等号线替换为短横线
      .replace(/\n{3,}/g, '\n\n')     // 多个换行符合并为两个
      .trim()

    // 添加适当的标题格式
    formatted = formatted
      .replace(/^=== (.+) ===/gm, '## $1')  // 三等号标题转为二级标题
      .replace(/^(.+):\s*$/gm, '**$1:**')   // 冒号结尾的行加粗

    return formatted
  }

  /**
   * 格式化N皇后问题输出
   */
  private formatQueensOutput(output: string): string {
    return output
      .replace(/Solution found:/g, '✅ **找到解决方案:**')
      .replace(/No solution exists/g, '❌ **无解**')
      .replace(/Board:/g, '**棋盘布局:**')
  }

  /**
   * 格式化数独输出
   */
  private formatSudokuOutput(output: string): string {
    return output
      .replace(/Solved sudoku:/g, '✅ **数独已解决:**')
      .replace(/Invalid sudoku/g, '❌ **无效的数独**')
      .replace(/No solution/g, '❌ **无解**')
  }

  /**
   * 格式化安装输出
   */
  private formatInstallOutput(output: string): string {
    return output
      .replace(/Successfully installed/g, '✅ **安装成功**')
      .replace(/Requirement already satisfied/g, '✅ **已安装**')
      .replace(/ERROR:/g, '❌ **错误:**')
      .replace(/WARNING:/g, '⚠️ **警告:**')
  }

  /**
   * 通用输出格式化
   */
  private formatGenericOutput(output: string): string {
    return output
      .replace(/\n{3,}/g, '\n\n')     // 合并多个换行符
      .replace(/^(.+):\s*$/gm, '**$1:**')  // 冒号结尾的行加粗
      .trim()
  }

  /**
   * 特殊工具响应格式化
   */
  private formatSpecialToolResponse(toolName: string, result: any): string | null {
    switch (toolName) {
      case 'solve_n_queens':
        return this.formatNQueensResponse(result)
      case 'solve_sudoku':
        return this.formatSudokuResponse(result)
      default:
        return null
    }
  }

  /**
   * 格式化N皇后问题响应
   */
  private formatNQueensResponse(result: any): string {
    if (result.success && result.solution) {
      const solution = result.solution
      let board = ''
      
      // 生成棋盘显示
      for (let row = 0; row < solution.length; row++) {
        let rowStr = ''
        for (let col = 0; col < solution.length; col++) {
          if (solution[row] === col) {
            rowStr += '♛ '  // 皇后
          } else {
            rowStr += '· '  // 空位
          }
        }
        board += rowStr.trim() + '\n'
      }
      
      return `✅ **找到解决方案!**\n\n**棋盘布局:**\n\`\`\`\n${board}\`\`\`\n\n**解向量:** [${solution.join(', ')}]\n\n每个数字表示该行皇后所在的列位置。`
    } else if (result.error) {
      return `❌ **求解失败:** ${result.error}`
    } else {
      return `❌ **无解**`
    }
  }

  /**
   * 格式化数独响应
   */
  private formatSudokuResponse(result: any): string {
    if (result.success && result.solution) {
      const solution = result.solution
      let grid = ''
      
      for (let i = 0; i < 9; i++) {
        if (i % 3 === 0 && i > 0) grid += '------+-------+------\n'
        
        for (let j = 0; j < 9; j++) {
          if (j % 3 === 0 && j > 0) grid += '| '
          grid += solution[i][j] + ' '
        }
        grid += '\n'
      }
      
      return `✅ **数独已解决!**\n\n\`\`\`\n${grid}\`\`\``
    } else if (result.error) {
      return `❌ **求解失败:** ${result.error}`
    } else {
      return `❌ **无解**`
    }
  }

  /**
   * 为结果添加上下文信息
   */
  private addContextToResult(toolName: string, result: string, params: Record<string, any>): string {
    const contextMap: Record<string, string> = {
      'solve_n_queens': `🔢 **N皇后问题求解** (N=${params.n || 8})\n\n${result}`,
      'solve_sudoku': `🧩 **数独求解结果**\n\n${result}`,
      'run_example': `🚀 **${this.getExampleDisplayName(params.example_name || 'basic')}示例运行**\n\n${result}`,
      'echo': `📢 **回显结果**\n\n${result}`,
      'install': `📦 **包安装结果**\n\n${result}`,
      'info': `ℹ️ **系统信息**\n\n${result}`
    }

    return contextMap[toolName] || `🔧 **${toolName} 执行结果**\n\n${result}`
  }

  /**
   * 获取示例类型的显示名称
   */
  private getExampleDisplayName(exampleType: string): string {
    const displayNames: Record<string, string> = {
      'lp': '线性规划',
      'basic': '基础',
      'advanced': '高级',
      'portfolio': '投资组合优化',
      'transportation': '运输问题',
      'assignment': '分配问题'
    }
    
    return displayNames[exampleType] || exampleType
  }

  /**
   * 格式化MCP工具执行错误
   */
  private formatMCPError(toolName: string, errorMessage: string, params: Record<string, any>): string {
    try {
      // 解析不同类型的错误
      const formattedError = this.parseAndFormatError(toolName, errorMessage, params)
      return this.addContextToResult(toolName, formattedError, params)
    } catch (error) {
      console.error('Error formatting MCP error:', error)
      return this.addContextToResult(toolName, `❌ **执行失败**\n\n${errorMessage}`, params)
    }
  }

  /**
   * 解析和格式化错误信息
   */
  private parseAndFormatError(toolName: string, errorMessage: string, params: Record<string, any>): string {
    // 缺少必需参数的错误
    if (errorMessage.includes('missing') && errorMessage.includes('required')) {
      return this.formatMissingParametersError(toolName, errorMessage, params)
    }

    // 无效参数错误
    if (errorMessage.includes('Invalid arguments') || errorMessage.includes('invalid')) {
      return this.formatInvalidArgumentsError(toolName, errorMessage, params)
    }

    // 类型错误
    if (errorMessage.includes('TypeError') || errorMessage.includes('type')) {
      return this.formatTypeError(toolName, errorMessage, params)
    }

    // 值错误
    if (errorMessage.includes('ValueError') || errorMessage.includes('value')) {
      return this.formatValueError(toolName, errorMessage, params)
    }

    // 连接错误
    if (errorMessage.includes('connection') || errorMessage.includes('timeout')) {
      return this.formatConnectionError(toolName, errorMessage)
    }

    // 通用错误格式化
    return this.formatGenericError(toolName, errorMessage)
  }

  /**
   * 格式化缺少参数错误
   */
  private formatMissingParametersError(toolName: string, errorMessage: string, params: Record<string, any>): string {
    // 提取缺少的参数名称
    const missingParams = this.extractMissingParameters(errorMessage)
    const suggestions = this.generateParameterSuggestions(toolName, missingParams)

    let formatted = `❌ **参数缺失**\n\n`
    formatted += `工具 **${toolName}** 需要以下必需参数：\n\n`
    
    missingParams.forEach((param, index) => {
      formatted += `${index + 1}. **${param}**`
      if (suggestions[param]) {
        formatted += ` - ${suggestions[param]}`
      }
      formatted += '\n'
    })

    if (Object.keys(params).length > 0) {
      formatted += `\n**当前提供的参数:**\n`
      Object.entries(params).forEach(([key, value]) => {
        formatted += `• ${key}: ${JSON.stringify(value)}\n`
      })
    }

    formatted += `\n💡 **建议:** 请提供完整的参数信息，或尝试更具体的描述让系统自动推断参数。`

    return formatted
  }

  /**
   * 格式化无效参数错误
   */
  private formatInvalidArgumentsError(toolName: string, errorMessage: string, params: Record<string, any>): string {
    let formatted = `❌ **参数无效**\n\n`
    formatted += `工具 **${toolName}** 的参数格式不正确。\n\n`
    formatted += `**错误详情:** ${errorMessage}\n\n`

    if (Object.keys(params).length > 0) {
      formatted += `**提供的参数:**\n`
      Object.entries(params).forEach(([key, value]) => {
        formatted += `• ${key}: ${JSON.stringify(value)}\n`
      })
      formatted += '\n'
    }

    formatted += `💡 **建议:** 请检查参数格式，或使用更自然的语言描述您的需求。`

    return formatted
  }

  /**
   * 格式化类型错误
   */
  private formatTypeError(toolName: string, errorMessage: string, params: Record<string, any>): string {
    let formatted = `❌ **参数类型错误**\n\n`
    formatted += `工具 **${toolName}** 的参数类型不匹配。\n\n`
    formatted += `**错误详情:** ${errorMessage}\n\n`

    formatted += `💡 **建议:** 请确保参数类型正确（如数字、文本、数组等）。`

    return formatted
  }

  /**
   * 格式化值错误
   */
  private formatValueError(toolName: string, errorMessage: string, params: Record<string, any>): string {
    let formatted = `❌ **参数值错误**\n\n`
    formatted += `工具 **${toolName}** 的参数值不在有效范围内。\n\n`
    formatted += `**错误详情:** ${errorMessage}\n\n`

    formatted += `💡 **建议:** 请检查参数值是否在允许的范围内。`

    return formatted
  }

  /**
   * 格式化连接错误
   */
  private formatConnectionError(toolName: string, errorMessage: string): string {
    let formatted = `🔌 **连接错误**\n\n`
    formatted += `无法连接到工具 **${toolName}** 的服务。\n\n`
    formatted += `**错误详情:** ${errorMessage}\n\n`

    formatted += `💡 **建议:** 请稍后重试，或联系管理员检查服务状态。`

    return formatted
  }

  /**
   * 格式化通用错误
   */
  private formatGenericError(toolName: string, errorMessage: string): string {
    let formatted = `❌ **执行失败**\n\n`
    formatted += `工具 **${toolName}** 执行时遇到问题。\n\n`
    formatted += `**错误详情:** ${errorMessage}\n\n`

    formatted += `💡 **建议:** 请尝试重新描述您的需求，或联系支持获取帮助。`

    return formatted
  }

  /**
   * 提取缺少的参数名称
   */
  private extractMissingParameters(errorMessage: string): string[] {
    const params: string[] = []
    
    // 匹配 "missing X required positional arguments: 'param1' and 'param2'"
    const match1 = errorMessage.match(/missing \d+ required positional arguments?: (.+)/i)
    if (match1) {
      const paramStr = match1[1]
      // 提取引号中的参数名
      const paramMatches = paramStr.match(/'([^']+)'/g)
      if (paramMatches) {
        params.push(...paramMatches.map(p => p.replace(/'/g, '')))
      }
    }

    // 匹配其他格式的缺少参数错误
    const match2 = errorMessage.match(/required parameter[s]?\s*:?\s*([^.]+)/i)
    if (match2 && params.length === 0) {
      const paramStr = match2[1].trim()
      params.push(...paramStr.split(/[,\s]+/).filter(p => p.length > 0))
    }

    return params
  }

  /**
   * 生成参数建议
   */
  private generateParameterSuggestions(toolName: string, missingParams: string[]): Record<string, string> {
    const suggestions: Record<string, string> = {}

    // 基于工具名称和参数名称生成建议
    missingParams.forEach(param => {
      const paramLower = param.toLowerCase()
      
      if (paramLower.includes('return') || paramLower.includes('expected')) {
        suggestions[param] = '预期收益率数组，例如 [0.1, 0.12, 0.08]'
      } else if (paramLower.includes('covariance') || paramLower.includes('matrix')) {
        suggestions[param] = '协方差矩阵，表示资产间的风险关系'
      } else if (paramLower.includes('risk')) {
        suggestions[param] = '风险容忍度，通常为0-1之间的数值'
      } else if (paramLower.includes('weight') || paramLower.includes('allocation')) {
        suggestions[param] = '权重分配，各资产的投资比例'
      } else if (paramLower.includes('data') || paramLower.includes('input')) {
        suggestions[param] = '输入数据，请提供具体的数据格式'
      } else if (paramLower.includes('n') && toolName.includes('queens')) {
        suggestions[param] = '棋盘大小，例如 8 表示8x8棋盘'
      } else if (paramLower.includes('puzzle') && toolName.includes('sudoku')) {
        suggestions[param] = '数独谜题，9x9的数字矩阵'
      } else {
        suggestions[param] = '请提供此参数的具体值'
      }
    })

    return suggestions
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

  /**
   * 测试MCP结果格式化 (公共方法，用于测试)
   */
  public testFormatMCPResult(toolName: string, result: any, params: Record<string, any> = {}): string {
    return this.formatMCPResult(toolName, result, params)
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