// Tool Indexer - Automatically index MCP tools for vector search

import { getToolVectorStore } from './tool-vector-store'
import { getMCPToolsService } from './mcp-tools'

/**
 * Tool Indexer - Manages automatic indexing of MCP tools
 */
export class ToolIndexer {
  private static instance: ToolIndexer
  private indexing: boolean = false

  private constructor() {}

  public static getInstance(): ToolIndexer {
    if (!ToolIndexer.instance) {
      ToolIndexer.instance = new ToolIndexer()
    }
    return ToolIndexer.instance
  }

  /**
   * Index all available MCP tools
   */
  async indexAllTools(): Promise<void> {
    if (this.indexing) {
      console.log('Indexing already in progress, skipping')
      return
    }

    this.indexing = true

    try {
      const vectorStore = getToolVectorStore()
      
      // Check if vector store is available
      if (!vectorStore.isReady()) {
        console.log('Vector store not ready, initializing...')
        await vectorStore.initialize()
        
        if (!vectorStore.isReady()) {
          console.log('Vector store initialization failed, skipping indexing')
          return
        }
      }

      console.log('Starting tool indexing...')

      const mcpToolsService = getMCPToolsService()
      const tools = await mcpToolsService.getAvailableTools()

      if (tools.length === 0) {
        console.log('No tools available to index')
        return
      }

      console.log(`Indexing ${tools.length} tools...`)

      // Index tools (assuming all from same server for now)
      // In production, you'd want to track which server each tool comes from
      await vectorStore.indexTools(tools, 'default')

      const stats = await vectorStore.getStats()
      console.log('Tool indexing completed:', stats)
    } catch (error) {
      console.error('Failed to index tools:', error)
    } finally {
      this.indexing = false
    }
  }

  /**
   * Re-index tools (clear and rebuild)
   */
  async reindexTools(): Promise<void> {
    console.log('Re-indexing all tools...')
    
    try {
      const vectorStore = getToolVectorStore()
      
      if (!vectorStore.isReady()) {
        console.log('Vector store not ready')
        return
      }

      // Clear existing tools
      const { getDatabaseService } = await import('./database')
      const dbService = getDatabaseService()
      await dbService.query('TRUNCATE TABLE mcp_tools')
      
      console.log('Cleared existing tool index')

      // Re-index
      await this.indexAllTools()
    } catch (error) {
      console.error('Failed to re-index tools:', error)
    }
  }

  /**
   * Check indexing status
   */
  async getIndexStatus(): Promise<{
    isIndexing: boolean
    stats: {
      totalTools: number
      toolsByServer: Record<string, number>
    }
  }> {
    const vectorStore = getToolVectorStore()
    
    if (!vectorStore.isReady()) {
      return {
        isIndexing: this.indexing,
        stats: { totalTools: 0, toolsByServer: {} }
      }
    }

    const stats = await vectorStore.getStats()
    
    return {
      isIndexing: this.indexing,
      stats
    }
  }
}

/**
 * Convenience function
 */
export const getToolIndexer = () => ToolIndexer.getInstance()

/**
 * Auto-index tools on startup
 */
export const autoIndexTools = async () => {
  const indexer = getToolIndexer()
  await indexer.indexAllTools()
}
