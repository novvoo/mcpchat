import { NextRequest, NextResponse } from 'next/server'
import { MCPServerManager } from '../../../../services/mcp-server-manager'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const serverName = searchParams.get('server')

    if (!serverName) {
      return NextResponse.json({ error: 'Server name is required' }, { status: 400 })
    }

    const manager = MCPServerManager.getInstance()
    const tools = await manager.getServerTools(serverName)

    return NextResponse.json({ tools })
  } catch (error) {
    console.error('Failed to get tools:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}