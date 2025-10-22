import { NextRequest, NextResponse } from 'next/server'
import { MCPServerManager } from '@/services/mcp-server-manager'
import { getConfigLoader } from '@/services/config'

export async function GET(request: NextRequest) {
  try {
    const configLoader = getConfigLoader()
    await configLoader.loadConfig()
    
    const serverConfigs = configLoader.getAllMCPServerConfigs()
    const serverManager = MCPServerManager.getInstance()
    
    const servers = []
    
    for (const [serverName, config] of Object.entries(serverConfigs)) {
      try {
        const tools = await serverManager.getServerTools(serverName)
        
        servers.push({
          name: serverName,
          status: 'connected' as const,
          transport: config.transport || 'stdio',
          url: config.url,
          toolCount: tools.length,
          tools: tools.map(t => t.name)
        })
      } catch (error) {
        servers.push({
          name: serverName,
          status: 'error' as const,
          transport: config.transport || 'stdio',
          url: config.url,
          toolCount: 0,
          tools: [],
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }
    
    return NextResponse.json({
      success: true,
      servers
    })
  } catch (error) {
    console.error('Error getting MCP status:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}