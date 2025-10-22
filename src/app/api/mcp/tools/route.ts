// MCP Tools API endpoint - List available MCP tools

import { NextRequest, NextResponse } from 'next/server'
import { getMCPToolsService } from '@/services/mcp-tools'
import { getMCPManager } from '@/services/mcp-manager'
import { HTTP_STATUS, ERROR_CODES } from '@/types/constants'
import { MCPToolsResponse } from '@/types'

/**
 * GET /api/mcp/tools
 * List all available MCP tools from connected servers
 */
export async function GET(request: NextRequest) {
  try {
    const mcpToolsService = getMCPToolsService()
    
    // Get available tools from all connected servers
    const tools = await mcpToolsService.getAvailableTools()
    
    // Get tools grouped by server for additional context
    const toolsByServer = await mcpToolsService.getToolsByServer()
    
    // Get server status for context
    const mcpManager = getMCPManager()
    const serverStatus = mcpManager.getServerStatus()
    
    const response: MCPToolsResponse = {
      tools
    }

    return NextResponse.json(
      {
        success: true,
        data: response,
        meta: {
          totalTools: tools.length,
          toolsByServer,
          serverStatus,
          timestamp: new Date().toISOString()
        }
      },
      { status: HTTP_STATUS.OK }
    )

  } catch (error) {
    // Print full error with stack and non-enumerable props for Jest output
    console.error('MCP tools API error:', JSON.stringify(error, Object.getOwnPropertyNames(error)))
    
    return NextResponse.json(
      {
        success: false,
        error: {
          code: ERROR_CODES.MCP_SERVER_ERROR,
          message: 'Failed to retrieve MCP tools',
          details: error instanceof Error ? error.message : 'Unknown error'
        }
      },
      { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
    )
  }
}

/**
 * POST /api/mcp/tools
 * Refresh tools from MCP servers
 */
export async function POST(request: NextRequest) {
  try {
    const mcpManager = getMCPManager()
    
    // Reinitialize MCP manager to refresh tools
    await mcpManager.initialize()
    
    // Get updated tools
    const mcpToolsService = getMCPToolsService()
    const tools = await mcpToolsService.getAvailableTools()
    
    return NextResponse.json(
      {
        success: true,
        message: 'MCP tools refreshed successfully',
        data: {
          tools,
          refreshedAt: new Date().toISOString()
        }
      },
      { status: HTTP_STATUS.OK }
    )

  } catch (error) {
    // Print full error with stack and non-enumerable props for Jest output
    console.error('MCP tools refresh error:', JSON.stringify(error, Object.getOwnPropertyNames(error)))
    
    return NextResponse.json(
      {
        success: false,
        error: {
          code: ERROR_CODES.MCP_SERVER_ERROR,
          message: 'Failed to refresh MCP tools',
          details: error instanceof Error ? error.message : 'Unknown error'
        }
      },
      { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
    )
  }
}