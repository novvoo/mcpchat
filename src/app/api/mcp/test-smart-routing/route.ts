import { NextRequest, NextResponse } from 'next/server'
import { getSmartRouter } from '@/services/smart-router'
import { getMCPIntentRecognizer } from '@/services/mcp-intent-recognizer'

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
    const intentRecognizer = getMCPIntentRecognizer()

    let result: any = {}

    switch (testMode) {
      case 'intent-only':
        // 只测试意图识别
        const intent = await intentRecognizer.recognizeIntent(message)
        result = {
          testMode: 'intent-only',
          message,
          intent,
          suggestions: await intentRecognizer.getToolSuggestions(message)
        }
        break

      case 'routing-info':
        // 测试路由决策但不执行
        const routingIntent = await intentRecognizer.recognizeIntent(message)
        const availableTools = await smartRouter.getAvailableTools()
        const mcpConnected = await smartRouter.testMCPConnection()
        
        result = {
          testMode: 'routing-info',
          message,
          intent: routingIntent,
          availableTools,
          mcpConnected,
          wouldUseMCP: routingIntent.needsMCP && routingIntent.confidence >= 0.4,
          reasoning: routingIntent.reasoning
        }
        break

      case 'full':
      default:
        // 完整测试 - 实际执行
        const response = await smartRouter.processMessage(message, undefined, {
          enableMCPFirst: true,
          enableLLMFallback: true,
          mcpConfidenceThreshold: 0.4,  // 调整为与新置信度系统匹配
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
    const intentRecognizer = getMCPIntentRecognizer()

    const availableTools = await smartRouter.getAvailableTools()
    const mcpConnected = await smartRouter.testMCPConnection()
    const routingStats = smartRouter.getRoutingStats()
    const recognizerStats = intentRecognizer.getStats()

    return NextResponse.json({
      success: true,
      data: {
        status: 'ready',
        mcpConnected,
        availableTools: availableTools.length,
        toolNames: availableTools.map(t => t.name),
        routingStats,
        recognizerStats,
        capabilities: {
          intentRecognition: true,
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