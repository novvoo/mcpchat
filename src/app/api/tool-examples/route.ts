import { NextRequest, NextResponse } from 'next/server'
import { getErrorHandlingService } from '@/services/error-handling-service'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const toolName = searchParams.get('tool')
    const errorType = searchParams.get('errorType')

    if (!toolName) {
      return NextResponse.json({
        success: false,
        error: { message: 'Tool name is required' }
      }, { status: 400 })
    }

    const errorHandlingService = getErrorHandlingService()
    const { examples, suggestions } = await errorHandlingService.getToolExamplesAndSuggestions(
      toolName, 
      errorType || undefined
    )

    return NextResponse.json({
      success: true,
      data: {
        toolName,
        examples,
        suggestions,
        timestamp: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('获取工具示例失败:', error)
    return NextResponse.json({
      success: false,
      error: { 
        message: error instanceof Error ? error.message : 'Unknown error',
        code: 'EXAMPLE_FETCH_ERROR'
      }
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { toolName, errorMessage, errorType } = body

    if (!toolName || !errorMessage) {
      return NextResponse.json({
        success: false,
        error: { message: 'Tool name and error message are required' }
      }, { status: 400 })
    }

    const errorHandlingService = getErrorHandlingService()
    const formattedError = await errorHandlingService.formatErrorWithExamples(
      toolName,
      errorMessage,
      errorType
    )

    return NextResponse.json({
      success: true,
      data: {
        formattedError,
        timestamp: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('格式化错误失败:', error)
    return NextResponse.json({
      success: false,
      error: { 
        message: error instanceof Error ? error.message : 'Unknown error',
        code: 'ERROR_FORMAT_ERROR'
      }
    }, { status: 500 })
  }
}