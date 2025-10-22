import { NextRequest, NextResponse } from 'next/server'
import { MCPServerManager } from '@/services/mcp-server-manager'
import { getConfigLoader } from '@/services/config'

export async function POST(request: NextRequest) {
  try {
    const configLoader = getConfigLoader()
    await configLoader.loadConfig()
    
    const serverConfigs = configLoader.getAllMCPServerConfigs()
    const enabledServers = configLoader.getEnabledServers()
    const serverManager = MCPServerManager.getInstance()
    
    const results = []
    
    for (const serverName of enabledServers) {
      const config = serverConfigs[serverName]
      if (config) {
        try {
          await serverManager.initializeServer(serverName, config)
          results.push({
            server: serverName,
            success: true
          })
        } catch (error) {
          results.push({
            server: serverName,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        }
      }
    }
    
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