// Test Formatting API - 测试MCP响应格式化

import { NextRequest, NextResponse } from 'next/server'
import { getSmartRouter } from '@/services/smart-router'

export async function POST(request: NextRequest) {
  try {
    const { testCases } = await request.json()
    
    if (!testCases || !Array.isArray(testCases)) {
      return NextResponse.json(
        { success: false, error: 'Invalid test cases' },
        { status: 400 }
      )
    }

    const smartRouter = getSmartRouter()
    const results = []

    for (const testCase of testCases) {
      try {
        // 使用公共测试方法进行格式化
        const formattedResult = smartRouter.testFormatMCPResult(
          testCase.toolName,
          testCase.mockResult,
          testCase.params
        )

        results.push({
          original: testCase.mockResult,
          formatted: formattedResult,
          toolName: testCase.toolName,
          params: testCase.params
        })
      } catch (error) {
        console.error(`格式化测试失败 (${testCase.toolName}):`, error)
        results.push({
          original: testCase.mockResult,
          formatted: `格式化失败: ${error instanceof Error ? error.message : '未知错误'}`,
          toolName: testCase.toolName,
          params: testCase.params
        })
      }
    }

    return NextResponse.json({
      success: true,
      results
    })

  } catch (error) {
    console.error('测试格式化API错误:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'MCP Formatting Test API',
    usage: {
      POST: {
        description: '测试MCP响应格式化',
        body: {
          testCases: 'Array of test cases with toolName, params, and mockResult'
        }
      }
    }
  })
}