// Intelligent Router Service - 为动态配置API提供智能路由功能

import { getSmartRouter } from './smart-router'
import { getEnhancedSmartRouter } from './enhanced-smart-router'

/**
 * 智能路由服务 - 提供路由统计、用户输入路由和学习功能
 */
export class IntelligentRouterService {
  private static instance: IntelligentRouterService

  private constructor() {}

  public static getInstance(): IntelligentRouterService {
    if (!IntelligentRouterService.instance) {
      IntelligentRouterService.instance = new IntelligentRouterService()
    }
    return IntelligentRouterService.instance
  }

  /**
   * 获取路由统计信息
   */
  async getRoutingStats(days: number = 7): Promise<{
    totalRequests: number
    mcpDirectRequests: number
    llmRequests: number
    hybridRequests: number
    averageConfidence: number
    period: string
  }> {
    const smartRouter = getSmartRouter()
    const stats = smartRouter.getRoutingStats()
    
    return {
      ...stats,
      period: `${days} days`
    }
  }

  /**
   * 路由用户输入
   */
  async routeUserInput(options: {
    userInput: string
    conversationId?: string
    enableMCPFirst?: boolean
    enableLLMFallback?: boolean
    mcpConfidenceThreshold?: number
    maxToolCalls?: number
    useLangChain?: boolean
  }): Promise<{
    response: string
    source: 'mcp' | 'llm' | 'hybrid'
    toolResults?: any[]
    confidence?: number
    reasoning?: string
  }> {
    const enhancedRouter = getEnhancedSmartRouter()
    
    const result = await enhancedRouter.processMessage(
      options.userInput,
      options.conversationId,
      {
        enableMCPFirst: options.enableMCPFirst,
        enableLLMFallback: options.enableLLMFallback,
        mcpConfidenceThreshold: options.mcpConfidenceThreshold,
        maxToolCalls: options.maxToolCalls,
        useLangChain: options.useLangChain
      }
    )

    return {
      response: result.response,
      source: result.source,
      toolResults: result.toolResults,
      confidence: result.confidence,
      reasoning: result.reasoning
    }
  }

  /**
   * 从执行结果中学习
   */
  async learnFromExecution(
    routingContext: any,
    selectedTool: string,
    parameters: Record<string, any>,
    executionResult: any
  ): Promise<void> {
    // 这里可以实现学习逻辑，比如记录到数据库
    console.log('Learning from execution:', {
      routingContext,
      selectedTool,
      parameters,
      executionResult
    })

    // 可以在这里添加实际的学习逻辑，比如：
    // 1. 记录成功/失败的路由决策
    // 2. 更新工具选择的置信度
    // 3. 优化参数提取逻辑
    // 4. 存储到数据库用于后续分析
  }
}

/**
 * 便捷函数
 */
export const getIntelligentRouterService = () => IntelligentRouterService.getInstance()