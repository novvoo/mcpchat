// Configuration validation utilities

import { MCPServerConfig, AppConfig } from '@/types'
import { ValidationResult, ValidationError } from '@/types/validation'

/**
 * Validate MCP server configuration
 */
export function validateMCPServerConfig(
  serverName: string, 
  config: any
): ValidationResult<MCPServerConfig> {
  const errors: ValidationError[] = []

  // Check if config is an object
  if (!config || typeof config !== 'object') {
    errors.push({
      field: 'config',
      message: 'Server configuration must be an object',
      code: 'INVALID_CONFIG_TYPE'
    })
    return { isValid: false, errors }
  }

  // Validate required fields
  const requiredFields = [
    { name: 'command', type: 'string' },
    { name: 'args', type: 'array' },
    { name: 'env', type: 'object' },
    { name: 'disabled', type: 'boolean' },
    { name: 'autoApprove', type: 'array' }
  ]

  for (const field of requiredFields) {
    if (!(field.name in config)) {
      errors.push({
        field: field.name,
        message: `Missing required field '${field.name}'`,
        code: 'MISSING_REQUIRED_FIELD'
      })
      continue
    }

    const value = config[field.name]
    
    switch (field.type) {
      case 'string':
        if (typeof value !== 'string') {
          errors.push({
            field: field.name,
            message: `Field '${field.name}' must be a string`,
            code: 'INVALID_FIELD_TYPE'
          })
        } else if (field.name === 'command' && value.trim().length === 0) {
          errors.push({
            field: field.name,
            message: 'Command cannot be empty',
            code: 'EMPTY_COMMAND'
          })
        }
        break
        
      case 'array':
        if (!Array.isArray(value)) {
          errors.push({
            field: field.name,
            message: `Field '${field.name}' must be an array`,
            code: 'INVALID_FIELD_TYPE'
          })
        } else if (field.name === 'args') {
          // Validate args array contains only strings
          for (let i = 0; i < value.length; i++) {
            if (typeof value[i] !== 'string') {
              errors.push({
                field: `${field.name}[${i}]`,
                message: `Argument at index ${i} must be a string`,
                code: 'INVALID_ARGUMENT_TYPE'
              })
            }
          }
        } else if (field.name === 'autoApprove') {
          // Validate autoApprove array contains only strings
          for (let i = 0; i < value.length; i++) {
            if (typeof value[i] !== 'string') {
              errors.push({
                field: `${field.name}[${i}]`,
                message: `Auto-approve item at index ${i} must be a string`,
                code: 'INVALID_AUTO_APPROVE_TYPE'
              })
            }
          }
        }
        break
        
      case 'object':
        if (typeof value !== 'object' || value === null || Array.isArray(value)) {
          errors.push({
            field: field.name,
            message: `Field '${field.name}' must be an object`,
            code: 'INVALID_FIELD_TYPE'
          })
        } else if (field.name === 'env') {
          // Validate env object contains only string values
          for (const [key, val] of Object.entries(value)) {
            if (typeof val !== 'string') {
              errors.push({
                field: `${field.name}.${key}`,
                message: `Environment variable '${key}' must be a string`,
                code: 'INVALID_ENV_VAR_TYPE'
              })
            }
          }
        }
        break
        
      case 'boolean':
        if (typeof value !== 'boolean') {
          errors.push({
            field: field.name,
            message: `Field '${field.name}' must be a boolean`,
            code: 'INVALID_FIELD_TYPE'
          })
        }
        break
    }
  }

  // Add server name to config
  const validatedConfig: MCPServerConfig = {
    name: serverName,
    command: config.command,
    args: config.args,
    env: config.env,
    disabled: config.disabled,
    autoApprove: config.autoApprove
  }

  return {
    isValid: errors.length === 0,
    data: errors.length === 0 ? validatedConfig : undefined,
    errors: errors.length > 0 ? errors : undefined
  }
}

/**
 * Validate complete MCP configuration object
 */
export function validateMCPConfig(
  config: any
): ValidationResult<Record<string, MCPServerConfig>> {
  const errors: ValidationError[] = []

  if (!config || typeof config !== 'object') {
    errors.push({
      field: 'config',
      message: 'MCP configuration must be an object',
      code: 'INVALID_CONFIG_TYPE'
    })
    return { isValid: false, errors }
  }

  if (!config.mcpServers || typeof config.mcpServers !== 'object') {
    errors.push({
      field: 'mcpServers',
      message: 'Missing or invalid mcpServers field',
      code: 'MISSING_MCP_SERVERS'
    })
    return { isValid: false, errors }
  }

  const validatedServers: Record<string, MCPServerConfig> = {}

  // Validate each server configuration
  for (const [serverName, serverConfig] of Object.entries(config.mcpServers)) {
    const validation = validateMCPServerConfig(serverName, serverConfig)
    
    if (!validation.isValid) {
      // Add server name prefix to error fields
      const serverErrors = validation.errors?.map((error: ValidationError) => ({
        ...error,
        field: `mcpServers.${serverName}.${error.field}`
      })) || []
      errors.push(...serverErrors)
    } else if (validation.data) {
      validatedServers[serverName] = validation.data
    }
  }

  return {
    isValid: errors.length === 0,
    data: errors.length === 0 ? validatedServers : undefined,
    errors: errors.length > 0 ? errors : undefined
  }
}

/**
 * Validate complete application configuration
 */
export function validateAppConfig(config: any): ValidationResult<AppConfig> {
  const errors: ValidationError[] = []

  if (!config || typeof config !== 'object') {
    errors.push({
      field: 'config',
      message: 'Application configuration must be an object',
      code: 'INVALID_CONFIG_TYPE'
    })
    return { isValid: false, errors }
  }

  // Validate LLM configuration
  if (!config.llm || typeof config.llm !== 'object') {
    errors.push({
      field: 'llm',
      message: 'Missing or invalid LLM configuration',
      code: 'MISSING_LLM_CONFIG'
    })
  } else {
    if (!config.llm.url || typeof config.llm.url !== 'string') {
      errors.push({
        field: 'llm.url',
        message: 'LLM URL is required and must be a string',
        code: 'INVALID_LLM_URL'
      })
    }

    if (!config.llm.headers || typeof config.llm.headers !== 'object') {
      errors.push({
        field: 'llm.headers',
        message: 'LLM headers must be an object',
        code: 'INVALID_LLM_HEADERS'
      })
    }
  }

  // Validate MCP configuration
  if (!config.mcp || typeof config.mcp !== 'object') {
    errors.push({
      field: 'mcp',
      message: 'Missing or invalid MCP configuration',
      code: 'MISSING_MCP_CONFIG'
    })
  } else {
    if (!config.mcp.servers || typeof config.mcp.servers !== 'object') {
      errors.push({
        field: 'mcp.servers',
        message: 'MCP servers configuration is required',
        code: 'MISSING_MCP_SERVERS'
      })
    } else {
      // Validate each server
      for (const [serverName, serverConfig] of Object.entries(config.mcp.servers)) {
        const validation = validateMCPServerConfig(serverName, serverConfig)
        
        if (!validation.isValid) {
          const serverErrors = validation.errors?.map((error: ValidationError) => ({
            ...error,
            field: `mcp.servers.${serverName}.${error.field}`
          })) || []
          errors.push(...serverErrors)
        }
      }
    }
  }

  return {
    isValid: errors.length === 0,
    data: errors.length === 0 ? config as AppConfig : undefined,
    errors: errors.length > 0 ? errors : undefined
  }
}

/**
 * Format validation errors for display
 */
export function formatValidationErrors(errors: ValidationError[]): string {
  return errors.map(error => `${error.field}: ${error.message}`).join('\n')
}

/**
 * Check if configuration has any enabled servers
 */
export function hasEnabledServers(config: Record<string, MCPServerConfig>): boolean {
  return Object.values(config).some(server => !server.disabled)
}

/**
 * Get list of validation error codes from errors array
 */
export function getErrorCodes(errors: ValidationError[]): string[] {
  return errors.map(error => error.code)
}