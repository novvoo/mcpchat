// Batch MCP tool execution API endpoint

import { NextRequest, NextResponse } from 'next/server'
import { getMCPToolsService } from '@/services/mcp-tools'
import { HTTP_STATUS, ERROR_CODES } from '@/types/constants'
import { ToolCall, ToolResult } from '@/types'

/**
 * POST /api/mcp/execute-batch
 * Execute multiple MCP tools in batch
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { toolCalls } = body

    if (!toolCalls || !Array.isArray(toolCalls)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: ERROR_CODES.INVALID_PARAMETERS,
            message: 'toolCalls array is required'
          }
        },
        { status: HTTP_STATUS.BAD_REQUEST }
      )
    }

    const mcpToolsService = getMCPToolsService()
    const results: ToolResult[] = []

    // Execute tool calls in parallel
    const executionPromises = toolCalls.map(async (toolCall: ToolCall) => {
      try {
        // Validate tool call format
        if (!toolCall.id || !toolCall.name || typeof toolCall.parameters !== 'object') {
          return {
            toolCallId: toolCall.id || 'unknown',
            result: null,
            error: 'Invalid tool call format'
          }
        }

        const executionResult = await mcpToolsService.executeTool(
          toolCall.name,
          toolCall.parameters,
          {
            timeout: 30000,
            retryAttempts: 2,
            validateInput: true
          }
        )

        if (executionResult.success) {
          return {
            toolCallId: toolCall.id,
            result: executionResult.result
          }
        } else {
          return {
            toolCallId: toolCall.id,
            result: null,
            error: executionResult.error?.message || 'Tool execution failed'
          }
        }
      } catch (error) {
        // Print full error with stack and non-enumerable props for Jest output
        console.error(`Error executing tool ${toolCall.name}:`, JSON.stringify(error, Object.getOwnPropertyNames(error)))
        return {
          toolCallId: toolCall.id,
          result: null,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    })

    const executionResults = await Promise.all(executionPromises)
    results.push(...executionResults)

    return NextResponse.json(
      {
        success: true,
        results
      },
      { status: HTTP_STATUS.OK }
    )

  } catch (error) {
    // Print full error with stack and non-enumerable props for Jest output
    console.error('Batch tool execution API error:', JSON.stringify(error, Object.getOwnPropertyNames(error)))
    
    return NextResponse.json(
      {
        success: false,
        error: {
          code: ERROR_CODES.INTERNAL_SERVER_ERROR,
          message: 'Failed to execute tools',
          details: error instanceof Error ? error.message : 'Unknown error'
        }
      },
      { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
    )
  }
}