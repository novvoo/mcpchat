// Embeddings configuration loader

import { promises as fs } from 'fs'
import path from 'path'

export interface EmbeddingsConfig {
  provider: string
  model: string
  dimensions: number
  endpoint: string
  batchSize: number
  fallback: {
    enabled: boolean
    type: string
  }
}

/**
 * Load embeddings configuration from config/embeddings.json
 */
export async function getEmbeddingsConfig(): Promise<EmbeddingsConfig> {
  try {
    const configPath = path.join(process.cwd(), 'config', 'embeddings.json')
    const configContent = await fs.readFile(configPath, 'utf-8')
    const config = JSON.parse(configContent) as EmbeddingsConfig
    
    // Validate required fields
    if (!config.provider || !config.model || !config.dimensions) {
      throw new Error('Invalid embeddings config: missing required fields')
    }
    
    return config
  } catch (error) {
    // Return default configuration (no error logging needed for missing file)
    return {
      provider: 'openai',
      model: 'text-embedding-ada-002',
      dimensions: 1536,
      endpoint: '/embeddings',
      batchSize: 100,
      fallback: {
        enabled: true,
        type: 'mock'
      }
    }
  }
}