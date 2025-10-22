import { NextRequest, NextResponse } from 'next/server'
import { getToolIndexer } from '@/services/tool-indexer'
import { getToolVectorStore } from '@/services/tool-vector-store'

/**
 * GET - Get indexing status
 */
export async function GET() {
  try {
    const indexer = getToolIndexer()
    const status = await indexer.getIndexStatus()

    const vectorStore = getToolVectorStore()
    const isReady = vectorStore.isReady()

    return NextResponse.json({
      success: true,
      vectorSearchEnabled: isReady,
      ...status
    })
  } catch (error) {
    console.error('Failed to get index status:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

/**
 * POST - Trigger indexing
 */
export async function POST(request: NextRequest) {
  try {
    const { action = 'index' } = await request.json()

    const indexer = getToolIndexer()

    if (action === 'reindex') {
      console.log('Triggering re-index...')
      // Run in background
      indexer.reindexTools().catch(error => {
        console.error('Re-indexing failed:', error)
      })

      return NextResponse.json({
        success: true,
        message: 'Re-indexing started in background'
      })
    } else {
      console.log('Triggering index...')
      // Run in background
      indexer.indexAllTools().catch(error => {
        console.error('Indexing failed:', error)
      })

      return NextResponse.json({
        success: true,
        message: 'Indexing started in background'
      })
    }
  } catch (error) {
    console.error('Failed to trigger indexing:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
