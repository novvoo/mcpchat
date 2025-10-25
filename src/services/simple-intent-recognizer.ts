// 简单的意图识别器 - 不依赖数据库的备选方案

import { Tool } from '@/types'
import { getMCPToolsService } from './mcp-tools'

/**
 * 简单意图识别器 - 使用内存中的关键词映射
 */
export class SimpleIntentRecognizer {
  private static instance: SimpleIntentRecognizer
  private availableTools: Tool[] = []
  
  // 简化的关键词映射（仅作为最后回退）
  private readonly basicKeywordMappings: Record<string, string[]> = {
    'solve_n_queens': ['皇后', 'queens', '解决'],
    'solve_sudoku': ['数独', 'sudoku'],
    'run_example': ['示例', 'example', 'demo'],
    'install': ['安装', 'install'],
    'echo': ['回显', 'echo'],
    'info': ['信息', 'info', '帮助'],
    'solve_24_point_game': ['24点', '24 point', '得到24', '算出24', '24游戏', '加减乘除', '四则运算', 'make 24', 'get 24'],
    'solve_chicken_rabbit_problem': ['鸡兔', 'chicken rabbit']
  }

  // 动态关键词映射缓存
  private dynamicKeywordMappings: Record<string, string[]> = {}

  private constructor() {}

  public static getInstance(): SimpleIntentRecognizer {
    if (!SimpleIntentRecognizer.instance) {
      SimpleIntentRecognizer.instance = new SimpleIntentRecognizer()
    }
    return SimpleIntentRecognizer.instance
  }

  /**
   * 更新可用工具列表并尝试获取动态关键词
   */
  async updateAvailableTools(): Promise<void> {
    try {
      const mcpToolsService = getMCPToolsService()
      this.availableTools = await mcpToolsService.getAvailableTools()
      console.log(`Simple recognizer updated tools: ${this.availableTools.map(t => t.name).join(', ')}`)
      
      // 尝试从数据库获取动态关键词映射
      await this.loadDynamicKeywordMappings()
    } catch (error) {
      console.error('Failed to update available tools:', error)
      this.availableTools = []
    }
  }

  /**
   * 从数据库加载动态关键词映射
   */
  private async loadDynamicKeywordMappings(): Promise<void> {
    try {
      const { getToolMetadataService } = await import('./tool-metadata-service')
      const metadataService = getToolMetadataService()
      
      // 为每个可用工具获取关键词
      for (const tool of this.availableTools) {
        try {
          const suggestions = await metadataService.getToolSuggestions(tool.name)
          if (suggestions.length > 0) {
            this.dynamicKeywordMappings[tool.name] = suggestions[0].keywords
          }
        } catch (error) {
          console.warn(`获取工具 ${tool.name} 的动态关键词失败:`, error)
        }
      }
      
      console.log(`加载了 ${Object.keys(this.dynamicKeywordMappings).length} 个工具的动态关键词映射`)
    } catch (error) {
      console.warn('加载动态关键词映射失败，将使用基础映射:', error)
    }
  }

  /**
   * 识别用户输入的意图
   */
  async recognizeIntent(userInput: string): Promise<{
    needsMCP: boolean
    suggestedTool?: string
    confidence: number
    parameters?: Record<string, any>
    reasoning?: string
  }> {
    // 更新工具列表
    await this.updateAvailableTools()

    if (this.availableTools.length === 0) {
      return {
        needsMCP: false,
        confidence: 0,
        reasoning: 'No MCP tools available'
      }
    }

    const input = userInput.toLowerCase().trim()
    
    // 检查是否是信息查询
    if (this.isInformationQuery(input)) {
      return {
        needsMCP: false,
        confidence: 0,
        reasoning: 'Detected information query, should use LLM instead of tools'
      }
    }

    // 查找最佳匹配的工具
    let bestMatch = {
      toolName: '',
      confidence: 0,
      matchedKeywords: [] as string[]
    }

    for (const tool of this.availableTools) {
      // 优先使用动态关键词，回退到基础关键词
      const keywords = this.dynamicKeywordMappings[tool.name] || 
                      this.basicKeywordMappings[tool.name] || 
                      [tool.name]
      
      const matches = keywords.filter(keyword => 
        input.includes(keyword.toLowerCase())
      )

      if (matches.length > 0) {
        // 计算置信度
        const confidence = this.calculateConfidence(input, matches, keywords)
        
        if (confidence > bestMatch.confidence) {
          bestMatch = {
            toolName: tool.name,
            confidence,
            matchedKeywords: matches
          }
        }
      }
    }

    // 应用置信度校准
    const calibratedConfidence = this.calibrateConfidence(bestMatch.toolName, bestMatch.confidence)
    
    // 设置阈值
    const MEDIUM_CONFIDENCE_THRESHOLD = 0.4
    const shouldUseMCP = calibratedConfidence >= MEDIUM_CONFIDENCE_THRESHOLD

    // 提取参数
    const parameters = this.extractParameters(bestMatch.toolName, userInput)

    return {
      needsMCP: shouldUseMCP,
      suggestedTool: shouldUseMCP ? bestMatch.toolName : undefined,
      confidence: calibratedConfidence,
      parameters,
      reasoning: bestMatch.toolName 
        ? `Simple matcher found ${bestMatch.toolName} with ${(calibratedConfidence * 100).toFixed(1)}% confidence based on keywords: ${bestMatch.matchedKeywords.join(', ')}`
        : 'No matching tools found in simple keyword mapping'
    }
  }

  /**
   * 计算置信度
   */
  private calculateConfidence(input: string, matches: string[], allKeywords: string[]): number {
    // 基础匹配分数
    let score = 0.4
    
    // 匹配关键词数量奖励
    score += (matches.length / allKeywords.length) * 0.3
    
    // 长关键词奖励
    const avgMatchLength = matches.reduce((sum, match) => sum + match.length, 0) / matches.length
    if (avgMatchLength >= 3) {
      score += 0.2
    }
    
    // 完全匹配奖励
    if (matches.some(match => input === match.toLowerCase())) {
      score += 0.3
    }
    
    // 特殊关键词奖励（如"24点"、"24 point"等核心关键词）
    const coreKeywords = ['24点', '24 point', '数独', 'sudoku', '皇后', 'queens']
    if (matches.some(match => coreKeywords.includes(match))) {
      score += 0.2
    }
    
    return Math.min(1.0, score)
  }

  /**
   * 校准置信度（简化版本）
   */
  private calibrateConfidence(toolName: string, rawConfidence: number): number {
    // 基于工具类型的简单成功率估算
    let successRate = 0.7 // 默认成功率
    
    if (toolName.includes('echo') || toolName.includes('info')) {
      successRate = 0.95 // 简单工具成功率高
    } else if (toolName.includes('solve')) {
      successRate = 0.85 // 求解类工具成功率较高
    } else if (toolName.includes('install')) {
      successRate = 0.75 // 安装类工具可能有环境依赖
    }

    const calibratedConfidence = rawConfidence * successRate + (1 - successRate) * 0.1
    return Math.max(0.05, Math.min(0.98, calibratedConfidence))
  }

  /**
   * 提取参数
   */
  private extractParameters(toolName: string, userInput: string): Record<string, any> {
    const params: Record<string, any> = {}

    switch (toolName) {
      case 'run_example':
        params.example_name = this.extractExampleType(userInput)
        break
      case 'solve_n_queens':
        params.n = this.extractNumber(userInput, 8)
        break
      case 'solve_24_point_game':
        params.numbers = this.extract24PointNumbers(userInput)
        break
      case 'echo':
        params.message = this.extractEchoMessage(userInput)
        break
      case 'install':
        params.package = this.extractPackageName(userInput)
        params.upgrade = false
        break
    }

    return params
  }

  /**
   * 提取示例类型
   */
  private extractExampleType(input: string): string {
    if (input.includes('lp') || input.includes('linear')) return 'lp'
    if (input.includes('basic')) return 'lp'
    return 'lp'
  }

  /**
   * 提取数字
   */
  private extractNumber(input: string, defaultValue: number): number {
    const match = input.match(/\d+/)
    return match ? parseInt(match[0]) : defaultValue
  }

  /**
   * 提取回显消息
   */
  private extractEchoMessage(input: string): string {
    const match = input.match(/echo\s+(.+)/i) || input.match(/say\s+(.+)/i)
    return match ? match[1] : input
  }

  /**
   * 提取24点游戏的数字
   */
  private extract24PointNumbers(input: string): number[] {
    // 先移除 "24 point" 或 "24点" 这样的关键词，避免把24当作输入数字
    let cleanInput = input
      .replace(/24\s*point/gi, '')
      .replace(/24\s*点/g, '')
      .replace(/得到\s*24/g, '')
      .replace(/算出\s*24/g, '')
      .replace(/make\s*24/gi, '')
      .replace(/get\s*24/gi, '')
    
    // 尝试从数组格式提取: [9,32,15,27] 或 [9, 32, 15, 27]
    const arrayMatch = cleanInput.match(/\[([^\]]+)\]/)
    if (arrayMatch) {
      const numbers = arrayMatch[1].split(/[,\s]+/).map(n => parseInt(n.trim())).filter(n => !isNaN(n))
      if (numbers.length >= 4) {
        return numbers.slice(0, 4)
      }
    }
    
    // 尝试提取所有数字
    const numbers = cleanInput.match(/\d+/g)
    if (numbers && numbers.length >= 4) {
      return numbers.slice(0, 4).map(n => parseInt(n))
    }
    
    // 如果没有找到足够的数字，返回默认值
    return [8, 8, 4, 13]
  }

  /**
   * 提取包名
   */
  private extractPackageName(input: string): string {
    if (input.includes('gurddy')) return 'gurddy'
    const match = input.match(/安装\s*(\w+)|install\s+(\w+)/i)
    return match ? (match[1] || match[2]) : 'gurddy'
  }

  /**
   * 检查是否是信息查询
   */
  private isInformationQuery(input: string): boolean {
    // 如果包含明确的工具相关关键词，不应该被识别为信息查询
    const toolKeywords = ['24点', '24 point', '得到24', '算出24', '数独', 'sudoku', '皇后', 'queens']
    if (toolKeywords.some(keyword => input.includes(keyword))) {
      return false
    }

    const queryWords = [
      '什么是', '什么叫', 'what is', 'what are',
      '为什么', 'why', '原因',
      '解释', '说明', 'explain', 'describe'
    ]

    // 只有纯粹的信息查询才返回true
    return queryWords.some(word => input.includes(word)) && 
           !toolKeywords.some(keyword => input.includes(keyword))
  }
}

export const getSimpleIntentRecognizer = () => SimpleIntentRecognizer.getInstance()