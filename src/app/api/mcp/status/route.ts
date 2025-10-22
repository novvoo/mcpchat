// MCP Server Status API endpoint - Get MCP server status and health

import { NextRequest, NextResponse } from 'next/server'
import { getMCPManager } from '@/services/mcp-manager'
import { getMCPHealthMonitor } from '@/services/mcp-health'
import { HTTP_STATUS, ERROR_CODES } from '@/types/constants'

/**
 * GET /api/mcp/status
 * Get status of all MCP servers
 */
export async function GET(request: NextRequest) {
    try {
        const url = new URL(request.url)
        const includeHealth = url.searchParams.get('health') === 'true'
        const includeMetrics = url.searchParams.get('metrics') === 'true'

        const mcpManager = getMCPManager()
        const healthMonitor = getMCPHealthMonitor()

        // Get server status
        const serverStatus = mcpManager.getServerStatus()

        const response: any = {
            servers: serverStatus,
            summary: {
                total: Object.keys(serverStatus).length,
                connected: Object.values(serverStatus).filter(s => s.status === 'connected').length,
                disconnected: Object.values(serverStatus).filter(s => s.status === 'disconnected').length,
                error: Object.values(serverStatus).filter(s => s.status === 'error').length,
                initializing: Object.values(serverStatus).filter(s => s.status === 'initializing').length
            }
        }

        // Include health information if requested
        if (includeHealth) {
            response.health = {
                checks: healthMonitor.getAllServerHealth(),
                summary: healthMonitor.getHealthSummary(),
                monitoring: healthMonitor.isMonitoring()
            }
        }

        // Include metrics if requested
        if (includeMetrics) {
            const registry = mcpManager.getRegistry()
            const metrics: any = {}

            for (const [serverName, server] of registry.servers) {
                try {
                    // Check if server has getMetrics method (our implementation does)
                    if ('getMetrics' in server && typeof server.getMetrics === 'function') {
                        metrics[serverName] = (server as any).getMetrics()
                    } else {
                        metrics[serverName] = {
                            message: 'Metrics not available for this server type',
                            serverType: server.constructor.name
                        }
                    }
                } catch (error) {
                    metrics[serverName] = { error: 'Failed to get metrics' }
                }
            }

            response.metrics = metrics
        }

        return NextResponse.json(
            {
                success: true,
                data: response,
                timestamp: new Date().toISOString()
            },
            { status: HTTP_STATUS.OK }
        )

    } catch (error) {
        // Print full error with stack and non-enumerable props for Jest output
        console.error('MCP status API error:', JSON.stringify(error, Object.getOwnPropertyNames(error)))

        return NextResponse.json(
            {
                success: false,
                error: {
                    code: ERROR_CODES.MCP_SERVER_ERROR,
                    message: 'Failed to retrieve MCP server status',
                    details: error instanceof Error ? error.message : 'Unknown error'
                }
            },
            { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
        )
    }
}

/**
 * POST /api/mcp/status
 * Perform health check on all servers
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json().catch(() => ({}))
        const { serverId } = body

        const healthMonitor = getMCPHealthMonitor()

        if (serverId) {
            // Force health check for specific server
            const healthCheck = await healthMonitor.forceHealthCheck(serverId)

            if (!healthCheck) {
                return NextResponse.json(
                    {
                        success: false,
                        error: {
                            code: ERROR_CODES.MCP_SERVER_ERROR,
                            message: `Server '${serverId}' not found`
                        }
                    },
                    { status: HTTP_STATUS.NOT_FOUND }
                )
            }

            return NextResponse.json(
                {
                    success: true,
                    data: {
                        serverId,
                        healthCheck,
                        timestamp: new Date().toISOString()
                    }
                },
                { status: HTTP_STATUS.OK }
            )
        } else {
            // Start monitoring if not already running
            if (!healthMonitor.isMonitoring()) {
                healthMonitor.startMonitoring()
            }

            // Get current health summary
            const healthSummary = healthMonitor.getHealthSummary()

            return NextResponse.json(
                {
                    success: true,
                    data: {
                        message: 'Health monitoring started',
                        summary: healthSummary,
                        monitoring: true,
                        timestamp: new Date().toISOString()
                    }
                },
                { status: HTTP_STATUS.OK }
            )
        }

    } catch (error) {
        // Print full error with stack and non-enumerable props for Jest output
        console.error('MCP health check API error:', JSON.stringify(error, Object.getOwnPropertyNames(error)))

        return NextResponse.json(
            {
                success: false,
                error: {
                    code: ERROR_CODES.MCP_SERVER_ERROR,
                    message: 'Failed to perform health check',
                    details: error instanceof Error ? error.message : 'Unknown error'
                }
            },
            { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
        )
    }
}