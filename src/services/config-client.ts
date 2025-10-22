// Client-side configuration loader - uses API calls instead of direct file access

import { MCPServerConfig, AppConfig } from '@/types'

/**
 * Client-side configuration loader class
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
   * Load configuration via API call
   */
  public async loadConfig(): Promise<AppConfig> {
    if (this.config) {
      return this.config
    }

    try {
      const response = await fetch('/api/config')
      if (!response.ok) {
        throw new Error(`Failed to load config: ${response.statusText}`)
      }

      const configData = await response.json()
      this.config = configData
      return configData
    } catch (error) {
      console.error('Failed to load configuration:', error)
      throw new Error(`Configuration loading failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
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
 * Convenience function to get the singleton ClientConfigLoader instance
 */
export const getClientConfigLoader = () => ClientConfigLoader.getInstance()

/**
 * Convenience function to load and get configuration
 */
export const loadClientAppConfig = async (): Promise<AppConfig> => {
  const loader = getClientConfigLoader()
  return loader.loadConfig()
}