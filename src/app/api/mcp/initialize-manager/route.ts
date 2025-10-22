import { NextRequest, NextResponse } from 'next/server'
import { MCPServerManager } from '../../../../services/mcp-server-manager'

export async function POST(request: NextRequest) {
    try {
        const manager = MCPServerManager.getInstance()
        const servers = await manager.initializeFromConfig()

        return NextResponse.json({ servers })
    } catch (error) {
        console.error('Failed to initialize MCP manager:', error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        )
    }
}