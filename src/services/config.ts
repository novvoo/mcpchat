// Configuration loader and manager for MCP servers

import { MCPServerConfig, AppConfig } from '@/types'
import { DEFAULT_CONFIG, ENV_VARS } from '@/types/constants'
import { getMCPConfig } from '@/lib/mcp-config'

/**
 * Configuration loader class for managing MCP server configurations
 */
export class ConfigLoader {
  private static instance: ConfigLoader
  private config: AppConfig | null = null

  private constructor() {}

  /**
   * Get singleton instance of ConfigLoader
   */
  public static getInstance(): ConfigLoader {
    if (!ConfigLoader.instance) {
      ConfigLoader.instance = new ConfigLoader()
    }
    return ConfigLoader.instance
  }

  /**
   * Load configuration from environment variables and mcp.json file
   */
  public async loadConfig(): Promise<AppConfig> {
    if (this.config) {
      return this.config
    }

    try {
      // Load LLM configuration from environment variables
      const llmConfig = this.loadLLMConfig()
      
      // Load MCP configuration from file
      const mcpConfig = await this.loadMCPConfig()

      this.config = {
        llm: llmConfig,
        mcp: mcpConfig
      }

      return this.config
    } catch (error) {
      console.error('Failed to load configuration:', error)
      throw new Error(`Configuration loading failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Load LLM service configuration from environment variables
   */
  private loadLLMConfig() {
    const llmUrl = process.env[ENV_VARS.LLM_URL] || DEFAULT_CONFIG.LLM_URL
    const llmApiKey = process.env[ENV_VARS.LLM_API_KEY] || ''

    return {
      url: llmUrl,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': llmApiKey ? `Bearer ${llmApiKey}` : ''
      }
    }
  }

  /**
   * Load MCP server configuration from mcp.json file
   */
  private async loadMCPConfig(): Promise<{ servers: Record<string, MCPServerConfig> }> {
    try {
      // Use the dynamic config loader from constants
      const mcpConfig = await getMCPConfig()
      return { servers: mcpConfig }
    } catch (error) {
      console.warn('Failed to load MCP config from file:', error)
      // Fall back to empty configuration
      return { servers: {} }
    }
  }



  /**
   * Validate a single MCP server configuration
   */
  private validateServerConfig(serverName: string, config: any): void {
    if (!config || typeof config !== 'object') {
      throw new Error(`Invalid server configuration for ${serverName}: must be an object`)
    }

    const requiredFields = ['env', 'disabled', 'autoApprove']
    for (const field of requiredFields) {
      if (!(field in config)) {
        throw new Error(`Invalid server configuration for ${serverName}: missing required field '${field}'`)
      }
    }

    if (typeof config.env !== 'object' || config.env === null) {
      throw new Error(`Invalid server configuration for ${serverName}: 'env' must be an object`)
    }

    if (typeof config.disabled !== 'boolean') {
      throw new Error(`Invalid server configuration for ${serverName}: 'disabled' must be a boolean`)
    }

    if (!Array.isArray(config.autoApprove)) {
      throw new Error(`Invalid server configuration for ${serverName}: 'autoApprove' must be an array`)
    }

    // Validate optional transport field
    if (config.transport && !['stdio', 'http'].includes(config.transport)) {
      throw new Error(`Invalid server configuration for ${serverName}: 'transport' must be 'stdio' or 'http'`)
    }

    // Validate required fields based on transport type
    if (config.transport === 'http') {
      if (!config.url) {
        throw new Error(`Invalid server configuration for ${serverName}: 'url' is required for HTTP transport`)
      }
    } else {
      // Default to stdio, require command and args
      if (!config.command) {
        throw new Error(`Invalid server configuration for ${serverName}: 'command' is required for stdio transport`)
      }
      if (!Array.isArray(config.args)) {
        throw new Error(`Invalid server configuration for ${serverName}: 'args' must be an array for stdio transport`)
      }
    }
  }

  /**
   * Get current configuration (must call loadConfig first)
   */
  public getConfig(): AppConfig {
    if (!this.config) {
      throw new Error('Configuration not loaded. Call loadConfig() first.')
    }
    return this.config
  }

  /**
   * Get MCP server configuration by name
   */
  public getMCPServerConfig(serverName: string): MCPServerConfig | undefined {
    if (!this.config) {
      throw new Error('Configuration not loaded. Call loadConfig() first.')
    }
    return this.config.mcp.servers[serverName]
  }

  /**
   * Get all MCP server configurations
   */
  public getAllMCPServerConfigs(): Record<string, MCPServerConfig> {
    if (!this.config) {
      throw new Error('Configuration not loaded. Call loadConfig() first.')
    }
    return this.config.mcp.servers
  }

  /**
   * Get LLM service configuration
   */
  public getLLMConfig() {
    if (!this.config) {
      throw new Error('Configuration not loaded. Call loadConfig() first.')
    }
    return this.config.llm
  }

  /**
   * Reload configuration from sources
   */
  public async reloadConfig(): Promise<AppConfig> {
    this.config = null
    return this.loadConfig()
  }

  /**
   * Check if a server is enabled
   */
  public isServerEnabled(serverName: string): boolean {
    const serverConfig = this.getMCPServerConfig(serverName)
    return serverConfig ? !serverConfig.disabled : false
  }

  /**
   * Get list of enabled server names
   */
  public getEnabledServers(): string[] {
    const allConfigs = this.getAllMCPServerConfigs()
    return Object.keys(allConfigs).filter(name => !allConfigs[name].disabled)
  }

  /**
   * Check if a tool is auto-approved for a server
   */
  public isToolAutoApproved(serverName: string, toolName: string): boolean {
    const serverConfig = this.getMCPServerConfig(serverName)
    return serverConfig ? serverConfig.autoApprove.includes(toolName) : false
  }
}

/**
 * Convenience function to get the singleton ConfigLoader instance
 */
export const getConfigLoader = () => ConfigLoader.getInstance()

/**
 * Convenience function to load and get configuration
 */
export const loadAppConfig = async (): Promise<AppConfig> => {
  const loader = getConfigLoader()
  return loader.loadConfig()
}