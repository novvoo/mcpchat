import { NextRequest, NextResponse } from 'next/server'
import { getSampleProblemsService } from '@/services/sample-problems-service'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { count = 5, category, difficulty, tool_name } = body

    const sampleProblemsService = getSampleProblemsService()
    
    // 生成样例问题
    const problems = await sampleProblemsService.generateProblemsIntelligently({
      count,
      category,
      difficulty,
      tool_name
    })

    return NextResponse.json({
      success: true,
      problems,
      count: problems.length,
      message: `成功生成 ${problems.length} 个样例问题`
    })
  } catch (error) {
    console.error('生成样例问题失败:', error)
    return NextResponse.json({ 
      error: '生成样例问题失败',
      problems: []
    }, { status: 500 })
  }
}

export async function GET() {
  try {
    const sampleProblemsService = getSampleProblemsService()
    
    // 获取推荐问题
    const problems = await sampleProblemsService.getRecommendedProblems({ limit: 10 })

    return NextResponse.json({
      success: true,
      problems,
      count: problems.length
    })
  } catch (error) {
    console.error('获取样例问题失败:', error)
    return NextResponse.json({ 
      error: '获取样例问题失败',
      problems: []
    }, { status: 500 })
  }
}