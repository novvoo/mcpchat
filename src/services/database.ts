// Database Service - PostgreSQL connection management

import { Pool } from 'pg'
import type { PoolClient } from 'pg'
import fs from 'fs'
import path from 'path'

export interface DatabaseConfig {
    host: string
    port: number
    database: string
    user: string
    password: string
    ssl?: boolean
    pool?: {
        min: number
        max: number
    }
}

export interface PgVectorConfig {
    enabled: boolean
    similarityThreshold: number
    maxResults: number
}

export interface EmbeddingsConfigRecord {
    id: number
    provider: string
    model: string
    dimensions: number
    endpoint: string
    api_key_configured: boolean
    base_url: string | null
    batch_size: number
    is_available: boolean
    last_checked: Date | null
    last_success: Date | null
    last_failure: Date | null
    failure_count: number
    success_count: number
    fallback_enabled: boolean
    fallback_type: string
    metadata: any
    created_at: Date
    updated_at: Date
}

/**
 * Database Service - Manages PostgreSQL connections
 */
export class DatabaseService {
    private static instance: DatabaseService
    private pool: Pool | null = null
    private config: DatabaseConfig | null = null
    private pgvectorConfig: PgVectorConfig | null = null
    private initialized: boolean = false
    private initializing: Promise<void> | null = null

    private constructor() { }

    public static getInstance(): DatabaseService {
        if (!DatabaseService.instance) {
            DatabaseService.instance = new DatabaseService()
        }
        return DatabaseService.instance
    }

    /**
     * Initialize database connection
     */
    async initialize(): Promise<void> {
        // 如果已经初始化，直接返回
        if (this.initialized) {
            return
        }

        // 如果正在初始化，等待完成
        if (this.initializing) {
            return this.initializing
        }

        // 开始初始化
        this.initializing = this._doInitialize()
        
        try {
            await this.initializing
            this.initialized = true
        } finally {
            this.initializing = null
        }
    }

    /**
     * Internal initialization logic
     */
    private async _doInitialize(): Promise<void> {
        try {
            // Load configuration
            const configPath = path.join(process.cwd(), 'config', 'database.json')

            if (!fs.existsSync(configPath)) {
                console.warn('Database config not found, vector search will be disabled')
                return
            }

            const configData = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
            this.config = configData.postgresql
            this.pgvectorConfig = configData.pgvector

            if (!this.pgvectorConfig?.enabled) {
                console.log('pgvector is disabled in config')
                return
            }

            if (!this.config) {
                console.warn('Database config is missing')
                return
            }

            // Ensure database exists
            await this.ensureDatabaseExists()

            // Create connection pool
            this.pool = new Pool({
                host: this.config.host,
                port: this.config.port,
                database: this.config.database,
                user: this.config.user,
                password: this.config.password,
                ssl: this.config.ssl ? { rejectUnauthorized: false } : false,
                min: this.config.pool?.min || 2,
                max: this.config.pool?.max || 10
            })

            // Test connection first
            const client = await this.pool.connect()
            await client.query('SELECT NOW()')
            client.release()

            console.log('Database connection established successfully')

            // Initialize schema (this will create the pgvector extension)
            await this.initializeSchema()

            // Register pgvector types after extension is created (only if enabled)
            if (this.pgvectorConfig?.enabled) {
                try {
                    // 使用正确的方式注册 pgvector 类型
                    const client = await this.pool.connect()
                    try {
                        await client.query('SELECT 1') // 确保连接正常
                        // pgvector 类型会在使用时自动处理，不需要手动注册
                        console.log('pgvector extension is ready')
                    } finally {
                        client.release()
                    }
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error)
                    console.warn('Failed to verify pgvector setup:', errorMessage)
                    console.warn('Vector search will be disabled')
                    this.pgvectorConfig = {
                        enabled: false,
                        similarityThreshold: this.pgvectorConfig?.similarityThreshold ?? 0.7,
                        maxResults: this.pgvectorConfig?.maxResults ?? 5
                    }
                }
            }
        } catch (error) {
            console.error('Failed to initialize database:', error)
            this.pool = null
            // Don't throw - allow system to work without vector search
        }
    }

    /**
     * Ensure database exists, create if not
     */
    private async ensureDatabaseExists(): Promise<void> {
        if (!this.config) return

        const targetDatabase = this.config.database
        let tempPool: Pool | null = null

        try {
            // Connect to default 'postgres' database to check/create target database
            tempPool = new Pool({
                host: this.config.host,
                port: this.config.port,
                database: 'postgres', // Connect to default database
                user: this.config.user,
                password: this.config.password,
                ssl: this.config.ssl ? { rejectUnauthorized: false } : false
            })

            const client = await tempPool.connect()

            try {
                // Check if database exists
                const result = await client.query(
                    'SELECT 1 FROM pg_database WHERE datname = $1',
                    [targetDatabase]
                )

                if (result.rows.length === 0) {
                    // Database doesn't exist, create it
                    console.log(`Database '${targetDatabase}' not found, creating...`)
                    await client.query(`CREATE DATABASE ${targetDatabase}`)
                    console.log(`Database '${targetDatabase}' created successfully`)
                } else {
                    console.log(`Database '${targetDatabase}' already exists`)
                }
            } finally {
                client.release()
            }
        } catch (error) {
            console.error('Error ensuring database exists:', error)
            throw error
        } finally {
            if (tempPool) {
                await tempPool.end()
            }
        }
    }

    /**
     * Initialize database schema for vector search
     */
    private async initializeSchema(): Promise<void> {
        if (!this.pool) return

        const client = await this.pool.connect()
        try {
            // Check if pgvector extension is available
            const extensionCheck = await client.query(`
                SELECT 1 FROM pg_available_extensions WHERE name = 'vector'
            `)

            if (extensionCheck.rows.length === 0) {
                console.warn('pgvector extension is not available in this PostgreSQL installation')
                console.warn('Vector search will be disabled. To enable it, install pgvector extension.')
                return
            }

            // Enable pgvector extension
            await client.query('CREATE EXTENSION IF NOT EXISTS vector')
            console.log('pgvector extension enabled successfully')

            // Create tools table with vector embeddings
            await client.query(`
        CREATE TABLE IF NOT EXISTS mcp_tools (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) UNIQUE NOT NULL,
          description TEXT NOT NULL,
          input_schema JSONB,
          server_name VARCHAR(255),
          embedding vector(1536),
          keywords TEXT[] DEFAULT '{}',
          parameter_mappings JSONB,
          valid_parameters TEXT[] DEFAULT '{}',
          examples JSONB,
          category VARCHAR(100),
          metadata JSONB,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `)

            // Note: keyword_embeddings table creation removed as embeddings are no longer used

            // Create tool_keyword_mappings table
            await client.query(`
        CREATE TABLE IF NOT EXISTS tool_keyword_mappings (
          id SERIAL PRIMARY KEY,
          tool_name VARCHAR(255) NOT NULL,
          keyword VARCHAR(255) NOT NULL,
          confidence FLOAT DEFAULT 1.0,
          source VARCHAR(50) DEFAULT 'static',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(tool_name, keyword)
        )
      `)

            // Create tool_parameter_mappings table
            await client.query(`
        CREATE TABLE IF NOT EXISTS tool_parameter_mappings (
          id SERIAL PRIMARY KEY,
          tool_name VARCHAR(255) NOT NULL,
          user_input VARCHAR(255) NOT NULL,
          mcp_parameter VARCHAR(255) NOT NULL,
          confidence FLOAT DEFAULT 1.0,
          usage_count INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(tool_name, user_input)
        )
      `)

            // Create tool_usage_stats table
            await client.query(`
        CREATE TABLE IF NOT EXISTS tool_usage_stats (
          id SERIAL PRIMARY KEY,
          tool_name VARCHAR(255) NOT NULL,
          user_input TEXT,
          parameters JSONB,
          success BOOLEAN DEFAULT true,
          execution_time INTEGER,
          error_message TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `)

            // Note: tool_keyword_embeddings table creation removed as embeddings are no longer used

            // Create tool_name_patterns table
            await client.query(`
        CREATE TABLE IF NOT EXISTS tool_name_patterns (
          id SERIAL PRIMARY KEY,
          pattern VARCHAR(255) NOT NULL UNIQUE,
          keywords TEXT[] DEFAULT '{}',
          confidence FLOAT DEFAULT 1.0,
          usage_count INTEGER DEFAULT 0,
          examples TEXT[] DEFAULT '{}',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `)

            // Create keyword_generation_log table
            await client.query(`
        CREATE TABLE IF NOT EXISTS keyword_generation_log (
          id SERIAL PRIMARY KEY,
          tool_name VARCHAR(255) NOT NULL,
          generated_keywords TEXT[] DEFAULT '{}',
          generation_method VARCHAR(100),
          confidence FLOAT DEFAULT 0.5,
          success BOOLEAN DEFAULT true,
          error_message TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `)

            // Create user_input_patterns table
            await client.query(`
        CREATE TABLE IF NOT EXISTS user_input_patterns (
          id SERIAL PRIMARY KEY,
          input_pattern TEXT NOT NULL UNIQUE,
          matched_tools TEXT[] DEFAULT '{}',
          total_attempts INTEGER DEFAULT 0,
          successful_attempts INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `)

            // Create tool_metadata table (alias/view for mcp_tools for compatibility)
            await client.query(`
        CREATE TABLE IF NOT EXISTS tool_metadata (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) UNIQUE NOT NULL,
          description TEXT NOT NULL,
          input_schema JSONB,
          server_name VARCHAR(255),
          keywords TEXT[] DEFAULT '{}',
          parameter_mappings JSONB,
          valid_parameters TEXT[] DEFAULT '{}',
          examples JSONB,
          category VARCHAR(100),
          metadata JSONB,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `)

            // Create indexes for tool vector similarity search (for tool matching)
            await client.query(`
        CREATE INDEX IF NOT EXISTS mcp_tools_embedding_idx 
        ON mcp_tools 
        USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 100)
      `)

            // Create other indexes
            await client.query(`
        CREATE INDEX IF NOT EXISTS mcp_tools_name_idx 
        ON mcp_tools (name)
      `)

            await client.query(`
        CREATE INDEX IF NOT EXISTS tool_keyword_mappings_tool_idx 
        ON tool_keyword_mappings (tool_name)
      `)

            await client.query(`
        CREATE INDEX IF NOT EXISTS tool_keyword_mappings_keyword_idx 
        ON tool_keyword_mappings (keyword)
      `)

            await client.query(`
        CREATE INDEX IF NOT EXISTS tool_parameter_mappings_tool_idx 
        ON tool_parameter_mappings (tool_name)
      `)

            await client.query(`
        CREATE INDEX IF NOT EXISTS tool_usage_stats_tool_idx 
        ON tool_usage_stats (tool_name)
      `)

            await client.query(`
        CREATE INDEX IF NOT EXISTS keyword_generation_log_tool_idx 
        ON keyword_generation_log (tool_name)
      `)

            await client.query(`
        CREATE INDEX IF NOT EXISTS user_input_patterns_pattern_idx 
        ON user_input_patterns (input_pattern)
      `)

            await client.query(`
        CREATE INDEX IF NOT EXISTS tool_metadata_name_idx 
        ON tool_metadata (name)
      `)

            await client.query(`
        CREATE INDEX IF NOT EXISTS tool_metadata_category_idx 
        ON tool_metadata (category)
      `)

            // 注意：Embeddings相关功能已弃用，现在使用LangChain进行意图识别
            // 保留embeddings_config表结构以避免破坏现有数据，但不再主动使用
            await this.initializeEmbeddingsConfigTable()
            
            console.log('⚠️  Embeddings功能已弃用，现在使用LangChain进行意图识别')
            console.log('如需配置LangChain，请设置环境变量 OPENAI_API_KEY 和 OPENAI_BASE_URL')

            console.log('Database schema initialized successfully')
        } catch (error) {
            console.error('Failed to initialize schema:', error)
            // If it's a pgvector-related error, disable vector search gracefully
            const errorMessage = error instanceof Error ? error.message : String(error)
            if (errorMessage.includes('vector') || errorMessage.includes('extension')) {
                console.warn('pgvector extension could not be enabled. Vector search will be disabled.')
                this.pgvectorConfig = {
                    enabled: false,
                    similarityThreshold: this.pgvectorConfig?.similarityThreshold ?? 0.7,
                    maxResults: this.pgvectorConfig?.maxResults ?? 5
                }
                return
            }
            throw error
        } finally {
            client.release()
        }
    }

    /**
     * Get database client
     */
    async getClient(): Promise<PoolClient | null> {
        if (!this.pool) return null
        return this.pool.connect()
    }

    /**
     * Execute query
     */
    async query(text: string, params?: any[]): Promise<any> {
        if (!this.pool) {
            throw new Error('Database not initialized')
        }
        return this.pool.query(text, params)
    }

    /**
     * Check if database is initialized
     */
    isInitialized(): boolean {
        return this.initialized
    }

    /**
     * Check if pgvector is available
     */
    isVectorSearchEnabled(): boolean {
        return !!(this.pool && this.pgvectorConfig?.enabled)
    }

    /**
     * Get pgvector configuration
     */
    getVectorConfig(): PgVectorConfig | null {
        return this.pgvectorConfig
    }

    /**
     * Initialize embeddings_config table - 已弃用但保留表结构
     * 
     * @deprecated 现在使用LangChain进行意图识别，不再需要embeddings配置
     * 保留此表仅为向后兼容，避免破坏现有数据
     */
    private async initializeEmbeddingsConfigTable(): Promise<void> {
        if (!this.pool) return

        const client = await this.pool.connect()
        try {
            // 保留表结构但标记为已弃用
            await client.query(`
                CREATE TABLE IF NOT EXISTS embeddings_config (
                    id SERIAL PRIMARY KEY,
                    provider VARCHAR(100) NOT NULL,
                    model VARCHAR(255) NOT NULL,
                    dimensions INTEGER NOT NULL,
                    endpoint VARCHAR(255) NOT NULL,
                    api_key_configured BOOLEAN DEFAULT false,
                    base_url TEXT,
                    batch_size INTEGER DEFAULT 100,
                    is_available BOOLEAN DEFAULT false,
                    last_checked TIMESTAMP,
                    last_success TIMESTAMP,
                    last_failure TIMESTAMP,
                    failure_count INTEGER DEFAULT 0,
                    success_count INTEGER DEFAULT 0,
                    fallback_enabled BOOLEAN DEFAULT true,
                    fallback_type VARCHAR(50) DEFAULT 'mock',
                    metadata JSONB,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    -- 添加弃用标记
                    deprecated BOOLEAN DEFAULT true,
                    deprecation_note TEXT DEFAULT 'Replaced by LangChain text processor'
                )
            `)

            // Create index for faster queries
            await client.query(`
                CREATE INDEX IF NOT EXISTS embeddings_config_provider_idx 
                ON embeddings_config (provider)
            `)

            console.log('embeddings_config table initialized (deprecated, kept for compatibility)')
        } catch (error) {
            console.error('Failed to initialize embeddings_config table:', error)
            throw error
        } finally {
            client.release()
        }
    }

    /**
     * Sync embeddings configuration from file to database
     */
    private async syncEmbeddingsConfigToDatabase(): Promise<void> {
        if (!this.pool) return

        try {
            // Read embeddings config file
            const configPath = path.join(process.cwd(), 'config', 'embeddings.json')
            
            if (!fs.existsSync(configPath)) {
                // Create a default record marking as unavailable (no warning needed)
                await this.upsertEmbeddingsConfig({
                    provider: 'openai',
                    model: 'text-embedding-ada-002',
                    dimensions: 1536,
                    endpoint: '/embeddings',
                    api_key_configured: false,
                    base_url: null,
                    batch_size: 100,
                    is_available: false,
                    fallback_enabled: true,
                    fallback_type: 'mock'
                })
                return
            }

            const configData = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
            
            // Get LLM config for base URL and API key info
            const dbConfigPath = path.join(process.cwd(), 'config', 'database.json')
            let baseUrl = null
            let apiKeyConfigured = false
            
            try {
                // Try to get LLM URL from environment or config
                baseUrl = process.env.LLM_URL || null
                apiKeyConfigured = !!(process.env.LLM_API_KEY)
            } catch (error) {
                console.warn('Could not determine LLM config:', error)
            }

            // Upsert configuration to database
            await this.upsertEmbeddingsConfig({
                provider: configData.provider || 'openai',
                model: configData.model || 'text-embedding-ada-002',
                dimensions: configData.dimensions || 1536,
                endpoint: configData.endpoint || '/embeddings',
                api_key_configured: apiKeyConfigured,
                base_url: baseUrl,
                batch_size: configData.batchSize || 100,
                is_available: false, // Will be updated by availability test
                fallback_enabled: configData.fallback?.enabled ?? true,
                fallback_type: configData.fallback?.type || 'mock'
            })

            console.log('Embeddings configuration synced to database')
        } catch (error) {
            console.error('Failed to sync embeddings config to database:', error)
        }
    }

    /**
     * Get embeddings configuration from database
     */
    async getEmbeddingsConfig(): Promise<EmbeddingsConfigRecord | null> {
        if (!this.pool) return null

        try {
            const result = await this.pool.query(
                'SELECT * FROM embeddings_config ORDER BY id DESC LIMIT 1'
            )
            return result.rows.length > 0 ? result.rows[0] : null
        } catch (error) {
            console.error('Failed to get embeddings config:', error)
            return null
        }
    }

    /**
     * Upsert embeddings configuration
     */
    async upsertEmbeddingsConfig(config: Partial<EmbeddingsConfigRecord>): Promise<void> {
        if (!this.pool) return

        try {
            const existing = await this.getEmbeddingsConfig()

            if (existing) {
                // Update existing record
                await this.pool.query(`
                    UPDATE embeddings_config 
                    SET provider = $1,
                        model = $2,
                        dimensions = $3,
                        endpoint = $4,
                        api_key_configured = $5,
                        base_url = $6,
                        batch_size = $7,
                        is_available = $8,
                        fallback_enabled = $9,
                        fallback_type = $10,
                        metadata = $11,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = $12
                `, [
                    config.provider || existing.provider,
                    config.model || existing.model,
                    config.dimensions || existing.dimensions,
                    config.endpoint || existing.endpoint,
                    config.api_key_configured ?? existing.api_key_configured,
                    config.base_url ?? existing.base_url,
                    config.batch_size || existing.batch_size,
                    config.is_available ?? existing.is_available,
                    config.fallback_enabled ?? existing.fallback_enabled,
                    config.fallback_type || existing.fallback_type,
                    config.metadata ? JSON.stringify(config.metadata) : existing.metadata,
                    existing.id
                ])
            } else {
                // Insert new record
                await this.pool.query(`
                    INSERT INTO embeddings_config (
                        provider, model, dimensions, endpoint, api_key_configured,
                        base_url, batch_size, is_available, fallback_enabled, fallback_type, metadata
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                `, [
                    config.provider,
                    config.model,
                    config.dimensions,
                    config.endpoint,
                    config.api_key_configured ?? false,
                    config.base_url ?? null,
                    config.batch_size ?? 100,
                    config.is_available ?? false,
                    config.fallback_enabled ?? true,
                    config.fallback_type ?? 'mock',
                    config.metadata ? JSON.stringify(config.metadata) : null
                ])
            }
        } catch (error) {
            console.error('Failed to upsert embeddings config:', error)
            throw error
        }
    }

    /**
     * Update embeddings availability status
     */
    async updateEmbeddingsAvailability(isAvailable: boolean, metadata?: any): Promise<void> {
        if (!this.pool) return

        try {
            const timestampField = isAvailable ? 'last_success' : 'last_failure'
            await this.pool.query(`
                UPDATE embeddings_config 
                SET is_available = $1,
                    last_checked = CURRENT_TIMESTAMP,
                    ${timestampField} = CURRENT_TIMESTAMP,
                    metadata = COALESCE($2, metadata),
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = (SELECT id FROM embeddings_config ORDER BY id DESC LIMIT 1)
            `, [isAvailable, metadata ? JSON.stringify(metadata) : null])
        } catch (error) {
            console.error('Failed to update embeddings availability:', error)
        }
    }

    /**
     * Test embeddings API availability
     */
    async testEmbeddingsAvailability(): Promise<boolean> {
        if (!this.pool) return false

        try {
            const config = await this.getEmbeddingsConfig()
            if (!config || !config.base_url) {
                console.log('Embeddings API not configured, using fallback mode')
                await this.updateEmbeddingsAvailability(false, { error: 'Configuration missing' })
                return false
            }

            // Prepare test request
            const baseUrl = config.base_url.replace('/v1', '') + '/v1'
            const url = `${baseUrl}${config.endpoint}`
            
            const headers: Record<string, string> = {
                'Content-Type': 'application/json'
            }

            // Add API key if configured
            if (config.api_key_configured && process.env.LLM_API_KEY) {
                headers['Authorization'] = `Bearer ${process.env.LLM_API_KEY}`
            }

            // Create abort controller for timeout
            const controller = new AbortController()
            const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 second timeout

            try {
                const response = await fetch(url, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        input: 'test',
                        model: config.model
                    }),
                    signal: controller.signal
                })

                clearTimeout(timeoutId)

                const responseText = await response.text()
                const trimmedResponse = responseText.trim()

                // Check if response is valid JSON and has expected format
                if (!trimmedResponse.startsWith('{')) {
                    console.warn('Embeddings endpoint returned non-JSON response')
                    await this.updateEmbeddingsAvailability(false, { 
                        error: 'Non-JSON response',
                        response_preview: trimmedResponse.substring(0, 100)
                    })
                    return false
                }

                const data = JSON.parse(responseText)
                
                if (response.ok && data.data && data.data[0] && data.data[0].embedding) {
                    console.log('✓ Embeddings API is available')
                    await this.updateEmbeddingsAvailability(true, { 
                        test_time: new Date().toISOString(),
                        status: 'healthy'
                    })
                    return true
                } else {
                    console.warn('Embeddings endpoint returned unexpected format')
                    await this.updateEmbeddingsAvailability(false, { 
                        error: 'Unexpected response format',
                        status_code: response.status
                    })
                    return false
                }
            } catch (fetchError) {
                clearTimeout(timeoutId)
                
                if (fetchError instanceof Error && fetchError.name === 'AbortError') {
                    console.log('Embeddings API test timed out, using fallback mode')
                    await this.updateEmbeddingsAvailability(false, { error: 'Timeout after 5 seconds' })
                } else {
                    console.log('Embeddings API not available, using fallback mode')
                    await this.updateEmbeddingsAvailability(false, { 
                        error: fetchError instanceof Error ? fetchError.message : 'Unknown error'
                    })
                }
                return false
            }
        } catch (error) {
            console.log('Embeddings API test failed, using fallback mode')
            await this.updateEmbeddingsAvailability(false, { 
                error: error instanceof Error ? error.message : 'Test failed'
            })
            return false
        }
    }

    /**
     * Record embeddings usage result
     */
    async recordEmbeddingsUsage(success: boolean, error?: string): Promise<void> {
        if (!this.pool) return

        try {
            const countField = success ? 'success_count' : 'failure_count'
            const timestampField = success ? 'last_success' : 'last_failure'
            
            await this.pool.query(`
                UPDATE embeddings_config 
                SET ${countField} = ${countField} + 1,
                    ${timestampField} = CURRENT_TIMESTAMP,
                    is_available = $1,
                    last_checked = CURRENT_TIMESTAMP,
                    metadata = CASE 
                        WHEN $2 IS NOT NULL THEN jsonb_set(
                            COALESCE(metadata, '{}'::jsonb),
                            '{last_error}',
                            to_jsonb($2::text)
                        )
                        ELSE metadata
                    END,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = (SELECT id FROM embeddings_config ORDER BY id DESC LIMIT 1)
            `, [success, error || null])
        } catch (error) {
            console.error('Failed to record embeddings usage:', error)
        }
    }

    /**
     * Shutdown database connection
     */
    async shutdown(): Promise<void> {
        if (this.pool) {
            await this.pool.end()
            this.pool = null
            console.log('Database connection closed')
        }
    }
}

/**
 * Convenience function
 */
export const getDatabaseService = () => DatabaseService.getInstance()
