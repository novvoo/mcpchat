// 初始化基础数据库表
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function initBaseTables() {
    console.log('🚀 初始化基础数据库表...\n');

    // 加载数据库配置
    const configPath = path.join(process.cwd(), 'config', 'database.json');
    if (!fs.existsSync(configPath)) {
        console.error('❌ 数据库配置文件不存在:', configPath);
        process.exit(1);
    }

    const configData = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    const dbConfig = configData.postgresql;

    const pool = new Pool({
        host: dbConfig.host,
        port: dbConfig.port,
        database: dbConfig.database,
        user: dbConfig.user,
        password: dbConfig.password,
        ssl: dbConfig.ssl ? { rejectUnauthorized: false } : false
    });

    const client = await pool.connect();

    try {
        console.log('✓ 连接数据库成功\n');

        // 1. 启用 pgvector 扩展
        console.log('1️⃣ 启用 pgvector 扩展...');
        await client.query('CREATE EXTENSION IF NOT EXISTS vector');
        console.log('✓ pgvector 扩展已启用\n');

        // 2. 创建 mcp_tools 表
        console.log('2️⃣ 创建 mcp_tools 表...');
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
        `);
        console.log('✓ mcp_tools 表创建成功\n');

        // 3. 创建 keyword_embeddings 表
        console.log('3️⃣ 创建 keyword_embeddings 表...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS keyword_embeddings (
                id SERIAL PRIMARY KEY,
                keyword VARCHAR(255) NOT NULL UNIQUE,
                embedding vector(1536),
                tool_names TEXT[] DEFAULT '{}',
                usage_count INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✓ keyword_embeddings 表创建成功\n');

        // 4. 创建索引
        console.log('4️⃣ 创建索引...');
        
        // Vector 相似度搜索索引
        await client.query(`
            CREATE INDEX IF NOT EXISTS mcp_tools_embedding_idx 
            ON mcp_tools 
            USING ivfflat (embedding vector_cosine_ops)
            WITH (lists = 100)
        `);
        console.log('✓ 向量索引创建成功');

        // 工具名称索引
        await client.query(`
            CREATE INDEX IF NOT EXISTS mcp_tools_name_idx 
            ON mcp_tools (name)
        `);
        console.log('✓ 名称索引创建成功');

        // keyword_embeddings 向量索引
        await client.query(`
            CREATE INDEX IF NOT EXISTS keyword_embeddings_vector_idx 
            ON keyword_embeddings 
            USING ivfflat (embedding vector_cosine_ops)
            WITH (lists = 100)
        `);
        console.log('✓ 关键词向量索引创建成功\n');

        // 4. 创建 embeddings_config 表
        console.log('4️⃣ 创建 embeddings_config 表...');
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
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        await client.query(`
            CREATE INDEX IF NOT EXISTS embeddings_config_provider_idx 
            ON embeddings_config (provider)
        `);
        console.log('✓ embeddings_config 表创建成功\n');

        // 5. 验证表结构
        console.log('5️⃣ 验证表结构...');
        const result = await client.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'mcp_tools'
            ORDER BY ordinal_position
        `);
        
        console.log('表结构:');
        result.rows.forEach(col => {
            console.log(`  - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? '(NOT NULL)' : ''}`);
        });

        console.log('\n✅ 基础表初始化完成！');

    } catch (error) {
        console.error('\n❌ 初始化失败:', error.message);
        console.error(error);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

initBaseTables();
