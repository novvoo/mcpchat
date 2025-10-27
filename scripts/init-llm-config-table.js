// Initialize LLM configuration table in PostgreSQL
const { Pool } = require('pg')
const fs = require('fs')
const path = require('path')

async function initializeLLMConfigTable() {
    let pool = null
    
    try {
        // 检查是否已经初始化过
        const { Pool } = require('pg')
        const fs = require('fs')
        const path = require('path')
        // Load database configuration
        const configPath = path.join(process.cwd(), 'config', 'database.json')
        
        if (!fs.existsSync(configPath)) {
            console.error('Database config not found at:', configPath)
            process.exit(1)
        }

        const configData = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
        const dbConfig = configData.postgresql

        if (!dbConfig) {
            console.error('PostgreSQL configuration not found in database.json')
            process.exit(1)
        }

        // Create connection pool
        pool = new Pool({
            host: dbConfig.host,
            port: dbConfig.port,
            database: dbConfig.database,
            user: dbConfig.user,
            password: dbConfig.password,
            ssl: dbConfig.ssl ? { rejectUnauthorized: false } : false
        })

        console.log('Connected to PostgreSQL database')

        // Create llm_config table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS llm_config (
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

        // Create indexes
        await pool.query(`
            CREATE INDEX IF NOT EXISTS llm_config_name_idx ON llm_config (name)
        `)
        
        await pool.query(`
            CREATE INDEX IF NOT EXISTS llm_config_provider_idx ON llm_config (provider)
        `)
        
        await pool.query(`
            CREATE INDEX IF NOT EXISTS llm_config_active_idx ON llm_config (is_active)
        `)

        // Read LLM configuration from llm.json and sync to database
        const llmConfigPath = path.join(process.cwd(), 'config', 'llm.json')
        let llmConfig = null
        
        if (fs.existsSync(llmConfigPath)) {
            try {
                llmConfig = JSON.parse(fs.readFileSync(llmConfigPath, 'utf-8'))
                console.log('Loaded LLM config from llm.json')
            } catch (error) {
                console.warn('Failed to parse llm.json:', error)
            }
        }

        // Prepare configurations to insert
        const defaultConfigs = []
        
        // Add config from llm.json if available
        if (llmConfig) {
            defaultConfigs.push({
                name: 'default',
                provider: 'openai', // 可以从URL推断或配置中指定
                model: 'gpt-3.5-turbo', // 默认模型，可以在配置中指定
                base_url: llmConfig.url,
                api_key_configured: !!(llmConfig.apiKey && llmConfig.apiKey !== 'your-api-key-here' && llmConfig.apiKey !== 'your-actual-api-key-here'),
                timeout: llmConfig.timeout || 30000,
                max_tokens: llmConfig.maxTokens || 2000,
                temperature: llmConfig.temperature || 0.7,
                headers: llmConfig.headers || { 'Content-Type': 'application/json' },
                is_active: true,
                metadata: { 
                    description: 'Configuration from llm.json',
                    source: 'llm.json'
                }
            })
        } else {
            // Fallback default configuration
            defaultConfigs.push({
                name: 'default',
                provider: 'openai',
                model: 'gpt-3.5-turbo',
                base_url: 'https://api.openai.com/v1/chat/completions',
                api_key_configured: false,
                timeout: 30000,
                max_tokens: 2000,
                temperature: 0.7,
                headers: { 'Content-Type': 'application/json' },
                is_active: true,
                metadata: { 
                    description: 'Default fallback configuration',
                    source: 'fallback'
                }
            })
        }

        // Add additional example configurations
        defaultConfigs.push({
            name: 'local',
            provider: 'ollama',
            model: 'llama2',
            base_url: 'http://localhost:11434/v1/chat/completions',
            api_key_configured: false,
            timeout: 60000,
            max_tokens: 4000,
            temperature: 0.7,
            headers: { 'Content-Type': 'application/json' },
            is_active: false,
            metadata: { 
                description: 'Local Ollama configuration',
                source: 'default'
            }
        })

        for (const config of defaultConfigs) {
            await pool.query(`
                INSERT INTO llm_config (
                    name, provider, model, base_url, api_key_configured,
                    timeout, max_tokens, temperature, headers, is_active, metadata
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                ON CONFLICT (name) DO UPDATE SET
                    provider = EXCLUDED.provider,
                    model = EXCLUDED.model,
                    base_url = EXCLUDED.base_url,
                    timeout = EXCLUDED.timeout,
                    max_tokens = EXCLUDED.max_tokens,
                    temperature = EXCLUDED.temperature,
                    headers = EXCLUDED.headers,
                    metadata = EXCLUDED.metadata,
                    updated_at = CURRENT_TIMESTAMP
            `, [
                config.name,
                config.provider,
                config.model,
                config.base_url,
                config.api_key_configured,
                config.timeout,
                config.max_tokens,
                config.temperature,
                JSON.stringify(config.headers),
                config.is_active,
                JSON.stringify(config.metadata)
            ])
        }

        console.log('✓ LLM configuration table initialized successfully')
        console.log('✓ Configurations synced from llm.json')

        // Test the table
        const result = await pool.query('SELECT name, provider, model, is_active FROM llm_config ORDER BY name')
        console.log('Current LLM configurations:')
        result.rows.forEach(row => {
            console.log(`  - ${row.name}: ${row.provider}/${row.model} (${row.is_active ? 'active' : 'inactive'})`)
        })

        return { success: true, count: result.rows.length }

    } catch (error) {
        console.error('Error initializing LLM config table:', error)
        
        // 如果是作为模块调用，抛出错误而不是退出进程
        if (require.main !== module) {
            throw error
        }
        process.exit(1)
    } finally {
        if (pool) {
            await pool.end()
        }
    }
}

// Run if called directly
if (require.main === module) {
    initializeLLMConfigTable()
}

module.exports = { initializeLLMConfigTable }