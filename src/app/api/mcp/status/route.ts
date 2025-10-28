// MCP Status API - 检查MCP系统状态

import { NextRequest, NextResponse } from 'next/server'
import { getMCPInitializer } from '@/services/mcp-initializer'
import { HTTP_STATUS, ERROR_CODES } from '@/types/constants'

/**
 * GET /api/mcp/status
 * 获取MCP系统状态
 */
export async function GET(request: NextRequest) {
  try {
    // 添加调试信息来追踪调用来源
    const userAgent = request.headers.get('user-agent') || 'Unknown'
    const referer = request.headers.get('referer') || 'None'
    const timestamp = new Date().toLocaleTimeString()
    
    console.log(`🔍 [${timestamp}] MCP Status API 被调用`)
    console.log(`   User-Agent: ${userAgent.substring(0, 100)}`)
    console.log(`   Referer: ${referer}`)
    console.log(`   URL: ${request.url}`)
    
    const initializer = getMCPInitializer()
    const status = initializer.getStatus()
    
    // 不在状态检查时触发初始化，只返回当前状态
    // 初始化应该由系统启动时或明确的初始化请求触发
    
    // 从数据库获取详细的系统信息
    let systemInfo
    let dbStatus = null
    try {
      systemInfo = await initializer.getSystemInfo()
      
      // 从数据库获取MCP服务器和工具的状态信息
      dbStatus = await getMCPStatusFromDatabase()
    } catch (error) {
      console.warn('获取系统信息失败，使用基础状态:', error)
      systemInfo = {
        status,
        servers: {},
        tools: [],
        capabilities: []
      }
    }
    
    return NextResponse.json(
      {
        success: true,
        data: {
          ...status,
          systemInfo: {
            servers: systemInfo.servers,
            toolCount: systemInfo.tools.length,
            capabilities: systemInfo.capabilities
          },
          // 添加从数据库获取的状态信息
          databaseStatus: dbStatus,
          // 添加状态描述
          statusMessage: getStatusMessage(status),
          // 添加时间戳
          timestamp: new Date().toISOString()
        }
      },
      { status: HTTP_STATUS.OK }
    )

  } catch (error) {
    console.error('MCP status API error:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: {
          code: ERROR_CODES.INTERNAL_SERVER_ERROR,
          message: 'Failed to get MCP system status',
          details: error instanceof Error ? error.message : 'Unknown error'
        }
      },
      { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
    )
  }
}

/**
 * 从数据库获取MCP状态信息
 */
async function getMCPStatusFromDatabase() {
  try {
    const { getDatabaseService } = await import('@/services/database')
    const dbService = getDatabaseService()
    
    // 获取MCP服务器状态
    const serversResult = await dbService.query(`
      SELECT 
        name,
        display_name,
        disabled,
        created_at,
        updated_at,
        metadata
      FROM mcp_servers 
      ORDER BY name
    `)
    
    // 获取工具元数据统计
    const toolsResult = await dbService.query(`
      SELECT 
        COUNT(*) as total_tools,
        COUNT(CASE WHEN keywords IS NOT NULL AND keywords != '{}' THEN 1 END) as tools_with_keywords,
        COUNT(CASE WHEN parameter_mappings IS NOT NULL THEN 1 END) as tools_with_mappings
      FROM tool_metadata
    `)
    
    // 获取最近的工具更新时间
    const lastUpdateResult = await dbService.query(`
      SELECT MAX(updated_at) as last_update
      FROM tool_metadata
    `)
    
    return {
      servers: serversResult.rows || [],
      toolStats: toolsResult.rows[0] || {
        total_tools: 0,
        tools_with_keywords: 0,
        tools_with_mappings: 0
      },
      lastUpdate: lastUpdateResult.rows[0]?.last_update || null,
      retrievedAt: new Date().toISOString()
    }
    
  } catch (error) {
    console.warn('从数据库获取MCP状态失败:', error)
    return null
  }
}

/**
 * 根据状态生成描述信息
 */
function getStatusMessage(status: any): string {
  if (status.ready) {
    return 'MCP就绪'
  }
  
  if (status.error) {
    return `MCP错误: ${status.error}`
  }
  
  // 根据初始化进度生成状态信息
  const steps = []
  if (!status.configLoaded) {
    steps.push('加载配置')
  } else if (!status.serversConnected) {
    steps.push('连接服务器')
  } else if (!status.toolsLoaded) {
    steps.push('加载工具')
  } else if (!status.keywordsMapped) {
    steps.push('映射关键词')
  }
  
  if (steps.length > 0) {
    return `MCP初始化中: ${steps[0]}...`
  }
  
  return 'MCP状态未知'
}

/**
 * POST /api/mcp/status
 * 重新初始化MCP系统
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, force = false } = body
    
    if (action === 'reinitialize') {
      const initializer = getMCPInitializer()
      const status = await initializer.initialize(force)
      
      return NextResponse.json(
        {
          success: true,
          data: status,
          message: status.ready ? 'MCP系统重新初始化成功' : 'MCP系统重新初始化完成但未完全就绪'
        },
        { status: HTTP_STATUS.OK }
      )
    } else {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: ERROR_CODES.INVALID_PARAMETERS,
            message: 'Invalid action. Supported actions: reinitialize'
          }
        },
        { status: HTTP_STATUS.BAD_REQUEST }
      )
    }

  } catch (error) {
    console.error('MCP status action API error:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: {
          code: ERROR_CODES.INTERNAL_SERVER_ERROR,
          message: 'Failed to execute MCP system action',
          details: error instanceof Error ? error.message : 'Unknown error'
        }
      },
      { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
    )
  }
}