import { NextResponse } from 'next/server'
import { getToolMetadataService } from '@/services/tool-metadata-service'

export async function POST() {
  try {
    console.log('手动触发关键词映射检查和创建...')
    
    const metadataService = getToolMetadataService()
    await metadataService.initialize()
    
    // 确保关键词映射存在
    await metadataService.ensureKeywordMappingsExist()
    
    // 刷新工具元数据
    await metadataService.refreshToolMetadata()
    
    console.log('关键词映射检查和创建完成')
    
    return NextResponse.json({
      success: true,
      message: '关键词映射检查和创建完成'
    })
    
  } catch (error) {
    console.error('关键词映射创建失败:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}