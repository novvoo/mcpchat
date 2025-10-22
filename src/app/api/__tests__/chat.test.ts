import { NextRequest } from 'next/server'
import { POST, GET } from '../chat/route'

// Mock the services
jest.mock('@/services/llm-service', () => ({
  getLLMService: jest.fn(() => ({
    initialize: jest.fn(),
    updateApiKey: jest.fn(),
    sendMessage: jest.fn(),
    getConfig: jest.fn(() => ({
      baseUrl: 'https://test-api.com/v1',
      timeout: 30000,
      headers: { Authorization: 'Bearer test-key' }
    })),
    testConnection: jest.fn()
  })),
  LLMServiceError: class LLMServiceError extends Error {
    constructor(message: string, public statusCode: number = 500, public details?: any) {
      super(message)
      this.name = 'LLMServiceError'
    }
  }
}))

jest.mock('@/services/tool-orchestrator', () => ({
  getToolOrchestrator: jest.fn(() => ({
    processMessage: jest.fn()
  }))
}))

jest.mock('@/types/validation', () => ({
  validateChatRequest: jest.fn()
}))

const { getLLMService, LLMServiceError } = require('@/services/llm-service')
const { getToolOrchestrator } = require('@/services/tool-orchestrator')
const { validateChatRequest } = require('@/types/validation')

describe('/api/chat', () => {
  let mockLLMService: any
  let mockOrchestrator: any

  beforeEach(() => {
    mockLLMService = getLLMService()
    mockOrchestrator = getToolOrchestrator()
    jest.clearAllMocks()
  })

  describe('POST', () => {
    it('processes single message with tool orchestration', async () => {
      validateChatRequest.mockReturnValue({ isValid: true })
      
      mockOrchestrator.processMessage.mockResolvedValue({
        response: {
          content: 'Hello there!',
          usage: { promptTokens: 5, completionTokens: 10 }
        },
        conversationId: 'conv_123',
        toolCalls: [],
        toolResults: []
      })

      const request = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          message: 'Hello',
          enableTools: true
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.response.content).toBe('Hello there!')
      expect(data.data.conversationId).toBe('conv_123')
      expect(mockOrchestrator.processMessage).toHaveBeenCalledWith('Hello', undefined, {
        enableTools: true,
        maxToolCalls: 5,
        toolTimeout: 30000
      })
    })

    it('processes messages array directly', async () => {
      validateChatRequest.mockReturnValue({ isValid: true })
      
      mockLLMService.sendMessage.mockResolvedValue({
        content: 'Response to messages',
        usage: { promptTokens: 10, completionTokens: 15 }
      })

      const request = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [
            { role: 'user', content: 'Hello' },
            { role: 'assistant', content: 'Hi there!' }
          ],
          conversationId: 'existing_conv'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.response).toBe('Response to messages')
      expect(data.data.conversationId).toBe('existing_conv')
      expect(mockLLMService.sendMessage).toHaveBeenCalledWith([
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' }
      ])
    })

    it('updates API key when provided', async () => {
      validateChatRequest.mockReturnValue({ isValid: true })
      
      mockOrchestrator.processMessage.mockResolvedValue({
        response: { content: 'Response' },
        conversationId: 'conv_123',
        toolCalls: [],
        toolResults: []
      })

      const request = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          message: 'Hello',
          apiKey: 'custom-api-key'
        })
      })

      await POST(request)

      expect(mockLLMService.updateApiKey).toHaveBeenCalledWith('custom-api-key')
    })

    it('returns validation error for invalid request', async () => {
      validateChatRequest.mockReturnValue({
        isValid: false,
        errors: ['Message is required']
      })

      const request = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        body: JSON.stringify({})
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('INVALID_MESSAGE')
      expect(data.error.details).toEqual(['Message is required'])
    })

    it('returns error when neither message nor messages provided', async () => {
      validateChatRequest.mockReturnValue({ isValid: true })

      const request = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          someOtherField: 'value'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error.message).toBe('Either "message" string or "messages" array is required')
    })

    it('handles LLM service errors', async () => {
      validateChatRequest.mockReturnValue({ isValid: true })
      
      mockOrchestrator.processMessage.mockRejectedValue(
        new LLMServiceError('API key invalid', 401, { code: 'invalid_api_key' })
      )

      const request = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          message: 'Hello'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('LLM_SERVICE_ERROR')
      expect(data.error.message).toBe('API key invalid')
    })

    it('handles authentication errors', async () => {
      validateChatRequest.mockReturnValue({ isValid: true })
      
      mockOrchestrator.processMessage.mockRejectedValue(
        new Error('401 Unauthorized')
      )

      const request = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          message: 'Hello'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('LLM_AUTHENTICATION_ERROR')
    })

    it('handles rate limit errors', async () => {
      validateChatRequest.mockReturnValue({ isValid: true })
      
      mockOrchestrator.processMessage.mockRejectedValue(
        new Error('429 Rate limit exceeded')
      )

      const request = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          message: 'Hello'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(429)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('LLM_RATE_LIMIT_ERROR')
    })

    it('handles network errors', async () => {
      validateChatRequest.mockReturnValue({ isValid: true })
      
      mockOrchestrator.processMessage.mockRejectedValue(
        new Error('fetch failed - network error')
      )

      const request = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          message: 'Hello'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(503)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('NETWORK_ERROR')
    })

    it('handles generic errors', async () => {
      validateChatRequest.mockReturnValue({ isValid: true })
      
      mockOrchestrator.processMessage.mockRejectedValue(
        new Error('Unexpected error')
      )

      const request = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          message: 'Hello'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('INTERNAL_SERVER_ERROR')
      expect(data.error.details).toBe('Unexpected error')
    })

    it('generates conversation ID when not provided', async () => {
      validateChatRequest.mockReturnValue({ isValid: true })
      
      mockLLMService.sendMessage.mockResolvedValue({
        content: 'Response',
        usage: { promptTokens: 5, completionTokens: 10 }
      })

      const request = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Hello' }]
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.conversationId).toMatch(/^conv_\d+_[a-z0-9]+$/)
    })
  })

  describe('GET', () => {
    it('returns service status', async () => {
      const request = new NextRequest('http://localhost:3000/api/chat')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.status).toBe('ready')
      expect(data.data.endpoint).toBe('https://test-api.com/v1')
      expect(data.data.timeout).toBe(30000)
      expect(data.data.hasApiKey).toBe(true)
    })

    it('tests connection when requested', async () => {
      mockLLMService.testConnection.mockResolvedValue(true)

      const request = new NextRequest('http://localhost:3000/api/chat?test=true')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.connectionStatus).toBe('connected')
      expect(mockLLMService.testConnection).toHaveBeenCalled()
    })

    it('handles connection test failure', async () => {
      mockLLMService.testConnection.mockResolvedValue(false)

      const request = new NextRequest('http://localhost:3000/api/chat?test=true')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.connectionStatus).toBe('failed')
    })

    it('handles connection test error', async () => {
      mockLLMService.testConnection.mockRejectedValue(new Error('Connection failed'))

      const request = new NextRequest('http://localhost:3000/api/chat?test=true')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.connectionStatus).toBe('failed')
    })

    it('handles service status errors', async () => {
      mockLLMService.getConfig.mockImplementation(() => {
        throw new Error('Config error')
      })

      const request = new NextRequest('http://localhost:3000/api/chat')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('INTERNAL_SERVER_ERROR')
    })
  })
})