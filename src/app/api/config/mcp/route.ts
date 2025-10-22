// API endpoint to serve MCP configuration to client

import { NextRequest, NextResponse } from 'next/server'
import { getConfigLoader } from '@/services/config'
import { HTTP_STATUS, ERROR_CODES } from '@/types/constants'

/**
 * GET /api/config/mcp
 * Returns MCP server configuration for client-side use
 */
export async function GET(request: NextRequest) {
  try {
    const configLoader = getConfigLoader()
    
    // Load configuration from server-side
    await configLoader.loadConfig()
    
    // Get MCP server configurations
    const mcpServers = configLoader.getAllMCPServerConfigs()
    
    // Return only the server configurations (no sensitive data)
    return NextResponse.json(
      {
        success: true,
        servers: mcpServers
      },
      { status: HTTP_STATUS.OK }
    )
  } catch (error) {
    // Print full error with stack and non-enumerable props for Jest output
    console.error('Failed to load MCP configuration:', JSON.stringify(error, Object.getOwnPropertyNames(error)))
    
    return NextResponse.json(
      {
        success: false,
        error: {
          code: ERROR_CODES.INTERNAL_SERVER_ERROR,
          message: 'Failed to load MCP configuration',
          details: error instanceof Error ? error.message : 'Unknown error'
        }
      },
      { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
    )
  }
}