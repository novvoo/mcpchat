// Embedding Service - DEPRECATED: 已弃用，意图识别现在使用LangChain
// 保留此文件仅为向后兼容，新功能请使用LangChain文本处理器

// @deprecated 使用 getLangChainTextProcessor 替代

export interface EmbeddingConfig {
  provider: string
  model: string
  endpoint: string
  apiKey?: string
}

/**
 * @deprecated Embedding Service - 已弃用，意图识别现在使用LangChain
 * 
 * 此服务已被弃用，因为：
 * 1. 意图识别现在完全基于LangChain进行
 * 2. LangChain提供更准确的语义分析和实体识别
 * 3. 不再需要向量相似度计算进行工具匹配
 * 
 * 新的意图识别流程：
 * - 使用 getLangChainTextProcessor() 进行文本分析
 * - 使用 getEnhancedSmartRouter() 进行意图识别
 * - 基于规则和语义分析而非向量相似度
 */
export class EmbeddingService {
  private static instance: EmbeddingService
  private initialized = false
  private config: EmbeddingConfig | null = null
  private skipApiCalls = false

  private constructor() {}

  public static getInstance(): EmbeddingService {
    if (!EmbeddingService.instance) {
      EmbeddingService.instance = new EmbeddingService()
    }
    return EmbeddingService.instance
  }

  /**
   * 初始化服务
   */
  async initialize(): Promise<void> {
    if (this.initialized) return

    try {
      // 尝试从环境变量或配置加载embedding配置
      await this.loadConfig()
      this.initialized = true
      console.log('Embedding service initialized (for tool matching only)')
    } catch (error) {
      console.warn('Embedding service initialization failed, will use mock embeddings:', error)
      this.skipApiCalls = true
      this.initialized = true
    }
  }

  /**
   * 加载配置
   */
  private async loadConfig(): Promise<void> {
    // 尝试从环境变量加载
    const provider = process.env.EMBEDDING_PROVIDER || 'openai'
    const model = process.env.EMBEDDING_MODEL || 'text-embedding-3-small'
    const endpoint = process.env.EMBEDDING_ENDPOINT || 'https://api.openai.com/v1/embeddings'
    const apiKey = process.env.OPENAI_API_KEY

    if (!apiKey) {
      console.warn('No embedding API key found, will use mock embeddings')
      this.skipApiCalls = true
      return
    }

    this.config = {
      provider,
      model,
      endpoint,
      apiKey
    }

    console.log(`Embedding config loaded: ${provider}/${model}`)
  }

  /**
   * 为工具描述生成embedding
   */
  async generateToolEmbedding(toolName: string, description: string): Promise<number[]> {
    const text = `${toolName}: ${description}`
    return this.generateEmbedding(text)
  }

  /**
   * 为问题描述生成embedding
   */
  async generateQueryEmbedding(query: string): Promise<number[]> {
    return this.generateEmbedding(query)
  }

  /**
   * 生成embedding
   */
  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.initialized) {
      await this.initialize()
    }

    // 如果跳过API调用，返回模拟向量
    if (this.skipApiCalls || !this.config) {
      return this.generateMockEmbedding(text)
    }

    try {
      const response = await fetch(this.config.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`
        },
        body: JSON.stringify({
          input: text,
          model: this.config.model
        })
      })

      if (!response.ok) {
        throw new Error(`Embedding API error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      
      if (!data.data || !data.data[0] || !data.data[0].embedding) {
        throw new Error('Invalid embedding response format')
      }

      return data.data[0].embedding
    } catch (error) {
      console.warn('Embedding generation failed, using mock embedding:', error)
      return this.generateMockEmbedding(text)
    }
  }

  /**
   * 生成模拟embedding（用于测试或API不可用时）
   */
  private generateMockEmbedding(text: string): number[] {
    // 生成基于文本内容的确定性向量
    const hash = this.simpleHash(text)
    const dimensions = 1536 // OpenAI text-embedding-3-small 的维度
    const embedding = new Array(dimensions)
    
    for (let i = 0; i < dimensions; i++) {
      // 使用文本哈希和索引生成确定性的浮点数
      const seed = hash + i
      embedding[i] = (Math.sin(seed) + Math.cos(seed * 0.7) + Math.sin(seed * 1.3)) / 3
    }
    
    // 归一化向量
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0))
    return embedding.map(val => val / magnitude)
  }

  /**
   * 简单哈希函数
   */
  private simpleHash(str: string): number {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // 转换为32位整数
    }
    return Math.abs(hash)
  }

  /**
   * 检查服务是否可用
   */
  isAvailable(): boolean {
    return this.initialized && (this.config !== null || this.skipApiCalls)
  }

  /**
   * 获取配置信息
   */
  getConfig(): EmbeddingConfig | null {
    return this.config
  }
}

/**
 * 便捷函数
 */
export const getEmbeddingService = () => EmbeddingService.getInstance()