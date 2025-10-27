// Enhanced Chat API - 使用LangChain增强的Smart Router

import { NextRequest, NextResponse } from 'next/server'
import { getLLMService, LLMServiceError } from '@/services/llm-service'
import { getEnhancedSmartRouter } from '@/services/enhanced-smart-router'
import { validateChatRequest } from '@/types/validation'
import { HTTP_STATUS, ERROR_CODES } from '@/types/constants'
import { ChatMessage, ChatApiResponse } from '@/types'

/**
 * POST /api/enhanced-chat
 * 使用LangChain增强的智能路由处理聊天请求
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

    // 提取请求数据
    const { 
      message, 
      messages, 
      apiKey, 
      conversationId, 
      enableTools = true,
      useLangChain = true,
      mcpConfidenceThreshold = 0.4
    } = body
    
    // 初始化LLM服务
    const llmService = getLLMService()
    await llmService.initialize()
    
    // 更新API密钥
    if (apiKey) {
      llmService.updateApiKey(apiKey)
    }

    let result: any

    if (message && typeof message === 'string') {
      // 使用增强版智能路由处理消息
      const enhancedRouter = getEnhancedSmartRouter()
      
      result = await enhancedRouter.processMessage(message, conversationId, {
        enableMCPFirst: enableTools,
        enableLLMFallback: true,
        mcpConfidenceThreshold,
        maxToolCalls: 5,
        useLangChain // 启用LangChain增强
      })

      // 准备API响应
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
          reasoning: result.reasoning,
          enhanced: true // 标识这是增强版处理
        },
        { status: HTTP_STATUS.OK }
      )
    } else if (messages && Array.isArray(messages)) {
      // 直接消息数组模式（传统支持）
      const chatMessages: ChatMessage[] = messages.map((msg: any) => ({
        role: msg.role,
        content: msg.content,
        tool_calls: msg.tool_calls
      }))

      // 直接发送到LLM服务
      const response = await llmService.sendMessage(chatMessages)
      
      // 生成会话ID
      const responseConversationId = conversationId || `enhanced_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`

      // 准备API响应
      const apiResponse: ChatApiResponse = {
        response: response.content,
        conversationId: responseConversationId,
        toolCalls: response.toolCalls
      }

      return NextResponse.json(
        {
          success: true,
          data: apiResponse,
          usage: response.usage,
          enhanced: false // 标识这是传统处理
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
    console.error('Enhanced Chat API error:', error)

    // 处理LLM服务错误
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

    // 处理认证错误
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

    // 通用错误处理
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
 * GET /api/enhanced-chat
 * 获取增强版聊天服务状态
 */
export async function GET(request: NextRequest) {
  try {
    const llmService = getLLMService()
    const config = llmService.getConfig()
    
    // 检查LangChain处理器状态
    const { getLangChainTextProcessor } = await import('@/services/langchain-text-processor')
    const langchainProcessor = getLangChainTextProcessor()
    const langchainStatus = langchainProcessor.getStatus()
    
    // 测试连接（可选）
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
          hasApiKey: !!config.headers.Authorization,
          enhanced: true,
          langchainStatus,
          features: [
            'LangChain增强意图识别',
            '高级分词和实体识别',
            '语义情感分析',
            '智能工具路由',
            '上下文感知处理'
          ]
        }
      },
      { status: HTTP_STATUS.OK }
    )

  } catch (error) {
    console.error('Enhanced Chat status API error:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: {
          code: ERROR_CODES.INTERNAL_SERVER_ERROR,
          message: 'Failed to get enhanced chat service status'
        }
      },
      { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
    )
  }
}