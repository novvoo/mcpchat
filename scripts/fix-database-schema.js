#!/usr/bin/env node
/**
 * 一键修复数据库表结构
 * 确保所有必需的表和列都存在
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function fixDatabaseSchema() {
    console.log('🔧 开始修复数据库表结构...\n');

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

        // 1. 确保 pgvector 扩展已启用
        console.log('1️⃣ 启用 pgvector 扩展...');
        await client.query('CREATE EXTENSION IF NOT EXISTS vector');
        console.log('✓ pgvector 扩展已启用\n');

        // 2. 为 tool_name_patterns 添加缺失的列
        console.log('2️⃣ 检查 tool_name_patterns 表...');
        
        // 检查 updated_at 列
        const hasUpdatedAt = await client.query(`
            SELECT column_name FROM information_schema.columns 
            WHERE table_name = 'tool_name_patterns' AND column_name = 'updated_at'
        `);
        
        if (hasUpdatedAt.rows.length === 0) {
            console.log('  添加 updated_at 列...');
            await client.query(`
                ALTER TABLE tool_name_patterns 
                ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            `);
            await client.query(`
                UPDATE tool_name_patterns 
                SET updated_at = created_at 
                WHERE updated_at IS NULL
            `);
            console.log('  ✓ updated_at 列已添加');
        } else {
            console.log('  ✓ updated_at 列已存在');
        }

        // 检查 examples 列
        const hasExamples = await client.query(`
            SELECT column_name FROM information_schema.columns 
            WHERE table_name = 'tool_name_patterns' AND column_name = 'examples'
        `);
        
        if (hasExamples.rows.length === 0) {
            console.log('  添加 examples 列...');
            await client.query(`
                ALTER TABLE tool_name_patterns 
                ADD COLUMN examples TEXT[] DEFAULT '{}'
            `);
            console.log('  ✓ examples 列已添加');
        } else {
            console.log('  ✓ examples 列已存在');
        }
        console.log();

        // 3. 创建 keyword_embeddings 表（如果不存在）
        console.log('3️⃣ 检查 keyword_embeddings 表...');
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
        await client.query(`
            CREATE INDEX IF NOT EXISTS keyword_embeddings_vector_idx 
            ON keyword_embeddings 
            USING ivfflat (embedding vector_cosine_ops)
            WITH (lists = 100)
        `);
        console.log('✓ keyword_embeddings 表已就绪\n');

        // 4. 创建 keyword_generation_log 表（如果不存在）
        console.log('4️⃣ 检查 keyword_generation_log 表...');
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
        await client.query(`
            CREATE INDEX IF NOT EXISTS keyword_generation_log_tool_idx 
            ON keyword_generation_log (tool_name)
        `);
        console.log('✓ keyword_generation_log 表已就绪\n');

        // 5. 创建 user_input_patterns 表（如果不存在）
        console.log('5️⃣ 检查 user_input_patterns 表...');
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
        await client.query(`
            CREATE INDEX IF NOT EXISTS user_input_patterns_pattern_idx 
            ON user_input_patterns (input_pattern)
        `);
        console.log('✓ user_input_patterns 表已就绪\n');

        // 6. 验证所有表
        console.log('6️⃣ 验证所有必需的表...');
        const requiredTables = [
            'mcp_tools',
            'keyword_embeddings',
            'tool_keyword_mappings',
            'tool_parameter_mappings',
            'tool_usage_stats',
            'tool_keyword_embeddings',
            'tool_name_patterns',
            'keyword_generation_log',
            'user_input_patterns'
        ];

        let allExist = true;
        for (const tableName of requiredTables) {
            const result = await client.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = $1
                )
            `, [tableName]);

            if (result.rows[0].exists) {
                console.log(`  ✓ ${tableName}`);
            } else {
                console.log(`  ❌ ${tableName} - 不存在`);
                allExist = false;
            }
        }

        console.log('\n' + '='.repeat(60));
        
        if (allExist) {
            console.log('✅ 数据库表结构修复完成！');
            console.log('\n💡 所有必需的表和列都已正确配置');
            console.log('💡 系统现在应该可以正常启动了');
        } else {
            console.log('⚠️  部分表仍然缺失');
            console.log('\n💡 请检查数据库权限或运行完整的初始化脚本');
        }

    } catch (error) {
        console.error('\n❌ 修复失败:', error.message);
        console.error(error);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

// 运行修复
fixDatabaseSchema().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
