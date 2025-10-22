import { OpenAICompatibleLLMService, ClientLLMService, LLMServiceError } from '../llm-service'
import { ChatMessage, ChatResponse } from '@/types'

// Mock the config loader
jest.mock('../config', () => ({
  getConfigLoader: jest.fn(() => ({
    loadConfig: jest.fn(),
    getLLMConfig: jest.fn(() => ({
      url: 'https://test-api.com/v1',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-key'
      }
    }))
  }))
}))

// Mock the MCP tools service
const mockExecuteTool = jest.fn()
jest.mock('../mcp-tools', () => ({
  getMCPToolsService: jest.fn(() => ({
    executeTool: mockExecuteTool
  }))
}))

// Mock fetch globally
global.fetch = jest.fn()

describe('OpenAICompatibleLLMService', () => {
  let service: OpenAICompatibleLLMService
  const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>

  beforeEach(async () => {
    service = OpenAICompatibleLLMService.getInstance()
    await service.initialize()
    mockFetch.mockClear()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('sendMessage', () => {
    const mockMessages: ChatMessage[] = [
      {
        role: 'user',
        content: 'Hello, how are you?'
      }
    ]

    it('sends messages successfully', async () => {
      const mockResponse: ChatResponse = {
        content: 'I am doing well, thank you!',
        usage: {
          promptTokens: 10,
          completionTokens: 15
        }
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: mockResponse.content
            }
          }],
          usage: {
            prompt_tokens: 10,
            completion_tokens: 15
          }
        })
      } as Response)

      const result = await service.sendMessage(mockMessages)

      expect(result.content).toBe(mockResponse.content)
      expect(result.usage?.promptTokens).toBe(10)
      expect(result.usage?.completionTokens).toBe(15)
      expect(mockFetch).toHaveBeenCalledWith(
        'https://test-api.com/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-key'
          }),
          body: expect.stringContaining('"messages"')
        })
      )
    })

    it('handles tool calls in response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: 'I will execute a tool for you.',
              tool_calls: [{
                id: 'call_123',
                function: {
                  name: 'test_tool',
                  arguments: '{"param": "value"}'
                }
              }]
            }
          }]
        })
      } as Response)

      const result = await service.sendMessage(mockMessages)

      expect(result.content).toBe('I will execute a tool for you.')
      expect(result.toolCalls).toHaveLength(1)
      expect(result.toolCalls![0].name).toBe('test_tool')
      expect(result.toolCalls![0].parameters).toEqual({ param: 'value' })
    })

    it('validates messages before sending', async () => {
      const invalidMessages: any[] = []

      await expect(service.sendMessage(invalidMessages)).rejects.toThrow(LLMServiceError)
    })

    it('validates message roles', async () => {
      const invalidMessages: any[] = [{
        role: 'invalid_role',
        content: 'Test message'
      }]

      await expect(service.sendMessage(invalidMessages)).rejects.toThrow(LLMServiceError)
    })

    it('validates message content', async () => {
      const invalidMessages: any[] = [{
        role: 'user',
        content: ''
      }]

      await expect(service.sendMessage(invalidMessages)).rejects.toThrow(LLMServiceError)
    })

    it('handles HTTP errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({ error: 'Invalid API key' })
      } as Response)

      await expect(service.sendMessage(mockMessages)).rejects.toThrow(LLMServiceError)
    })

    it('handles network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      await expect(service.sendMessage(mockMessages)).rejects.toThrow(LLMServiceError)
    })

    it('handles timeout errors', async () => {
      mockFetch.mockImplementationOnce(() => 
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error('AbortError')), 100)
        })
      )

      await expect(service.sendMessage(mockMessages)).rejects.toThrow(LLMServiceError)
    })
  })

  describe('handleToolCalls', () => {
    it('executes tool calls successfully', async () => {
      mockExecuteTool.mockResolvedValueOnce({
        success: true,
        result: 'Tool executed successfully'
      })

      const toolCalls = [{
        id: 'call_123',
        name: 'test_tool',
        parameters: { param: 'value' }
      }]

      const results = await service.handleToolCalls(toolCalls)

      expect(results).toHaveLength(1)
      expect(results[0].toolCallId).toBe('call_123')
      expect(results[0].result).toBe('Tool executed successfully')
      expect(mockExecuteTool).toHaveBeenCalledWith(
        'test_tool',
        { param: 'value' },
        expect.objectContaining({
          timeout: expect.any(Number),
          retryAttempts: 2,
          validateInput: true
        })
      )
    })

    it('handles tool execution failures', async () => {
      mockExecuteTool.mockResolvedValueOnce({
        success: false,
        error: { message: 'Tool execution failed' }
      })

      const toolCalls = [{
        id: 'call_123',
        name: 'test_tool',
        parameters: { param: 'value' }
      }]

      const results = await service.handleToolCalls(toolCalls)

      expect(results).toHaveLength(1)
      expect(results[0].toolCallId).toBe('call_123')
      expect(results[0].result).toBeNull()
      expect(results[0].error).toBe('Tool execution failed')
    })

    it('handles tool execution exceptions', async () => {
      mockExecuteTool.mockRejectedValueOnce(new Error('Unexpected error'))

      const toolCalls = [{
        id: 'call_123',
        name: 'test_tool',
        parameters: { param: 'value' }
      }]

      const results = await service.handleToolCalls(toolCalls)

      expect(results).toHaveLength(1)
      expect(results[0].toolCallId).toBe('call_123')
      expect(results[0].result).toBeNull()
      expect(results[0].error).toBe('Unexpected error')
    })
  })

  describe('configuration methods', () => {
    it('updates API key', () => {
      service.updateApiKey('new-api-key')
      const config = service.getConfig()
      
      expect(config.headers.Authorization).toBe('Bearer new-api-key')
    })

    it('updates base URL', () => {
      service.updateBaseUrl('https://new-api.com/v1')
      const config = service.getConfig()
      
      expect(config.baseUrl).toBe('https://new-api.com/v1')
    })

    it('updates timeout', () => {
      service.updateTimeout(60000)
      const config = service.getConfig()
      
      expect(config.timeout).toBe(60000)
    })
  })

  describe('testConnection', () => {
    it('returns true for successful connection', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: { content: 'Hello' }
          }]
        })
      } as Response)

      const result = await service.testConnection()
      expect(result).toBe(true)
    })

    it('returns false for failed connection', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection failed'))

      const result = await service.testConnection()
      expect(result).toBe(false)
    })
  })
})

describe('ClientLLMService', () => {
  let service: ClientLLMService
  const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>

  beforeEach(() => {
    service = ClientLLMService.getInstance()
    mockFetch.mockClear()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('sendMessage', () => {
    const mockMessages: ChatMessage[] = [
      {
        role: 'user',
        content: 'Hello'
      }
    ]

    it('sends messages via API route', async () => {
      const mockResponse = {
        response: {
          content: 'Hello there!',
          usage: { promptTokens: 5, completionTokens: 10 }
        }
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      } as Response)

      service.setApiKey('test-key')
      const result = await service.sendMessage(mockMessages)

      expect(result.content).toBe('Hello there!')
      expect(mockFetch).toHaveBeenCalledWith('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: mockMessages,
          apiKey: 'test-key'
        })
      })
    })

    it('handles API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: { message: 'Bad request' }
        })
      } as Response)

      await expect(service.sendMessage(mockMessages)).rejects.toThrow(LLMServiceError)
    })
  })

  describe('handleToolCalls', () => {
    it('executes tool calls via API route', async () => {
      const toolCalls = [{
        id: 'call_123',
        name: 'test_tool',
        parameters: { param: 'value' }
      }]

      const mockResponse = {
        results: [{
          toolCallId: 'call_123',
          result: 'Success'
        }]
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      } as Response)

      const results = await service.handleToolCalls(toolCalls)

      expect(results).toEqual(mockResponse.results)
      expect(mockFetch).toHaveBeenCalledWith('/api/mcp/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toolCalls })
      })
    })

    it('handles tool execution errors gracefully', async () => {
      const toolCalls = [{
        id: 'call_123',
        name: 'test_tool',
        parameters: { param: 'value' }
      }]

      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const results = await service.handleToolCalls(toolCalls)

      expect(results).toHaveLength(1)
      expect(results[0].toolCallId).toBe('call_123')
      expect(results[0].result).toBeNull()
      expect(results[0].error).toBe('Network error')
    })
  })
})

describe('LLMServiceError', () => {
  it('creates error with message and status code', () => {
    const error = new LLMServiceError('Test error', 400, { detail: 'test' })
    
    expect(error.message).toBe('Test error')
    expect(error.statusCode).toBe(400)
    expect(error.details).toEqual({ detail: 'test' })
    expect(error.name).toBe('LLMServiceError')
  })

  it('uses default status code when not provided', () => {
    const error = new LLMServiceError('Test error')
    
    expect(error.statusCode).toBe(500)
  })
})