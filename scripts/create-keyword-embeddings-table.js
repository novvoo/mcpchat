// 创建 keyword_embeddings 表
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function createKeywordEmbeddingsTable() {
    console.log('🚀 创建 keyword_embeddings 表...\n');

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

        // 创建 keyword_embeddings 表
        console.log('创建 keyword_embeddings 表...');
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

        // 创建向量索引
        console.log('创建向量索引...');
        await client.query(`
            CREATE INDEX IF NOT EXISTS keyword_embeddings_vector_idx 
            ON keyword_embeddings 
            USING ivfflat (embedding vector_cosine_ops)
            WITH (lists = 100)
        `);
        console.log('✓ 向量索引创建成功\n');

        // 验证表结构
        console.log('验证表结构...');
        const result = await client.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'keyword_embeddings'
            ORDER BY ordinal_position
        `);
        
        console.log('表结构:');
        result.rows.forEach(col => {
            console.log(`  - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? '(NOT NULL)' : ''}`);
        });

        console.log('\n✅ keyword_embeddings 表创建完成！');

    } catch (error) {
        console.error('\n❌ 创建失败:', error.message);
        console.error(error);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

createKeywordEmbeddingsTable();
