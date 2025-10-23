// Test Smart Router API - 测试智能路由逻辑

import { NextRequest, NextResponse } from 'next/server'
import { getSmartRouter } from '@/services/smart-router'
import { getMCPIntentRecognizer } from '@/services/mcp-intent-recognizer'
import { getToolMetadataService } from '@/services/tool-metadata-service'

// 生成动态示例
async function generateDynamicExamples() {
  try {
    const { getSampleProblemsService } = await import('@/services/sample-problems-service')
    const sampleProblemsService = getSampleProblemsService()
    const problems = await sampleProblemsService.getRecommendedProblems(3)
    
    const dynamicExamples = problems.map(problem => {
      const testInput = generateTestInputForProblem(problem)
      return {
        message: testInput || problem.title,
        expected: `Should identify ${problem.tool_name} tool`
      }
    }).filter(example => example.message)
    
    // 添加静态示例
    const staticExamples = [
      {
        message: '什么是N皇后问题？',
        expected: 'Should NOT identify any tools (information query)'
      }
    ]
    
    return [...dynamicExamples, ...staticExamples]
  } catch (error) {
    console.error('Failed to generate dynamic examples:', error)
    // 备用示例 - 尝试从默认样例问题生成
    try {
      const { getSampleProblemsService } = await import('@/services/sample-problems-service')
      const sampleProblemsService = getSampleProblemsService()
      const fallbackProblems = await sampleProblemsService.searchProblems({ 
        tool_name: 'solve_n_queens', 
        limit: 1 
      })
      
      const fallbackExamples = [
        {
          message: '运行一个示例',
          expected: 'Should identify run_example tool'
        },
        {
          message: '什么是N皇后问题？',
          expected: 'Should NOT identify any tools (information query)'
        }
      ]
      
      if (fallbackProblems.length > 0) {
        const testInput = generateTestInputForProblem(fallbackProblems[0])
        if (testInput) {
          fallbackExamples.unshift({
            message: testInput,
            expected: `Should identify ${fallbackProblems[0].tool_name} tool with high confidence`
          })
        }
      }
      
      return fallbackExamples
    } catch {
      // 最终备用
      return [
        {
          message: '请处理一个算法问题',
          expected: 'Should identify appropriate MCP tool'
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
    }
  }
}

// 辅助函数：为样例问题生成测试输入
function generateTestInputForProblem(problem: any): string | null {
  const toolName = problem.tool_name
  const params = problem.parameters || {}
  
  switch (toolName) {
    case 'solve_n_queens':
      const n = params.n || 8
      return `解决${n}皇后问题`
      
    case 'solve_sudoku':
      return '帮我解数独'
      
    case 'run_example':
      const exampleType = params.example_type || 'basic'
      return `run example ${exampleType}`
      
    default:
      if (problem.title) {
        return `请处理：${problem.title}`
      }
      return null
  }
}

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
    examples: await generateDynamicExamples()
  })
}