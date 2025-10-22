// MCP Intent Recognizer - 识别用户输入是否匹配MCP工具

import { Tool } from '@/types'
import { getMCPToolsService } from './mcp-tools'

/**
 * MCP意图识别器 - 分析用户输入并匹配合适的MCP工具
 */
export class MCPIntentRecognizer {
  private static instance: MCPIntentRecognizer
  private toolKeywords: Map<string, string[]> = new Map()
  private availableTools: Tool[] = []

  private constructor() {
    this.initializeKeywords()
  }

  public static getInstance(): MCPIntentRecognizer {
    if (!MCPIntentRecognizer.instance) {
      MCPIntentRecognizer.instance = new MCPIntentRecognizer()
    }
    return MCPIntentRecognizer.instance
  }

  /**
   * 初始化工具关键词映射
   */
  private initializeKeywords(): void {
    // 为不同的工具定义关键词
    this.toolKeywords.set('solve_n_queens', [
      'n queens', 'n-queens', 'queens problem', '皇后问题', '八皇后', 'n皇后',
      'chess queens', 'queens puzzle', 'queens solution'
    ])

    this.toolKeywords.set('solve_sudoku', [
      'sudoku', '数独', 'sudoku puzzle', 'sudoku solver', '数独游戏',
      'solve sudoku', '解数独', 'sudoku solution'
    ])

    this.toolKeywords.set('run_example', [
      'run example', '运行示例', 'example', '示例', 'demo', '演示',
      'test run', '测试运行', 'execute example'
    ])

    this.toolKeywords.set('echo', [
      'echo', '回显', 'repeat', '重复', 'say back', '说回来'
    ])
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
    shouldUseMCP: boolean
    matchedTool?: string
    confidence: number
    extractedParams?: Record<string, any>
    reasoning?: string
  }> {
    // 确保工具列表是最新的
    await this.updateAvailableTools()

    if (this.availableTools.length === 0) {
      return {
        shouldUseMCP: false,
        confidence: 0,
        reasoning: 'No MCP tools available'
      }
    }

    const input = userInput.toLowerCase().trim()
    let bestMatch = {
      tool: '',
      confidence: 0,
      params: {} as Record<string, any>,
      reasoning: ''
    }

    // 检查每个可用工具
    for (const tool of this.availableTools) {
      const match = this.matchToolToInput(tool.name, input, userInput)
      if (match.confidence > bestMatch.confidence) {
        bestMatch = {
          tool: tool.name,
          confidence: match.confidence,
          params: match.params,
          reasoning: match.reasoning
        }
      }
    }

    // 设置置信度阈值
    const CONFIDENCE_THRESHOLD = 0.6

    return {
      shouldUseMCP: bestMatch.confidence >= CONFIDENCE_THRESHOLD,
      matchedTool: bestMatch.confidence >= CONFIDENCE_THRESHOLD ? bestMatch.tool : undefined,
      confidence: bestMatch.confidence,
      extractedParams: bestMatch.params,
      reasoning: bestMatch.reasoning
    }
  }

  /**
   * 匹配特定工具到用户输入
   */
  private matchToolToInput(toolName: string, input: string, originalInput: string): {
    confidence: number
    params: Record<string, any>
    reasoning: string
  } {
    const keywords = this.toolKeywords.get(toolName) || []
    let confidence = 0
    let params: Record<string, any> = {}
    let reasoning = ''

    // 关键词匹配
    const keywordMatches = keywords.filter(keyword => 
      input.includes(keyword.toLowerCase())
    )

    if (keywordMatches.length > 0) {
      confidence += 0.7 * (keywordMatches.length / keywords.length)
      reasoning += `Matched keywords: ${keywordMatches.join(', ')}. `
    }

    // 特定工具的参数提取和额外匹配逻辑
    switch (toolName) {
      case 'solve_n_queens':
        confidence += this.matchNQueens(input, params)
        break
      
      case 'solve_sudoku':
        confidence += this.matchSudoku(input, originalInput, params)
        break
      
      case 'run_example':
        confidence += this.matchExample(input, params)
        break
      
      case 'echo':
        confidence += this.matchEcho(input, originalInput, params)
        break
    }

    return { confidence: Math.min(confidence, 1.0), params, reasoning }
  }

  /**
   * N皇后问题匹配逻辑
   */
  private matchNQueens(input: string, params: Record<string, any>): number {
    let confidence = 0

    // 查找数字
    const numberMatch = input.match(/(\d+)\s*(?:queens?|皇后)/i) || 
                       input.match(/(\d+)\s*x\s*\d+/) ||
                       input.match(/size\s*[=:]\s*(\d+)/i) ||
                       input.match(/n\s*[=:]\s*(\d+)/i)

    if (numberMatch) {
      const n = parseInt(numberMatch[1])
      if (n >= 1 && n <= 20) { // 合理的范围
        params.n = n
        confidence += 0.3
      }
    } else {
      // 默认8皇后
      params.n = 8
      confidence += 0.1
    }

    // 检查问题相关词汇
    const problemWords = ['solve', 'solution', 'problem', '解决', '求解', '问题']
    if (problemWords.some(word => input.includes(word))) {
      confidence += 0.2
    }

    return confidence
  }

  /**
   * 数独匹配逻辑
   */
  private matchSudoku(input: string, originalInput: string, params: Record<string, any>): number {
    let confidence = 0

    // 检查是否包含数独网格
    const gridPattern = /\[[\[\d\s,\]]+\]/
    if (gridPattern.test(originalInput)) {
      try {
        const gridMatch = originalInput.match(gridPattern)
        if (gridMatch) {
          const grid = JSON.parse(gridMatch[0])
          if (Array.isArray(grid) && grid.length === 9) {
            params.puzzle = grid
            confidence += 0.4
          }
        }
      } catch (error) {
        // 解析失败，使用默认数独
      }
    }

    // 如果没有提供网格，使用示例数独
    if (!params.puzzle) {
      params.puzzle = [
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
      confidence += 0.1
    }

    return confidence
  }

  /**
   * 示例运行匹配逻辑
   */
  private matchExample(input: string, params: Record<string, any>): number {
    let confidence = 0

    // 提取示例类型
    const typeMatch = input.match(/(?:type|类型)[=:\s]+([a-zA-Z_]+)/i) ||
                     input.match(/run\s+([a-zA-Z_]+)\s+example/i) ||
                     input.match(/([a-zA-Z_]+)\s+example/i)

    if (typeMatch) {
      params.example_type = typeMatch[1]
      confidence += 0.3
    } else {
      params.example_type = 'basic'
      confidence += 0.1
    }

    return confidence
  }

  /**
   * 回显匹配逻辑
   */
  private matchEcho(input: string, originalInput: string, params: Record<string, any>): number {
    let confidence = 0

    // 提取要回显的消息
    const echoMatch = originalInput.match(/echo[:\s]+(.+)/i) ||
                     originalInput.match(/say[:\s]+(.+)/i) ||
                     originalInput.match(/repeat[:\s]+(.+)/i)

    if (echoMatch) {
      params.message = echoMatch[1].trim()
      confidence += 0.4
    } else {
      // 如果没有明确的echo指令，但包含echo关键词，使用整个输入
      params.message = originalInput
      confidence += 0.2
    }

    return confidence
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
    
    const suggestions = []
    const input = userInput.toLowerCase()

    for (const tool of this.availableTools) {
      const match = this.matchToolToInput(tool.name, input, userInput)
      if (match.confidence > 0.3) {
        suggestions.push({
          toolName: tool.name,
          description: tool.description,
          confidence: match.confidence,
          suggestedParams: match.params
        })
      }
    }

    return suggestions.sort((a, b) => b.confidence - a.confidence)
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
   * 获取统计信息
   */
  getStats(): {
    totalTools: number
    keywordMappings: number
    lastUpdate: Date
  } {
    return {
      totalTools: this.availableTools.length,
      keywordMappings: this.toolKeywords.size,
      lastUpdate: new Date()
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