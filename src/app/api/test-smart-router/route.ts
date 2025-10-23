// Test Smart Router API - 测试智能路由逻辑

import { NextRequest, NextResponse } from 'next/server'
import { getSmartRouter } from '@/services/smart-router'
import { getMCPIntentRecognizer } from '@/services/mcp-intent-recognizer'
import { getToolMetadataService } from '@/services/tool-metadata-service'

export async function POST(request: NextRequest) {
  try {
    const { message, testMode = 'full' } = await request.json()

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      )
    }

    const results: any = {
      userMessage: message,
      testMode,
      timestamp: new Date().toISOString()
    }

    // 测试意图识别
    if (testMode === 'intent' || testMode === 'full') {
      console.log('Testing intent recognition...')
      const intentRecognizer = getMCPIntentRecognizer()
      await intentRecognizer.initialize()
      
      const intent = await intentRecognizer.recognizeIntent(message)
      results.intentRecognition = intent
    }

    // 测试工具元数据建议
    if (testMode === 'metadata' || testMode === 'full') {
      console.log('Testing tool metadata suggestions...')
      const metadataService = getToolMetadataService()
      await metadataService.initialize()
      
      const suggestions = await metadataService.getToolSuggestions(message)
      results.toolSuggestions = suggestions
    }

    // 测试完整的智能路由
    if (testMode === 'router' || testMode === 'full') {
      console.log('Testing smart router...')
      const smartRouter = getSmartRouter()
      
      try {
        const routerResult = await smartRouter.processMessage(message, undefined, {
          enableMCPFirst: true,
          enableLLMFallback: false, // 禁用LLM fallback来测试直接工具调用
          mcpConfidenceThreshold: 0.3
        })
        results.smartRouterResult = routerResult
      } catch (error) {
        results.smartRouterError = {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }
      }
    }

    return NextResponse.json({
      success: true,
      results
    })

  } catch (error) {
    console.error('Test smart router error:', error)
    return NextResponse.json(
      { 
        error: 'Test failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Smart Router Test API',
    usage: {
      POST: {
        body: {
          message: 'string (required) - User message to test',
          testMode: 'string (optional) - "intent", "metadata", "router", or "full" (default)'
        }
      }
    },
    examples: [
      {
        message: '解决8皇后问题',
        expected: 'Should identify solve_n_queens tool with high confidence'
      },
      {
        message: '运行一个示例',
        expected: 'Should identify run_example tool'
      },
      {
        message: '什么是N皇后问题？',
        expected: 'Should NOT identify any tools (information query)'
      }
    ]
  })
}