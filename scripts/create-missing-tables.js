// 创建缺失的表
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function createMissingTables() {
    console.log('🚀 创建缺失的表...\n');

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

        // 创建 keyword_generation_log 表
        console.log('1️⃣ 创建 keyword_generation_log 表...');
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
        `);
        console.log('✓ keyword_generation_log 表创建成功\n');

        // 创建 user_input_patterns 表
        console.log('2️⃣ 创建 user_input_patterns 表...');
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
        `);
        console.log('✓ user_input_patterns 表创建成功\n');

        // 创建索引
        console.log('3️⃣ 创建索引...');
        await client.query(`
            CREATE INDEX IF NOT EXISTS keyword_generation_log_tool_idx 
            ON keyword_generation_log (tool_name)
        `);
        await client.query(`
            CREATE INDEX IF NOT EXISTS user_input_patterns_pattern_idx 
            ON user_input_patterns (input_pattern)
        `);
        console.log('✓ 索引创建成功\n');

        // 验证表结构
        console.log('4️⃣ 验证表结构...\n');
        
        const tables = ['keyword_generation_log', 'user_input_patterns'];
        for (const tableName of tables) {
            const result = await client.query(`
                SELECT column_name, data_type
                FROM information_schema.columns
                WHERE table_name = $1
                ORDER BY ordinal_position
            `, [tableName]);
            
            console.log(`${tableName} 表结构:`);
            result.rows.forEach(col => {
                console.log(`  - ${col.column_name}: ${col.data_type}`);
            });
            console.log();
        }

        console.log('✅ 所有缺失的表已创建完成！');

    } catch (error) {
        console.error('\n❌ 创建失败:', error.message);
        console.error(error);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

createMissingTables();
