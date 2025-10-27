// Enhanced Structured Parsing API - 使用 LangChain 增强的结构化解析

import { NextRequest, NextResponse } from 'next/server'
import { getEnhancedStructuredParser } from '@/services/enhanced-structured-parser'

export async function POST(request: NextRequest) {
  try {
    const { question } = await request.json()

    if (!question || typeof question !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Question is required and must be a string' },
        { status: 400 }
      )
    }

    if (question.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Question cannot be empty' },
        { status: 400 }
      )
    }

    // 使用增强版解析器
    const parser = getEnhancedStructuredParser()
    const result = await parser.parseQuestion(question.trim())

    return NextResponse.json(result)
  } catch (error) {
    console.error('Enhanced parsing API error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    // 返回服务状态
    const parser = getEnhancedStructuredParser()
    const status = parser.getStatus()

    return NextResponse.json({
      service: 'Enhanced Structured Parser',
      status,
      endpoints: {
        parse: 'POST /api/enhanced-parse',
        status: 'GET /api/enhanced-parse'
      },
      features: [
        'LangChain 集成',
        '高级分词识别',
        '语义情感分析',
        '实体识别',
        '意图分析',
        '智能路由',
        '置信度评分'
      ]
    })
  } catch (error) {
    console.error('Enhanced parsing status error:', error)
    return NextResponse.json(
      { error: 'Failed to get service status' },
      { status: 500 }
    )
  }
}