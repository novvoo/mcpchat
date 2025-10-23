import { promises as fs } from 'fs'
import path from 'path'
import { DEFAULT_CONFIG } from '@/types/constants'
import type { LLMConfig } from '@/types'

// Server-side LLM configuration loader
let llmConfigCache: LLMConfig | null = null

export const getLLMConfig = async (): Promise<LLMConfig> => {
  if (llmConfigCache) {
    return llmConfigCache
  }

  try {
    const configPath = path.resolve(process.cwd(), 'config/llm.json')
    const configContent = await fs.readFile(configPath, 'utf-8')
    const parsedConfig = JSON.parse(configContent)
    
    // Validate and normalize configuration
    const config: LLMConfig = {
      url: parsedConfig.url || DEFAULT_CONFIG.LLM_URL,
      apiKey: parsedConfig.apiKey || '',
      timeout: parsedConfig.timeout || DEFAULT_CONFIG.REQUEST_TIMEOUT,
      maxTokens: parsedConfig.maxTokens || 2000,
      temperature: parsedConfig.temperature || 0.7,
      headers: {
        'Content-Type': 'application/json',
        ...parsedConfig.headers
      }
    }
    
    // Add Authorization header if API key is provided
    if (config.apiKey) {
      config.headers!['Authorization'] = `Bearer ${config.apiKey}`
    }
    
    llmConfigCache = config
    return config
  } catch (error) {
    console.warn('Failed to load LLM config from file, using default config:', error)
    
    // Return default configuration
    const defaultConfig: LLMConfig = {
      url: DEFAULT_CONFIG.LLM_URL,
      apiKey: '',
      timeout: DEFAULT_CONFIG.REQUEST_TIMEOUT,
      maxTokens: 2000,
      temperature: 0.7,
      headers: {
        'Content-Type': 'application/json'
      }
    }
    
    llmConfigCache = defaultConfig
    return defaultConfig
  }
}

// Clear cache function for testing or config reloading
export const clearLLMConfigCache = () => {
  llmConfigCache = null
}