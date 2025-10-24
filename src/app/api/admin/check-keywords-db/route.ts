import { NextResponse } from 'next/server'
import { getDatabaseService } from '@/services/database'

export async function GET() {
  try {
    const dbService = getDatabaseService()
    const client = await dbService.getClient()
    
    if (!client) {
      return NextResponse.json({
        success: false,
        error: '数据库连接失败'
      }, { status: 500 })
    }

    try {
      // 检查关键词映射表
      const keywordResult = await client.query(`
        SELECT tool_name, keyword, confidence, source 
        FROM tool_keyword_mappings 
        ORDER BY tool_name, keyword
      `)
      
      // 检查参数映射表
      const paramResult = await client.query(`
        SELECT tool_name, user_input, mcp_parameter, confidence 
        FROM tool_parameter_mappings 
        ORDER BY tool_name, user_input
      `)
      
      // 按工具分组
      const keywordsByTool: Record<string, any[]> = {}
      keywordResult.rows.forEach(row => {
        if (!keywordsByTool[row.tool_name]) {
          keywordsByTool[row.tool_name] = []
        }
        keywordsByTool[row.tool_name].push({
          keyword: row.keyword,
          confidence: row.confidence,
          source: row.source
        })
      })
      
      const paramsByTool: Record<string, any[]> = {}
      paramResult.rows.forEach(row => {
        if (!paramsByTool[row.tool_name]) {
          paramsByTool[row.tool_name] = []
        }
        paramsByTool[row.tool_name].push({
          userInput: row.user_input,
          mcpParameter: row.mcp_parameter,
          confidence: row.confidence
        })
      })
      
      return NextResponse.json({
        success: true,
        data: {
          totalKeywords: keywordResult.rows.length,
          totalParams: paramResult.rows.length,
          keywordsByTool,
          paramsByTool,
          toolsWithKeywords: Object.keys(keywordsByTool),
          toolsWithParams: Object.keys(paramsByTool)
        }
      })
      
    } finally {
      client.release()
    }
    
  } catch (error) {
    console.error('检查关键词数据库失败:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '检查失败'
    }, { status: 500 })
  }
}