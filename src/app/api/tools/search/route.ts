import { NextRequest, NextResponse } from 'next/server'
import { getToolVectorStore } from '@/services/tool-vector-store'

/**
 * POST - Search for tools using semantic similarity
 */
export async function POST(request: NextRequest) {
  try {
    const { query, maxResults = 5 } = await request.json()

    if (!query || typeof query !== 'string') {
      return NextResponse.json({
        success: false,
        error: 'Query is required and must be a string'
      }, { status: 400 })
    }

    const vectorStore = getToolVectorStore()

    if (!vectorStore.isReady()) {
      return NextResponse.json({
        success: false,
        error: 'Vector search is not available. Please check database configuration.'
      }, { status: 503 })
    }

    const results = await vectorStore.searchTools(query, maxResults)

    return NextResponse.json({
      success: true,
      query,
      results: results.map(r => ({
        name: r.tool.name,
        description: r.tool.description,
        similarity: r.similarity
      })),
      count: results.length
    })
  } catch (error) {
    console.error('Tool search failed:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
