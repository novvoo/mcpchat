// API Route for Sample Problems

import { NextRequest, NextResponse } from 'next/server'
import { getSampleProblemsService } from '@/services/sample-problems-service'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action') || 'list'
    
    const sampleProblemsService = getSampleProblemsService()

    switch (action) {
      case 'list':
        const problems = await sampleProblemsService.getAllProblems()
        return NextResponse.json({
          success: true,
          data: problems
        })

      case 'recommended':
        const limit = parseInt(searchParams.get('limit') || '5')
        const recommended = await sampleProblemsService.getRecommendedProblems(limit)
        return NextResponse.json({
          success: true,
          data: recommended,
          source: recommended.length > 0 && recommended[0].id.startsWith('mcp-') ? 'mcp' : 'database'
        })

      case 'search':
        const keywords = searchParams.get('keywords')?.split(',').filter(k => k.trim()) || []
        const category = searchParams.get('category') || undefined
        const difficulty = searchParams.get('difficulty') || undefined
        const tool_name = searchParams.get('tool_name') || undefined
        
        const searchResults = await sampleProblemsService.searchProblems({
          keywords: keywords.length > 0 ? keywords : undefined,
          category,
          difficulty,
          tool_name,
          limit: parseInt(searchParams.get('limit') || '10')
        })
        
        return NextResponse.json({
          success: true,
          data: searchResults
        })

      case 'stats':
        const stats = await sampleProblemsService.getProblemAnalytics()
        return NextResponse.json({
          success: true,
          data: stats
        })

      case 'by-tool':
        const toolName = searchParams.get('tool_name')
        if (!toolName) {
          return NextResponse.json({
            success: false,
            error: 'tool_name parameter is required'
          }, { status: 400 })
        }
        
        const toolProblems = await sampleProblemsService.searchProblems({ tool_name: toolName })
        return NextResponse.json({
          success: true,
          data: toolProblems
        })

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action parameter'
        }, { status: 400 })
    }
  } catch (error) {
    console.error('Sample problems API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')
    
    if (action === 'search-by-keywords') {
      const body = await request.json()
      const { keywords } = body
      
      if (!keywords || !Array.isArray(keywords)) {
        return NextResponse.json({
          success: false,
          error: 'keywords array is required'
        }, { status: 400 })
      }
      
      const sampleProblemsService = getSampleProblemsService()
      const results = await sampleProblemsService.searchProblems({ keywords })
      
      return NextResponse.json({
        success: true,
        data: results
      })
    }
    
    return NextResponse.json({
      success: false,
      error: 'Invalid action parameter'
    }, { status: 400 })
  } catch (error) {
    console.error('Sample problems POST API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}