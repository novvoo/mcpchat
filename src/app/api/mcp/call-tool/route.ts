import { NextRequest, NextResponse } from 'next/server'
import { MCPServerManager } from '@/services/mcp-server-manager'
import { getConfigLoader } from '@/services/config'

export async function POST(request: NextRequest) {
  try {
    const { toolName, args } = await request.json()
    
    if (!toolName) {
      return NextResponse.json({
        success: false,
        error: 'Tool name is required'
      }, { status: 400 })
    }
    
    const configLoader = getConfigLoader()
    await configLoader.loadConfig()
    
    const serverConfigs = configLoader.getAllMCPServerConfigs()
    const serverManager = MCPServerManager.getInstance()
    
    // Find which server has this tool
    let targetServer = null
    for (const [serverName, config] of Object.entries(serverConfigs)) {
      if (!config.disabled) {
        try {
          const tools = await serverManager.getServerTools(serverName)
          if (tools.some(tool => tool.name === toolName)) {
            targetServer = serverName
            break
          }
        } catch (error) {
          // Server not available, continue searching
          continue
        }
      }
    }
    
    if (!targetServer) {
      return NextResponse.json({
        success: false,
        error: `Tool ${toolName} not found on any connected server`
      }, { status: 404 })
    }
    
    // Call the tool
    const result = await serverManager.callTool(targetServer, toolName, args || {})
    
    return NextResponse.json({
      success: true,
      result,
      server: targetServer
    })
  } catch (error) {
    console.error('Error calling MCP tool:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}