import { NextRequest, NextResponse } from 'next/server'
import { MCPServerManager } from '../../../../services/mcp-server-manager'

export async function POST(request: NextRequest) {
    try {
        const { serverName } = await request.json()

        const manager = MCPServerManager.getInstance()
        await manager.shutdownServer(serverName)

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Failed to shutdown server:', error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        )
    }
}