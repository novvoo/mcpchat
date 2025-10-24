// MCP Intent Recognizer - 识别用户输入是否匹配MCP工具

import { Tool } from '@/types'
import { getMCPToolsService } from './mcp-tools'
import { getToolMetadataService } from './tool-metadata-service'

/**
 * MCP意图识别器 - 分析用户输入并匹配合适的MCP工具
 */
export class MCPIntentRecognizer {
  private static instance: MCPIntentRecognizer
  private availableTools: Tool[] = []
  private initialized = false

  private constructor() {}

  public static getInstance(): MCPIntentRecognizer {
    if (!MCPIntentRecognizer.instance) {
      MCPIntentRecognizer.instance = new MCPIntentRecognizer()
    }
    return MCPIntentRecognizer.instance
  }

  /**
   * 初始化服务
   */
  async initialize(): Promise<void> {
    if (this.initialized) return

    try {
      const metadataService = getToolMetadataService()
      await metadataService.initialize()
      
      // 刷新工具元数据
      await metadataService.refreshToolMetadata()
      
      // 确保关键词映射存在
      await metadataService.ensureKeywordMappingsExist()
      
      this.initialized = true
      console.log('MCP Intent Recognizer initialized with dynamic metadata')
    } catch (error) {
      console.error('Failed to initialize MCP Intent Recognizer:', error)
      // 继续使用基本功能，不抛出错误
    }
  }

  /**
   * 更新可用工具列表
   */
  async updateAvailableTools(): Promise<void> {
    try {
      const mcpToolsService = getMCPToolsService()
      this.availableTools = await mcpToolsService.getAvailableTools()
      console.log(`Updated available tools: ${this.availableTools.map(t => t.name).join(', ')}`)
    } catch (error) {
      console.error('Failed to update available tools:', error)
      this.availableTools = []
    }
  }

  /**
   * 识别用户输入的意图并匹配MCP工具
   */
  async recognizeIntent(userInput: string): Promise<{
    needsMCP: boolean
    suggestedTool?: string
    confidence: number
    parameters?: Record<string, any>
    reasoning?: string
  }> {
    // 确保服务已初始化
    await this.initialize()
    
    // 确保工具列表是最新的
    await this.updateAvailableTools()

    if (this.availableTools.length === 0) {
      return {
        needsMCP: false,
        confidence: 0,
        reasoning: 'No MCP tools available'
      }
    }

    const input = userInput.toLowerCase().trim()
    
    // 首先检查是否是信息查询类请求
    if (this.isInformationQuery(input)) {
      return {
        needsMCP: false,
        confidence: 0,
        reasoning: 'Detected information query, should use LLM instead of tools'
      }
    }

    // 尝试使用动态元数据服务获取工具建议
    const metadataService = getToolMetadataService()
    let suggestions = []
    
    try {
      suggestions = await metadataService.getToolSuggestions(userInput)
    } catch (error) {
      console.warn('Metadata service failed, falling back to simple recognizer:', error)
      
      // 使用简单识别器作为备选
      const { getSimpleIntentRecognizer } = await import('./simple-intent-recognizer')
      const simpleRecognizer = getSimpleIntentRecognizer()
      return await simpleRecognizer.recognizeIntent(userInput)
    }

    if (suggestions.length === 0) {
      console.warn('No suggestions from metadata service, falling back to simple recognizer')
      
      // 使用简单识别器作为备选
      const { getSimpleIntentRecognizer } = await import('./simple-intent-recognizer')
      const simpleRecognizer = getSimpleIntentRecognizer()
      return await simpleRecognizer.recognizeIntent(userInput)
    }

    // 选择最佳匹配并校准置信度
    const bestSuggestion = suggestions[0]
    const calibratedConfidence = this.calibrateConfidence(bestSuggestion.toolName, bestSuggestion.confidence)
    
    // 提取参数
    const parameters = await this.extractParameters(bestSuggestion.toolName, userInput)

    // 改进的置信度阈值设置
    const HIGH_CONFIDENCE_THRESHOLD = 0.7  // 高置信度：直接执行
    const MEDIUM_CONFIDENCE_THRESHOLD = 0.4 // 中等置信度：可以执行但需要更多验证
    const LOW_CONFIDENCE_THRESHOLD = 0.2   // 低置信度：不建议执行

    // 根据校准后的置信度等级决定是否使用MCP工具
    const shouldUseMCP = calibratedConfidence >= MEDIUM_CONFIDENCE_THRESHOLD
    
    // 生成更详细的推理说明
    let confidenceLevel = 'low'
    if (calibratedConfidence >= HIGH_CONFIDENCE_THRESHOLD) {
      confidenceLevel = 'high'
    } else if (calibratedConfidence >= MEDIUM_CONFIDENCE_THRESHOLD) {
      confidenceLevel = 'medium'
    }

    return {
      needsMCP: shouldUseMCP,
      suggestedTool: shouldUseMCP ? bestSuggestion.toolName : undefined,
      confidence: calibratedConfidence,
      parameters,
      reasoning: `Tool ${bestSuggestion.toolName} matched with ${confidenceLevel} confidence (${(calibratedConfidence * 100).toFixed(1)}%, raw: ${(bestSuggestion.confidence * 100).toFixed(1)}%) based on keywords: ${bestSuggestion.keywords.join(', ')}`
    }
  }

  /**
   * 使用动态元数据提取参数
   */
  private async extractParameters(toolName: string, userInput: string): Promise<Record<string, any>> {
    const metadataService = getToolMetadataService()
    const params: Record<string, any> = {}

    try {
      // 根据工具类型提取参数
      if (toolName === 'solve_n_queens') {
        params.n = this.extractNumberParameter(userInput, 'queens', 8)
      } else if (toolName === 'solve_sudoku') {
        params.puzzle = this.extractSudokuGrid(userInput)
      } else if (toolName === 'run_example') {
        // 使用动态参数映射
        const exampleType = await this.extractExampleType(userInput, metadataService)
        params.example_name = exampleType  // 修正：参数名应该是 example_name
      } else if (toolName === 'echo') {
        params.message = this.extractEchoMessage(userInput)
      }

      console.log(`Extracted parameters for ${toolName}:`, params)
      return params
    } catch (error) {
      console.error(`Error extracting parameters for ${toolName}:`, error)
      return {}
    }
  }

  /**
   * 提取数字参数
   */
  private extractNumberParameter(input: string, context: string, defaultValue: number): number {
    const numberMatch = input.match(new RegExp(`(\\d+)\\s*(?:${context}|皇后)`, 'i'))
    return numberMatch ? parseInt(numberMatch[1]) : defaultValue
  }

  /**
   * 提取数独网格
   */
  private extractSudokuGrid(input: string): number[][] {
    const gridPattern = /\[[\[\d\s,\]]+\]/
    if (gridPattern.test(input)) {
      try {
        const gridMatch = input.match(gridPattern)
        if (gridMatch) {
          const grid = JSON.parse(gridMatch[0])
          if (Array.isArray(grid) && grid.length === 9) {
            return grid
          }
        }
      } catch (error) {
        console.warn('Failed to parse sudoku grid:', error)
      }
    }

    // 返回默认数独
    return [
      [5,3,0,0,7,0,0,0,0],
      [6,0,0,1,9,5,0,0,0],
      [0,9,8,0,0,0,0,6,0],
      [8,0,0,0,6,0,0,0,3],
      [4,0,0,8,0,3,0,0,1],
      [7,0,0,0,2,0,0,0,6],
      [0,6,0,0,0,0,2,8,0],
      [0,0,0,4,1,9,0,0,5],
      [0,0,0,0,8,0,0,7,9]
    ]
  }

  /**
   * 使用动态元数据提取示例类型
   */
  private async extractExampleType(input: string, metadataService: any): Promise<string> {
    // 首先尝试从输入中提取类型
    const typeMatch = input.match(/run\s+example\s+([a-zA-Z_]+)/i) ||
                     input.match(/example\s+([a-zA-Z_]+)/i) ||
                     input.match(/(?:type|类型)[=:\s]+([a-zA-Z_]+)/i) ||
                     input.match(/run\s+([a-zA-Z_]+)\s+example/i)

    if (typeMatch) {
      const rawType = typeMatch[1].toLowerCase()
      
      // 使用动态参数映射
      const mappedType = await metadataService.getParameterMapping('run_example', rawType)
      if (mappedType) {
        console.log(`Mapped "${rawType}" to "${mappedType}" using dynamic metadata`)
        return mappedType
      }
      
      // 如果没有映射，返回原始类型
      return rawType
    }

    // 默认返回 lp
    return 'lp'
  }

  /**
   * 提取回显消息
   */
  private extractEchoMessage(input: string): string {
    const echoMatch = input.match(/echo[:\s]+(.+)/i) ||
                     input.match(/say[:\s]+(.+)/i) ||
                     input.match(/repeat[:\s]+(.+)/i)

    return echoMatch ? echoMatch[1].trim() : input
  }



  /**
   * 获取工具的使用建议
   */
  async getToolSuggestions(userInput: string): Promise<Array<{
    toolName: string
    description: string
    confidence: number
    suggestedParams?: Record<string, any>
  }>> {
    await this.updateAvailableTools()
    
    // 使用动态元数据服务获取建议
    const metadataService = getToolMetadataService()
    const suggestions = await metadataService.getToolSuggestions(userInput)
    
    return suggestions.map(suggestion => ({
      toolName: suggestion.toolName,
      description: this.availableTools.find(t => t.name === suggestion.toolName)?.description || '',
      confidence: suggestion.confidence,
      suggestedParams: {}
    }))
  }

  /**
   * 检查输入是否明确要求使用特定工具
   */
  isExplicitToolRequest(userInput: string): boolean {
    const explicitPatterns = [
      /use\s+tool/i,
      /call\s+tool/i,
      /execute\s+tool/i,
      /run\s+tool/i,
      /使用工具/,
      /调用工具/,
      /执行工具/
    ]

    return explicitPatterns.some(pattern => pattern.test(userInput))
  }

  /**
   * 检查是否是信息查询类请求
   */
  private isInformationQuery(input: string): boolean {
    // 信息查询的关键词
    const queryWords = [
      '什么是', '什么叫', 'what is', 'what are',
      '如何', '怎么', '怎样', 'how to', 'how do',
      '为什么', 'why', '原因',
      '解释', '说明', 'explain', 'describe',
      '介绍', 'introduce', 'tell me about',
      '定义', 'definition', 'meaning',
      '规则', 'rules', '原理', 'principle'
    ]

    // 疑问词
    const questionWords = ['？', '?', '吗', '呢']

    // 检查是否包含查询关键词
    const hasQueryWords = queryWords.some(word => input.includes(word))
    
    // 检查是否包含疑问词
    const hasQuestionWords = questionWords.some(word => input.includes(word))

    // 检查是否以疑问词开头
    const startsWithQuestion = /^(什么|如何|怎么|怎样|为什么|why|what|how|where|when|who)/i.test(input)

    return hasQueryWords || hasQuestionWords || startsWithQuestion
  }

  /**
   * 校准置信度 - 根据工具的历史成功率调整置信度
   */
  private calibrateConfidence(toolName: string, rawConfidence: number): number {
    // 工具成功率映射 (可以从数据库或配置中获取)
    const toolSuccessRates: Record<string, number> = {
      'solve_n_queens': 0.95,      // N皇后问题通常很准确
      'solve_sudoku': 0.90,        // 数独求解也很准确
      'run_example': 0.85,         // 示例运行相对可靠
      'echo': 0.98,                // Echo最简单最可靠
      'info': 0.99,                // Info查询最可靠
      'solve_24_point_game': 0.80, // 24点游戏稍微复杂
      'solve_chicken_rabbit_problem': 0.88, // 鸡兔同笼问题较准确
      'install': 0.75              // 安装操作可能有环境依赖
    }

    const successRate = toolSuccessRates[toolName] || 0.7 // 默认成功率70%
    
    // 使用贝叶斯方法校准置信度
    // 校准后的置信度 = 原始置信度 * 成功率 + 调整因子
    const calibratedConfidence = rawConfidence * successRate + (1 - successRate) * 0.1
    
    // 确保置信度在合理范围内
    return Math.max(0.05, Math.min(0.98, calibratedConfidence))
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    totalTools: number
    keywordMappings: number
    lastUpdate: Date
    confidenceCalibration: boolean
  } {
    return {
      totalTools: this.availableTools.length,
      keywordMappings: 0, // 现在使用动态元数据，不再有固定的关键词映射
      lastUpdate: new Date(),
      confidenceCalibration: true // 表示启用了置信度校准
    }
  }
}

/**
 * 便捷函数
 */
export const getMCPIntentRecognizer = () => MCPIntentRecognizer.getInstance()

/**
 * 快速意图识别
 */
export const recognizeUserIntent = async (userInput: string) => {
  const recognizer = getMCPIntentRecognizer()
  return recognizer.recognizeIntent(userInput)
}