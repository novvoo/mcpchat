// Semantic Tool Matcher - 基于语义理解的工具匹配服务

import { Tool } from '@/types'
import { getMCPToolsService } from './mcp-tools'

export interface SemanticMatch {
  toolName: string
  confidence: number
  reasoning: string
  suggestedParameters?: Record<string, any>
  matchType: 'exact' | 'semantic' | 'contextual' | 'intent'
}

/**
 * 语义工具匹配器 - 使用LLM进行自然语言理解
 */
export class SemanticToolMatcher {
  private static instance: SemanticToolMatcher
  private availableTools: Tool[] = []
  private toolContexts: Map<string, string> = new Map()

  private constructor() {}

  public static getInstance(): SemanticToolMatcher {
    if (!SemanticToolMatcher.instance) {
      SemanticToolMatcher.instance = new SemanticToolMatcher()
    }
    return SemanticToolMatcher.instance
  }

  /**
   * 初始化工具上下文
   */
  async initialize(): Promise<void> {
    try {
      const mcpToolsService = getMCPToolsService()
      this.availableTools = await mcpToolsService.getAvailableTools()
      
      // 为每个工具构建丰富的上下文信息
      for (const tool of this.availableTools) {
        const context = await this.buildToolContext(tool)
        this.toolContexts.set(tool.name, context)
      }

      console.log(`Semantic tool matcher initialized with ${this.availableTools.length} tools`)
    } catch (error) {
      console.error('Failed to initialize semantic tool matcher:', error)
    }
  }

  /**
   * 构建工具的语义上下文
   */
  private async buildToolContext(tool: Tool): Promise<string> {
    let context = `工具名称: ${tool.name}\n`
    context += `描述: ${tool.description}\n`

    // 添加参数信息
    if (tool.inputSchema?.properties) {
      const params = Object.entries(tool.inputSchema.properties)
      context += `参数:\n`
      params.forEach(([name, schema]: [string, any]) => {
        context += `  - ${name}: ${schema.description || schema.type || '未知类型'}\n`
      })
    }

    // 添加使用场景
    const scenarios = this.generateUsageScenarios(tool.name, tool.description)
    if (scenarios.length > 0) {
      context += `使用场景:\n`
      scenarios.forEach(scenario => {
        context += `  - ${scenario}\n`
      })
    }

    return context
  }

  /**
   * 生成工具的使用场景
   */
  private generateUsageScenarios(toolName: string, description: string): string[] {
    const scenarios: string[] = []

    // 基于工具名称和描述生成场景
    if (toolName.includes('solve_n_queens')) {
      scenarios.push(
        '用户想解决N皇后问题',
        '用户询问如何在棋盘上放置皇后',
        '用户需要计算皇后问题的解',
        '用户想了解回溯算法的应用'
      )
    } else if (toolName.includes('solve_sudoku')) {
      scenarios.push(
        '用户想解决数独谜题',
        '用户有一个数独题目需要求解',
        '用户想验证数独答案',
        '用户询问数独解法'
      )
    } else if (toolName.includes('run_example')) {
      scenarios.push(
        '用户想看示例演示',
        '用户想测试工具功能',
        '用户需要了解如何使用',
        '用户想运行一个例子'
      )
    } else if (toolName.includes('24_point_game')) {
      scenarios.push(
        '用户想玩24点游戏',
        '用户有四个数字想算出24',
        '用户询问如何用四则运算得到24',
        '用户想解决数学游戏'
      )
    } else if (toolName.includes('chicken_rabbit')) {
      scenarios.push(
        '用户遇到鸡兔同笼问题',
        '用户想解决头腿计算问题',
        '用户有数学应用题',
        '用户询问古典数学问题'
      )
    }

    return scenarios
  }

  /**
   * 使用语义理解匹配工具
   */
  async matchTools(userInput: string): Promise<SemanticMatch[]> {
    try {
      const { getLLMService } = await import('./llm-service')
      const llmService = getLLMService()

      // 构建工具匹配提示词
      const systemPrompt = this.buildMatchingPrompt()
      const userPrompt = `用户输入: "${userInput}"`

      const response = await llmService.sendMessage([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ])

      // 解析LLM响应
      const matches = this.parseMatchingResponse(response.content)
      
      // 验证并增强匹配结果
      const validMatches = await this.validateAndEnhanceMatches(matches, userInput)

      return validMatches.sort((a, b) => b.confidence - a.confidence)

    } catch (error) {
      console.error('Semantic tool matching failed:', error)
      return []
    }
  }

  /**
   * 构建工具匹配的提示词
   */
  private buildMatchingPrompt(): string {
    const toolContexts = Array.from(this.toolContexts.entries())
      .map(([name, context]) => context)
      .join('\n---\n')

    return `你是一个智能工具匹配助手。根据用户的自然语言输入，理解其意图并推荐最合适的工具。

可用工具及其上下文：
${toolContexts}

分析原则：
1. 深度理解用户的真实意图和需求
2. 考虑用户可能的表达方式和语境
3. 匹配工具的核心功能和使用场景
4. 评估匹配的置信度和推理过程
5. 提供参数建议（如果适用）

返回JSON数组格式：
[
  {
    "toolName": "工具名称",
    "confidence": 0.0-1.0的置信度,
    "reasoning": "详细的匹配推理过程",
    "suggestedParameters": {"参数名": "建议值"},
    "matchType": "exact|semantic|contextual|intent"
  }
]

匹配类型说明：
- exact: 精确匹配工具功能
- semantic: 语义相似匹配
- contextual: 基于上下文推断
- intent: 基于用户意图推断

只返回JSON，不要其他解释。如果没有合适的工具，返回空数组[]。`
  }

  /**
   * 解析匹配响应
   */
  private parseMatchingResponse(content: string): SemanticMatch[] {
    try {
      const matches = JSON.parse(content)
      if (Array.isArray(matches)) {
        return matches.filter(match => 
          match.toolName && 
          typeof match.confidence === 'number' &&
          match.confidence >= 0 && 
          match.confidence <= 1 &&
          match.reasoning &&
          ['exact', 'semantic', 'contextual', 'intent'].includes(match.matchType)
        )
      }
    } catch (error) {
      console.warn('Failed to parse semantic matching response:', error)
    }
    return []
  }

  /**
   * 验证并增强匹配结果
   */
  private async validateAndEnhanceMatches(
    matches: SemanticMatch[], 
    userInput: string
  ): Promise<SemanticMatch[]> {
    const validMatches: SemanticMatch[] = []

    for (const match of matches) {
      // 验证工具是否存在
      const tool = this.availableTools.find(t => t.name === match.toolName)
      if (!tool) continue

      // 增强参数建议
      if (!match.suggestedParameters) {
        match.suggestedParameters = await this.generateParameterSuggestions(
          tool, 
          userInput
        )
      }

      // 调整置信度（基于工具可用性等因素）
      match.confidence = this.adjustConfidence(match, tool, userInput)

      validMatches.push(match)
    }

    return validMatches
  }

  /**
   * 生成参数建议
   */
  private async generateParameterSuggestions(
    tool: Tool, 
    userInput: string
  ): Promise<Record<string, any> | undefined> {
    try {
      // 基于用户输入和工具schema生成参数建议
      if (!tool.inputSchema?.properties) return undefined

      const suggestions: Record<string, any> = {}
      const inputLower = userInput.toLowerCase()

      // 特定工具的参数提取逻辑
      if (tool.name === 'solve_n_queens') {
        const nMatch = userInput.match(/(\d+)[\s-]*皇后|(\d+)[\s-]*queens?/i)
        if (nMatch) {
          suggestions.n = parseInt(nMatch[1] || nMatch[2])
        }
      } else if (tool.name === 'solve_24_point_game') {
        const numbers = userInput.match(/\d+/g)
        if (numbers && numbers.length >= 4) {
          suggestions.numbers = numbers.slice(0, 4).map(n => parseInt(n))
        }
      } else if (tool.name === 'solve_chicken_rabbit_problem') {
        const headsMatch = userInput.match(/(\d+)\s*(?:个)?头|头\s*(\d+)/i)
        const legsMatch = userInput.match(/(\d+)\s*(?:条)?腿|腿\s*(\d+)/i)
        if (headsMatch && legsMatch) {
          suggestions.total_heads = parseInt(headsMatch[1] || headsMatch[2])
          suggestions.total_legs = parseInt(legsMatch[1] || legsMatch[2])
        }
      }

      return Object.keys(suggestions).length > 0 ? suggestions : undefined

    } catch (error) {
      console.warn('Failed to generate parameter suggestions:', error)
      return undefined
    }
  }

  /**
   * 调整置信度
   */
  private adjustConfidence(
    match: SemanticMatch, 
    tool: Tool, 
    userInput: string
  ): number {
    let confidence = match.confidence

    // 基于匹配类型调整
    switch (match.matchType) {
      case 'exact':
        confidence *= 1.0
        break
      case 'semantic':
        confidence *= 0.9
        break
      case 'contextual':
        confidence *= 0.8
        break
      case 'intent':
        confidence *= 0.7
        break
    }

    // 基于参数匹配度调整
    if (match.suggestedParameters && Object.keys(match.suggestedParameters).length > 0) {
      confidence *= 1.1 // 有参数建议的匹配更可信
    }

    // 确保置信度在有效范围内
    return Math.min(1.0, Math.max(0.0, confidence))
  }

  /**
   * 获取工具的详细信息
   */
  getToolContext(toolName: string): string | undefined {
    return this.toolContexts.get(toolName)
  }

  /**
   * 更新工具列表
   */
  async refreshTools(): Promise<void> {
    await this.initialize()
  }
}

/**
 * 便捷函数
 */
export const getSemanticToolMatcher = () => SemanticToolMatcher.getInstance()

/**
 * 便捷函数 - 语义工具匹配
 */
export const matchToolsSemanticially = async (userInput: string): Promise<SemanticMatch[]> => {
  const matcher = getSemanticToolMatcher()
  await matcher.initialize()
  return matcher.matchTools(userInput)
}