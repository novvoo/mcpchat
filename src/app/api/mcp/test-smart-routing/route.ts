import { NextRequest, NextResponse } from 'next/server'
import { getSmartRouter } from '@/services/smart-router'

/**
 * 测试智能路由功能的API端点
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { message, testMode = 'full' } = body

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required and must be a string' },
        { status: 400 }
      )
    }

    const smartRouter = getSmartRouter()

    let result: any = {}

    switch (testMode) {
      case 'intent-only':
        // 意图识别已移除，返回提示信息
        result = {
          testMode: 'intent-only',
          message,
          notice: 'Intent recognition service has been removed',
          alternative: 'Use tool metadata service for tool suggestions'
        }
        break

      case 'routing-info':
        // 测试路由决策但不执行
        const availableTools = await smartRouter.getAvailableTools()
        const mcpConnected = await smartRouter.testMCPConnection()
        
        result = {
          testMode: 'routing-info',
          message,
          availableTools,
          mcpConnected,
          notice: 'Intent recognition has been removed, using enhanced routing'
        }
        break

      case 'full':
      default:
        // 完整测试 - 实际执行
        const response = await smartRouter.processMessage(message, undefined, {
          enableMCPFirst: true,
          enableLLMFallback: true,
          mcpConfidenceThreshold: 0.4,
          maxToolCalls: 3
        })
        
        result = {
          testMode: 'full',
          message,
          response: response.response,
          source: response.source,
          confidence: response.confidence,
          reasoning: response.reasoning,
          toolResults: response.toolResults,
          conversationId: response.conversationId
        }
        break
    }

    return NextResponse.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Smart routing test error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}

/**
 * 获取智能路由状态信息
 */
export async function GET(request: NextRequest) {
  try {
    const smartRouter = getSmartRouter()

    const availableTools = await smartRouter.getAvailableTools()
    const mcpConnected = await smartRouter.testMCPConnection()
    const routingStats = smartRouter.getRoutingStats()

    return NextResponse.json({
      success: true,
      data: {
        status: 'ready',
        mcpConnected,
        availableTools: availableTools.length,
        toolNames: availableTools.map(t => t.name),
        routingStats,
        capabilities: {
          intentRecognition: false, // 已移除
          mcpDirectExecution: mcpConnected,
          llmFallback: true,
          hybridMode: true
        }
      }
    })

  } catch (error) {
    console.error('Smart routing status error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}