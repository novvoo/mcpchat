const { Pool } = require('pg')
const path = require('path')
const fs = require('fs')

console.log('🧪 测试 MCP 配置同步...\n')

// 读取数据库配置
const dbConfigPath = path.join(__dirname, '..', 'config', 'database.json')
const dbConfig = JSON.parse(fs.readFileSync(dbConfigPath, 'utf-8'))
const pgConfig = dbConfig.postgresql

// 创建 PostgreSQL 连接池
const pool = new Pool({
  host: pgConfig.host,
  port: pgConfig.port,
  database: pgConfig.database,
  user: pgConfig.user,
  password: pgConfig.password,
  ssl: pgConfig.ssl
})

async function test() {
  const client = await pool.connect()
  
  try {
    console.log('1️⃣ 读取 config/mcp.json 文件...')
    const mcpConfigPath = path.join(__dirname, '..', 'config', 'mcp.json')
    const mcpConfig = JSON.parse(fs.readFileSync(mcpConfigPath, 'utf-8'))
    
    console.log('   文件中的服务器:')
    Object.keys(mcpConfig.mcpServers).forEach(name => {
      const server = mcpConfig.mcpServers[name]
      console.log(`   - ${name} (${server.transport})`)
    })
    
    console.log('\n2️⃣ 查询数据库中的 MCP 服务器...')
    const result = await client.query('SELECT * FROM mcp_servers ORDER BY name')
    
    console.log(`   数据库中的服务器: ${result.rows.length} 个`)
    result.rows.forEach(row => {
      console.log(`   - ${row.name} (${row.transport})${row.disabled ? ' [已禁用]' : ''}`)
    })
    
    console.log('\n3️⃣ 验证数据一致性...')
    const fileServers = Object.keys(mcpConfig.mcpServers)
    const dbServers = result.rows.map(r => r.name)
    
    const missingInDb = fileServers.filter(s => !dbServers.includes(s))
    const extraInDb = dbServers.filter(s => !fileServers.includes(s))
    
    if (missingInDb.length > 0) {
      console.log('   ⚠️  文件中有但数据库中没有:', missingInDb.join(', '))
    }
    
    if (extraInDb.length > 0) {
      console.log('   ⚠️  数据库中有但文件中没有:', extraInDb.join(', '))
    }
    
    if (missingInDb.length === 0 && extraInDb.length === 0) {
      console.log('   ✅ 数据一致！')
    }
    
    console.log('\n4️⃣ 模拟 API 响应格式...')
    const mcpServers = {}
    
    result.rows.forEach(server => {
      const config = {
        name: server.display_name || server.name,
        transport: server.transport
      }

      if (server.url) config.url = server.url
      if (server.command) config.command = server.command
      if (server.args) {
        try {
          config.args = JSON.parse(server.args)
        } catch (e) {
          config.args = server.args
        }
      }
      if (server.env) {
        try {
          config.env = JSON.parse(server.env)
        } catch (e) {
          config.env = server.env
        }
      }
      if (server.disabled) config.disabled = true

      mcpServers[server.name] = config
    })
    
    console.log('   API 将返回:')
    console.log(JSON.stringify({ mcpServers }, null, 2))
    
    console.log('\n✅ 测试完成！')
    
  } catch (error) {
    console.error('❌ 测试失败:', error)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

test()
