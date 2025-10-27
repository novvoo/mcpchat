// Tool Search API - Vector-based tool search for problem matching
import { NextRequest, NextResponse } from 'next/server'
import { getToolIndexer } from '@/services/tool-indexer'

/**
 * 工具搜索API - 基于向量相似度搜索匹配的工具
 * 用于结构化JSON输出后的工具匹配
 */
export async function POST(request: NextRequest) {
  try {
    const { query, threshold = 0.7, maxResults = 5 } = await request.json()

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query is required and must be a string' },
        { status: 400 }
      )
    }

    console.log(`Searching tools for query: "${query}"`)

    const toolIndexer = getToolIndexer()
    const results = await toolIndexer.searchTools(query, threshold, maxResults)

    return NextResponse.json({
      success: true,
      query,
      results,
      count: results.length,
      threshold,
      maxResults
    })

  } catch (error) {
    console.error('Tool search API error:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * 获取搜索统计信息
 */
export async function GET() {
  try {
    const toolIndexer = getToolIndexer()
    const stats = await toolIndexer.getIndexStats()

    return NextResponse.json({
      success: true,
      stats,
      isIndexing: toolIndexer.isIndexing()
    })

  } catch (error) {
    console.error('Tool search stats API error:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}