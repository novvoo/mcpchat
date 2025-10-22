import { promises as fs } from 'fs'
import path from 'path'
import { DEFAULT_CONFIG } from '@/types/constants'
import type { MCPServerConfig } from '@/types'

// Server-side MCP configuration loader
let mcpConfigCache: Record<string, MCPServerConfig> | null = null

export const getMCPConfig = async (): Promise<Record<string, MCPServerConfig>> => {
  if (mcpConfigCache) {
    return mcpConfigCache
  }

  try {
    const configPath = path.resolve(process.cwd(), DEFAULT_CONFIG.MCP_CONFIG_PATH)
    const configContent = await fs.readFile(configPath, 'utf-8')
    const parsedConfig = JSON.parse(configContent)
    
    // Handle both formats: direct server configs or wrapped in mcpServers
    let config: Record<string, MCPServerConfig>
    if (parsedConfig.mcpServers) {
      config = parsedConfig.mcpServers
    } else {
      config = parsedConfig
    }
    
    // Normalize server configurations - add name field if missing
    for (const [serverName, serverConfig] of Object.entries(config)) {
      if (!serverConfig.name) {
        serverConfig.name = serverName
      }
    }
    
    mcpConfigCache = config
    return config
  } catch (error) {
    console.warn('Failed to load MCP config from file, using empty config:', error)
    mcpConfigCache = {}
    return {}
  }
}

// Clear cache function for testing or config reloading
export const clearMCPConfigCache = () => {
  mcpConfigCache = null
}