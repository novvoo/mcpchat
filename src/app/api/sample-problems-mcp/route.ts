// API Route for MCP-based Sample Problems

import { NextRequest, NextResponse } from 'next/server'
import { getSampleProblemsService } from '@/services/sample-problems-service'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action') || 'generate'
    
    const sampleProblemsService = getSampleProblemsService()

    switch (action) {
      case 'generate':
        const mcpProblems = await sampleProblemsService.generateProblemsFromMCP()
        return NextResponse.json({
          success: true,
          data: mcpProblems,
          source: 'mcp'
        })

      case 'recommended':
        const limit = parseInt(searchParams.get('limit') || '5')
        const recommended = await sampleProblemsService.getRecommendedProblems(limit)
        return NextResponse.json({
          success: true,
          data: recommended,
          source: 'mcp_with_fallback'
        })

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action parameter'
        }, { status: 400 })
    }
  } catch (error) {
    console.error('MCP Sample problems API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}