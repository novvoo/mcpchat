import { NextRequest, NextResponse } from 'next/server'
import { MCPServerManager } from '@/services/mcp-server-manager'

export async function POST(request: NextRequest) {
  try {
    const { serverName, config } = await request.json()
    
    const manager = MCPServerManager.getInstance()
    await manager.initializeServer(serverName, config)
    
    return NextResponse.json({ 
      success: true, 
      capabilities: {
        tools: { listChanged: true },
        resources: { subscribe: true, listChanged: true },
        prompts: { listChanged: true },
        logging: {}
      }
    })
  } catch (error) {
    console.error('Failed to initialize MCP server:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}