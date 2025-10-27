// Smart Router Architecture Test - 验证架构要求的实现

// Mock all dependencies before importing
jest.mock('../database', () => ({
  getDatabaseService: jest.fn().mockReturnValue({
    getClient: jest.fn().mockResolvedValue({
      query: jest.fn(),
      release: jest.fn()
    })
  })
}))

jest.mock('../llm-service', () => ({
  getLLMService: jest.fn().mockReturnValue({
    sendMessage: jest.fn().mockResolvedValue({
      content: 'This is a pure LLM response without any tool information',
      usage: { promptTokens: 10, completionTokens: 20 }
    })
  })
}))

jest.mock('../mcp-tools', () => ({
  getMCPToolsService: jest.fn().mockReturnValue({
    executeTool: jest.fn(),
    getAvailableTools: jest.fn().mockResolvedValue([])
  })
}))

// mcp-intent-recognizer has been removed

jest.mock('../conversation', () => ({
  getConversationManager: jest.fn().mockReturnValue({
    createConversation: jest.fn().mockReturnValue('test-conversation-id'),
    getConversation: jest.fn().mockReturnValue({ id: 'test-conversation-id', messages: [] }),
    createUserMessage: jest.fn().mockReturnValue({ role: 'user', content: 'test message' }),
    createAssistantMessage: jest.fn().mockReturnValue({ role: 'assistant', content: 'test response' }),
    createSystemMessage: jest.fn().mockReturnValue({ role: 'system', content: 'system message' }),
    addMessage: jest.fn(),
    getMessagesForLLM: jest.fn().mockReturnValue([
      { role: 'user', content: 'test message' }
    ])
  })
}))

jest.mock('../mcp-initializer', () => ({
  isMCPSystemReady: jest.fn().mockReturnValue(true),
  getMCPInitializer: jest.fn().mockReturnValue({
    initialize: jest.fn().mockResolvedValue({ ready: true })
  })
}))

jest.mock('../tool-metadata-service', () => ({
  getToolMetadataService: jest.fn().mockReturnValue({
    initialize: jest.fn(),
    getToolSuggestions: jest.fn().mockResolvedValue([])
  })
}))

import { getSmartRouter } from '../smart-router'
import { getLLMService } from '../llm-service'

describe('Smart Router Architecture Compliance', () => {
  let smartRouter: ReturnType<typeof getSmartRouter>
  let mockLLMService: jest.Mocked<ReturnType<typeof getLLMService>>

  beforeEach(() => {
    jest.clearAllMocks()
    
    smartRouter = getSmartRouter()
    mockLLMService = getLLMService() as jest.Mocked<ReturnType<typeof getLLMService>>
  })

  describe('Architecture Requirement: No MCP Tools in LLM Requests', () => {
    it('should not include any MCP tool definitions in LLM requests', async () => {
      // 测试纯对话场景
      const response = await smartRouter.processMessage(
        'Hello, how are you?',
        'test-conversation-id'
      )

      // 验证LLM被调用
      expect(mockLLMService.sendMessage).toHaveBeenCalledTimes(1)
      
      // 获取发送给LLM的消息
      const sentMessages = mockLLMService.sendMessage.mock.calls[0][0]
      
      // 验证消息中不包含任何工具定义
      const messageContent = JSON.stringify(sentMessages)
      expect(messageContent).not.toContain('solve_n_queens')
      expect(messageContent).not.toContain('run_example')
      expect(messageContent).not.toContain('inputSchema')
      
      // 验证响应来源
      expect(response.source).toBe('llm')
      expect(response.toolCalls).toBeUndefined()
      expect(response.toolResults).toBeUndefined()
    })

    it('should ignore tool calls if LLM accidentally returns them', async () => {
      // Mock LLM返回工具调用（这不应该发生，但如果发生了应该被忽略）
      mockLLMService.sendMessage.mockResolvedValueOnce({
        content: 'I need to use a tool',
        toolCalls: [
          {
            id: 'call_123',
            name: 'some_tool',
            parameters: { param: 'value' }
          }
        ],
        usage: { promptTokens: 10, completionTokens: 20 }
      })

      const response = await smartRouter.processMessage(
        'Solve 8 queens problem',
        'test-conversation-id'
      )

      // 验证工具调用被忽略
      expect(response.toolCalls).toBeUndefined()
      expect(response.toolResults).toBeUndefined()
      expect(response.source).toBe('llm')
      expect(response.response).toBe('I need to use a tool')
    })
  })
})