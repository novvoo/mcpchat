import { NextRequest, NextResponse } from 'next/server'
import { MCPServerManager } from '@/services/mcp-server-manager'

export async function POST(request: NextRequest) {
  try {
    const { serverName, toolName, args } = await request.json()
    
    const manager = MCPServerManager.getInstance()
    const result = await manager.callTool(serverName, toolName, args)
    
    return NextResponse.json(result)
  } catch (error) {
    console.error('Failed to call tool:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}