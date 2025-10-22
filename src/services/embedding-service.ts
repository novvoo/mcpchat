// Embedding Service - Generate embeddings for text using OpenAI API

import { getConfigLoader } from './config'

/**
 * Embedding Service - Generate text embeddings
 */
export class EmbeddingService {
  private static instance: EmbeddingService
  private baseUrl: string = ''
  private headers: Record<string, string> = {}
  private model: string = 'text-embedding-3-small'

  private constructor() {}

  public static getInstance(): EmbeddingService {
    if (!EmbeddingService.instance) {
      EmbeddingService.instance = new EmbeddingService()
    }
    return EmbeddingService.instance
  }

  /**
   * Initialize embedding service
   */
  async initialize(): Promise<void> {
    try {
      const configLoader = getConfigLoader()
      await configLoader.loadConfig()
      
      const llmConfig = configLoader.getLLMConfig()
      
      // Use LLM endpoint for embeddings (OpenAI compatible)
      this.baseUrl = llmConfig.url.replace('/v1', '') + '/v1'
      this.headers = { ...llmConfig.headers }
      
      console.log(`Embedding service initialized with model: ${this.model}`)
    } catch (error) {
      console.error('Failed to initialize embedding service:', error)
    }
  }

  /**
   * Generate embedding for a single text
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await fetch(`${this.baseUrl}/embeddings`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          model: this.model,
          input: text
        })
      })

      if (!response.ok) {
        throw new Error(`Embedding API error: ${response.statusText}`)
      }

      const data = await response.json()
      
      if (!data.data || !data.data[0] || !data.data[0].embedding) {
        throw new Error('Invalid embedding response format')
      }

      return data.data[0].embedding
    } catch (error) {
      console.error('Failed to generate embedding:', error)
      throw error
    }
  }

  /**
   * Generate embeddings for multiple texts (batch)
   */
  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    try {
      const response = await fetch(`${this.baseUrl}/embeddings`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          model: this.model,
          input: texts
        })
      })

      if (!response.ok) {
        throw new Error(`Embedding API error: ${response.statusText}`)
      }

      const data = await response.json()
      
      if (!data.data || !Array.isArray(data.data)) {
        throw new Error('Invalid embedding response format')
      }

      return data.data.map((item: any) => item.embedding)
    } catch (error) {
      console.error('Failed to generate embeddings:', error)
      throw error
    }
  }

  /**
   * Generate embedding for tool (combines name and description)
   */
  async generateToolEmbedding(toolName: string, description: string): Promise<number[]> {
    const text = `${toolName}: ${description}`
    return this.generateEmbedding(text)
  }
}

/**
 * Convenience function
 */
export const getEmbeddingService = () => EmbeddingService.getInstance()
