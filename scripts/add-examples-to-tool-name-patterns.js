// 为 tool_name_patterns 表添加 examples 列
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function addExamplesColumn() {
    console.log('🚀 为 tool_name_patterns 表添加 examples 列...\n');

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

        // 检查列是否已存在
        console.log('检查 examples 列是否存在...');
        const checkResult = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'tool_name_patterns' 
            AND column_name = 'examples'
        `);

        if (checkResult.rows.length > 0) {
            console.log('✓ examples 列已存在，无需添加\n');
        } else {
            console.log('添加 examples 列...');
            await client.query(`
                ALTER TABLE tool_name_patterns 
                ADD COLUMN examples TEXT[] DEFAULT '{}'
            `);
            console.log('✓ examples 列添加成功\n');
        }

        // 验证表结构
        console.log('验证表结构...');
        const result = await client.query(`
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_name = 'tool_name_patterns'
            ORDER BY ordinal_position
        `);
        
        console.log('表结构:');
        result.rows.forEach(col => {
            console.log(`  - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? '(NOT NULL)' : ''}`);
        });

        console.log('\n✅ tool_name_patterns 表更新完成！');

    } catch (error) {
        console.error('\n❌ 更新失败:', error.message);
        console.error(error);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

addExamplesColumn();
