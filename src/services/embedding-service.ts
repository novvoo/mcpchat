// Embedding Service - Generate embeddings for text using configurable provider

import { getConfigLoader } from './config'
import { EmbeddingsConfig } from '@/types'
import { getDatabaseService, EmbeddingsConfigRecord } from './database'

/**
 * Embedding Service - Generate text embeddings
 */
export class EmbeddingService {
  private static instance: EmbeddingService
  private baseUrl: string = ''
  private headers: Record<string, string> = {}
  private embeddingsConfig: EmbeddingsConfig | null = null
  private skipApiCalls: boolean = false // 跟踪是否应跳过 API 调用
  private hasLoggedFallback: boolean = false // 跟踪是否已记录 fallback 消息
  private isInitialized: boolean = false // 跟踪是否已初始化
  private dbConfig: EmbeddingsConfigRecord | null = null // 数据库配置缓存
  private lastDbCheck: Date | null = null // 最后一次数据库检查时间
  private dbCheckInterval: number = 5 * 60 * 1000 // 5 分钟缓存间隔

  private constructor() { }

  public static getInstance(): EmbeddingService {
    if (!EmbeddingService.instance) {
      EmbeddingService.instance = new EmbeddingService()
    }
    return EmbeddingService.instance
  }

  /**
   * Initialize embedding service (only runs once)
   */
  async initialize(): Promise<void> {
    // Skip if already initialized
    if (this.isInitialized) {
      return
    }

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
      
      // Load configuration from database if available
      try {
        const db = getDatabaseService()
        this.dbConfig = await db.getEmbeddingsConfig()
        
        if (this.dbConfig) {
          console.log('Loaded embeddings config from database, is_available:', this.dbConfig.is_available)
          this.lastDbCheck = new Date()
          
          // If database says it's unavailable, skip API test
          if (!this.dbConfig.is_available) {
            console.log('Database indicates embeddings API is unavailable, using fallback')
            this.skipApiCalls = true
            this.hasLoggedFallback = true
          }
        } else {
          // No database record, test endpoint and create record
          console.log('No database record found, testing embeddings endpoint...')
          await this.testEmbeddingsEndpoint()
        }
      } catch (error) {
        console.warn('Failed to load embeddings config from database:', error)
        // Fall back to testing endpoint
        await this.testEmbeddingsEndpoint()
      }
      
      // Mark as initialized
      this.isInitialized = true
    } catch (error) {
      console.error('Failed to initialize embedding service:', error)
      // Still mark as initialized to avoid repeated failures
      this.isInitialized = true
    }
  }

  /**
   * 测试 embeddings 端点是否可用
   */
  private async testEmbeddingsEndpoint(): Promise<void> {
    try {
      // 发送一个简单的测试请求
      const response = await fetch(`${this.baseUrl}${this.embeddingsConfig!.endpoint}`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          input: 'test',
          model: this.embeddingsConfig!.model
        })
      })

      const responseText = await response.text()
      const trimmedResponse = responseText.trim()
      
      // 检查响应格式 - 必须在解析 JSON 之前检查
      if (trimmedResponse.startsWith('Q:') || !trimmedResponse.startsWith('{')) {
        console.warn('⚠️  LLM endpoint does not support embeddings API')
        console.warn('   Response starts with:', trimmedResponse.substring(0, 50))
        console.warn('   Using fallback embeddings (mock) for all requests')
        console.warn('   This is normal if your LLM service does not provide embeddings')
        
        // 标记跳过 API 调用
        this.skipApiCalls = true
        this.hasLoggedFallback = true
        return
      }

      // 尝试解析 JSON
      try {
        const data = JSON.parse(responseText)
        if (response.ok && data.data && data.data[0] && data.data[0].embedding) {
          console.log('✓ Embeddings endpoint is available and working')
        } else {
          console.warn('⚠️  Embeddings endpoint returned unexpected format, will use fallback')
          this.skipApiCalls = true
          this.hasLoggedFallback = true
        }
      } catch (parseError) {
        console.warn('⚠️  Embeddings endpoint returned invalid JSON, will use fallback')
        this.skipApiCalls = true
        this.hasLoggedFallback = true
      }
    } catch (error) {
      console.warn('⚠️  Could not test embeddings endpoint, will use fallback')
      console.warn('   Error:', error instanceof Error ? error.message : String(error))
      this.skipApiCalls = true
      this.hasLoggedFallback = true
    }
  }

  /**
   * Check if embeddings API should be used based on database status
   */
  private async shouldUseEmbeddingsAPI(): Promise<boolean> {
    try {
      const db = getDatabaseService()
      
      // Check if we need to refresh database config (every 5 minutes)
      const now = new Date()
      const shouldRefresh = !this.lastDbCheck || 
        (now.getTime() - this.lastDbCheck.getTime()) > this.dbCheckInterval

      if (shouldRefresh) {
        this.dbConfig = await db.getEmbeddingsConfig()
        this.lastDbCheck = now

        // If last check was more than 5 minutes ago, trigger a new availability test
        if (this.dbConfig && this.dbConfig.last_checked) {
          const lastCheckTime = new Date(this.dbConfig.last_checked).getTime()
          const timeSinceCheck = now.getTime() - lastCheckTime
          
          if (timeSinceCheck > this.dbCheckInterval) {
            console.log('Embeddings status cache expired, re-testing availability...')
            // Trigger async test without waiting
            db.testEmbeddingsAvailability().catch(err => 
              console.error('Background availability test failed:', err)
            )
          }
        }
      }

      // If database config exists and marks as unavailable, skip API calls
      if (this.dbConfig && !this.dbConfig.is_available) {
        if (!this.hasLoggedFallback) {
          console.log('Embeddings API marked as unavailable in database, using fallback')
          this.hasLoggedFallback = true
        }
        return false
      }

      // If skipApiCalls flag is set (from previous test failures), don't use API
      if (this.skipApiCalls) {
        return false
      }

      return true
    } catch (error) {
      console.warn('Failed to check database status, falling back to config-based decision:', error)
      return !this.skipApiCalls
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

    // Check database status first
    const shouldUseAPI = await this.shouldUseEmbeddingsAPI()
    
    if (!shouldUseAPI) {
      // 只在第一次记录，避免重复日志
      if (!this.hasLoggedFallback) {
        console.log('Using fallback embeddings (API not available)')
        this.hasLoggedFallback = true
      }
      return this.generateFallbackEmbedding(text)
    }

    return this.generateEmbeddingWithRetry(text, 3)
  }

  /**
   * Generate embedding with retry logic for rate limiting
   */
  private async generateEmbeddingWithRetry(text: string, maxRetries: number): Promise<number[]> {
    // Double-check skipApiCalls flag before making any API calls
    if (this.skipApiCalls) {
      return this.generateFallbackEmbedding(text)
    }

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

        const responseText = await response.text()
        const trimmedResponse = responseText.trim()
        
        // 检查响应是否以非 JSON 字符开头（如 "Q:"）- 必须在 JSON.parse 之前
        if (trimmedResponse.startsWith('Q:') || !trimmedResponse.startsWith('{')) {
          if (!this.hasLoggedFallback) {
            console.warn('Response is not JSON format (starts with:', trimmedResponse.substring(0, 50), ')')
            console.warn('This endpoint does not support embeddings API, using fallback')
            this.hasLoggedFallback = true
          }
          
          // 标记此配置应跳过 API 调用
          this.skipApiCalls = true
          
          if (this.embeddingsConfig!.fallback.enabled) {
            return this.generateFallbackEmbedding(text)
          }
          throw new Error('Endpoint does not support embeddings API')
        }
        
        let data
        try {
          data = JSON.parse(responseText)
        } catch (parseError) {
          if (!this.hasLoggedFallback) {
            console.error('Failed to parse embedding response as JSON:', parseError)
            console.warn('Invalid JSON response, using fallback embeddings for all future requests')
            this.hasLoggedFallback = true
          }
          
          // 标记此配置应跳过 API 调用
          this.skipApiCalls = true
          
          if (this.embeddingsConfig!.fallback.enabled) {
            return this.generateFallbackEmbedding(text)
          }
          throw new Error('Invalid JSON response from embedding API')
        }

        if (!data.data || !data.data[0] || !data.data[0].embedding) {
          console.warn('Invalid embedding response format, using fallback')
          // Record failure
          try {
            const db = getDatabaseService()
            await db.recordEmbeddingsUsage(false, 'Invalid response format')
          } catch (dbError) {
            console.warn('Failed to record usage:', dbError)
          }
          return this.generateFallbackEmbedding(text)
        }

        // Record success
        try {
          const db = getDatabaseService()
          await db.recordEmbeddingsUsage(true)
        } catch (dbError) {
          console.warn('Failed to record usage:', dbError)
        }

        return data.data[0].embedding
      } catch (error) {
        console.error(`Failed to generate embedding (attempt ${attempt}):`, error)
        
        // Record failure on last attempt
        if (attempt === maxRetries) {
          try {
            const db = getDatabaseService()
            await db.recordEmbeddingsUsage(false, error instanceof Error ? error.message : 'Unknown error')
          } catch (dbError) {
            console.warn('Failed to record usage:', dbError)
          }
          
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
    if (this.skipApiCalls) {
      // 静默使用 fallback，不重复记录
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

    // Check if API calls should be skipped
    if (this.skipApiCalls) {
      return texts.map(text => this.generateFallbackEmbedding(text))
    }

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
