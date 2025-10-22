// MCP Server Management API endpoint - Manage MCP server lifecycle

import { NextRequest, NextResponse } from 'next/server'
import { getMCPManager } from '@/services/mcp-manager'
import { getConfigLoader } from '@/services/config'
import { HTTP_STATUS, ERROR_CODES } from '@/types/constants'

/**
 * GET /api/mcp/servers
 * List all configured MCP servers
 */
export async function GET(request: NextRequest) {
  try {
    const configLoader = getConfigLoader()
    const mcpManager = getMCPManager()
    
    // Get server configurations
    const serverConfigs = configLoader.getAllMCPServerConfigs()
    const enabledServers = configLoader.getEnabledServers()
    const serverStatus = mcpManager.getServerStatus()
    
    // Combine configuration and status information
    const servers = Object.entries(serverConfigs).map(([name, config]) => ({
      name,
      config,
      enabled: !config.disabled,
      status: serverStatus[name] || { name, status: 'disconnected' },
      autoApproveCount: config.autoApprove.length
    }))

    return NextResponse.json(
      {
        success: true,
        data: {
          servers,
          summary: {
            total: servers.length,
            enabled: enabledServers.length,
            connected: servers.filter(s => s.status.status === 'connected').length
          }
        }
      },
      { status: HTTP_STATUS.OK }
    )

  } catch (error) {
    // Print full error with stack and non-enumerable props for Jest output
    console.error('MCP servers list API error:', JSON.stringify(error, Object.getOwnPropertyNames(error)))
    
    return NextResponse.json(
      {
        success: false,
        error: {
          code: ERROR_CODES.MCP_SERVER_ERROR,
          message: 'Failed to list MCP servers',
          details: error instanceof Error ? error.message : 'Unknown error'
        }
      },
      { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
    )
  }
}

/**
 * POST /api/mcp/servers
 * Manage MCP server operations (start, stop, restart)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, serverId } = body
    
    if (!action || !serverId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: ERROR_CODES.INVALID_PARAMETERS,
            message: 'Action and serverId are required'
          }
        },
        { status: HTTP_STATUS.BAD_REQUEST }
      )
    }

    const mcpManager = getMCPManager()
    const registry = mcpManager.getRegistry()
    
    switch (action) {
      case 'start':
        try {
          const configLoader = getConfigLoader()
          const serverConfig = configLoader.getMCPServerConfig(serverId)
          
          if (!serverConfig) {
            return NextResponse.json(
              {
                success: false,
                error: {
                  code: ERROR_CODES.MCP_SERVER_ERROR,
                  message: `Server configuration for '${serverId}' not found`
                }
              },
              { status: HTTP_STATUS.NOT_FOUND }
            )
          }

          await registry.register(serverId, serverConfig)
          
          return NextResponse.json(
            {
              success: true,
              data: {
                message: `Server '${serverId}' started successfully`,
                serverId,
                action: 'start'
              }
            },
            { status: HTTP_STATUS.OK }
          )
        } catch (error) {
          return NextResponse.json(
            {
              success: false,
              error: {
                code: ERROR_CODES.MCP_SERVER_ERROR,
                message: `Failed to start server '${serverId}': ${error instanceof Error ? error.message : 'Unknown error'}`
              }
            },
            { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
          )
        }

      case 'stop':
        try {
          await registry.unregister(serverId)
          
          return NextResponse.json(
            {
              success: true,
              data: {
                message: `Server '${serverId}' stopped successfully`,
                serverId,
                action: 'stop'
              }
            },
            { status: HTTP_STATUS.OK }
          )
        } catch (error) {
          return NextResponse.json(
            {
              success: false,
              error: {
                code: ERROR_CODES.MCP_SERVER_ERROR,
                message: `Failed to stop server '${serverId}': ${error instanceof Error ? error.message : 'Unknown error'}`
              }
            },
            { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
          )
        }

      case 'restart':
        try {
          // Stop first
          await registry.unregister(serverId)
          
          // Wait a moment
          await new Promise(resolve => setTimeout(resolve, 1000))
          
          // Start again
          const configLoader = getConfigLoader()
          const serverConfig = configLoader.getMCPServerConfig(serverId)
          
          if (!serverConfig) {
            return NextResponse.json(
              {
                success: false,
                error: {
                  code: ERROR_CODES.MCP_SERVER_ERROR,
                  message: `Server configuration for '${serverId}' not found`
                }
              },
              { status: HTTP_STATUS.NOT_FOUND }
            )
          }

          await registry.register(serverId, serverConfig)
          
          return NextResponse.json(
            {
              success: true,
              data: {
                message: `Server '${serverId}' restarted successfully`,
                serverId,
                action: 'restart'
              }
            },
            { status: HTTP_STATUS.OK }
          )
        } catch (error) {
          return NextResponse.json(
            {
              success: false,
              error: {
                code: ERROR_CODES.MCP_SERVER_ERROR,
                message: `Failed to restart server '${serverId}': ${error instanceof Error ? error.message : 'Unknown error'}`
              }
            },
            { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
          )
        }

      default:
        return NextResponse.json(
          {
            success: false,
            error: {
              code: ERROR_CODES.INVALID_PARAMETERS,
              message: `Invalid action '${action}'. Supported actions: start, stop, restart`
            }
          },
          { status: HTTP_STATUS.BAD_REQUEST }
        )
    }

  } catch (error) {
    // Print full error with stack and non-enumerable props for Jest output
    console.error('MCP server management API error:', JSON.stringify(error, Object.getOwnPropertyNames(error)))
    
    return NextResponse.json(
      {
        success: false,
        error: {
          code: ERROR_CODES.MCP_SERVER_ERROR,
          message: 'Failed to manage MCP server',
          details: error instanceof Error ? error.message : 'Unknown error'
        }
      },
      { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
    )
  }
}