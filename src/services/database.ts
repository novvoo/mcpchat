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





/**
 * Database Service - Manages PostgreSQL connections
 */
export class DatabaseService {
    private static instance: DatabaseService
    private pool: Pool | null = null
    private config: DatabaseConfig | null = null

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
                console.warn('Database config not found')
                return
            }

            const configData = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
            this.config = configData.postgresql

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

            // Initialize schema
            await this.initializeSchema()
        } catch (error) {
            console.error('Failed to initialize database:', error)
            this.pool = null
            // Don't throw - allow system to work without database
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
     * Initialize database schema
     */
    private async initializeSchema(): Promise<void> {
        if (!this.pool) return

        const client = await this.pool.connect()
        try {
            // Database schema initialization



            // Create tools table
            await client.query(`
        CREATE TABLE IF NOT EXISTS mcp_tools (
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

            // Create indexes for tool search
            await client.query(`
        CREATE INDEX IF NOT EXISTS mcp_tools_name_idx ON mcp_tools (name)
      `)
            await client.query(`
        CREATE INDEX IF NOT EXISTS mcp_tools_server_idx ON mcp_tools (server_name)
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

            // Create MCP servers configuration table
            await client.query(`
                CREATE TABLE IF NOT EXISTS mcp_configs (
                    id SERIAL PRIMARY KEY,
                    name TEXT NOT NULL UNIQUE,
                    display_name TEXT,
                    transport TEXT NOT NULL,
                    url TEXT,
                    command TEXT,
                    args TEXT,
                    env TEXT,
                    disabled BOOLEAN DEFAULT FALSE,
                    metadata JSONB,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `)

            // Create MCP servers table (alias for compatibility)
            await client.query(`
                CREATE TABLE IF NOT EXISTS mcp_servers (
                    id SERIAL PRIMARY KEY,
                    name TEXT NOT NULL UNIQUE,
                    display_name TEXT,
                    transport TEXT NOT NULL,
                    url TEXT,
                    command TEXT,
                    args TEXT,
                    env TEXT,
                    disabled BOOLEAN DEFAULT FALSE,
                    metadata JSONB,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `)

            // Create LLM configuration table
            await client.query(`
                CREATE TABLE IF NOT EXISTS llm_configs (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(255) NOT NULL UNIQUE,
                    provider VARCHAR(100) NOT NULL,
                    model VARCHAR(255) NOT NULL,
                    base_url TEXT NOT NULL,
                    api_key_configured BOOLEAN DEFAULT false,
                    timeout INTEGER DEFAULT 30000,
                    max_tokens INTEGER DEFAULT 2000,
                    temperature FLOAT DEFAULT 0.7,
                    headers JSONB DEFAULT '{}',
                    is_active BOOLEAN DEFAULT true,
                    is_available BOOLEAN DEFAULT false,
                    last_checked TIMESTAMP,
                    last_success TIMESTAMP,
                    last_failure TIMESTAMP,
                    failure_count INTEGER DEFAULT 0,
                    success_count INTEGER DEFAULT 0,
                    metadata JSONB DEFAULT '{}',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `)

            // Create indexes for MCP and LLM configs
            await client.query(`
                CREATE INDEX IF NOT EXISTS mcp_configs_name_idx ON mcp_configs (name)
            `)
            
            await client.query(`
                CREATE INDEX IF NOT EXISTS mcp_servers_name_idx ON mcp_servers (name)
            `)
            
            await client.query(`
                CREATE INDEX IF NOT EXISTS llm_configs_name_idx ON llm_configs (name)
            `)
            
            await client.query(`
                CREATE INDEX IF NOT EXISTS llm_configs_provider_idx ON llm_configs (provider)
            `)
            
            await client.query(`
                CREATE INDEX IF NOT EXISTS llm_configs_active_idx ON llm_configs (is_active)
            `)

            console.log('现在使用LangChain进行意图识别')
            console.log('如需配置LangChain，请设置环境变量 OPENAI_API_KEY 和 OPENAI_BASE_URL')

            console.log('Database schema initialized successfully')
        } catch (error) {
            console.error('Failed to initialize schema:', error)
            // Log error but continue
            const errorMessage = error instanceof Error ? error.message : String(error)
            console.warn('Schema initialization had issues:', errorMessage)
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
