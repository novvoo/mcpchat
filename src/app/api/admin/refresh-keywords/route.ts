import { NextResponse } from 'next/server'
import { getToolMetadataService } from '@/services/tool-metadata-service'

export async function POST() {
  try {
    console.log('开始刷新关键词映射...')
    
    const metadataService = getToolMetadataService()
    await metadataService.initialize()
    
    // 强制刷新工具元数据
    await metadataService.refreshToolMetadata()
    
    // 确保关键词映射存在
    await metadataService.ensureKeywordMappingsExist()
    
    console.log('关键词映射刷新完成')
    
    return NextResponse.json({
      success: true,
      message: '关键词映射刷新成功'
    })
    
  } catch (error) {
    console.error('刷新关键词映射失败:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '刷新失败'
    }, { status: 500 })
  }
}