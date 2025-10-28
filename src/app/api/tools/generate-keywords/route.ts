// API route to generate keywords for tools

import { NextRequest, NextResponse } from 'next/server'
import { getToolMetadataService } from '@/services/tool-metadata-service'

export async function POST(request: NextRequest) {
  try {
    console.log('Starting keyword generation...')
    
    const metadataService = getToolMetadataService()
    await metadataService.initialize()
    
    // 确保关键词映射存在
    await metadataService.ensureKeywordMappingsExist()
    
    console.log('Keyword generation completed successfully')
    
    return NextResponse.json({
      success: true,
      message: 'Keywords generated successfully',
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Keyword generation failed:', error)
    
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