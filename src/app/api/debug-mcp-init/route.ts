import { NextRequest, NextResponse } from 'next/server'
import { MCPServerManager } from '@/services/mcp-server-manager'
import { getConfigLoader } from '@/services/config'

export async function POST(request: NextRequest) {
  try {
    console.log('=== Debug MCP Initialization ===')
    
    // Step 1: Load configuration
    console.log('Step 1: Loading configuration...')
    const configLoader = getConfigLoader()
    await configLoader.loadConfig()
    
    const serverConfigs = configLoader.getAllMCPServerConfigs()
    const enabledServers = configLoader.getEnabledServers()
    
    console.log('Configuration loaded:', {
      totalServers: Object.keys(serverConfigs).length,
      enabledServers: enabledServers,
      serverConfigs: Object.keys(serverConfigs).map(name => ({
        name,
        transport: serverConfigs[name].transport,
        url: serverConfigs[name].url,
        disabled: serverConfigs[name].disabled
      }))
    })
    
    // Step 2: Initialize servers one by one
    console.log('Step 2: Initializing servers...')
    const serverManager = MCPServerManager.getInstance()
    const results = []
    
    for (const serverName of enabledServers) {
      const config = serverConfigs[serverName]
      if (config) {
        console.log(`\n--- Initializing server: ${serverName} ---`)
        console.log('Config:', {
          transport: config.transport,
          url: config.url,
          timeout: config.timeout
        })
        
        try {
          await serverManager.initializeServer(serverName, config)
          console.log(`✅ Server ${serverName} initialized successfully`)
          
          // Try to get tools
          try {
            const tools = await serverManager.getServerTools(serverName)
            console.log(`✅ Tools loaded for ${serverName}:`, tools.map(t => t.name))
            
            results.push({
              server: serverName,
              success: true,
              toolCount: tools.length,
              tools: tools.map(t => t.name)
            })
          } catch (toolError) {
            console.log(`⚠️ Failed to load tools for ${serverName}:`, toolError)
            results.push({
              server: serverName,
              success: true,
              toolCount: 0,
              toolError: toolError instanceof Error ? toolError.message : 'Unknown error'
            })
          }
        } catch (error) {
          console.log(`❌ Failed to initialize server ${serverName}:`, error)
          results.push({
            server: serverName,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined
          })
        }
      }
    }
    
    console.log('\n=== Initialization Summary ===')
    console.log('Results:', results)
    
    return NextResponse.json({
      success: true,
      results,
      summary: {
        totalServers: enabledServers.length,
        successfulServers: results.filter(r => r.success).length,
        failedServers: results.filter(r => !r.success).length
      }
    })
    
  } catch (error) {
    console.error('Debug MCP initialization error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}