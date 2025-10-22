// LLM Service Client - Handles communication with LLM API

import { ChatMessage, ChatResponse, ToolCall, ToolResult } from '@/types'
import { getConfigLoader } from './config'
import { DEFAULT_CONFIG, ERROR_CODES, HTTP_STATUS } from '@/types/constants'

/**
 * LLM Service interface for chat completions
 */
export interface LLMService {
  sendMessage(messages: ChatMessage[]): Promise<ChatResponse>
  handleToolCalls(toolCalls: ToolCall[]): Promise<ToolResult[]>
}

/**
 * OpenAI-compatible LLM Service implementation
 */
export class OpenAICompatibleLLMService implements LLMService {
  private static instance: OpenAICompatibleLLMService
  private baseUrl: string
  private headers: Record<string, string>
  private timeout: number = DEFAULT_CONFIG.REQUEST_TIMEOUT

  private constructor() {
    // Initialize with default values, will be updated when config is loaded
    this.baseUrl = DEFAULT_CONFIG.LLM_URL
    this.headers = {
      'Content-Type': 'application/json',
      'Authorization': ''
    }
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): OpenAICompatibleLLMService {
    if (!OpenAICompatibleLLMService.instance) {
      OpenAICompatibleLLMService.instance = new OpenAICompatibleLLMService()
    }
    return OpenAICompatibleLLMService.instance
  }

  /**
   * Initialize the service with configuration
   */
  async initialize(): Promise<void> {
    try {
      const configLoader = getConfigLoader()
      await configLoader.loadConfig()
      
      const llmConfig = configLoader.getLLMConfig()
      this.baseUrl = llmConfig.url
      this.headers = { ...llmConfig.headers }
      
      console.log('LLM Service initialized with endpoint:', this.baseUrl)
    } catch (error) {
      console.error('Failed to initialize LLM service:', error)
      // Continue with default configuration
    }
  }

  /**
   * Send messages to LLM and get response
   */
  async sendMessage(messages: ChatMessage[]): Promise<ChatResponse> {
    try {
      // Validate messages
      this.validateMessages(messages)

      // Prepare request payload
      const requestPayload = {
        model: 'gpt-4o', // Default model, can be made configurable
        messages: messages.map(msg => ({
          role: msg.role,
          content: msg.content,
          ...(msg.tool_calls && { tool_calls: msg.tool_calls })
        })),
        temperature: 0.7,
        max_tokens: 2000,
        stream: false
      }

      // Make API request
      const response = await this.makeRequest('/chat/completions', requestPayload)
      
      // Parse and return response
      return this.parseResponse(response)
    } catch (error) {
      console.error('Error sending message to LLM:', error)
      throw this.handleError(error)
    }
  }

  /**
   * Handle tool calls by executing them via MCP
   */
  async handleToolCalls(toolCalls: ToolCall[]): Promise<ToolResult[]> {
    const { getMCPToolsService } = await import('./mcp-tools')
    const mcpToolsService = getMCPToolsService()
    const results: ToolResult[] = []
    
    for (const toolCall of toolCalls) {
      try {
        console.log(`Executing tool call: ${toolCall.name}`, toolCall.parameters)
        
        // Execute the tool via MCP
        const executionResult = await mcpToolsService.executeTool(
          toolCall.name,
          toolCall.parameters,
          {
            timeout: this.timeout,
            retryAttempts: 2,
            validateInput: true
          }
        )
        
        if (executionResult.success) {
          results.push({
            toolCallId: toolCall.id,
            result: executionResult.result
          })
        } else {
          results.push({
            toolCallId: toolCall.id,
            result: null,
            error: executionResult.error?.message || 'Tool execution failed'
          })
        }
      } catch (error) {
        console.error(`Error executing tool ${toolCall.name}:`, error)
        results.push({
          toolCallId: toolCall.id,
          result: null,
          error: error instanceof Error ? error.message : 'Unknown error during tool execution'
        })
      }
    }
    
    return results
  }

  /**
   * Make HTTP request to LLM API
   */
  private async makeRequest(endpoint: string, payload: any): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`
    
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)

    try {
      console.log('Making LLM request to:', url)
      console.log('Request payload:', JSON.stringify(payload, null, 2))
      
      const response = await fetch(url, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(payload),
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        let errorData = {}
        try {
          errorData = await response.json()
        } catch {
          // If JSON parsing fails, try to get text
          const errorText = await response.text()
          errorData = { message: errorText }
        }
        
        throw new LLMServiceError(
          `HTTP ${response.status}: ${response.statusText}`,
          response.status,
          errorData
        )
      }

      // Get response text first to handle both JSON and text responses
      const responseText = await response.text()
      console.log('Raw LLM response:', responseText.substring(0, 200) + '...')
      
      // Check if response looks like JSON
      const contentType = response.headers.get('content-type') || ''
      const looksLikeJson = responseText.trim().startsWith('{') || responseText.trim().startsWith('[')
      
      if (contentType.includes('application/json') || looksLikeJson) {
        try {
          return JSON.parse(responseText)
        } catch (parseError) {
          console.error('Failed to parse JSON response:', parseError)
          console.error('Response text:', responseText.substring(0, 500))
          
          throw new LLMServiceError(
            `Invalid JSON response from LLM service. Response: ${responseText.substring(0, 100)}...`,
            502, // BAD_GATEWAY
            { 
              rawResponse: responseText.substring(0, 500),
              contentType,
              parseError: parseError instanceof Error ? parseError.message : 'Unknown parse error'
            }
          )
        }
      } else {
        // Handle plain text response - convert to OpenAI format
        console.warn('Received plain text response from LLM, converting to JSON format')
        
        return {
          choices: [{
            message: {
              role: 'assistant',
              content: responseText
            }
          }],
          usage: {
            prompt_tokens: 0,
            completion_tokens: responseText.length / 4 // Rough estimate
          }
        }
      }
    } catch (error) {
      clearTimeout(timeoutId)
      
      if (error instanceof Error && error.name === 'AbortError') {
        throw new LLMServiceError('Request timeout', HTTP_STATUS.SERVICE_UNAVAILABLE)
      }
      
      if (error instanceof LLMServiceError) {
        throw error
      }
      
      throw new LLMServiceError(
        `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        HTTP_STATUS.SERVICE_UNAVAILABLE,
        { originalError: error }
      )
    }
  }

  /**
   * Parse LLM API response
   */
  private parseResponse(response: any): ChatResponse {
    try {
      if (!response.choices || !Array.isArray(response.choices) || response.choices.length === 0) {
        throw new Error('Invalid response format: missing choices')
      }

      const choice = response.choices[0]
      const message = choice.message

      if (!message) {
        throw new Error('Invalid response format: missing message')
      }

      // Handle tool calls if present
      let toolCalls: ToolCall[] | undefined
      if (message.tool_calls && Array.isArray(message.tool_calls)) {
        toolCalls = message.tool_calls.map((tc: any) => ({
          id: tc.id || `call_${Date.now()}`,
          name: tc.function?.name || tc.name,
          parameters: tc.function?.arguments ? JSON.parse(tc.function.arguments) : tc.parameters || {}
        }))
      }

      // Content is optional when tool calls are present
      const content = message.content || (toolCalls ? '' : null)
      
      if (content === null) {
        throw new Error('Invalid response format: missing message content and no tool calls')
      }

      const chatResponse: ChatResponse = {
        content,
        usage: response.usage ? {
          promptTokens: response.usage.prompt_tokens || 0,
          completionTokens: response.usage.completion_tokens || 0
        } : undefined,
        toolCalls
      }

      return chatResponse
    } catch (error) {
      console.error('Error parsing LLM response:', error)
      throw new LLMServiceError(
        `Failed to parse response: ${error instanceof Error ? error.message : 'Unknown error'}`,
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      )
    }
  }

  /**
   * Validate messages before sending
   */
  private validateMessages(messages: ChatMessage[]): void {
    if (!Array.isArray(messages) || messages.length === 0) {
      throw new LLMServiceError('Messages array is required and cannot be empty', HTTP_STATUS.BAD_REQUEST)
    }

    for (let i = 0; i < messages.length; i++) {
      const message = messages[i]
      
      if (!message.role || !['user', 'assistant', 'system'].includes(message.role)) {
        throw new LLMServiceError(
          `Invalid role at message ${i}: must be 'user', 'assistant', or 'system'`,
          HTTP_STATUS.BAD_REQUEST
        )
      }

      if (!message.content || typeof message.content !== 'string') {
        throw new LLMServiceError(
          `Invalid content at message ${i}: must be a non-empty string`,
          HTTP_STATUS.BAD_REQUEST
        )
      }

      // Skip length validation for system messages with tool definitions
      // as they can be quite large
      if (message.role !== 'system' && message.content.length > DEFAULT_CONFIG.MAX_MESSAGE_LENGTH) {
        throw new LLMServiceError(
          `Message ${i} exceeds maximum length of ${DEFAULT_CONFIG.MAX_MESSAGE_LENGTH} characters`,
          HTTP_STATUS.BAD_REQUEST
        )
      }
    }
  }

  /**
   * Handle and transform errors
   */
  private handleError(error: any): Error {
    if (error instanceof LLMServiceError) {
      return error
    }

    if (error instanceof Error) {
      if (error.message.includes('fetch')) {
        return new LLMServiceError(
          'Network error: Unable to connect to LLM service',
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          { originalError: error.message }
        )
      }
      
      if (error.message.includes('timeout')) {
        return new LLMServiceError(
          'Request timeout: LLM service did not respond in time',
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          { timeout: this.timeout }
        )
      }
    }

    return new LLMServiceError(
      'Unknown error occurred while communicating with LLM service',
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      { originalError: error }
    )
  }

  /**
   * Update API key
   */
  updateApiKey(apiKey: string): void {
    this.headers['Authorization'] = apiKey ? `Bearer ${apiKey}` : ''
  }

  /**
   * Update base URL
   */
  updateBaseUrl(url: string): void {
    this.baseUrl = url
  }

  /**
   * Update request timeout
   */
  updateTimeout(timeout: number): void {
    this.timeout = timeout
  }

  /**
   * Get current configuration
   */
  getConfig(): {
    baseUrl: string
    headers: Record<string, string>
    timeout: number
  } {
    return {
      baseUrl: this.baseUrl,
      headers: { ...this.headers },
      timeout: this.timeout
    }
  }

  /**
   * Test connection to LLM service
   */
  async testConnection(): Promise<boolean> {
    try {
      const testMessages: ChatMessage[] = [{
        role: 'user',
        content: 'Hello'
      }]

      await this.sendMessage(testMessages)
      return true
    } catch (error) {
      console.error('LLM service connection test failed:', error)
      return false
    }
  }
}

/**
 * Custom error class for LLM service errors
 */
export class LLMServiceError extends Error {
  public readonly statusCode: number
  public readonly details?: any

  constructor(message: string, statusCode: number = HTTP_STATUS.INTERNAL_SERVER_ERROR, details?: any) {
    super(message)
    this.name = 'LLMServiceError'
    this.statusCode = statusCode
    this.details = details
  }
}

/**
 * Client-side LLM service for browser environment
 */
export class ClientLLMService implements LLMService {
  private static instance: ClientLLMService
  private apiKey: string = ''

  private constructor() {}

  /**
   * Get singleton instance
   */
  public static getInstance(): ClientLLMService {
    if (!ClientLLMService.instance) {
      ClientLLMService.instance = new ClientLLMService()
    }
    return ClientLLMService.instance
  }

  /**
   * Set API key for authentication
   */
  setApiKey(apiKey: string): void {
    this.apiKey = apiKey
  }

  /**
   * Send messages via API route
   */
  async sendMessage(messages: ChatMessage[]): Promise<ChatResponse> {
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messages,
          apiKey: this.apiKey
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new LLMServiceError(
          errorData.error?.message || `HTTP ${response.status}`,
          response.status,
          errorData
        )
      }

      const data = await response.json()
      return data.response
    } catch (error) {
      console.error('Error in client LLM service:', error)
      throw error
    }
  }

  /**
   * Handle tool calls via API route
   */
  async handleToolCalls(toolCalls: ToolCall[]): Promise<ToolResult[]> {
    try {
      const response = await fetch('/api/mcp/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          toolCalls
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new LLMServiceError(
          errorData.error?.message || `HTTP ${response.status}`,
          response.status,
          errorData
        )
      }

      const data = await response.json()
      return data.results || []
    } catch (error) {
      console.error('Error in client tool call handling:', error)
      
      // Return error results for each tool call
      return toolCalls.map(toolCall => ({
        toolCallId: toolCall.id,
        result: null,
        error: error instanceof Error ? error.message : 'Unknown error'
      }))
    }
  }
}

/**
 * Convenience functions
 */
export const getLLMService = () => OpenAICompatibleLLMService.getInstance()
export const getClientLLMService = () => ClientLLMService.getInstance()

/**
 * Initialize LLM service
 */
export const initializeLLMService = async (): Promise<OpenAICompatibleLLMService> => {
  const service = getLLMService()
  await service.initialize()
  return service
}