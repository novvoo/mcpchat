// Tool Store - Manage tool metadata for tool matching (using LangChain)

import { Tool } from '@/types'
import { getDatabaseService } from './database'

/**
 * 工具存储服务 - 用于工具元数据存储和管理
 * 
 * 使用 LangChain 进行意图识别和工具匹配，不再使用向量搜索
 */
export class ToolStore {
  private static instance: ToolStore
  private initialized = false

  private constructor() {}

  public static getInstance(): ToolStore {
    if (!ToolStore.instance) {
      ToolStore.instance = new ToolStore()
    }
    return ToolStore.instance
  }

  /**
   * 初始化工具存储
   */
  async initialize(): Promise<void> {
    if (this.initialized) return

    try {
      const dbService = getDatabaseService()
      await dbService.initialize()

      this.initialized = true
      console.log('Tool store initialized (using LangChain for intent recognition)')
    } catch (error) {
      console.error('Failed to initialize tool store:', error)
      throw error
    }
  }

  /**
   * 索引工具（存储工具基本信息）
   */
  async indexTool(tool: Tool, serverName: string): Promise<void> {
    if (!this.initialized) {
      await this.initialize()
    }

    const dbService = getDatabaseService()
    const client = await dbService.getClient()
    if (!client) return

    try {
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
            langchain_enabled: true
          })
        ]
      )

      console.log(`Tool ${tool.name} indexed`)
    } catch (error) {
      console.error(`Failed to index tool ${tool.name}:`, error)
      throw error
    } finally {
      client.release()
    }
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
   * 获取统计信息
   */
  async getStats(): Promise<{
    totalTools: number
  }> {
    if (!this.initialized) {
      await this.initialize()
    }

    const dbService = getDatabaseService()
    const client = await dbService.getClient()
    if (!client) return { totalTools: 0 }

    try {
      const totalResult = await client.query('SELECT COUNT(*) as count FROM mcp_tools')
      const totalTools = parseInt(totalResult.rows[0].count)

      return { totalTools }
    } catch (error) {
      console.error('Failed to get stats:', error)
      return { totalTools: 0 }
    } finally {
      client.release()
    }
  }
}

/**
 * 便捷函数
 */
export const getToolStore = () => ToolStore.getInstance()