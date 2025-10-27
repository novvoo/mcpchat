// Chat API endpoint - Handles chat requests with smart MCP/LLM routing

import { NextRequest, NextResponse } from 'next/server'
import { getLLMService, LLMServiceError } from '@/services/llm-service'
import { getEnhancedSmartRouter } from '@/services/enhanced-smart-router'
import { getToolOrchestrator } from '@/services/tool-orchestrator'
import { getEnhancedStructuredParser } from '@/services/enhanced-structured-parser'
import { validateChatRequest } from '@/types/validation'
import { HTTP_STATUS, ERROR_CODES } from '@/types/constants'
import { ChatMessage, ChatApiResponse } from '@/types'

/**
 * POST /api/chat
 * Handle chat message requests
 */
export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json()
    
    // Validate request
    const validation = validateChatRequest(body)
    if (!validation.isValid) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: ERROR_CODES.INVALID_MESSAGE,
            message: 'Invalid chat request',
            details: validation.errors
          }
        },
        { status: HTTP_STATUS.BAD_REQUEST }
      )
    }

    // Extract request data
    const { message, messages, apiKey, conversationId, enableTools = true, skipSmartRouter = false, useLangChain = true } = body
    
    // Initialize LLM service
    const llmService = getLLMService()
    await llmService.initialize()
    
    // Update API key if provided
    if (apiKey) {
      llmService.updateApiKey(apiKey)
    }

    let result: any

    if (message && typeof message === 'string') {
      if (skipSmartRouter) {
        // 跳过Smart Router，直接使用LLM
        const chatMessages: ChatMessage[] = [
          {
            role: 'system',
            content: '你是一个智能助手，专注于回答用户的问题和提供帮助。请直接回答用户的问题。'
          },
          {
            role: 'user',
            content: message
          }
        ]

        const response = await llmService.sendMessage(chatMessages)
        const responseConversationId = conversationId || `direct_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`

        result = {
          response: response.content,
          source: 'direct-llm',
          conversationId: responseConversationId,
          toolCalls: undefined,
          toolResults: undefined
        }
      } else {
        // 使用增强版智能路由处理消息 - 基于LangChain的意图识别
        const enhancedRouter = getEnhancedSmartRouter()
        
        result = await enhancedRouter.processMessage(message, conversationId, {
          enableMCPFirst: true,
          enableLLMFallback: true,
          mcpConfidenceThreshold: 0.4,  // 调整为与新置信度系统匹配
          maxToolCalls: 5,
          useLangChain  // 从请求参数中获取，默认为true
        })

        // 使用增强结构化解析器处理响应
        if (result.response && typeof result.response === 'string') {
          const parser = getEnhancedStructuredParser()
          const parsedResult = await parser.parseResponse(result.response)
          
          if (parsedResult.hasStructuredContent) {
            result.response = parsedResult.formattedResponse
          }
        }
      }

      // Prepare API response
      const apiResponse: ChatApiResponse = {
        response: result.response,
        conversationId: result.conversationId,
        toolCalls: result.toolCalls
      }

      return NextResponse.json(
        {
          success: true,
          data: apiResponse,
          toolResults: result.toolResults,
          source: result.source,
          confidence: result.confidence,
          reasoning: result.reasoning
        },
        { status: HTTP_STATUS.OK }
      )
    } else if (messages && Array.isArray(messages)) {
      // Direct messages array (legacy support)
      const chatMessages: ChatMessage[] = messages.map((msg: any) => ({
        role: msg.role,
        content: msg.content,
        tool_calls: msg.tool_calls
      }))

      // Send to LLM service directly
      const response = await llmService.sendMessage(chatMessages)
      
      // Generate conversation ID if not provided
      const responseConversationId = conversationId || `conv_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`

      // Prepare API response
      const apiResponse: ChatApiResponse = {
        response: response.content,
        conversationId: responseConversationId,
        toolCalls: response.toolCalls
      }

      return NextResponse.json(
        {
          success: true,
          data: apiResponse,
          usage: response.usage
        },
        { status: HTTP_STATUS.OK }
      )
    } else {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: ERROR_CODES.INVALID_MESSAGE,
            message: 'Either "message" string or "messages" array is required'
          }
        },
        { status: HTTP_STATUS.BAD_REQUEST }
      )
    }

  } catch (error) {
    // Print full error with stack and non-enumerable props for Jest output
    console.error('Chat API error:', JSON.stringify(error, Object.getOwnPropertyNames(error)))

    // Handle LLM service errors
    if (error instanceof LLMServiceError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: ERROR_CODES.LLM_SERVICE_ERROR,
            message: error.message,
            details: error.details
          }
        },
        { status: error.statusCode }
      )
    }

    // Handle authentication errors
    if (error instanceof Error && error.message.includes('401')) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: ERROR_CODES.LLM_AUTHENTICATION_ERROR,
            message: 'Invalid API key or authentication failed'
          }
        },
        { status: HTTP_STATUS.UNAUTHORIZED }
      )
    }

    // Handle rate limit errors
    if (error instanceof Error && error.message.includes('429')) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: ERROR_CODES.LLM_RATE_LIMIT_ERROR,
            message: 'Rate limit exceeded'
          }
        },
        { status: 429 }
      )
    }

    // Handle network errors
    if (error instanceof Error && (error.message.includes('fetch') || error.message.includes('network'))) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: ERROR_CODES.NETWORK_ERROR,
            message: 'Network error: Unable to connect to LLM service'
          }
        },
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      )
    }

    // Generic error handler
    return NextResponse.json(
      {
        success: false,
        error: {
          code: ERROR_CODES.INTERNAL_SERVER_ERROR,
          message: 'Internal server error',
          details: error instanceof Error ? error.message : 'Unknown error'
        }
      },
      { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
    )
  }
}

/**
 * GET /api/chat
 * Get chat service status and configuration
 */
export async function GET(request: NextRequest) {
  try {
    const llmService = getLLMService()
    const config = llmService.getConfig()
    
    // Test connection (optional, can be enabled via query parameter)
    const url = new URL(request.url)
    const testConnection = url.searchParams.get('test') === 'true'
    
    let connectionStatus = 'unknown'
    if (testConnection) {
      try {
        const isConnected = await llmService.testConnection()
        connectionStatus = isConnected ? 'connected' : 'failed'
      } catch (error) {
        connectionStatus = 'failed'
      }
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          status: 'ready',
          endpoint: config.baseUrl,
          timeout: config.timeout,
          connectionStatus,
          hasApiKey: !!config.headers.Authorization
        }
      },
      { status: HTTP_STATUS.OK }
    )

  } catch (error) {
    // Print full error with stack and non-enumerable props for Jest output
    console.error('Chat status API error:', JSON.stringify(error, Object.getOwnPropertyNames(error)))
    
    return NextResponse.json(
      {
        success: false,
        error: {
          code: ERROR_CODES.INTERNAL_SERVER_ERROR,
          message: 'Failed to get chat service status'
        }
      },
      { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
    )
  }
}