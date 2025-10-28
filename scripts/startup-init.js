#!/usr/bin/env node
/**
 * 统一启动初始化脚本
 * 在应用启动前自动检查和初始化所有必需的数据库表和配置
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

class StartupInitializer {
    constructor() {
        this.pool = null;
        this.client = null;
    }

    async initialize() {
        console.log('🚀 启动初始化检查...\n');

        try {
            // 1. 检查配置文件
            await this.checkConfigFiles();
            
            // 2. 连接数据库（包含数据库创建）
            await this.connectDatabase();
            
            // 3. 初始化所有表
            await this.initializeTables();
            
            // 4. 同步配置
            await this.syncConfigurations();
            
            // 5. 验证完整性
            await this.verifySetup();
            
            console.log('✅ 启动初始化完成，应用可以安全启动\n');
            return true;
            
        } catch (error) {
            console.error('❌ 启动初始化失败:', error.message);
            return false;
        } finally {
            await this.cleanup();
        }
    }

    async checkConfigFiles() {
        console.log('1️⃣ 检查配置文件...');
        
        const configPath = path.join(process.cwd(), 'config', 'database.json');
        if (!fs.existsSync(configPath)) {
            throw new Error(`数据库配置文件不存在: ${configPath}`);
        }
        
        console.log('✓ 数据库配置文件存在\n');
    }

    async connectDatabase() {
        console.log('2️⃣ 连接数据库...');
        
        const configPath = path.join(process.cwd(), 'config', 'database.json');
        const configData = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        this.dbConfig = configData.postgresql;

        if (!this.dbConfig) {
            throw new Error('PostgreSQL 配置不存在');
        }

        // 先确保数据库存在
        await this.ensureDatabaseExists();

        // 然后连接到目标数据库
        this.pool = new Pool({
            host: this.dbConfig.host,
            port: this.dbConfig.port,
            database: this.dbConfig.database,
            user: this.dbConfig.user,
            password: this.dbConfig.password,
            ssl: this.dbConfig.ssl ? { rejectUnauthorized: false } : false
        });

        this.client = await this.pool.connect();
        console.log('✓ 数据库连接成功\n');
    }

    async ensureDatabaseExists() {
        const targetDatabase = this.dbConfig.database;
        let tempPool = null;

        try {
            // 连接到默认的 'postgres' 数据库来检查/创建目标数据库
            tempPool = new Pool({
                host: this.dbConfig.host,
                port: this.dbConfig.port,
                database: 'postgres',
                user: this.dbConfig.user,
                password: this.dbConfig.password,
                ssl: this.dbConfig.ssl ? { rejectUnauthorized: false } : false
            });

            const tempClient = await tempPool.connect();

            try {
                // 检查数据库是否存在
                const result = await tempClient.query(
                    'SELECT 1 FROM pg_database WHERE datname = $1',
                    [targetDatabase]
                );

                if (result.rows.length === 0) {
                    console.log(`  数据库 '${targetDatabase}' 不存在，正在创建...`);
                    await tempClient.query(`CREATE DATABASE "${targetDatabase}"`);
                    console.log(`  ✓ 数据库 '${targetDatabase}' 创建成功`);
                } else {
                    console.log(`  ✓ 数据库 '${targetDatabase}' 已存在`);
                }
            } finally {
                tempClient.release();
            }
        } finally {
            if (tempPool) {
                await tempPool.end();
            }
        }
    }

    async initializeTables() {
        console.log('3️⃣ 初始化数据库表...');

        // 创建所有必需的表
        const tables = [
            {
                name: 'mcp_configs',
                sql: `
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
                `
            },
            {
                name: 'mcp_servers',
                sql: `
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
                `
            },
            {
                name: 'llm_configs',
                sql: `
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
                `
            },
            {
                name: 'mcp_tools',
                sql: `
                    CREATE TABLE IF NOT EXISTS mcp_tools (
                        id SERIAL PRIMARY KEY,
                        name TEXT NOT NULL UNIQUE,
                        description TEXT,
                        input_schema JSONB,
                        server_name TEXT,
                        keywords TEXT[] DEFAULT '{}',
                        parameter_mappings JSONB,
                        valid_parameters TEXT[] DEFAULT '{}',
                        examples JSONB,
                        category TEXT,
                        metadata JSONB,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                `
            },
            {
                name: 'tool_keyword_mappings',
                sql: `
                    CREATE TABLE IF NOT EXISTS tool_keyword_mappings (
                        id SERIAL PRIMARY KEY,
                        tool_name TEXT NOT NULL,
                        keyword TEXT NOT NULL,
                        confidence FLOAT DEFAULT 1.0,
                        source TEXT DEFAULT 'manual',
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE(tool_name, keyword)
                    )
                `
            },
            {
                name: 'tool_parameter_mappings',
                sql: `
                    CREATE TABLE IF NOT EXISTS tool_parameter_mappings (
                        id SERIAL PRIMARY KEY,
                        tool_name TEXT NOT NULL,
                        user_input TEXT NOT NULL,
                        mcp_parameter TEXT NOT NULL,
                        confidence FLOAT DEFAULT 1.0,
                        usage_count INTEGER DEFAULT 0,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE(tool_name, user_input)
                    )
                `
            },
            {
                name: 'tool_usage_stats',
                sql: `
                    CREATE TABLE IF NOT EXISTS tool_usage_stats (
                        id SERIAL PRIMARY KEY,
                        tool_name TEXT NOT NULL,
                        user_input TEXT,
                        success BOOLEAN DEFAULT true,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                `
            },
            {
                name: 'tool_name_patterns',
                sql: `
                    CREATE TABLE IF NOT EXISTS tool_name_patterns (
                        id SERIAL PRIMARY KEY,
                        pattern TEXT NOT NULL UNIQUE,
                        keywords TEXT[],
                        confidence FLOAT DEFAULT 0.5,
                        usage_count INTEGER DEFAULT 0,
                        examples TEXT[],
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                `
            },
            {
                name: 'keyword_generation_log',
                sql: `
                    CREATE TABLE IF NOT EXISTS keyword_generation_log (
                        id SERIAL PRIMARY KEY,
                        tool_name TEXT NOT NULL,
                        generated_keywords TEXT[],
                        generation_method TEXT DEFAULT 'llm',
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                `
            },
            {
                name: 'user_input_patterns',
                sql: `
                    CREATE TABLE IF NOT EXISTS user_input_patterns (
                        id SERIAL PRIMARY KEY,
                        input_pattern TEXT NOT NULL,
                        matched_tools TEXT[],
                        total_attempts INTEGER DEFAULT 0,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                `
            }
        ];

        for (const table of tables) {
            await this.client.query(table.sql);
            console.log(`  ✓ 表 ${table.name} 已创建/验证`);
        }

        // 创建索引
        const indexes = [
            'CREATE INDEX IF NOT EXISTS mcp_configs_name_idx ON mcp_configs (name)',
            'CREATE INDEX IF NOT EXISTS mcp_servers_name_idx ON mcp_servers (name)',
            'CREATE INDEX IF NOT EXISTS llm_configs_name_idx ON llm_configs (name)',
            'CREATE INDEX IF NOT EXISTS llm_configs_provider_idx ON llm_configs (provider)',
            'CREATE INDEX IF NOT EXISTS llm_configs_active_idx ON llm_configs (is_active)',
            'CREATE INDEX IF NOT EXISTS mcp_tools_name_idx ON mcp_tools (name)',
            'CREATE INDEX IF NOT EXISTS tool_keyword_mappings_tool_idx ON tool_keyword_mappings (tool_name)',
            'CREATE INDEX IF NOT EXISTS tool_usage_stats_tool_idx ON tool_usage_stats (tool_name)'
        ];

        for (const indexSql of indexes) {
            await this.client.query(indexSql);
        }

        console.log('✓ 所有表和索引已创建\n');
    }

    async syncConfigurations() {
        console.log('4️⃣ 同步配置文件...');

        // 同步 MCP 配置
        await this.syncMCPConfig();
        
        // 同步 LLM 配置
        await this.syncLLMConfig();
        
        console.log();
    }

    async syncMCPConfig() {
        const mcpConfigPath = path.join(process.cwd(), 'config', 'mcp.json');
        
        if (!fs.existsSync(mcpConfigPath)) {
            console.log('  ⚠️  config/mcp.json 不存在，跳过 MCP 配置同步');
            return;
        }

        try {
            const mcpConfig = JSON.parse(fs.readFileSync(mcpConfigPath, 'utf-8'));
            
            if (!mcpConfig.mcpServers || Object.keys(mcpConfig.mcpServers).length === 0) {
                console.log('  ⚠️  config/mcp.json 中没有服务器配置');
                return;
            }

            const servers = Object.entries(mcpConfig.mcpServers);

            for (const [name, config] of servers) {
                // 同步到 mcp_configs 表
                await this.client.query(`
                    INSERT INTO mcp_configs 
                    (name, display_name, transport, url, command, args, env, disabled, metadata, updated_at)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
                    ON CONFLICT (name) 
                    DO UPDATE SET
                        display_name = EXCLUDED.display_name,
                        transport = EXCLUDED.transport,
                        url = EXCLUDED.url,
                        command = EXCLUDED.command,
                        args = EXCLUDED.args,
                        env = EXCLUDED.env,
                        disabled = EXCLUDED.disabled,
                        metadata = EXCLUDED.metadata,
                        updated_at = CURRENT_TIMESTAMP
                `, [
                    name,
                    config.name || name,
                    config.transport || 'stdio',
                    config.url || null,
                    config.command || null,
                    config.args ? JSON.stringify(config.args) : null,
                    config.env ? JSON.stringify(config.env) : null,
                    config.disabled || false,
                    JSON.stringify(config)
                ]);

                // 同步到 mcp_servers 表（兼容性）
                await this.client.query(`
                    INSERT INTO mcp_servers 
                    (name, display_name, transport, url, command, args, env, disabled, metadata, updated_at)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
                    ON CONFLICT (name) 
                    DO UPDATE SET
                        display_name = EXCLUDED.display_name,
                        transport = EXCLUDED.transport,
                        url = EXCLUDED.url,
                        command = EXCLUDED.command,
                        args = EXCLUDED.args,
                        env = EXCLUDED.env,
                        disabled = EXCLUDED.disabled,
                        metadata = EXCLUDED.metadata,
                        updated_at = CURRENT_TIMESTAMP
                `, [
                    name,
                    config.name || name,
                    config.transport || 'stdio',
                    config.url || null,
                    config.command || null,
                    config.args ? JSON.stringify(config.args) : null,
                    config.env ? JSON.stringify(config.env) : null,
                    config.disabled || false,
                    JSON.stringify(config)
                ]);
            }
            
            console.log(`  ✓ 同步了 ${servers.length} 个 MCP 服务器配置`);
        } catch (error) {
            console.log(`  ❌ 同步 MCP 配置失败: ${error.message}`);
        }
    }

    async syncLLMConfig() {
        const llmConfigPath = path.join(process.cwd(), 'config', 'llm.json');
        let llmConfig = null;
        
        if (fs.existsSync(llmConfigPath)) {
            try {
                llmConfig = JSON.parse(fs.readFileSync(llmConfigPath, 'utf-8'));
                console.log('  ✓ 加载了 llm.json 配置');
            } catch (error) {
                console.log(`  ⚠️  解析 llm.json 失败: ${error.message}`);
            }
        }

        // 准备要插入的配置
        const defaultConfigs = [];
        
        // 从 llm.json 添加配置
        if (llmConfig) {
            defaultConfigs.push({
                name: 'default',
                provider: 'openai',
                model: 'gpt-3.5-turbo',
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
            });
        } else {
            // 默认配置
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
            });
        }

        // 添加本地配置示例
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
        });

        for (const config of defaultConfigs) {
            await this.client.query(`
                INSERT INTO llm_configs (
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
            ]);
        }
        
        console.log(`  ✓ 同步了 ${defaultConfigs.length} 个 LLM 配置`);
    }

    async verifySetup() {
        console.log('5️⃣ 验证设置...');

        // 检查 MCP 配置
        const mcpResult = await this.client.query('SELECT name, transport, disabled FROM mcp_configs ORDER BY name');
        console.log('  MCP 服务器:');
        if (mcpResult.rows.length > 0) {
            mcpResult.rows.forEach(row => {
                console.log(`    - ${row.name}: ${row.transport} (${row.disabled ? '已禁用' : '启用'})`);
            });
        } else {
            console.log('    (无)');
        }

        // 检查 LLM 配置
        const llmResult = await this.client.query('SELECT name, provider, model, is_active FROM llm_configs ORDER BY name');
        console.log('  LLM 配置:');
        if (llmResult.rows.length > 0) {
            llmResult.rows.forEach(row => {
                console.log(`    - ${row.name}: ${row.provider}/${row.model} (${row.is_active ? '激活' : '未激活'})`);
            });
        } else {
            console.log('    (无)');
        }

        // 检查必需的表
        const requiredTables = [
            'mcp_configs', 'mcp_servers', 'llm_configs', 'mcp_tools',
            'tool_keyword_mappings', 'tool_parameter_mappings', 'tool_usage_stats',
            'tool_name_patterns', 'keyword_generation_log', 'user_input_patterns'
        ];

        const missingTables = [];
        for (const tableName of requiredTables) {
            const result = await this.client.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = $1
                )
            `, [tableName]);

            if (!result.rows[0].exists) {
                missingTables.push(tableName);
            }
        }

        if (missingTables.length === 0) {
            console.log(`  ✓ 所有 ${requiredTables.length} 个必需的表都存在`);
        } else {
            console.log(`  ❌ 缺少表: ${missingTables.join(', ')}`);
            throw new Error(`缺少必需的表: ${missingTables.join(', ')}`);
        }

        console.log();
    }

    async cleanup() {
        if (this.client) {
            this.client.release();
        }
        if (this.pool) {
            await this.pool.end();
        }
    }
}

// 运行初始化
async function main() {
    const initializer = new StartupInitializer();
    const success = await initializer.initialize();
    
    if (!success) {
        console.log('💡 请检查配置文件和数据库连接');
        process.exit(1);
    }
    
    console.log('🎉 准备就绪，可以启动应用！');
}

// 如果直接运行此脚本
if (require.main === module) {
    main().catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

module.exports = { StartupInitializer };