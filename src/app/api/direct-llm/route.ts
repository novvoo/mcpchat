// Direct LLM API - 直接调用LLM，跳过Smart Router

import { NextRequest, NextResponse } from 'next/server'
import { getLLMService, LLMServiceError } from '@/services/llm-service'
import { validateChatRequest } from '@/types/validation'
import { HTTP_STATUS, ERROR_CODES } from '@/types/constants'
import { ChatMessage, ChatApiResponse } from '@/types'

/**
 * POST /api/direct-llm
 * 直接调用LLM，跳过Smart Router和MCP工具检测
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // 验证请求
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

    const { message, messages, apiKey, conversationId } = body
    
    // 初始化LLM服务
    const llmService = getLLMService()
    await llmService.initialize()
    
    // 更新API密钥
    if (apiKey) {
      llmService.updateApiKey(apiKey)
    }

    let chatMessages: ChatMessage[]

    if (message && typeof message === 'string') {
      // 单条消息模式
      chatMessages = [
        {
          role: 'system',
          content: '你是一个智能助手，专注于回答用户的问题和提供帮助。请直接回答用户的问题，不要尝试调用任何工具。'
        },
        {
          role: 'user',
          content: message
        }
      ]
    } else if (messages && Array.isArray(messages)) {
      // 消息数组模式
      chatMessages = messages.map((msg: any) => ({
        role: msg.role,
        content: msg.content
      }))
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

    // 直接发送到LLM
    const response = await llmService.sendMessage(chatMessages)
    
    // 生成会话ID
    const responseConversationId = conversationId || `direct_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`

    const apiResponse: ChatApiResponse = {
      response: response.content,
      conversationId: responseConversationId,
      toolCalls: undefined // 明确不返回工具调用
    }

    return NextResponse.json(
      {
        success: true,
        data: apiResponse,
        source: 'direct-llm',
        usage: response.usage
      },
      { status: HTTP_STATUS.OK }
    )

  } catch (error) {
    console.error('Direct LLM API error:', error)

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
 * GET /api/direct-llm
 * 获取直接LLM服务状态
 */
export async function GET() {
  try {
    const llmService = getLLMService()
    const config = llmService.getConfig()
    
    return NextResponse.json(
      {
        success: true,
        data: {
          status: 'ready',
          endpoint: config.baseUrl,
          timeout: config.timeout,
          hasApiKey: !!config.headers.Authorization,
          mode: 'direct-llm',
          description: 'Direct LLM access without Smart Router'
        }
      },
      { status: HTTP_STATUS.OK }
    )

  } catch (error) {
    console.error('Direct LLM status error:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: {
          code: ERROR_CODES.INTERNAL_SERVER_ERROR,
          message: 'Failed to get direct LLM service status'
        }
      },
      { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
    )
  }
}