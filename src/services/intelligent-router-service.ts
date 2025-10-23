// 智能路由服务 - 基于学习的工具选择和参数映射
// 替代硬编码的工具路由逻辑，实现自适应的智能选择

import { getDynamicConfigService } from './dynamic-config-service'
import { getToolVectorStore } from './tool-vector-store'
import { MCPServerManager } from './mcp-server-manager'
import { getDatabaseService } from './database'
import { Tool } from '@/types'

export interface ToolSuggestion {
  tool: Tool
  serverName: string
  confidence: number
  reasoning: string
  suggestedParameters: Record<string, any>
  estimatedExecutionTime?: number
  successProbability?: number
}

export interface RoutingContext {
  userInput: string
  conversationHistory?: Array<{ role: string; content: string }>
  userPreferences?: Record<string, any>
  sessionId?: string
  previousTools?: string[]
}

export interface RoutingResult {
  suggestions: ToolSuggestion[]
  fallbackOptions: ToolSuggestion[]
  confidence: number
  processingTime: number
  reasoning: string[]
}

/**
 * 智能路由服务 - 基于机器学习的工具选择
 */
export class IntelligentRouterService {
  private static instance: IntelligentRouterService
  private configService = getDynamicConfigService()
  private vectorStore = getToolVectorStore()
  private mcpManager = MCPServerManager.getInstance()

  private constructor() {}

  public static getInstance(): IntelligentRouterService {
    if (!IntelligentRouterService.instance) {
      IntelligentRouterService.instance = new IntelligentRouterService()
    }
    return IntelligentRouterService.instance
  }

  /**
   * 智能路由 - 主要入口点
   */
  async routeUserInput(context: RoutingContext): Promise<RoutingResult> {
    const startTime = Date.now()
    const reasoning: string[] = []

    try {
      reasoning.push('开始智能路由分析...')

      // 1. 多策略工具发现
      const discoveryResults = await this.discoverTools(context)
      reasoning.push(`发现 ${discoveryResults.length} 个潜在工具匹配`)

      // 2. 上下文增强
      const enhancedResults = await this.enhanceWithContext(discoveryResults, context)
      reasoning.push('应用上下文增强和历史学习')

      // 3. 参数智能映射
      const parametrizedResults = await this.mapParameters(enhancedResults, context)
      reasoning.push('完成智能参数映射')

      // 4. 性能预测和排序
      const rankedResults = await this.rankAndPredict(parametrizedResults, context)
      reasoning.push('基于性能预测完成排序')

      // 5. 生成备选方案
      const fallbackOptions = await this.generateFallbackOptions(context, rankedResults)
      reasoning.push(`生成 ${fallbackOptions.length} 个备选方案`)

      const processingTime = Date.now() - startTime
      const overallConfidence = this.calculateOverallConfidence(rankedResults)

      return {
        suggestions: rankedResults.slice(0, 5), // 返回前5个建议
        fallbackOptions,
        confidence: overallConfidence,
        processingTime,
        reasoning
      }
    } catch (error) {
      console.error('智能路由失败:', error)
      reasoning.push(`路由失败: ${error instanceof Error ? error.message : '未知错误'}`)
      
      return {
        suggestions: [],
        fallbackOptions: [],
        confidence: 0,
        processingTime: Date.now() - startTime,
        reasoning
      }
    }
  }

  /**
   * 多策略工具发现
   */
  private async discoverTools(context: RoutingContext): Promise<ToolSuggestion[]> {
    const suggestions: ToolSuggestion[] = []

    // 策略1: 基于学习的模式匹配
    const learnedMappings = await this.configService.findBestToolForInput(context.userInput)
    for (const mapping of learnedMappings) {
      const tool = await this.getToolByName(mapping.toolName)
      if (tool) {
        suggestions.push({
          tool: tool.tool,
          serverName: tool.serverName,
          confidence: mapping.confidence * mapping.successRate,
          reasoning: `学习模式匹配: "${mapping.patternText}" (置信度: ${mapping.confidence.toFixed(2)})`,
          suggestedParameters: mapping.parameterHints,
          successProbability: mapping.successRate
        })
      }
    }

    // 策略2: 向量语义搜索
    if (this.vectorStore.isReady()) {
      const vectorResults = await this.vectorStore.searchTools(context.userInput, 3)
      for (const result of vectorResults) {
        const serverName = await this.findServerForTool(result.tool.name)
        if (serverName) {
          suggestions.push({
            tool: result.tool,
            serverName,
            confidence: result.similarity * 0.8, // 向量搜索权重稍低
            reasoning: `语义相似度匹配 (相似度: ${result.similarity.toFixed(2)})`,
            suggestedParameters: {}
          })
        }
      }
    }

    // 策略3: 关键词和规则匹配
    const ruleBasedResults = await this.applyRuleBasedMatching(context.userInput)
    suggestions.push(...ruleBasedResults)

    // 策略4: 上下文感知匹配
    if (context.conversationHistory) {
      const contextualResults = await this.applyContextualMatching(context)
      suggestions.push(...contextualResults)
    }

    return this.deduplicateSuggestions(suggestions)
  }

  /**
   * 上下文增强
   */
  private async enhanceWithContext(
    suggestions: ToolSuggestion[], 
    context: RoutingContext
  ): Promise<ToolSuggestion[]> {
    const enhanced: ToolSuggestion[] = []

    for (const suggestion of suggestions) {
      let enhancedConfidence = suggestion.confidence

      // 基于会话历史调整置信度
      if (context.conversationHistory) {
        const historyBoost = this.calculateHistoryBoost(suggestion.tool.name, context.conversationHistory)
        enhancedConfidence *= (1 + historyBoost)
      }

      // 基于用户偏好调整
      if (context.userPreferences) {
        const preferenceBoost = this.calculatePreferenceBoost(suggestion, context.userPreferences)
        enhancedConfidence *= (1 + preferenceBoost)
      }

      // 基于最近使用的工具调整
      if (context.previousTools) {
        const recentUsageBoost = this.calculateRecentUsageBoost(suggestion.tool.name, context.previousTools)
        enhancedConfidence *= (1 + recentUsageBoost)
      }

      enhanced.push({
        ...suggestion,
        confidence: Math.min(enhancedConfidence, 1.0), // 确保不超过1.0
        reasoning: suggestion.reasoning + this.getEnhancementReasoning(suggestion, context)
      })
    }

    return enhanced
  }

  /**
   * 智能参数映射
   */
  private async mapParameters(
    suggestions: ToolSuggestion[], 
    context: RoutingContext
  ): Promise<ToolSuggestion[]> {
    const parametrized: ToolSuggestion[] = []

    for (const suggestion of suggestions) {
      // 获取学习到的参数映射
      const learnedParams = await this.configService.getParameterMappings(
        suggestion.tool.name, 
        context.userInput
      )

      // 基于工具schema智能推断参数
      const inferredParams = await this.inferParametersFromSchema(
        suggestion.tool, 
        context.userInput
      )

      // 合并参数
      const combinedParams = {
        ...suggestion.suggestedParameters,
        ...inferredParams,
        ...learnedParams
      }

      // 验证参数
      const validatedParams = this.validateParameters(suggestion.tool, combinedParams)

      parametrized.push({
        ...suggestion,
        suggestedParameters: validatedParams,
        reasoning: suggestion.reasoning + ` | 参数映射: ${Object.keys(validatedParams).length}个参数`
      })
    }

    return parametrized
  }

  /**
   * 性能预测和排序
   */
  private async rankAndPredict(
    suggestions: ToolSuggestion[], 
    context: RoutingContext
  ): Promise<ToolSuggestion[]> {
    const withPredictions: ToolSuggestion[] = []

    for (const suggestion of suggestions) {
      // 预测执行时间
      const estimatedTime = await this.predictExecutionTime(suggestion)
      
      // 预测成功概率
      const successProb = await this.predictSuccessProbability(suggestion, context)

      withPredictions.push({
        ...suggestion,
        estimatedExecutionTime: estimatedTime,
        successProbability: successProb
      })
    }

    // 综合排序：置信度 + 成功概率 + 执行时间倒数
    return withPredictions.sort((a, b) => {
      const scoreA = this.calculateOverallScore(a)
      const scoreB = this.calculateOverallScore(b)
      return scoreB - scoreA
    })
  }

  /**
   * 生成备选方案
   */
  private async generateFallbackOptions(
    context: RoutingContext, 
    primarySuggestions: ToolSuggestion[]
  ): Promise<ToolSuggestion[]> {
    const fallbacks: ToolSuggestion[] = []

    // 1. 通用工具作为备选
    const genericTools = await this.getGenericTools()
    for (const tool of genericTools) {
      if (!primarySuggestions.some(s => s.tool.name === tool.tool.name)) {
        fallbacks.push({
          ...tool,
          confidence: 0.3,
          reasoning: '通用备选工具',
          suggestedParameters: {}
        })
      }
    }

    // 2. 相似功能的工具
    const similarTools = await this.findSimilarTools(primarySuggestions)
    fallbacks.push(...similarTools)

    // 3. 最近成功的工具
    if (context.sessionId) {
      const recentSuccessful = await this.getRecentSuccessfulTools(context.sessionId)
      fallbacks.push(...recentSuccessful)
    }

    return fallbacks.slice(0, 3) // 最多3个备选方案
  }

  /**
   * 学习用户反馈
   */
  async learnFromExecution(
    context: RoutingContext,
    selectedTool: string,
    parameters: Record<string, any>,
    executionResult: {
      success: boolean
      executionTime: number
      error?: string
      userSatisfaction?: number
    }
  ): Promise<void> {
    try {
      // 1. 更新工具映射学习
      await this.configService.learnFromUserChoice(
        context.userInput,
        selectedTool,
        executionResult.success
      )

      // 2. 更新参数映射学习
      await this.learnParameterMappings(selectedTool, context.userInput, parameters, executionResult.success)

      // 3. 记录性能指标
      const serverName = await this.findServerForTool(selectedTool)
      if (serverName) {
        await this.configService.recordToolPerformance(
          selectedTool,
          serverName,
          executionResult.executionTime,
          executionResult.success,
          executionResult.error ? 'execution_error' : undefined,
          executionResult.error
        )
      }

      // 4. 记录用户行为模式
      await this.recordUserBehavior(context, selectedTool, parameters, executionResult)

      console.log(`学习完成: ${selectedTool} (成功: ${executionResult.success})`)
    } catch (error) {
      console.error('学习过程失败:', error)
    }
  }

  /**
   * 获取路由统计信息
   */
  async getRoutingStats(days: number = 7): Promise<any> {
    try {
      const toolStats = await this.configService.getToolPerformanceStats(undefined, days)
      
      const dbService = getDatabaseService()
      const client = await dbService.getClient()
      
      if (!client) {
        return { toolStats, userBehaviorStats: null }
      }

      try {
        // 用户行为统计
        const behaviorStats = await client.query(`
          SELECT 
            selected_tool,
            COUNT(*) as usage_count,
            AVG(CASE WHEN execution_success THEN 1.0 ELSE 0.0 END) as success_rate,
            AVG(user_satisfaction) as avg_satisfaction,
            AVG(interaction_duration) as avg_duration
          FROM user_behavior_patterns 
          WHERE created_at >= NOW() - INTERVAL '${days} days'
          GROUP BY selected_tool
          ORDER BY usage_count DESC
        `)

        return {
          toolStats,
          userBehaviorStats: behaviorStats.rows
        }
      } finally {
        client.release()
      }
    } catch (error) {
      console.error('获取路由统计失败:', error)
      return { toolStats: null, userBehaviorStats: null }
    }
  }

  // 私有辅助方法

  private async getToolByName(toolName: string): Promise<{ tool: Tool; serverName: string } | null> {
    const servers = this.mcpManager.getServerStatus()
    
    for (const [serverName, serverInfo] of Object.entries(servers)) {
      if (serverInfo.status === 'connected') {
        const tool = serverInfo.tools.find(t => t.name === toolName)
        if (tool) {
          return { tool, serverName }
        }
      }
    }
    
    return null
  }

  private async findServerForTool(toolName: string): Promise<string | null> {
    const result = await this.getToolByName(toolName)
    return result?.serverName || null
  }

  private async applyRuleBasedMatching(userInput: string): Promise<ToolSuggestion[]> {
    const suggestions: ToolSuggestion[] = []
    
    // 硬编码规则作为备选（逐步迁移到数据库）
    const rules = [
      { pattern: /皇后|queens/i, tool: 'solve_n_queens', confidence: 0.8 },
      { pattern: /数独|sudoku/i, tool: 'solve_sudoku', confidence: 0.8 },
      { pattern: /示例|example|demo/i, tool: 'run_example', confidence: 0.7 },
      { pattern: /回显|echo/i, tool: 'echo', confidence: 0.9 }
    ]

    for (const rule of rules) {
      if (rule.pattern.test(userInput)) {
        const toolInfo = await this.getToolByName(rule.tool)
        if (toolInfo) {
          suggestions.push({
            tool: toolInfo.tool,
            serverName: toolInfo.serverName,
            confidence: rule.confidence,
            reasoning: `规则匹配: ${rule.pattern.source}`,
            suggestedParameters: {}
          })
        }
      }
    }

    return suggestions
  }

  private async applyContextualMatching(context: RoutingContext): Promise<ToolSuggestion[]> {
    // 基于对话历史的上下文匹配
    // 这里可以实现更复杂的上下文分析逻辑
    return []
  }

  private deduplicateSuggestions(suggestions: ToolSuggestion[]): ToolSuggestion[] {
    const seen = new Map<string, ToolSuggestion>()
    
    for (const suggestion of suggestions) {
      const key = `${suggestion.tool.name}:${suggestion.serverName}`
      const existing = seen.get(key)
      
      if (!existing || suggestion.confidence > existing.confidence) {
        seen.set(key, suggestion)
      }
    }
    
    return Array.from(seen.values())
  }

  private calculateHistoryBoost(toolName: string, history: Array<{ role: string; content: string }>): number {
    // 基于历史对话计算工具相关性提升
    const recentMentions = history.slice(-5).filter(msg => 
      msg.content.toLowerCase().includes(toolName.toLowerCase())
    ).length
    
    return recentMentions * 0.1 // 每次提及增加10%
  }

  private calculatePreferenceBoost(suggestion: ToolSuggestion, preferences: Record<string, any>): number {
    // 基于用户偏好计算提升
    const preferredCategories = preferences.categories || []
    const preferredTools = preferences.tools || []
    
    let boost = 0
    if (preferredTools.includes(suggestion.tool.name)) {
      boost += 0.2
    }
    // 可以添加更多偏好逻辑
    
    return boost
  }

  private calculateRecentUsageBoost(toolName: string, recentTools: string[]): number {
    const recentIndex = recentTools.indexOf(toolName)
    if (recentIndex === -1) return 0
    
    // 越近使用的工具获得越高的提升
    return (recentTools.length - recentIndex) * 0.05
  }

  private getEnhancementReasoning(suggestion: ToolSuggestion, context: RoutingContext): string {
    const reasons: string[] = []
    
    if (context.conversationHistory) {
      reasons.push('历史增强')
    }
    if (context.userPreferences) {
      reasons.push('偏好匹配')
    }
    if (context.previousTools) {
      reasons.push('使用模式')
    }
    
    return reasons.length > 0 ? ` | 增强: ${reasons.join(', ')}` : ''
  }

  private async inferParametersFromSchema(tool: Tool, userInput: string): Promise<Record<string, any>> {
    const parameters: Record<string, any> = {}
    
    // 基于工具schema和用户输入推断参数
    if (tool.inputSchema && tool.inputSchema.properties) {
      for (const [paramName, paramSchema] of Object.entries(tool.inputSchema.properties)) {
        const inferredValue = this.inferParameterValue(paramName, paramSchema as any, userInput)
        if (inferredValue !== undefined) {
          parameters[paramName] = inferredValue
        }
      }
    }
    
    return parameters
  }

  private inferParameterValue(paramName: string, schema: any, userInput: string): any {
    // 基于参数名称、schema和用户输入推断参数值
    if (schema.type === 'number' || schema.type === 'integer') {
      const numbers = userInput.match(/\d+/g)
      if (numbers) {
        const num = parseInt(numbers[0])
        if (schema.minimum && num < schema.minimum) return schema.minimum
        if (schema.maximum && num > schema.maximum) return schema.maximum
        return num
      }
    }
    
    if (schema.type === 'string' && schema.enum) {
      for (const option of schema.enum) {
        if (userInput.toLowerCase().includes(option.toLowerCase())) {
          return option
        }
      }
    }
    
    return schema.default
  }

  private validateParameters(tool: Tool, parameters: Record<string, any>): Record<string, any> {
    const validated: Record<string, any> = {}
    
    if (!tool.inputSchema || !tool.inputSchema.properties) {
      return parameters
    }
    
    for (const [key, value] of Object.entries(parameters)) {
      const schema = tool.inputSchema.properties[key] as any
      if (schema) {
        // 基本类型验证
        if (this.isValidParameter(value, schema)) {
          validated[key] = value
        }
      }
    }
    
    return validated
  }

  private isValidParameter(value: any, schema: any): boolean {
    if (schema.type === 'number' || schema.type === 'integer') {
      const num = Number(value)
      if (isNaN(num)) return false
      if (schema.minimum && num < schema.minimum) return false
      if (schema.maximum && num > schema.maximum) return false
      return true
    }
    
    if (schema.type === 'string') {
      if (schema.enum && !schema.enum.includes(value)) return false
      return true
    }
    
    return true
  }

  private async predictExecutionTime(suggestion: ToolSuggestion): Promise<number> {
    // 基于历史性能数据预测执行时间
    const stats = await this.configService.getToolPerformanceStats(suggestion.tool.name, 7)
    if (stats && stats.length > 0) {
      return Math.round(stats[0].avg_execution_time || 1000)
    }
    return 1000 // 默认1秒
  }

  private async predictSuccessProbability(suggestion: ToolSuggestion, context: RoutingContext): Promise<number> {
    // 基于历史数据和当前上下文预测成功概率
    let baseProbability = suggestion.successProbability || 0.8
    
    // 可以基于更多因素调整概率
    // 例如：参数完整性、服务器状态、历史成功率等
    
    return Math.min(baseProbability, 1.0)
  }

  private calculateOverallScore(suggestion: ToolSuggestion): number {
    const confidence = suggestion.confidence || 0
    const successProb = suggestion.successProbability || 0.5
    const timeScore = suggestion.estimatedExecutionTime ? 1 / (suggestion.estimatedExecutionTime / 1000) : 1
    
    // 综合评分：置信度(50%) + 成功概率(30%) + 时间效率(20%)
    return confidence * 0.5 + successProb * 0.3 + Math.min(timeScore, 1) * 0.2
  }

  private calculateOverallConfidence(suggestions: ToolSuggestion[]): number {
    if (suggestions.length === 0) return 0
    
    const topSuggestion = suggestions[0]
    return topSuggestion.confidence || 0
  }

  private async getGenericTools(): Promise<ToolSuggestion[]> {
    // 返回通用工具作为备选
    const genericToolNames = ['echo', 'run_example']
    const suggestions: ToolSuggestion[] = []
    
    for (const toolName of genericToolNames) {
      const toolInfo = await this.getToolByName(toolName)
      if (toolInfo) {
        suggestions.push({
          tool: toolInfo.tool,
          serverName: toolInfo.serverName,
          confidence: 0.3,
          reasoning: '通用工具',
          suggestedParameters: {}
        })
      }
    }
    
    return suggestions
  }

  private async findSimilarTools(primarySuggestions: ToolSuggestion[]): Promise<ToolSuggestion[]> {
    // 查找功能相似的工具
    // 这里可以实现基于工具描述或分类的相似性匹配
    return []
  }

  private async getRecentSuccessfulTools(sessionId: string): Promise<ToolSuggestion[]> {
    // 获取该会话中最近成功的工具
    const dbService = getDatabaseService()
    const client = await dbService.getClient()
    
    if (!client) {
      return []
    }

    try {
      const result = await client.query(`
        SELECT DISTINCT selected_tool, AVG(user_satisfaction) as avg_satisfaction
        FROM user_behavior_patterns 
        WHERE user_session = $1 AND execution_success = true
        AND created_at >= NOW() - INTERVAL '1 hour'
        GROUP BY selected_tool
        ORDER BY avg_satisfaction DESC
        LIMIT 2
      `, [sessionId])

      const suggestions: ToolSuggestion[] = []
      for (const row of result.rows) {
        const toolInfo = await this.getToolByName(row.selected_tool)
        if (toolInfo) {
          suggestions.push({
            tool: toolInfo.tool,
            serverName: toolInfo.serverName,
            confidence: 0.4,
            reasoning: `最近成功工具 (满意度: ${row.avg_satisfaction.toFixed(1)})`,
            suggestedParameters: {}
          })
        }
      }

      return suggestions
    } catch (error) {
      console.error('获取最近成功工具失败:', error)
      return []
    } finally {
      client.release()
    }
  }

  private async learnParameterMappings(
    toolName: string, 
    userInput: string, 
    parameters: Record<string, any>, 
    success: boolean
  ): Promise<void> {
    const dbService = getDatabaseService()
    const client = await dbService.getClient()

    if (!client) {
      return
    }

    try {
      for (const [paramName, paramValue] of Object.entries(parameters)) {
        await client.query(`
          INSERT INTO dynamic_parameter_mappings (
            tool_name, user_input_pattern, parameter_name, parameter_value, 
            mapping_type, confidence, success_count, failure_count
          ) VALUES ($1, $2, $3, $4, 'direct', $5, $6, $7)
          ON CONFLICT (tool_name, user_input_pattern) DO UPDATE SET
            success_count = dynamic_parameter_mappings.success_count + $6,
            failure_count = dynamic_parameter_mappings.failure_count + $7,
            confidence = CASE 
              WHEN $8 THEN LEAST(dynamic_parameter_mappings.confidence + 0.1, 1.0)
              ELSE GREATEST(dynamic_parameter_mappings.confidence - 0.1, 0.1)
            END,
            updated_at = CURRENT_TIMESTAMP
        `, [
          toolName, userInput, paramName, JSON.stringify(paramValue),
          success ? 0.7 : 0.3, success ? 1 : 0, success ? 0 : 1, success
        ])
      }
    } catch (error) {
      console.error('学习参数映射失败:', error)
    } finally {
      client.release()
    }
  }

  private async recordUserBehavior(
    context: RoutingContext,
    selectedTool: string,
    parameters: Record<string, any>,
    result: any
  ): Promise<void> {
    const dbService = getDatabaseService()
    const client = await dbService.getClient()

    if (!client) {
      return
    }

    try {
      await client.query(`
        INSERT INTO user_behavior_patterns (
          user_session, input_text, selected_tool, parameters_used,
          execution_success, user_satisfaction, interaction_duration
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        context.sessionId || 'anonymous',
        context.userInput,
        selectedTool,
        JSON.stringify(parameters),
        result.success,
        result.userSatisfaction || null,
        result.executionTime || null
      ])
    } catch (error) {
      console.error('记录用户行为失败:', error)
    } finally {
      client.release()
    }
  }
}

/**
 * 便利函数
 */
export const getIntelligentRouterService = () => IntelligentRouterService.getInstance()