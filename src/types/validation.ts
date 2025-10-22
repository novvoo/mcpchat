// Validation schemas and utility types for runtime type checking

// Type guards for runtime validation
export function isMessage(obj: any): obj is import('./index').Message {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof obj.id === 'string' &&
    ['user', 'assistant', 'system'].includes(obj.role) &&
    typeof obj.content === 'string' &&
    obj.timestamp instanceof Date
  )
}

export function isToolCall(obj: any): obj is import('./index').ToolCall {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof obj.id === 'string' &&
    typeof obj.name === 'string' &&
    typeof obj.parameters === 'object'
  )
}

export function isChatRequest(obj: any): obj is import('./index').ChatRequest {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof obj.message === 'string'
  )
}

export function isMCPExecuteRequest(obj: any): obj is import('./index').MCPExecuteRequest {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof obj.toolName === 'string' &&
    typeof obj.parameters === 'object'
  )
}

// Validation error types
export interface ValidationError {
  field: string
  message: string
  code: string
}

export interface ValidationResult<T> {
  isValid: boolean
  data?: T
  errors?: ValidationError[]
}

// Validation functions
export function validateMessage(data: any): ValidationResult<import('./index').Message> {
  const errors: ValidationError[] = []

  if (!data.id || typeof data.id !== 'string') {
    errors.push({ field: 'id', message: 'ID is required and must be a string', code: 'INVALID_ID' })
  }

  if (!data.role || !['user', 'assistant', 'system'].includes(data.role)) {
    errors.push({ field: 'role', message: 'Role must be user, assistant, or system', code: 'INVALID_ROLE' })
  }

  if (!data.content || typeof data.content !== 'string') {
    errors.push({ field: 'content', message: 'Content is required and must be a string', code: 'INVALID_CONTENT' })
  }

  if (!data.timestamp || !(data.timestamp instanceof Date)) {
    errors.push({ field: 'timestamp', message: 'Timestamp must be a valid Date', code: 'INVALID_TIMESTAMP' })
  }

  return {
    isValid: errors.length === 0,
    data: errors.length === 0 ? data : undefined,
    errors: errors.length > 0 ? errors : undefined
  }
}

export function validateChatRequest(data: any): ValidationResult<import('./index').ChatRequest> {
  const errors: ValidationError[] = []

  if (!data.message || typeof data.message !== 'string' || data.message.trim().length === 0) {
    errors.push({ field: 'message', message: 'Message is required and cannot be empty', code: 'INVALID_MESSAGE' })
  }

  if (data.conversationId && typeof data.conversationId !== 'string') {
    errors.push({ field: 'conversationId', message: 'Conversation ID must be a string', code: 'INVALID_CONVERSATION_ID' })
  }

  return {
    isValid: errors.length === 0,
    data: errors.length === 0 ? data : undefined,
    errors: errors.length > 0 ? errors : undefined
  }
}

export function validateMCPExecuteRequest(data: any): ValidationResult<import('./index').MCPExecuteRequest> {
  const errors: ValidationError[] = []

  if (!data.toolName || typeof data.toolName !== 'string') {
    errors.push({ field: 'toolName', message: 'Tool name is required and must be a string', code: 'INVALID_TOOL_NAME' })
  }

  if (!data.parameters || typeof data.parameters !== 'object') {
    errors.push({ field: 'parameters', message: 'Parameters must be an object', code: 'INVALID_PARAMETERS' })
  }

  return {
    isValid: errors.length === 0,
    data: errors.length === 0 ? data : undefined,
    errors: errors.length > 0 ? errors : undefined
  }
}