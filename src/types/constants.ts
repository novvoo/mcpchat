// Application constants and enums

// Message roles
export const MESSAGE_ROLES = {
  USER: 'user',
  ASSISTANT: 'assistant',
  SYSTEM: 'system'
} as const

export type MessageRole = typeof MESSAGE_ROLES[keyof typeof MESSAGE_ROLES]

// Server status types
export const SERVER_STATUS = {
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  ERROR: 'error'
} as const

export type ServerStatusType = typeof SERVER_STATUS[keyof typeof SERVER_STATUS]

// Error codes
export const ERROR_CODES = {
  // Validation errors
  INVALID_ID: 'INVALID_ID',
  INVALID_ROLE: 'INVALID_ROLE',
  INVALID_CONTENT: 'INVALID_CONTENT',
  INVALID_TIMESTAMP: 'INVALID_TIMESTAMP',
  INVALID_MESSAGE: 'INVALID_MESSAGE',
  INVALID_CONVERSATION_ID: 'INVALID_CONVERSATION_ID',
  INVALID_TOOL_NAME: 'INVALID_TOOL_NAME',
  INVALID_PARAMETERS: 'INVALID_PARAMETERS',
  
  // Network errors
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
  CONNECTION_FAILED: 'CONNECTION_FAILED',
  
  // LLM service errors
  LLM_SERVICE_ERROR: 'LLM_SERVICE_ERROR',
  LLM_AUTHENTICATION_ERROR: 'LLM_AUTHENTICATION_ERROR',
  LLM_RATE_LIMIT_ERROR: 'LLM_RATE_LIMIT_ERROR',
  
  // MCP errors
  MCP_SERVER_ERROR: 'MCP_SERVER_ERROR',
  MCP_TOOL_NOT_FOUND: 'MCP_TOOL_NOT_FOUND',
  MCP_TOOL_EXECUTION_ERROR: 'MCP_TOOL_EXECUTION_ERROR',
  MCP_CONNECTION_ERROR: 'MCP_CONNECTION_ERROR',
  
  // General errors
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
} as const

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES]

// Default configuration values
export const DEFAULT_CONFIG = {
  LLM_URL: 'https://ch.at/v1/chat/completions',
  MCP_CONFIG_PATH: './config/mcp.json',
  MAX_MESSAGE_LENGTH: 10000,
  MAX_CONVERSATION_MESSAGES: 100,
  REQUEST_TIMEOUT: 30000, // 30 seconds
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000 // 1 second
} as const

// HTTP status codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503
} as const

// Content types
export const CONTENT_TYPES = {
  JSON: 'application/json',
  TEXT: 'text/plain',
  HTML: 'text/html'
} as const

// API endpoints
export const API_ENDPOINTS = {
  CHAT: '/api/chat',
  MCP_TOOLS: '/api/mcp/tools',
  MCP_EXECUTE: '/api/mcp/execute'
} as const

// Environment variables
export const ENV_VARS = {
  LLM_URL: 'LLM_URL',
  LLM_API_KEY: 'LLM_API_KEY',
  MCP_CONFIG_PATH: 'MCP_CONFIG_PATH',
  NODE_ENV: 'NODE_ENV'
} as const

// Default headers for LLM requests
export const DEFAULT_LLM_HEADERS = {
  'Content-Type': 'application/json',
  'Authorization': ''
} as const

// Note: MCP configuration loading has been moved to server-side utilities
// Client-side code should fetch config through API endpoints