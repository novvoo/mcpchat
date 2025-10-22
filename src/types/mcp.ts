// MCP (Model Context Protocol) specific types and interfaces

import { MCPServerConfig, Tool, ToolCall, ToolResult } from './index'

// MCP protocol message types
export interface MCPMessage {
  jsonrpc: '2.0'
  id?: string | number
  method?: string
  params?: any
  result?: any
  error?: MCPError
}

// MCP error structure
export interface MCPError {
  code: number
  message: string
  data?: any
}

// MCP server capabilities
export interface MCPCapabilities {
  tools?: {
    listChanged?: boolean
  }
  resources?: {
    subscribe?: boolean
    listChanged?: boolean
  }
  prompts?: {
    listChanged?: boolean
  }
  logging?: {}
}

// MCP initialization request
export interface MCPInitializeRequest {
  protocolVersion: string
  capabilities: MCPCapabilities
  clientInfo: {
    name: string
    version: string
  }
}

// MCP initialization response
export interface MCPInitializeResponse {
  protocolVersion: string
  capabilities: MCPCapabilities
  serverInfo: {
    name: string
    version: string
  }
}

// MCP tool list request/response
export interface MCPListToolsRequest {
  cursor?: string
}

export interface MCPListToolsResponse {
  tools: Tool[]
  nextCursor?: string
}

// MCP tool call request/response
export interface MCPCallToolRequest {
  name: string
  arguments?: Record<string, any>
}

export interface MCPCallToolResponse {
  content: Array<{
    type: 'text' | 'image' | 'resource'
    text?: string
    data?: string
    mimeType?: string
  }>
  isError?: boolean
}

// MCP resource types
export interface MCPResource {
  uri: string
  name: string
  description?: string
  mimeType?: string
}

export interface MCPListResourcesRequest {
  cursor?: string
}

export interface MCPListResourcesResponse {
  resources: MCPResource[]
  nextCursor?: string
}

// MCP prompt types
export interface MCPPrompt {
  name: string
  description?: string
  arguments?: Array<{
    name: string
    description?: string
    required?: boolean
  }>
}

export interface MCPListPromptsRequest {
  cursor?: string
}

export interface MCPListPromptsResponse {
  prompts: MCPPrompt[]
  nextCursor?: string
}

// MCP server manager interface
export interface MCPServerManager {
  initialize(config: MCPServerConfig): Promise<void>
  shutdown(): Promise<void>
  listTools(): Promise<Tool[]>
  callTool(name: string, args: Record<string, any>): Promise<MCPCallToolResponse>
  listResources(): Promise<MCPResource[]>
  listPrompts(): Promise<MCPPrompt[]>
  getStatus(): ServerStatus
  isConnected(): boolean
}

// MCP server status
export interface ServerStatus {
  name: string
  status: 'initializing' | 'connected' | 'disconnected' | 'error'
  lastPing?: Date
  error?: string
  capabilities?: MCPCapabilities
}

// MCP connection configuration
export interface MCPConnectionConfig {
  transport: 'stdio' | 'http'
  command?: string
  args?: string[]
  env?: Record<string, string>
  url?: string
  timeout?: number
  retryAttempts?: number
  retryDelay?: number
}

// MCP server registry
export interface MCPServerRegistry {
  servers: Map<string, MCPServerManager>
  register(name: string, config: MCPServerConfig): Promise<void>
  unregister(name: string): Promise<void>
  get(name: string): MCPServerManager | undefined
  list(): string[]
  getStatus(): Record<string, ServerStatus>
}

// MCP tool execution context
export interface MCPToolExecutionContext {
  toolName: string
  parameters: Record<string, any>
  serverId: string
  requestId: string
  timestamp: Date
  timeout?: number
}

// MCP tool execution result
export interface MCPToolExecutionResult {
  success: boolean
  result?: any
  error?: MCPError
  executionTime: number
  context: MCPToolExecutionContext
}

// MCP event types
export type MCPEventType = 
  | 'server_connected'
  | 'server_disconnected'
  | 'server_error'
  | 'tool_called'
  | 'tool_completed'
  | 'tool_failed'
  | 'resource_updated'
  | 'prompt_updated'

export interface MCPEvent {
  type: MCPEventType
  serverId: string
  timestamp: Date
  data?: any
}

// MCP event listener
export type MCPEventListener = (event: MCPEvent) => void

// MCP configuration validator
export interface MCPConfigValidator {
  validate(config: MCPServerConfig): {
    isValid: boolean
    errors: string[]
  }
  validateConnection(config: MCPConnectionConfig): {
    isValid: boolean
    errors: string[]
  }
}

// MCP logging interface
export interface MCPLogger {
  debug(message: string, data?: any): void
  info(message: string, data?: any): void
  warn(message: string, data?: any): void
  error(message: string, error?: Error, data?: any): void
}

// MCP metrics interface
export interface MCPMetrics {
  toolCallCount: number
  toolCallSuccessRate: number
  averageExecutionTime: number
  errorCount: number
  connectionUptime: number
  lastActivity: Date
}

// MCP health check interface
export interface MCPHealthCheck {
  serverId: string
  status: 'healthy' | 'unhealthy' | 'unknown'
  lastCheck: Date
  responseTime?: number
  error?: string
}