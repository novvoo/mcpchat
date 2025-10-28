// Tool Index Management API - Manage tool indexing
import { NextRequest, NextResponse } from 'next/server'
import { getToolIndexer } from '@/services/tool-indexer'
import { getToolStore } from '@/services/tool-store'

/**
 * 重新索引所有工具
 */
export async function POST(request: NextRequest) {
  try {
    const { action } = await request.json()

    const toolIndexer = getToolIndexer()

    if (action === 'reindex') {
      console.log('Starting tool reindexing...')
      
      // 在后台执行重新索引
      toolIndexer.reindexAllTools().catch((error: any) => {
        console.error('Tool reindexing failed:', error)
      })

      return NextResponse.json({
        success: true,
        message: 'Tool reindexing started in background'
      })
    }

    if (action === 'clear') {
      console.log('Clearing tool indexes...')
      
      const toolStore = getToolStore()
      await toolStore.clearAllTools()

      return NextResponse.json({
        success: true,
        message: 'Tool indexes cleared'
      })
    }

    return NextResponse.json(
      { error: 'Invalid action. Use "reindex" or "clear"' },
      { status: 400 }
    )

  } catch (error) {
    console.error('Tool index management API error:', error)
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
 * 获取索引状态和统计信息
 */
export async function GET() {
  try {
    const toolIndexer = getToolIndexer()
    const toolStore = getToolStore()
    
    const stats = await toolIndexer.getIndexStats()
    const allTools = await toolStore.getAllIndexedTools()

    return NextResponse.json({
      success: true,
      stats,
      isIndexing: toolIndexer.isIndexing(),
      tools: allTools.map(tool => ({
        name: tool.name,
        description: tool.description
      }))
    })

  } catch (error) {
    console.error('Tool index status API error:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}