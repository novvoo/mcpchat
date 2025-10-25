#!/usr/bin/env node
/**
 * 启动前检查脚本
 * 在应用启动前验证数据库是否准备就绪
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function preStartCheck() {
    console.log('🔍 启动前检查...\n');

    // 检查配置文件
    console.log('1️⃣ 检查配置文件...');
    const configPath = path.join(process.cwd(), 'config', 'database.json');
    if (!fs.existsSync(configPath)) {
        console.error('❌ 数据库配置文件不存在:', configPath);
        console.log('\n💡 请创建 config/database.json 文件');
        return false;
    }
    console.log('✓ 配置文件存在\n');

    // 加载配置
    const configData = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    const dbConfig = configData.postgresql;

    // 测试数据库连接
    console.log('2️⃣ 测试数据库连接...');
    const pool = new Pool({
        host: dbConfig.host,
        port: dbConfig.port,
        database: dbConfig.database,
        user: dbConfig.user,
        password: dbConfig.password,
        ssl: dbConfig.ssl ? { rejectUnauthorized: false } : false
    });

    let client;
    try {
        client = await pool.connect();
        console.log('✓ 数据库连接成功\n');
    } catch (error) {
        console.error('❌ 数据库连接失败:', error.message);
        console.log('\n💡 请检查数据库配置和服务是否运行');
        await pool.end();
        return false;
    }

    try {
        // 检查 pgvector 扩展
        console.log('3️⃣ 检查 pgvector 扩展...');
        const extResult = await client.query(`
            SELECT * FROM pg_extension WHERE extname = 'vector'
        `);
        
        if (extResult.rows.length > 0) {
            console.log('✓ pgvector 扩展已启用\n');
        } else {
            console.log('⚠️  pgvector 扩展未启用');
            console.log('   应用启动时会自动启用\n');
        }

        // 检查必需的表
        console.log('4️⃣ 检查必需的表...');
        const requiredTables = [
            'mcp_tools',
            'mcp_servers',
            'keyword_embeddings',
            'tool_keyword_mappings',
            'tool_parameter_mappings',
            'tool_usage_stats',
            'tool_keyword_embeddings',
            'tool_name_patterns',
            'keyword_generation_log',
            'user_input_patterns'
        ];

        const missingTables = [];
        for (const tableName of requiredTables) {
            const result = await client.query(`
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
            console.log(`✓ 所有 ${requiredTables.length} 个必需的表都存在\n`);
        } else {
            console.log(`⚠️  缺少 ${missingTables.length} 个表: ${missingTables.join(', ')}`);
            console.log('   应用启动时会自动创建这些表\n');
        }

        // 检查关键列
        console.log('5️⃣ 检查关键表结构...');
        const criticalChecks = [
            {
                table: 'tool_name_patterns',
                columns: ['updated_at', 'examples'],
                description: '工具名称模式表'
            }
        ];

        let structureIssues = [];
        for (const check of criticalChecks) {
            const tableExists = await client.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = $1
                )
            `, [check.table]);

            if (tableExists.rows[0].exists) {
                for (const column of check.columns) {
                    const columnExists = await client.query(`
                        SELECT column_name 
                        FROM information_schema.columns 
                        WHERE table_name = $1 AND column_name = $2
                    `, [check.table, column]);

                    if (columnExists.rows.length === 0) {
                        structureIssues.push(`${check.table}.${column}`);
                    }
                }
            }
        }

        if (structureIssues.length === 0) {
            console.log('✓ 关键表结构完整\n');
        } else {
            console.log(`⚠️  缺少列: ${structureIssues.join(', ')}`);
            console.log('   应用启动时会自动添加这些列\n');
        }

        // 检查并同步 MCP 配置
        console.log('6️⃣ 检查 MCP 配置同步...');
        const mcpConfigPath = path.join(process.cwd(), 'config', 'mcp.json');
        if (fs.existsSync(mcpConfigPath)) {
            try {
                const mcpConfig = JSON.parse(fs.readFileSync(mcpConfigPath, 'utf-8'));
                const fileServers = Object.keys(mcpConfig.mcpServers || {});
                
                const dbServersResult = await client.query('SELECT name FROM mcp_servers');
                const dbServers = dbServersResult.rows.map(r => r.name);
                
                const needsSync = fileServers.some(s => !dbServers.includes(s)) || 
                                  dbServers.some(s => !fileServers.includes(s));
                
                if (needsSync) {
                    console.log('⚠️  MCP 配置需要同步');
                    console.log('   运行: npm run db:init:mcp\n');
                } else {
                    console.log(`✓ MCP 配置已同步 (${fileServers.length} 个服务器)\n`);
                }
            } catch (error) {
                console.log('⚠️  无法检查 MCP 配置:', error.message, '\n');
            }
        } else {
            console.log('⚠️  config/mcp.json 不存在\n');
        }

        // 总结
        console.log('='.repeat(60));
        console.log('✅ 启动前检查完成\n');
        
        if (missingTables.length > 0 || structureIssues.length > 0) {
            console.log('💡 发现一些缺失的表或列');
            console.log('💡 不用担心，应用启动时会自动创建它们');
            console.log('💡 这是正常的，特别是首次启动时\n');
        } else {
            console.log('💡 数据库已完全准备就绪');
            console.log('💡 可以安全启动应用\n');
        }

        console.log('🚀 现在可以运行: npm run dev\n');
        return true;

    } catch (error) {
        console.error('\n❌ 检查失败:', error.message);
        console.error(error);
        return false;
    } finally {
        client.release();
        await pool.end();
    }
}

// 运行检查
preStartCheck()
    .then(success => {
        process.exit(success ? 0 : 1);
    })
    .catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
