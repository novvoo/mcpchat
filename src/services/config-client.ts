// Client-side configuration loader for browser environment

import { MCPServerConfig, AppConfig } from '@/types'
import { DEFAULT_CONFIG, DEFAULT_MCP_CONFIG } from '@/types/constants'

/**
 * Client-side configuration loader for browser environment
 */
export class ClientConfigLoader {
  private static instance: ClientConfigLoader
  private config: AppConfig | null = null

  private constructor() {}

  /**
   * Get singleton instance of ClientConfigLoader
   */
  public static getInstance(): ClientConfigLoader {
    if (!ClientConfigLoader.instance) {
      ClientConfigLoader.instance = new ClientConfigLoader()
    }
    return ClientConfigLoader.instance
  }

  /**
   * Load configuration for client-side use
   * In browser environment, we'll use default configuration or fetch from API
   */
  public async loadConfig(): Promise<AppConfig> {
    if (this.config) {
      return this.config
    }

    try {
      // For client-side, we'll use environment variables passed from Next.js
      const llmConfig = this.loadLLMConfig()
      
      // Try to fetch MCP configuration from API or use default
      const mcpConfig = await this.loadMCPConfig()

      this.config = {
        llm: llmConfig,
        mcp: mcpConfig
      }

      return this.config
    } catch (error) {
      console.error('Failed to load client configuration:', error)
      // Fall back to default configuration
      return this.getDefaultConfig()
    }
  }

  /**
   * Load LLM service configuration
   */
  private loadLLMConfig() {
    // In Next.js, environment variables are available via process.env on server
    // For client-side, we'll use default values or fetch from API
    return {
      url: DEFAULT_CONFIG.LLM_URL,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': '' // Will be set when user provides API key
      }
    }
  }

  /**
   * Load MCP server configuration
   */
  private async loadMCPConfig() {
    try {
      // Try to fetch configuration from API endpoint
      const response = await fetch('/api/config/mcp')
      if (response.ok) {
        const data = await response.json()
        return { servers: data.servers }
      }
    } catch (error) {
      console.warn('Failed to fetch MCP config from API, using default:', error)
    }

    // Fall back to default configuration
    return { servers: DEFAULT_MCP_CONFIG }
  }

  /**
   * Get default configuration
   */
  private getDefaultConfig(): AppConfig {
    return {
      llm: {
        url: DEFAULT_CONFIG.LLM_URL,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': ''
        }
      },
      mcp: {
        servers: DEFAULT_MCP_CONFIG
      }
    }
  }

  /**
   * Get current configuration
   */
  public getConfig(): AppConfig {
    if (!this.config) {
      return this.getDefaultConfig()
    }
    return this.config
  }

  /**
   * Update LLM API key
   */
  public updateLLMApiKey(apiKey: string): void {
    if (!this.config) {
      this.config = this.getDefaultConfig()
    }
    
    this.config.llm.headers['Authorization'] = apiKey ? `Bearer ${apiKey}` : ''
  }

  /**
   * Get MCP server configuration by name
   */
  public getMCPServerConfig(serverName: string): MCPServerConfig | undefined {
    const config = this.getConfig()
    return config.mcp.servers[serverName]
  }

  /**
   * Get all MCP server configurations
   */
  public getAllMCPServerConfigs(): Record<string, MCPServerConfig> {
    const config = this.getConfig()
    return config.mcp.servers
  }

  /**
   * Get LLM service configuration
   */
  public getLLMConfig() {
    const config = this.getConfig()
    return config.llm
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

  /**
   * Reload configuration
   */
  public async reloadConfig(): Promise<AppConfig> {
    this.config = null
    return this.loadConfig()
  }
}

/**
 * Convenience function to get the singleton ClientConfigLoader instance
 */
export const getClientConfigLoader = () => ClientConfigLoader.getInstance()

/**
 * Convenience function to load and get client configuration
 */
export const loadClientConfig = async (): Promise<AppConfig> => {
  const loader = getClientConfigLoader()
  return loader.loadConfig()
}