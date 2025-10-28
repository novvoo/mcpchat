// API route to generate keywords for tools using LangChain

import { NextRequest, NextResponse } from 'next/server'
import { getToolMetadataService } from '@/services/tool-metadata-service'

export async function POST(request: NextRequest) {
  try {
    console.log('🤖 开始使用LangChain生成关键词...')
    
    const metadataService = getToolMetadataService()
    await metadataService.initialize()
    
    // 获取所有工具
    const tools = await metadataService.getAllTools()
    console.log(`📋 发现 ${tools.length} 个工具`)
    
    if (tools.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No tools found to generate keywords for',
        stats: { toolCount: 0, keywordsGenerated: 0 },
        timestamp: new Date().toISOString()
      })
    }
    
    // 动态导入LLM关键词生成器
    const { createLLMKeywordGenerator, generateRuleBasedKeywords } = await import('@/services/llm-keyword-generator')
    
    // 初始化LLM关键词生成器
    const llmGenerator = await createLLMKeywordGenerator()
    let totalKeywords = 0
    let llmKeywords = 0
    let ruleKeywords = 0
    
    for (const tool of tools) {
      console.log(`🔧 处理工具: ${tool.name}`)
      
      // 生成基于规则的关键词
      const ruleBasedKeywords = generateRuleBasedKeywords(tool.name, tool.description || '')
      
      // 使用LLM生成关键词（如果可用）
      let llmGeneratedKeywords: string[] = []
      if (llmGenerator) {
        try {
          llmGeneratedKeywords = await llmGenerator.generateKeywords(tool.name, tool.description || '')
          console.log(`  🧠 LLM生成了 ${llmGeneratedKeywords.length} 个关键词`)
        } catch (error) {
          console.log(`  ⚠️  LLM生成失败: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
      }
      
      // 保存关键词到数据库
      for (const keyword of ruleBasedKeywords) {
        await metadataService.addKeywordMapping(tool.name, keyword, 0.9, 'rule_based')
        ruleKeywords++
      }
      
      for (const keyword of llmGeneratedKeywords) {
        await metadataService.addKeywordMapping(tool.name, keyword, 0.95, 'llm_generated')
        llmKeywords++
      }
      
      const toolTotal = ruleBasedKeywords.length + llmGeneratedKeywords.length
      totalKeywords += toolTotal
      console.log(`  ✓ 添加了 ${toolTotal} 个关键词 (规则: ${ruleBasedKeywords.length}, LLM: ${llmGeneratedKeywords.length})`)
    }
    
    console.log('✅ 关键词生成完成')
    
    return NextResponse.json({
      success: true,
      message: 'Keywords generated successfully using LangChain',
      stats: {
        toolCount: tools.length,
        keywordsGenerated: totalKeywords,
        ruleBasedKeywords: ruleKeywords,
        llmGeneratedKeywords: llmKeywords,
        llmAvailable: llmGenerator !== null
      },
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('❌ 关键词生成失败:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const metadataService = getToolMetadataService()
    await metadataService.initialize()
    
    // 获取关键词映射统计
    const stats = await metadataService.getKeywordMappingStats()
    
    return NextResponse.json({
      success: true,
      stats,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Failed to get keyword mapping stats:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}