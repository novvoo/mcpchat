// API Route - 使用LLM生成工具关键词

import { NextRequest, NextResponse } from 'next/server'
import { getToolMetadataService } from '@/services/tool-metadata-service'
import { getMCPToolsService } from '@/services/mcp-tools'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { toolName, forceRegenerate = false } = body

    const metadataService = getToolMetadataService()
    await metadataService.initialize()

    if (toolName) {
      // 为特定工具生成关键词
      console.log(`为工具 ${toolName} 生成LLM关键词...`)
      
      // 如果强制重新生成，先清除现有的LLM生成的关键词
      if (forceRegenerate) {
        await metadataService.clearLLMKeywords(toolName)
      }
      
      const keywords = await metadataService.generateKeywordsForTool(toolName)
      
      return NextResponse.json({
        success: true,
        message: `为工具 ${toolName} 生成了 ${keywords.length} 个关键词`,
        data: {
          toolName,
          keywords,
          count: keywords.length
        }
      })
    } else {
      // 为所有工具生成关键词
      console.log('为所有工具生成LLM关键词...')
      
      const mcpToolsService = getMCPToolsService()
      const tools = await mcpToolsService.getAvailableTools()
      
      const results = []
      let totalKeywords = 0
      
      for (const tool of tools) {
        try {
          console.log(`处理工具: ${tool.name}`)
          
          // 如果强制重新生成，先清除现有的LLM生成的关键词
          if (forceRegenerate) {
            await metadataService.clearLLMKeywords(tool.name)
          }
          
          const keywords = await metadataService.generateKeywordsForTool(tool.name)
          
          results.push({
            toolName: tool.name,
            keywords,
            count: keywords.length,
            success: true
          })
          
          totalKeywords += keywords.length
          
          // 添加延迟以避免API限制
          await new Promise(resolve => setTimeout(resolve, 1000))
          
        } catch (error) {
          console.error(`为工具 ${tool.name} 生成关键词失败:`, error)
          results.push({
            toolName: tool.name,
            keywords: [],
            count: 0,
            success: false,
            error: error instanceof Error ? error.message : '未知错误'
          })
        }
      }
      
      return NextResponse.json({
        success: true,
        message: `为 ${tools.length} 个工具生成了总计 ${totalKeywords} 个关键词`,
        data: {
          totalTools: tools.length,
          totalKeywords,
          results
        }
      })
    }
    
  } catch (error) {
    console.error('生成LLM关键词失败:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '未知错误'
    }, { status: 500 })
  }
}

export async function GET() {
  try {
    const metadataService = getToolMetadataService()
    await metadataService.initialize()
    
    // 获取LLM关键词生成统计
    const stats = await metadataService.getLLMKeywordStats()
    
    return NextResponse.json({
      success: true,
      data: stats
    })
    
  } catch (error) {
    console.error('获取LLM关键词统计失败:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '未知错误'
    }, { status: 500 })
  }
}