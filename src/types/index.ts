// Core message types for chat functionality
export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  toolCalls?: ToolCall[]
}

// Tool call interface for MCP tool execution
export interface ToolCall {
  id: string
  name: string
  parameters: object
  result?: any
  error?: string
}

// MCP server configuration interface
export interface MCPServerConfig {
  name: string
  transport?: 'stdio' | 'http'
  command?: string
  args?: string[]
  env: Record<string, string>
  disabled: boolean
  autoApprove: string[]
  url?: string // For HTTP transport
  timeout?: number
  retryAttempts?: number
  retryDelay?: number
}

// Chat response from LLM service
export interface ChatResponse {
  content: string
  toolCalls?: ToolCall[]
  usage?: {
    promptTokens: number
    completionTokens: number
  }
}

// Application configuration interface
export interface AppConfig {
  llm: {
    url: string
    headers: Record<string, string>
  }
  mcp: {
    servers: Record<string, MCPServerConfig>
  }
}

// Error response format for API endpoints
export interface ErrorResponse {
  error: {
    code: string
    message: string
    details?: object
  }
}

// Chat message for LLM API requests
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  tool_calls?: ToolCall[]
}

// Tool result interface
export interface ToolResult {
  toolCallId: string
  result: any
  error?: string
}

// MCP tool definition
export interface Tool {
  name: string
  description: string
  inputSchema: {
    type: string
    properties: Record<string, any>
    required?: string[]
  }
}

// Note: ServerStatus is defined in mcp.ts to avoid duplication

// API request/response types for chat endpoint
export interface ChatRequest {
  message: string
  conversationId?: string
}

export interface ChatApiResponse {
  response: string
  conversationId: string
  toolCalls?: ToolCall[]
}

// API request/response types for MCP endpoints
export interface MCPToolsResponse {
  tools: Tool[]
}

export interface MCPExecuteRequest {
  toolName: string
  parameters: object
}

export interface MCPExecuteResponse {
  result: any
  error?: string
}

// Conversation context for maintaining chat state
export interface ConversationContext {
  id: string
  messages: Message[]
  createdAt: Date
  updatedAt: Date
}

// Loading states for UI components
export interface LoadingState {
  isLoading: boolean
  message?: string
}

// Component prop types
export interface MessageListProps {
  messages: Message[]
  isLoading?: boolean
  showTimestamps?: boolean
  showAvatars?: boolean
  autoScroll?: boolean
  className?: string
  onMessageClick?: (message: Message) => void
  onToolCallClick?: (toolCall: ToolCall) => void
}

export interface MessageInputProps {
  onSubmit: (text: string) => void
  disabled?: boolean
  placeholder?: string
  maxLength?: number
  autoFocus?: boolean
  showCharCount?: boolean
  multiline?: boolean
  className?: string
}

export interface ChatInterfaceProps {
  messages?: Message[]
  onSendMessage?: (text: string) => void | Promise<void>
  isLoading?: boolean
  disabled?: boolean
  showTimestamps?: boolean
  showAvatars?: boolean
  autoScroll?: boolean
  placeholder?: string
  maxMessageLength?: number
  className?: string
  onMessageClick?: (message: Message) => void
  onToolCallClick?: (toolCall: ToolCall) => void
  onError?: (error: string) => void
  apiKey?: string
  conversationId?: string
}