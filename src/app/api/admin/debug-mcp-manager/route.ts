import { NextResponse } from 'next/server'
import { getMCPManager } from '@/services/mcp-manager'
import { getMCPToolsService } from '@/services/mcp-tools'

export async function GET() {
  try {
    console.log('调试MCP管理器状态...')
    
    const mcpManager = getMCPManager()
    const mcpToolsService = getMCPToolsService()
    
    // 检查初始化状态
    const isInitialized = mcpManager['initialized']
    
    // 强制初始化（如果未初始化）
    if (!isInitialized) {
      console.log('MCP管理器未初始化，正在初始化...')
      await mcpManager.initialize()
    }
    
    // 获取服务器状态
    const serverStatus = mcpManager.getServerStatus()
    
    // 尝试获取工具列表
    let managerTools: any[] = []
    let serviceTools: any[] = []
    let managerError: string | null = null
    let serviceError: string | null = null
    
    try {
      managerTools = await mcpManager.listTools()
    } catch (error) {
      managerError = error instanceof Error ? error.message : '未知错误'
    }
    
    try {
      serviceTools = await mcpToolsService.getAvailableTools()
    } catch (error) {
      serviceError = error instanceof Error ? error.message : '未知错误'
    }
    
    return NextResponse.json({
      success: true,
      debug: {
        initialized: isInitialized,
        serverStatus,
        managerTools: {
          count: managerTools.length,
          tools: managerTools.map(t => t.name),
          error: managerError
        },
        serviceTools: {
          count: serviceTools.length,
          tools: serviceTools.map(t => t.name),
          error: serviceError
        },
        registry: {
          serverCount: mcpManager.getRegistry().servers.size,
          servers: Array.from(mcpManager.getRegistry().servers.keys())
        }
      }
    })
    
  } catch (error) {
    console.error('调试MCP管理器失败:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '调试失败'
    }, { status: 500 })
  }
}