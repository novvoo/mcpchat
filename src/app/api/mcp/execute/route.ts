// MCP Tool Execution API endpoint - Execute individual MCP tools

import { NextRequest, NextResponse } from 'next/server'
import { getMCPToolsService } from '@/services/mcp-tools'
import { validateMCPExecuteRequest } from '@/types/validation'
import { HTTP_STATUS, ERROR_CODES, ErrorCode } from '@/types/constants'
import { MCPExecuteRequest, MCPExecuteResponse } from '@/types'

/**
 * POST /api/mcp/execute
 * Execute a single MCP tool
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate request
    const validation = validateMCPExecuteRequest(body)
    if (!validation.isValid) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: ERROR_CODES.INVALID_PARAMETERS,
            message: 'Invalid MCP execute request',
            details: validation.errors
          }
        },
        { status: HTTP_STATUS.BAD_REQUEST }
      )
    }

    const { toolName, parameters, timeout = 30000, retryAttempts = 1 } = body as MCPExecuteRequest & {
      timeout?: number
      retryAttempts?: number
    }

    const mcpToolsService = getMCPToolsService()

    // Check if tool is available
    const isAvailable = await mcpToolsService.isToolAvailable(toolName)
    if (!isAvailable) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: ERROR_CODES.MCP_TOOL_NOT_FOUND,
            message: `Tool '${toolName}' is not available or not auto-approved`,
            details: { toolName, availableTools: await mcpToolsService.getAvailableTools().then(tools => tools.map(t => t.name)) }
          }
        },
        { status: HTTP_STATUS.NOT_FOUND }
      )
    }

    // Execute the tool
    const executionResult = await mcpToolsService.executeTool(
      toolName,
      parameters,
      {
        timeout,
        retryAttempts,
        validateInput: true
      }
    )

    if (executionResult.success) {
      const response: MCPExecuteResponse = {
        result: executionResult.result
      }

      return NextResponse.json(
        {
          success: true,
          data: response,
          meta: {
            executionTime: executionResult.executionTime,
            context: executionResult.context,
            timestamp: new Date().toISOString()
          }
        },
        { status: HTTP_STATUS.OK }
      )
    } else {
      const response: MCPExecuteResponse = {
        result: null,
        error: executionResult.error?.message || 'Tool execution failed'
      }

      return NextResponse.json(
        {
          success: false,
          data: response,
          error: {
            code: ERROR_CODES.MCP_TOOL_EXECUTION_ERROR,
            message: executionResult.error?.message || 'Tool execution failed',
            details: executionResult.error
          }
        },
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      )
    }

  } catch (error) {
    // Print full error with stack and non-enumerable props for Jest output
    console.error('MCP execute API error:', JSON.stringify(error, Object.getOwnPropertyNames(error)))

    // Enhanced error handling with specific error types
    let errorCode: ErrorCode = ERROR_CODES.MCP_TOOL_EXECUTION_ERROR
    let statusCode: number = HTTP_STATUS.INTERNAL_SERVER_ERROR
    let errorMessage = 'Failed to execute MCP tool'

    if (error instanceof Error) {
      const message = error.message.toLowerCase()

      if (message.includes('timeout')) {
        errorCode = ERROR_CODES.TIMEOUT_ERROR
        statusCode = HTTP_STATUS.SERVICE_UNAVAILABLE
        errorMessage = 'Tool execution timeout'
      } else if (message.includes('connection') || message.includes('network')) {
        errorCode = ERROR_CODES.MCP_CONNECTION_ERROR
        statusCode = HTTP_STATUS.SERVICE_UNAVAILABLE
        errorMessage = 'MCP server connection error'
      } else if (message.includes('not found') || message.includes('unavailable')) {
        errorCode = ERROR_CODES.MCP_TOOL_NOT_FOUND
        statusCode = HTTP_STATUS.NOT_FOUND
        errorMessage = 'MCP tool not found or unavailable'
      } else {
        errorMessage = error.message
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: errorCode,
          message: errorMessage,
          details: error instanceof Error ? error.message : 'Unknown error'
        }
      },
      { status: statusCode }
    )
  }
}

/**
 * GET /api/mcp/execute
 * Get tool execution history and statistics
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const limit = parseInt(url.searchParams.get('limit') || '10')
    const includeStats = url.searchParams.get('stats') === 'true'

    const mcpToolsService = getMCPToolsService()

    // Get execution history
    const history = mcpToolsService.getExecutionHistory(limit) || []

    const response: any = {
      history
    }

    // Include statistics if requested
    if (includeStats) {
      response.statistics = mcpToolsService.getExecutionStats()
    }

    return NextResponse.json(
      {
        success: true,
        data: response,
        meta: {
          historyCount: history.length,
          timestamp: new Date().toISOString()
        }
      },
      { status: HTTP_STATUS.OK }
    )

  } catch (error) {
    // Print full error with stack and non-enumerable props for Jest output
    console.error('MCP execute history API error:', JSON.stringify(error, Object.getOwnPropertyNames(error)))

    return NextResponse.json(
      {
        success: false,
        error: {
          code: ERROR_CODES.INTERNAL_SERVER_ERROR,
          message: 'Failed to retrieve execution history',
          details: error instanceof Error ? error.message : 'Unknown error'
        }
      },
      { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
    )
  }
}