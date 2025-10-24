import { NextRequest, NextResponse } from 'next/server'
import { getMCPIntentRecognizer } from '@/services/mcp-intent-recognizer'

export async function POST(request: NextRequest) {
  try {
    const { userInput } = await request.json()

    if (!userInput || typeof userInput !== 'string') {
      return NextResponse.json({
        success: false,
        error: '请提供有效的用户输入'
      }, { status: 400 })
    }

    // 获取意图识别器
    const recognizer = getMCPIntentRecognizer()
    
    // 执行意图识别
    const intent = await recognizer.recognizeIntent(userInput)

    return NextResponse.json({
      success: true,
      intent,
      metadata: {
        inputLength: userInput.length,
        timestamp: new Date().toISOString(),
        recognizerStats: recognizer.getStats()
      }
    })

  } catch (error) {
    console.error('Intent recognition test error:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '意图识别测试失败'
    }, { status: 500 })
  }
}