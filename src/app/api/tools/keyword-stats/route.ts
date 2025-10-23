import { NextResponse } from 'next/server'
import { getToolMetadataService } from '@/services/tool-metadata-service'
import { getMCPToolsService } from '@/services/mcp-tools'

export async function GET() {
  try {
    const metadataService = getToolMetadataService()
    const mcpToolsService = getMCPToolsService()
    
    // 获取所有可用工具
    const availableTools = await mcpToolsService.getAvailableTools()
    const totalTools = availableTools.length
    
    if (totalTools === 0) {
      return NextResponse.json({
        success: true,
        data: {
          totalTools: 0,
          toolsWithKeywords: 0,
          totalKeywords: 0,
          mappingPercentage: 0,
          details: []
        }
      })
    }
    
    // 获取数据库服务
    const { getDatabaseService } = await import('@/services/database')
    const dbService = getDatabaseService()
    const client = await dbService.getClient()
    
    if (!client) {
      throw new Error('Database connection failed')
    }
    
    try {
      // 获取每个工具的关键词映射统计
      const result = await client.query(`
        SELECT 
          t.name as tool_name,
          t.description,
          COUNT(tkm.keyword) as keyword_count
        FROM mcp_tools t
        LEFT JOIN tool_keyword_mappings tkm ON t.name = tkm.tool_name
        GROUP BY t.name, t.description
        ORDER BY keyword_count DESC, t.name
      `)
      
      // 获取总的关键词映射数量
      const totalKeywordsResult = await client.query(`
        SELECT COUNT(*) as total_keywords
        FROM tool_keyword_mappings
      `)
      
      const totalKeywords = parseInt(totalKeywordsResult.rows[0].total_keywords)
      
      // 计算有关键词映射的工具数量
      const toolsWithKeywords = result.rows.filter(row => parseInt(row.keyword_count) > 0).length
      
      // 计算映射百分比
      const mappingPercentage = totalTools > 0 ? Math.round((toolsWithKeywords / totalTools) * 100) : 0
      
      // 构建详细信息
      const details = result.rows.map(row => ({
        toolName: row.tool_name,
        description: row.description || '',
        keywordCount: parseInt(row.keyword_count),
        hasKeywords: parseInt(row.keyword_count) > 0
      }))
      
      return NextResponse.json({
        success: true,
        data: {
          totalTools,
          toolsWithKeywords,
          totalKeywords,
          mappingPercentage,
          details,
          lastUpdated: new Date().toISOString()
        }
      })
      
    } finally {
      client.release()
    }
    
  } catch (error) {
    console.error('Failed to get keyword stats:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}