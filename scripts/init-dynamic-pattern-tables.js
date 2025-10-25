// 初始化动态模式学习相关的数据库表
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function initDynamicPatternTables() {
    console.log('🚀 初始化动态模式学习表...\n');

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

        // 1. 创建 tool_usage_patterns 表
        console.log('1️⃣ 创建 tool_usage_patterns 表...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS tool_usage_patterns (
                id SERIAL PRIMARY KEY,
                tool_name VARCHAR(255) NOT NULL,
                query_text TEXT NOT NULL,
                query_keywords TEXT[] NOT NULL,
                success BOOLEAN DEFAULT false,
                context_data JSONB,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✓ tool_usage_patterns 表创建成功\n');

        // 2. 创建 dynamic_keyword_mappings 表
        console.log('2️⃣ 创建 dynamic_keyword_mappings 表...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS dynamic_keyword_mappings (
                id SERIAL PRIMARY KEY,
                tool_name VARCHAR(255) NOT NULL,
                keyword VARCHAR(255) NOT NULL,
                confidence FLOAT NOT NULL,
                source VARCHAR(100) NOT NULL,
                usage_count INTEGER DEFAULT 0,
                last_used TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(tool_name, keyword)
            )
        `);
        console.log('✓ dynamic_keyword_mappings 表创建成功\n');

        // 3. 创建 keyword_generation_log 表
        console.log('3️⃣ 创建 keyword_generation_log 表...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS keyword_generation_log (
                id SERIAL PRIMARY KEY,
                tool_name VARCHAR(255) NOT NULL,
                generated_keywords TEXT[] NOT NULL,
                generation_method VARCHAR(100) NOT NULL,
                confidence FLOAT NOT NULL,
                success BOOLEAN DEFAULT false,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✓ keyword_generation_log 表创建成功\n');

        // 4. 创建索引
        console.log('4️⃣ 创建索引...');
        
        await client.query(`
            CREATE INDEX IF NOT EXISTS tool_usage_patterns_tool_idx 
            ON tool_usage_patterns (tool_name)
        `);
        console.log('✓ tool_usage_patterns 工具名称索引创建成功');

        await client.query(`
            CREATE INDEX IF NOT EXISTS dynamic_keyword_mappings_tool_idx 
            ON dynamic_keyword_mappings (tool_name)
        `);
        console.log('✓ dynamic_keyword_mappings 工具名称索引创建成功');

        await client.query(`
            CREATE INDEX IF NOT EXISTS dynamic_keyword_mappings_keyword_idx 
            ON dynamic_keyword_mappings (keyword)
        `);
        console.log('✓ dynamic_keyword_mappings 关键词索引创建成功\n');

        // 5. 验证表结构
        console.log('5️⃣ 验证表结构...');
        
        const tables = ['tool_usage_patterns', 'dynamic_keyword_mappings', 'keyword_generation_log'];
        
        for (const tableName of tables) {
            const result = await client.query(`
                SELECT column_name, data_type
                FROM information_schema.columns
                WHERE table_name = $1
                ORDER BY ordinal_position
            `, [tableName]);
            
            console.log(`\n${tableName}:`);
            result.rows.forEach(col => {
                console.log(`  - ${col.column_name}: ${col.data_type}`);
            });
        }

        console.log('\n✅ 动态模式学习表初始化完成！');

    } catch (error) {
        console.error('\n❌ 初始化失败:', error.message);
        console.error(error);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

initDynamicPatternTables();
