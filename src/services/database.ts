// Database Service - PostgreSQL connection management

import { Pool } from 'pg'
import type { PoolClient } from 'pg'
import pgvector from 'pgvector/pg'
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

/**
 * Database Service - Manages PostgreSQL connections
 */
export class DatabaseService {
    private static instance: DatabaseService
    private pool: Pool | null = null
    private config: DatabaseConfig | null = null
    private pgvectorConfig: PgVectorConfig | null = null

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
            // Note: vector dimension will be determined by the first embedding inserted
            await client.query(`
        CREATE TABLE IF NOT EXISTS mcp_tools (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) UNIQUE NOT NULL,
          description TEXT NOT NULL,
          input_schema JSONB,
          server_name VARCHAR(255),
          embedding vector(1536),
          metadata JSONB,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `)

            // Create index for vector similarity search
            await client.query(`
        CREATE INDEX IF NOT EXISTS mcp_tools_embedding_idx 
        ON mcp_tools 
        USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 100)
      `)

            // Create index for tool name
            await client.query(`
        CREATE INDEX IF NOT EXISTS mcp_tools_name_idx 
        ON mcp_tools (name)
      `)

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
