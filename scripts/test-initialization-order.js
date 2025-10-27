// Test script to verify initialization order
const { Pool } = require('pg')
const fs = require('fs')
const path = require('path')

async function testInitializationOrder() {
    console.log('🧪 测试初始化顺序...')
    
    try {
        // 1. 模拟删除数据库（仅用于测试）
        console.log('1️⃣ 检查数据库是否存在...')
        
        const configPath = path.join(process.cwd(), 'config', 'database.json')
        const configData = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
        const dbConfig = configData.postgresql
        
        // 连接到 postgres 数据库检查目标数据库
        const tempPool = new Pool({
            host: dbConfig.host,
            port: dbConfig.port,
            database: 'postgres',
            user: dbConfig.user,
            password: dbConfig.password,
            ssl: dbConfig.ssl ? { rejectUnauthorized: false } : false
        })
        
        const client = await tempPool.connect()
        
        try {
            const result = await client.query(
                'SELECT 1 FROM pg_database WHERE datname = $1',
                [dbConfig.database]
            )
            
            if (result.rows.length > 0) {
                console.log(`✓ 数据库 '${dbConfig.database}' 存在`)
            } else {
                console.log(`❌ 数据库 '${dbConfig.database}' 不存在`)
            }
        } finally {
            client.release()
            await tempPool.end()
        }
        
        // 2. 测试数据库服务初始化
        console.log('2️⃣ 测试数据库服务初始化...')
        // 由于这是 TypeScript 项目，我们需要通过 Next.js 的方式来测试
        // 这里我们直接测试数据库连接
        const testPool = new Pool({
            host: dbConfig.host,
            port: dbConfig.port,
            database: dbConfig.database,
            user: dbConfig.user,
            password: dbConfig.password,
            ssl: dbConfig.ssl ? { rejectUnauthorized: false } : false
        })
        
        try {
            const testClient = await testPool.connect()
            await testClient.query('SELECT NOW()')
            testClient.release()
            console.log('✓ 数据库连接测试成功')
        } catch (error) {
            console.log('❌ 数据库连接测试失败:', error.message)
        } finally {
            await testPool.end()
        }

        
        // 3. 测试启动检查
        console.log('3️⃣ 测试启动检查...')
        const { startupCheck } = await import('./startup-check.js')
        const checkResults = await startupCheck()
        
        console.log('启动检查结果:')
        console.log('- 数据库连接:', checkResults.database ? '✓' : '❌')
        console.log('- LLM 配置表:', checkResults.llm_config ? '✓' : '❌')
        console.log('- MCP 工具表:', checkResults.mcp_tools ? '✓' : '❌')
        
        if (checkResults.errors.length > 0) {
            console.log('发现的问题:')
            checkResults.errors.forEach(error => console.log(`  - ${error}`))
        }
        
        console.log('✅ 初始化顺序测试完成')
        
    } catch (error) {
        console.error('❌ 测试失败:', error)
    }
}

// 运行测试
testInitializationOrder()