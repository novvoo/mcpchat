// Tool Indexer Service - Manages tool indexing operations

import { Tool } from '@/types'
import { getToolStore } from './tool-store'
import { getMCPToolsService } from './mcp-tools'
import { getMCPManager } from './mcp-manager'

/**
 * Tool Indexer Service - Coordinates tool indexing operations
 */
export class ToolIndexer {
  private static instance: ToolIndexer
  private indexing = false
  private lastIndexTime: Date | null = null

  private constructor() {}

  public static getInstance(): ToolIndexer {
    if (!ToolIndexer.instance) {
      ToolIndexer.instance = new ToolIndexer()
    }
    return ToolIndexer.instance
  }

  /**
   * Check if indexing is currently in progress
   */
  isIndexing(): boolean {
    return this.indexing
  }

  /**
   * Get indexing statistics
   */
  async getIndexStats(): Promise<{
    totalTools: number
    lastIndexTime: Date | null
    isIndexing: boolean
  }> {
    const toolStore = getToolStore()
    const stats = await toolStore.getStats()
    
    return {
      ...stats,
      lastIndexTime: this.lastIndexTime,
      isIndexing: this.indexing
    }
  }

  /**
   * Reindex all tools from MCP servers
   */
  async reindexAllTools(): Promise<void> {
    if (this.indexing) {
      console.log('Tool indexing already in progress, skipping...')
      return
    }

    this.indexing = true
    console.log('Starting tool reindexing...')

    try {
      // Get all available tools
      const mcpToolsService = getMCPToolsService()
      const tools = await mcpToolsService.getAvailableTools()
      
      console.log(`Found ${tools.length} tools to index`)

      // Clear existing indexes
      const toolStore = getToolStore()
      await toolStore.clearAllTools()
      
      // Index each tool
      await this.indexTools(tools)
      
      this.lastIndexTime = new Date()
      console.log(`Tool reindexing completed: ${tools.length} tools indexed`)
      
    } catch (error) {
      console.error('Tool reindexing failed:', error)
      throw error
    } finally {
      this.indexing = false
    }
  }

  /**
   * Index a list of tools
   */
  private async indexTools(tools: Tool[]): Promise<void> {
    const toolStore = getToolStore()
    await toolStore.initialize()
    
    // Get MCP manager to determine server names
    const mcpManager = getMCPManager()
    const registry = mcpManager.getRegistry()
    
    for (const tool of tools) {
      try {
        // Determine which server provides this tool
        let serverName = 'unknown'
        
        for (const [name, server] of registry.servers) {
          if (server.isConnected()) {
            try {
              const serverTools = await server.listTools()
              if (serverTools.some(t => t.name === tool.name)) {
                serverName = name
                break
              }
            } catch (error) {
              // Continue checking other servers
            }
          }
        }
        
        // Index the tool
        await toolStore.indexTool(tool, serverName)
        
        console.log(`Indexed tool: ${tool.name} (server: ${serverName})`)
        
      } catch (error) {
        console.warn(`Failed to index tool ${tool.name}:`, error)
      }
    }
  }

  /**
   * Index a single tool
   */
  async indexTool(tool: Tool, serverName: string): Promise<void> {
    const toolStore = getToolStore()
    await toolStore.initialize()
    await toolStore.indexTool(tool, serverName)
    console.log(`Indexed single tool: ${tool.name}`)
  }
}

/**
 * Convenience function to get the tool indexer instance
 */
export const getToolIndexer = () => ToolIndexer.getInstance()