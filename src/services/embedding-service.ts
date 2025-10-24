// Embedding Service - Generate embeddings for text using configurable provider

import { getConfigLoader } from './config'
import { EmbeddingsConfig } from '@/types'

/**
 * Embedding Service - Generate text embeddings
 */
export class EmbeddingService {
  private static instance: EmbeddingService
  private baseUrl: string = ''
  private headers: Record<string, string> = {}
  private embeddingsConfig: EmbeddingsConfig | null = null

  private constructor() { }

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
      this.embeddingsConfig = configLoader.getEmbeddingsConfig()

      // Use LLM endpoint for embeddings (OpenAI compatible)
      this.baseUrl = llmConfig.url.replace('/v1', '') + '/v1'

      // Build headers from config
      this.headers = {
        'Content-Type': 'application/json',
        ...llmConfig.headers
      }

      // Add Authorization header if API key is provided
      if (llmConfig.apiKey) {
        this.headers['Authorization'] = `Bearer ${llmConfig.apiKey}`
      }

      console.log('Embedding service initialized with provider:', this.embeddingsConfig.provider)
    } catch (error) {
      console.error('Failed to initialize embedding service:', error)
    }
  }

  /**
   * Generate embedding for a single text
   */
  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.embeddingsConfig) {
      console.warn('Embeddings config not loaded, using mock embeddings')
      return this.generateMockEmbedding(text)
    }

    // Check if API calls should be skipped (for incompatible endpoints)
    if ((this.embeddingsConfig as any).skipApiCalls) {
      console.log('Skipping API call, using fallback embeddings')
      return this.generateFallbackEmbedding(text)
    }

    return this.generateEmbeddingWithRetry(text, 3)
  }

  /**
   * Generate embedding with retry logic for rate limiting
   */
  private async generateEmbeddingWithRetry(text: string, maxRetries: number): Promise<number[]> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Try the embeddings endpoint
        const response = await fetch(`${this.baseUrl}${this.embeddingsConfig!.endpoint}`, {
          method: 'POST',
          headers: this.headers,
          body: JSON.stringify({
            input: text,
            model: this.embeddingsConfig!.model
          })
        })

        if (response.status === 429) {
          // Rate limited - wait and retry
          const waitTime = Math.pow(2, attempt) * 1000 // Exponential backoff
          console.warn(`Rate limited (attempt ${attempt}/${maxRetries}), waiting ${waitTime}ms`)

          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, waitTime))
            continue
          } else {
            // Final attempt failed, use fallback
            console.warn('Max retries reached for rate limiting, using fallback')
            return this.generateFallbackEmbedding(text)
          }
        }

        if (!response.ok) {
          const errorText = await response.text()
          console.error('Embedding API error response:', errorText)

          // If embeddings endpoint fails, fall back based on config
          if (this.embeddingsConfig!.fallback.enabled) {
            console.warn('Embeddings endpoint not available, using fallback')
            return this.generateFallbackEmbedding(text)
          }
          throw new Error(`Embedding API failed: ${response.status}`)
        }

        let data
        try {
          const responseText = await response.text()
          data = JSON.parse(responseText)
        } catch (parseError) {
          console.error('Failed to parse embedding response as JSON:', parseError)
          if (this.embeddingsConfig!.fallback.enabled) {
            console.warn('Invalid JSON response, using fallback')
            return this.generateFallbackEmbedding(text)
          }
          throw new Error('Invalid JSON response from embedding API')
        }

        if (!data.data || !data.data[0] || !data.data[0].embedding) {
          console.warn('Invalid embedding response format, using fallback')
          return this.generateFallbackEmbedding(text)
        }

        return data.data[0].embedding
      } catch (error) {
        console.error(`Failed to generate embedding (attempt ${attempt}):`, error)
        if (attempt === maxRetries) {
          if (this.embeddingsConfig!.fallback.enabled) {
            console.warn('Using fallback embeddings after all retries failed')
            return this.generateFallbackEmbedding(text)
          }
          throw error
        }
        // Wait before retry
        const waitTime = Math.pow(2, attempt) * 1000
        await new Promise(resolve => setTimeout(resolve, waitTime))
      }
    }

    // This should never be reached, but just in case
    return this.generateFallbackEmbedding(text)
  }

  /**
   * Generate a fallback embedding based on configuration
   */
  private generateFallbackEmbedding(text: string): number[] {
    if (!this.embeddingsConfig) {
      return this.generateMockEmbedding(text)
    }

    switch (this.embeddingsConfig.fallback.type) {
      case 'mock':
      default:
        return this.generateMockEmbedding(text)
    }
  }

  /**
   * Generate a mock embedding based on text hash (for testing/fallback)
   */
  private generateMockEmbedding(text: string): number[] {
    const dimensions = this.embeddingsConfig?.dimensions || 1536
    const hash = this.simpleHash(text)
    const embedding = new Array(dimensions)

    // Fill with pseudo-random values based on text hash
    for (let i = 0; i < embedding.length; i++) {
      embedding[i] = Math.sin(hash + i) * 0.5
    }

    return embedding
  }

  /**
   * Simple hash function for text
   */
  private simpleHash(str: string): number {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return hash
  }

  /**
   * Generate embeddings for multiple texts (batch)
   */
  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    if (!this.embeddingsConfig) {
      console.warn('Embeddings config not loaded, using mock embeddings')
      return texts.map(text => this.generateMockEmbedding(text))
    }

    // Check if API calls should be skipped (for incompatible endpoints)
    if ((this.embeddingsConfig as any).skipApiCalls) {
      console.log('Skipping batch API calls, using fallback embeddings')
      return texts.map(text => this.generateFallbackEmbedding(text))
    }

    // Process in batches based on config
    const batchSize = this.embeddingsConfig.batchSize
    const results: number[][] = []

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize)
      const batchResults = await this.processBatch(batch)
      results.push(...batchResults)
    }

    return results
  }

  /**
   * Process a batch of texts for embeddings
   */
  private async processBatch(texts: string[]): Promise<number[][]> {
    if (!this.embeddingsConfig) {
      return texts.map(text => this.generateMockEmbedding(text))
    }

    // For batch processing, if we hit rate limits, fall back to individual processing
    try {
      const response = await fetch(`${this.baseUrl}${this.embeddingsConfig.endpoint}`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          input: texts,
          model: this.embeddingsConfig.model
        })
      })

      if (response.status === 429) {
        console.warn('Rate limited in batch processing, falling back to individual processing')
        const results: number[][] = []
        for (const text of texts) {
          // Add delay between individual requests to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100))
          results.push(await this.generateEmbedding(text))
        }
        return results
      }

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Batch embedding API error response:', errorText)

        // Fall back based on config
        if (this.embeddingsConfig.fallback.enabled) {
          console.warn('Batch embeddings endpoint not available, using fallback')
          return texts.map(text => this.generateFallbackEmbedding(text))
        }
        throw new Error(`Batch embedding API failed: ${response.status}`)
      }

      let data
      try {
        const responseText = await response.text()
        data = JSON.parse(responseText)
      } catch (parseError) {
        console.error('Failed to parse batch embedding response as JSON:', parseError)
        if (this.embeddingsConfig.fallback.enabled) {
          console.warn('Invalid JSON response, using fallback')
          return texts.map(text => this.generateFallbackEmbedding(text))
        }
        throw new Error('Invalid JSON response from batch embedding API')
      }

      if (!data.data || !Array.isArray(data.data)) {
        console.warn('Invalid batch embedding response format, using fallback')
        return texts.map(text => this.generateFallbackEmbedding(text))
      }

      return data.data.map((item: any) => item.embedding)
    } catch (error) {
      console.error('Failed to generate batch embeddings:', error)
      if (this.embeddingsConfig.fallback.enabled) {
        console.warn('Using fallback embeddings')
        return texts.map(text => this.generateFallbackEmbedding(text))
      }
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
