// API route to refresh tool metadata from MCP servers

import { NextRequest, NextResponse } from 'next/server'
import { getToolMetadataService } from '@/services/tool-metadata-service'

export async function POST(request: NextRequest) {
  try {
    console.log('Starting tool metadata refresh...')
    
    const metadataService = getToolMetadataService()
    await metadataService.initialize()
    await metadataService.refreshToolMetadata()
    
    console.log('Tool metadata refresh completed successfully')
    
    return NextResponse.json({
      success: true,
      message: 'Tool metadata refreshed successfully',
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Tool metadata refresh failed:', error)
    
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
    
    // 获取工具元数据统计
    // TODO: 实现获取统计信息的方法
    
    return NextResponse.json({
      success: true,
      message: 'Tool metadata service is running',
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Failed to get tool metadata status:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}