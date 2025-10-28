// 验证所有必需的数据库表
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function verifyAllTables() {
    console.log('🔍 验证所有必需的数据库表...\n');

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

        // 所有必需的表及其关键列 (使用LangChain)
        const requiredTables = {
            'mcp_tools': ['id', 'name', 'description', 'keywords', 'parameter_mappings'],
            'tool_keyword_mappings': ['id', 'tool_name', 'keyword', 'confidence', 'source'],
            'tool_parameter_mappings': ['id', 'tool_name', 'user_input', 'mcp_parameter'],
            'tool_usage_stats': ['id', 'tool_name', 'user_input', 'success'],
            'tool_name_patterns': ['id', 'pattern', 'keywords', 'confidence', 'usage_count', 'updated_at'],
            'keyword_generation_log': ['id', 'tool_name', 'generated_keywords', 'generation_method'],
            'user_input_patterns': ['id', 'input_pattern', 'matched_tools', 'total_attempts']
        };

        let allValid = true;

        for (const [tableName, requiredColumns] of Object.entries(requiredTables)) {
            // 检查表是否存在
            const tableExists = await client.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = $1
                )
            `, [tableName]);

            if (!tableExists.rows[0].exists) {
                console.log(`❌ ${tableName} - 表不存在`);
                allValid = false;
                continue;
            }

            // 获取表的所有列
            const columns = await client.query(`
                SELECT column_name
                FROM information_schema.columns
                WHERE table_name = $1
            `, [tableName]);

            const existingColumns = columns.rows.map(row => row.column_name);
            const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col));

            if (missingColumns.length > 0) {
                console.log(`⚠️  ${tableName} - 缺少列: ${missingColumns.join(', ')}`);
                allValid = false;
            } else {
                console.log(`✓ ${tableName} - 所有必需列都存在 (${existingColumns.length} 列)`);
            }
        }

        console.log('\n' + '='.repeat(60));

        if (allValid) {
            console.log('✅ 所有表和列都已正确配置！');
            console.log('\n💡 系统应该可以正常启动了');
        } else {
            console.log('❌ 发现缺失的表或列');
            console.log('\n💡 请运行相应的修复脚本');
        }

    } catch (error) {
        console.error('\n❌ 验证失败:', error.message);
        console.error(error);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

verifyAllTables();
