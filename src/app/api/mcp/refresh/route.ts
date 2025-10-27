// MCP Refresh API - 手动触发MCP状态刷新

import { NextRequest, NextResponse } from 'next/server'
import { HTTP_STATUS, ERROR_CODES } from '@/types/constants'

/**
 * POST /api/mcp/refresh
 * 手动触发MCP状态刷新
 */
export async function POST(request: NextRequest) {
  try {
    console.log('收到MCP状态刷新请求')
    
    // 触发全局状态监听器刷新
    try {
      const { mcpStatusMonitor } = await import('@/utils/mcp-status-monitor')
      mcpStatusMonitor.triggerRefresh()
    } catch (error) {
      console.warn('触发状态监听器刷新失败:', error)
    }

    // 获取最新的MCP状态
    const { getMCPInitializer } = await import('@/services/mcp-initializer')
    const initializer = getMCPInitializer()
    const status = initializer.getStatus()
    
    // 如果系统未就绪，尝试重新初始化
    if (!status.ready && !status.error) {
      console.log('MCP系统未就绪，触发重新初始化')
      initializer.initialize().catch(error => {
        console.warn('后台MCP重新初始化失败:', error)
      })
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          ...status,
          refreshTriggered: true,
          timestamp: new Date().toISOString()
        },
        message: 'MCP状态刷新已触发'
      },
      { status: HTTP_STATUS.OK }
    )

  } catch (error) {
    console.error('MCP refresh API error:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: {
          code: ERROR_CODES.INTERNAL_SERVER_ERROR,
          message: 'Failed to refresh MCP status',
          details: error instanceof Error ? error.message : 'Unknown error'
        }
      },
      { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
    )
  }
}

/**
 * GET /api/mcp/refresh
 * 获取刷新状态信息
 */
export async function GET(request: NextRequest) {
  try {
    // 获取当前状态监听器状态
    let monitorStatus = null
    try {
      const { mcpStatusMonitor } = await import('@/utils/mcp-status-monitor')
      monitorStatus = mcpStatusMonitor.getCurrentStatus()
    } catch (error) {
      console.warn('获取状态监听器状态失败:', error)
    }

    // 获取MCP初始化器状态
    const { getMCPInitializer } = await import('@/services/mcp-initializer')
    const initializer = getMCPInitializer()
    const mcpStatus = initializer.getStatus()

    return NextResponse.json(
      {
        success: true,
        data: {
          mcpStatus,
          monitorStatus,
          timestamp: new Date().toISOString()
        }
      },
      { status: HTTP_STATUS.OK }
    )

  } catch (error) {
    console.error('MCP refresh status API error:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: {
          code: ERROR_CODES.INTERNAL_SERVER_ERROR,
          message: 'Failed to get refresh status',
          details: error instanceof Error ? error.message : 'Unknown error'
        }
      },
      { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
    )
  }
}