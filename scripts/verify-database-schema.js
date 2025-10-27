// 验证数据库表结构
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function verifyDatabaseSchema() {
    console.log('🔍 验证数据库表结构...\n');

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

        // 需要检查的表 (已移除embeddings相关表，现在使用LangChain)
        const requiredTables = [
            'mcp_tools',
            'tool_keyword_mappings',
            'tool_parameter_mappings',
            'tool_usage_stats',
            'tool_name_patterns'
        ];

        console.log('检查必需的表...\n');

        for (const tableName of requiredTables) {
            const result = await client.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = $1
                )
            `, [tableName]);

            const exists = result.rows[0].exists;
            
            if (exists) {
                console.log(`✓ ${tableName} - 存在`);
                
                // 获取列信息
                const columns = await client.query(`
                    SELECT column_name, data_type, is_nullable
                    FROM information_schema.columns
                    WHERE table_name = $1
                    ORDER BY ordinal_position
                `, [tableName]);
                
                console.log(`  列数: ${columns.rows.length}`);
                columns.rows.forEach(col => {
                    console.log(`    - ${col.column_name}: ${col.data_type}`);
                });
            } else {
                console.log(`❌ ${tableName} - 不存在`);
            }
            console.log();
        }

        // 检查工具表索引 (保留用于工具匹配的基本索引)
        console.log('\n检查工具表索引...\n');
        const indexes = await client.query(`
            SELECT 
                tablename,
                indexname,
                indexdef
            FROM pg_indexes
            WHERE schemaname = 'public'
            AND tablename = 'mcp_tools'
        `);

        if (indexes.rows.length > 0) {
            indexes.rows.forEach(idx => {
                console.log(`✓ ${idx.indexname} on ${idx.tablename}`);
            });
        } else {
            console.log('⚠️  未找到工具表索引');
        }

        console.log('\n✅ 数据库表结构验证完成！');

    } catch (error) {
        console.error('\n❌ 验证失败:', error.message);
        console.error(error);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

verifyDatabaseSchema();
