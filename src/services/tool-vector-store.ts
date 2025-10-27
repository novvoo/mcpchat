// Tool Vector Store - Manage tool embeddings for tool matching (simplified version)

import { Tool } from '@/types'
import { getDatabaseService } from './database'
import pgvector from 'pgvector/pg'

export interface ToolSearchResult {
  tool: Tool
  similarity: number
  serverName: string
}

/**
 * 工具向量存储服务 - 简化版本，主要用于工具元数据存储
 * 
 * 注意：向量搜索功能已弃用，现在使用LangChain进行意图识别
 * 此服务主要用于存储工具基本信息，不再处理embeddings
 */
export class ToolVectorStore {
  private static instance: ToolVectorStore
  private initialized = false

  private constructor() {}

  public static getInstance(): ToolVectorStore {
    if (!ToolVectorStore.instance) {
      ToolVectorStore.instance = new ToolVectorStore()
    }
    return ToolVectorStore.instance
  }

  /**
   * 初始化向量存储
   */
  async initialize(): Promise<void> {
    if (this.initialized) return

    try {
      const dbService = getDatabaseService()
      await dbService.initialize()

      this.initialized = true
      console.log('Tool vector store initialized (for tool matching only)')
    } catch (error) {
      console.error('Failed to initialize tool vector store:', error)
      throw error
    }
  }

  /**
   * 索引工具（存储工具基本信息，不再使用embeddings）
   * 
   * @deprecated embedding参数已弃用，现在使用LangChain进行意图识别
   */
  async indexTool(tool: Tool, serverName: string, embedding?: number[]): Promise<void> {
    if (!this.initialized) {
      await this.initialize()
    }

    const dbService = getDatabaseService()
    const client = await dbService.getClient()
    if (!client) return

    try {
      // 只存储工具基本信息，不再使用embeddings
      await client.query(
        `INSERT INTO mcp_tools (name, description, input_schema, server_name, metadata)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (name) 
         DO UPDATE SET
           description = EXCLUDED.description,
           input_schema = EXCLUDED.input_schema,
           server_name = EXCLUDED.server_name,
           metadata = EXCLUDED.metadata,
           updated_at = CURRENT_TIMESTAMP`,
        [
          tool.name,
          tool.description,
          JSON.stringify(tool.inputSchema),
          serverName,
          JSON.stringify({ 
            indexed_at: new Date().toISOString(), 
            has_embedding: false,
            langchain_enabled: true,
            note: 'Using LangChain for intent recognition instead of embeddings'
          })
        ]
      )

      console.log(`Tool ${tool.name} indexed (using LangChain for intent recognition)`)
    } catch (error) {
      console.error(`Failed to index tool ${tool.name}:`, error)
      throw error
    } finally {
      client.release()
    }
  }

  /**
   * 搜索相似工具 - 已弃用，现在使用LangChain进行意图识别
   * 
   * @deprecated 向量搜索已弃用，现在使用LangChain的语义分析进行工具匹配
   * 此方法保留仅为向后兼容，始终返回空结果
   */
  async searchSimilarTools(
    queryEmbedding: number[], 
    threshold: number = 0.7, 
    maxResults: number = 5
  ): Promise<ToolSearchResult[]> {
    console.warn('searchSimilarTools is deprecated. Use LangChain text processor for intent recognition instead.')
    return [] // 不再执行向量搜索
  }

  /**
   * 获取所有已索引的工具
   */
  async getAllIndexedTools(): Promise<Tool[]> {
    if (!this.initialized) {
      await this.initialize()
    }

    const dbService = getDatabaseService()
    const client = await dbService.getClient()
    if (!client) return []

    try {
      const result = await client.query(
        'SELECT name, description, input_schema FROM mcp_tools ORDER BY name'
      )

      return result.rows.map(row => ({
        name: row.name,
        description: row.description,
        inputSchema: row.input_schema
      }))
    } catch (error) {
      console.error('Failed to get indexed tools:', error)
      return []
    } finally {
      client.release()
    }
  }

  /**
   * 清除所有工具索引
   */
  async clearAllTools(): Promise<void> {
    if (!this.initialized) {
      await this.initialize()
    }

    const dbService = getDatabaseService()
    const client = await dbService.getClient()
    if (!client) return

    try {
      await client.query('DELETE FROM mcp_tools')
      console.log('All tool indexes cleared')
    } catch (error) {
      console.error('Failed to clear tool indexes:', error)
      throw error
    } finally {
      client.release()
    }
  }

  /**
   * 获取统计信息 - 更新为LangChain模式
   */
  async getStats(): Promise<{
    totalTools: number
    toolsWithLangChain: number
    toolsLegacy: number
  }> {
    if (!this.initialized) {
      await this.initialize()
    }

    const dbService = getDatabaseService()
    const client = await dbService.getClient()
    if (!client) return { totalTools: 0, toolsWithLangChain: 0, toolsLegacy: 0 }

    try {
      const totalResult = await client.query('SELECT COUNT(*) as count FROM mcp_tools')
      const langchainResult = await client.query(`
        SELECT COUNT(*) as count FROM mcp_tools 
        WHERE metadata->>'langchain_enabled' = 'true'
      `)
      
      const totalTools = parseInt(totalResult.rows[0].count)
      const toolsWithLangChain = parseInt(langchainResult.rows[0].count)
      const toolsLegacy = totalTools - toolsWithLangChain

      return {
        totalTools,
        toolsWithLangChain,
        toolsLegacy
      }
    } catch (error) {
      console.error('Failed to get stats:', error)
      return { totalTools: 0, toolsWithLangChain: 0, toolsLegacy: 0 }
    } finally {
      client.release()
    }
  }
}

/**
 * 便捷函数
 */
export const getToolVectorStore = () => ToolVectorStore.getInstance()