// 简单的意图识别器 - 不依赖数据库的备选方案

import { Tool } from '@/types'
import { getMCPToolsService } from './mcp-tools'

/**
 * 简单意图识别器 - 使用内存中的关键词映射
 */
export class SimpleIntentRecognizer {
  private static instance: SimpleIntentRecognizer
  private availableTools: Tool[] = []
  
  // 内置关键词映射
  private readonly keywordMappings: Record<string, string[]> = {
    'solve_n_queens': [
      '皇后问题', '皇后', '8皇后', 'n皇后', '八皇后', 'queens', 'queen', 
      'n queens', 'queens problem', 'solve_n_queens', 'solve', '解决', 
      '求解', '解', 'problem', '问题'
    ],
    'solve_sudoku': [
      '数独', 'sudoku', '解数独', 'solve sudoku', '数独游戏', 'puzzle'
    ],
    'run_example': [
      '示例', '演示', 'demo', '例子', '运行示例', 'run example', 'example', 
      '测试', 'test', '样例', 'basic', 'lp'
    ],
    'install': [
      '安装', 'install', '安装包', 'package', '部署', 'setup', 'gurddy'
    ],
    'echo': [
      '回显', '重复', 'echo', 'repeat', '输出', 'output', 'hello'
    ],
    'info': [
      '信息', '详情', 'info', 'information', '帮助', 'help'
    ],
    'solve_24_point_game': [
      '24点游戏', '24点', '24 point', '算24', '数字游戏'
    ],
    'solve_chicken_rabbit_problem': [
      '鸡兔同笼', 'chicken rabbit', '鸡兔问题', '经典问题'
    ]
  }

  private constructor() {}

  public static getInstance(): SimpleIntentRecognizer {
    if (!SimpleIntentRecognizer.instance) {
      SimpleIntentRecognizer.instance = new SimpleIntentRecognizer()
    }
    return SimpleIntentRecognizer.instance
  }

  /**
   * 更新可用工具列表
   */
  async updateAvailableTools(): Promise<void> {
    try {
      const mcpToolsService = getMCPToolsService()
      this.availableTools = await mcpToolsService.getAvailableTools()
      console.log(`Simple recognizer updated tools: ${this.availableTools.map(t => t.name).join(', ')}`)
    } catch (error) {
      console.error('Failed to update available tools:', error)
      this.availableTools = []
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
      const keywords = this.keywordMappings[tool.name] || []
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
    let score = 0.3
    
    // 匹配关键词数量奖励
    score += (matches.length / allKeywords.length) * 0.4
    
    // 长关键词奖励
    const avgMatchLength = matches.reduce((sum, match) => sum + match.length, 0) / matches.length
    if (avgMatchLength >= 4) {
      score += 0.2
    }
    
    // 完全匹配奖励
    if (matches.some(match => input === match.toLowerCase())) {
      score += 0.3
    }
    
    return Math.min(1.0, score)
  }

  /**
   * 校准置信度
   */
  private calibrateConfidence(toolName: string, rawConfidence: number): number {
    const toolSuccessRates: Record<string, number> = {
      'solve_n_queens': 0.95,
      'solve_sudoku': 0.90,
      'run_example': 0.85,
      'echo': 0.98,
      'info': 0.99,
      'install': 0.75,
      'solve_24_point_game': 0.80,
      'solve_chicken_rabbit_problem': 0.88
    }

    const successRate = toolSuccessRates[toolName] || 0.7
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
    const queryWords = [
      '什么是', '什么叫', 'what is', 'what are',
      '如何', '怎么', '怎样', 'how to', 'how do',
      '为什么', 'why', '原因',
      '解释', '说明', 'explain', 'describe'
    ]

    return queryWords.some(word => input.includes(word)) ||
           input.includes('？') || input.includes('?')
  }
}

export const getSimpleIntentRecognizer = () => SimpleIntentRecognizer.getInstance()