// MCP API Documentation and Overview endpoint

import { NextRequest, NextResponse } from 'next/server'
import { HTTP_STATUS } from '@/types/constants'

/**
 * GET /api/mcp
 * Get MCP API documentation and overview
 */
export async function GET(request: NextRequest) {
  const apiDocumentation = {
    name: 'MCP Chat Client API',
    version: '1.0.0',
    description: 'API for managing MCP (Model Context Protocol) servers and tool execution',
    endpoints: {
      '/api/mcp': {
        methods: ['GET'],
        description: 'API documentation and overview',
        parameters: {}
      },
      '/api/mcp/tools': {
        methods: ['GET', 'POST'],
        description: 'List and refresh available MCP tools',
        parameters: {
          GET: {},
          POST: {
            description: 'Refresh tools from MCP servers'
          }
        }
      },
      '/api/mcp/execute': {
        methods: ['GET', 'POST'],
        description: 'Execute MCP tools and get execution history',
        parameters: {
          GET: {
            limit: 'Number of history items to return (default: 10)',
            stats: 'Include execution statistics (true/false)'
          },
          POST: {
            toolName: 'Name of the tool to execute (required)',
            parameters: 'Tool parameters object (required)',
            timeout: 'Execution timeout in milliseconds (optional, default: 30000)',
            retryAttempts: 'Number of retry attempts (optional, default: 1)'
          }
        }
      },
      '/api/mcp/execute-batch': {
        methods: ['POST'],
        description: 'Execute multiple MCP tools in batch',
        parameters: {
          POST: {
            toolCalls: 'Array of tool call objects with id, name, and parameters'
          }
        }
      },
      '/api/mcp/status': {
        methods: ['GET', 'POST'],
        description: 'Get MCP server status and perform health checks',
        parameters: {
          GET: {
            health: 'Include health information (true/false)',
            metrics: 'Include server metrics (true/false)'
          },
          POST: {
            serverId: 'Specific server ID for health check (optional)'
          }
        }
      },
      '/api/mcp/servers': {
        methods: ['GET', 'POST'],
        description: 'List and manage MCP servers',
        parameters: {
          GET: {},
          POST: {
            action: 'Server action: start, stop, or restart (required)',
            serverId: 'Server ID to manage (required)'
          }
        }
      },
      '/api/chat': {
        methods: ['GET', 'POST'],
        description: 'Chat with LLM and execute tools automatically',
        parameters: {
          GET: {
            test: 'Test LLM connection (true/false)'
          },
          POST: {
            message: 'Single message string (alternative to messages array)',
            messages: 'Array of chat messages (alternative to message string)',
            apiKey: 'LLM API key (optional)',
            conversationId: 'Conversation ID (optional)',
            enableTools: 'Enable automatic tool execution (optional, default: true)'
          }
        }
      }
    },
    examples: {
      'List available tools': {
        method: 'GET',
        url: '/api/mcp/tools',
        response: {
          success: true,
          data: {
            tools: [
              {
                name: 'solve_n_queens',
                description: 'Solve the N-Queens problem',
                inputSchema: {
                  type: 'object',
                  properties: {
                    n: { type: 'number', description: 'Size of the chessboard' }
                  },
                  required: ['n']
                }
              }
            ]
          }
        }
      },
      'Execute a tool': {
        method: 'POST',
        url: '/api/mcp/execute',
        body: {
          toolName: 'solve_n_queens',
          parameters: { n: 8 }
        },
        response: {
          success: true,
          data: {
            result: {
              content: [
                {
                  type: 'text',
                  text: 'N-Queens solution for 8x8 board: Found solution'
                }
              ]
            }
          }
        }
      },
      'Send chat message with tools': {
        method: 'POST',
        url: '/api/chat',
        body: {
          message: 'Solve the 8 queens problem',
          enableTools: true
        },
        response: {
          success: true,
          data: {
            response: 'I\'ll solve the 8 queens problem for you...',
            conversationId: 'conv_123456789',
            toolCalls: [
              {
                id: 'call_1',
                name: 'solve_n_queens',
                parameters: { n: 8 }
              }
            ]
          }
        }
      }
    },
    errorCodes: {
      'INVALID_MESSAGE': 'Invalid chat request format',
      'INVALID_PARAMETERS': 'Invalid request parameters',
      'MCP_SERVER_ERROR': 'MCP server operation failed',
      'MCP_TOOL_NOT_FOUND': 'Requested tool not found or not available',
      'MCP_TOOL_EXECUTION_ERROR': 'Tool execution failed',
      'LLM_SERVICE_ERROR': 'LLM service error',
      'NETWORK_ERROR': 'Network communication error',
      'INTERNAL_SERVER_ERROR': 'Internal server error'
    }
  }

  return NextResponse.json(
    {
      success: true,
      data: apiDocumentation,
      timestamp: new Date().toISOString()
    },
    { status: HTTP_STATUS.OK }
  )
}