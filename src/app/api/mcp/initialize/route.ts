import { NextRequest, NextResponse } from 'next/server'
import { getMCPManager } from '@/services/mcp-manager'
import { getConfigLoader } from '@/services/config'

export async function POST(request: NextRequest) {
  try {
    const mcpManager = getMCPManager()
    
    // 初始化MCP管理器，这会自动加载配置并初始化所有启用的服务器
    await mcpManager.initialize()
    
    // 获取服务器状态
    const serverStatus = mcpManager.getServerStatus()
    
    const results = Object.entries(serverStatus).map(([serverName, status]) => ({
      server: serverName,
      success: status.status === 'connected'
    }))
    
    return NextResponse.json({
      success: true,
      results
    })
  } catch (error) {
    console.error('Error initializing MCP servers:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}