#!/usr/bin/env node
// 数据库连接诊断工具
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function diagnoseConnection() {
    console.log('🔍 PostgreSQL + pgvector 连接诊断\n');

    // 加载配置
    const configPath = path.join(process.cwd(), 'config', 'database.json');
    if (!fs.existsSync(configPath)) {
        console.error('❌ 配置文件不存在:', configPath);
        process.exit(1);
    }

    const configData = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    const dbConfig = configData.postgresql;

    console.log('📝 配置信息:');
    console.log(`   主机: ${dbConfig.host}`);
    console.log(`   端口: ${dbConfig.port}`);
    console.log(`   数据库: ${dbConfig.database}`);
    console.log(`   用户: ${dbConfig.user}\n`);

    // 测试连接到 postgres 数据库
    console.log('1️⃣ 测试连接到 PostgreSQL 服务器...');
    const postgresPool = new Pool({
        host: dbConfig.host,
        port: dbConfig.port,
        database: 'postgres',
        user: dbConfig.user,
        password: dbConfig.password,
        ssl: dbConfig.ssl ? { rejectUnauthorized: false } : false
    });

    try {
        await postgresPool.query('SELECT NOW()');
        console.log('✓ PostgreSQL 服务器连接成功\n');

        // 检查目标数据库是否存在
        console.log('2️⃣ 检查目标数据库...');
        const dbResult = await postgresPool.query(
            'SELECT 1 FROM pg_database WHERE datname = $1',
            [dbConfig.database]
        );

        if (dbResult.rows.length === 0) {
            console.log(`⚠️  数据库 '${dbConfig.database}' 不存在`);
            console.log('   运行以下命令创建: node scripts/init-base-tables.js\n');
            await postgresPool.end();
            process.exit(1);
        }
        console.log(`✓ 数据库 '${dbConfig.database}' 存在\n`);

        // 检查 pgvector 扩展
        console.log('3️⃣ 检查 pgvector 扩展...');
        const extResult = await postgresPool.query(
            "SELECT * FROM pg_available_extensions WHERE name = 'vector'"
        );

        if (extResult.rows.length === 0) {
            console.log('❌ pgvector 扩展未安装');
            console.log('   请安装 pgvector: https://github.com/pgvector/pgvector\n');
            await postgresPool.end();
            process.exit(1);
        }
        console.log(`✓ pgvector 扩展可用 (版本 ${extResult.rows[0].default_version})\n`);

    } catch (error) {
        console.error('❌ 连接失败:', error.message);
        await postgresPool.end();
        process.exit(1);
    } finally {
        await postgresPool.end();
    }

    // 测试连接到目标数据库
    console.log('4️⃣ 测试连接到目标数据库...');
    const targetPool = new Pool({
        host: dbConfig.host,
        port: dbConfig.port,
        database: dbConfig.database,
        user: dbConfig.user,
        password: dbConfig.password,
        ssl: dbConfig.ssl ? { rejectUnauthorized: false } : false
    });

    try {
        await targetPool.query('SELECT NOW()');
        console.log('✓ 目标数据库连接成功\n');

        // 检查扩展是否已启用
        console.log('5️⃣ 检查 pgvector 扩展状态...');
        const enabledResult = await targetPool.query(
            "SELECT extname, extversion FROM pg_extension WHERE extname = 'vector'"
        );

        if (enabledResult.rows.length === 0) {
            console.log('⚠️  pgvector 扩展未启用');
            console.log('   运行以下命令启用: node scripts/init-base-tables.js\n');
        } else {
            console.log(`✓ pgvector 扩展已启用 (版本 ${enabledResult.rows[0].extversion})\n`);
        }

        // 检查表
        console.log('6️⃣ 检查数据库表...');
        const tablesResult = await targetPool.query(`
            SELECT tablename 
            FROM pg_tables 
            WHERE schemaname = 'public' 
            ORDER BY tablename
        `);

        if (tablesResult.rows.length === 0) {
            console.log('⚠️  没有找到表');
            console.log('   运行以下命令初始化: node scripts/init-base-tables.js\n');
        } else {
            console.log(`✓ 找到 ${tablesResult.rows.length} 个表:`);
            tablesResult.rows.forEach(row => {
                console.log(`   - ${row.tablename}`);
            });
            console.log();
        }

        // 测试向量操作
        if (enabledResult.rows.length > 0) {
            console.log('7️⃣ 测试向量操作...');
            await targetPool.query("SELECT '[1,2,3]'::vector <-> '[4,5,6]'::vector");
            console.log('✓ 向量操作正常\n');
        }

        console.log('✅ 所有诊断检查通过！数据库连接正常');

    } catch (error) {
        console.error('❌ 诊断失败:', error.message);
        console.error(error);
        process.exit(1);
    } finally {
        await targetPool.end();
    }
}

diagnoseConnection();
