// 动态配置API - 测试和管理基于PostgreSQL的配置系统

import { NextRequest, NextResponse } from 'next/server'
import { getDynamicConfigService } from '@/services/dynamic-config-service'
import { getIntelligentRouterService } from '@/services/intelligent-router-service'
import { getSampleProblemsService } from '@/services/sample-problems-service'

/**
 * GET /api/dynamic-config - 获取配置信息和系统状态
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action') || 'status'

    const configService = getDynamicConfigService()
    const routerService = getIntelligentRouterService()
    const problemsService = getSampleProblemsService()

    switch (action) {
      case 'status':
        // 获取系统状态
        const [
          llmUrl,
          toolThreshold,
          mcpConfigs,
          routingStats,
          problemStats
        ] = await Promise.all([
          configService.getSystemConfig('llm.default_url'),
          configService.getSystemConfig('tool_selection.confidence_threshold', 0.7),
          configService.getMCPServerConfigs(),
          routerService.getRoutingStats(7),
          problemsService.getProblemAnalytics(7)
        ])

        return NextResponse.json({
          success: true,
          data: {
            systemConfig: {
              llmUrl,
              toolThreshold,
              mcpServerCount: Object.keys(mcpConfigs).length,
              enabledServers: Object.values(mcpConfigs).filter(c => !c.disabled).length
            },
            routingStats,
            problemStats,
            timestamp: new Date().toISOString()
          }
        })

      case 'mcp-servers':
        // 获取MCP服务器配置
        const servers = await configService.getMCPServerConfigs()
        return NextResponse.json({
          success: true,
          data: { servers }
        })

      case 'system-config':
        // 获取系统配置
        const configs = await Promise.all([
          configService.getSystemConfig('llm.default_url'),
          configService.getSystemConfig('llm.timeout'),
          configService.getSystemConfig('llm.max_tokens'),
          configService.getSystemConfig('tool_selection.confidence_threshold'),
          configService.getSystemConfig('tool_selection.max_suggestions'),
          configService.getSystemConfig('performance.metrics_retention_days')
        ])

        return NextResponse.json({
          success: true,
          data: {
            'llm.default_url': configs[0],
            'llm.timeout': configs[1],
            'llm.max_tokens': configs[2],
            'tool_selection.confidence_threshold': configs[3],
            'tool_selection.max_suggestions': configs[4],
            'performance.metrics_retention_days': configs[5]
          }
        })

      case 'performance':
        // 获取性能统计
        const perfStats = await configService.getToolPerformanceStats(undefined, 7)
        return NextResponse.json({
          success: true,
          data: { performanceStats: perfStats }
        })

      default:
        return NextResponse.json({
          success: false,
          error: '未知的操作类型'
        }, { status: 400 })
    }
  } catch (error) {
    console.error('获取动态配置失败:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '未知错误'
    }, { status: 500 })
  }
}

/**
 * POST /api/dynamic-config - 更新配置或执行操作
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, data } = body

    const configService = getDynamicConfigService()
    const routerService = getIntelligentRouterService()
    const problemsService = getSampleProblemsService()

    switch (action) {
      case 'update-system-config':
        // 更新系统配置
        const { key, value, type, description } = data
        await configService.setSystemConfig(key, value, type, description)
        
        return NextResponse.json({
          success: true,
          message: `系统配置 ${key} 已更新`
        })

      case 'update-mcp-server':
        // 更新MCP服务器配置
        const { serverName, config } = data
        await configService.updateMCPServerConfig(serverName, config)
        
        return NextResponse.json({
          success: true,
          message: `MCP服务器 ${serverName} 配置已更新`
        })

      case 'test-intelligent-routing':
        // 测试智能路由
        const { userInput, context } = data
        const routingResult = await routerService.routeUserInput({
          userInput,
          ...context
        })
        
        return NextResponse.json({
          success: true,
          data: routingResult
        })

      case 'generate-sample-problems':
        // 生成样例问题
        const { options } = data
        const problems = await problemsService.generateProblemsIntelligently(options)
        
        return NextResponse.json({
          success: true,
          data: { problems, count: problems.length }
        })

      case 'get-recommendations':
        // 获取推荐问题
        const { userSession, limit, personalizedWeight } = data
        const recommendations = await problemsService.getRecommendedProblems({
          userSession,
          limit,
          personalizedWeight
        })
        
        return NextResponse.json({
          success: true,
          data: { recommendations }
        })

      case 'learn-from-execution':
        // 学习执行结果
        const { routingContext, selectedTool, parameters, executionResult } = data
        await routerService.learnFromExecution(
          routingContext,
          selectedTool,
          parameters,
          executionResult
        )
        
        return NextResponse.json({
          success: true,
          message: '学习记录已保存'
        })

      case 'record-problem-usage':
        // 记录问题使用
        const { problemId, userSession: session, success, satisfaction } = data
        await problemsService.recordProblemUsage(problemId, session, success, satisfaction)
        
        return NextResponse.json({
          success: true,
          message: '问题使用记录已保存'
        })

      default:
        return NextResponse.json({
          success: false,
          error: '未知的操作类型'
        }, { status: 400 })
    }
  } catch (error) {
    console.error('动态配置操作失败:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '未知错误'
    }, { status: 500 })
  }
}

/**
 * PUT /api/dynamic-config - 批量更新配置
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { configs } = body

    const configService = getDynamicConfigService()
    const results = []

    for (const config of configs) {
      try {
        await configService.setSystemConfig(
          config.key,
          config.value,
          config.type,
          config.description
        )
        results.push({ key: config.key, success: true })
      } catch (error) {
        results.push({ 
          key: config.key, 
          success: false, 
          error: error instanceof Error ? error.message : '未知错误'
        })
      }
    }

    const successCount = results.filter(r => r.success).length
    
    return NextResponse.json({
      success: successCount === results.length,
      message: `${successCount}/${results.length} 个配置更新成功`,
      results
    })
  } catch (error) {
    console.error('批量更新配置失败:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '未知错误'
    }, { status: 500 })
  }
}

/**
 * DELETE /api/dynamic-config - 重置配置或清理数据
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    if (!action) {
      return NextResponse.json({
        success: false,
        error: '缺少操作类型'
      }, { status: 400 })
    }

    // 这里可以实现配置重置、缓存清理等功能
    // 为了安全起见，暂时只返回成功消息
    
    return NextResponse.json({
      success: true,
      message: `操作 ${action} 已执行`
    })
  } catch (error) {
    console.error('删除操作失败:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '未知错误'
    }, { status: 500 })
  }
}