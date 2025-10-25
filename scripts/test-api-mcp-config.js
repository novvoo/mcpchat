/**
 * 测试 /api/mcp-config API 路由
 * 这个脚本直接测试数据库查询逻辑
 */

const { Pool } = require('pg')
const path = require('path')
const fs = require('fs')

console.log('🧪 测试 /api/mcp-config API 逻辑...\n')

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

async function testAPI() {
  const client = await pool.connect()
  
  try {
    console.log('1️⃣ 执行数据库查询...')
    
    // 这是 API 路由中使用的查询
    const result = await client.query(`
      SELECT 
        name,
        display_name,
        transport,
        url,
        command,
        args,
        env,
        disabled,
        metadata
      FROM mcp_servers
      ORDER BY name
    `)

    const servers = result.rows
    console.log(`   找到 ${servers.length} 个服务器\n`)

    if (!servers || servers.length === 0) {
      console.log('⚠️  没有找到 MCP 服务器配置')
      console.log('   API 将返回: { mcpServers: {}, message: "No MCP servers configured in database" }\n')
      return
    }

    console.log('2️⃣ 转换为 mcp.json 格式...')
    
    // 转换为 mcp.json 格式
    const mcpServers = {}
    
    servers.forEach((server) => {
      const config = {
        name: server.display_name || server.name,
        transport: server.transport
      }

      if (server.url) {
        config.url = server.url
      }

      if (server.command) {
        config.command = server.command
      }

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

      if (server.disabled) {
        config.disabled = true
      }

      mcpServers[server.name] = config
    })
    
    console.log('3️⃣ API 响应预览:')
    console.log(JSON.stringify({ mcpServers }, null, 2))
    
    console.log('\n4️⃣ 验证每个服务器配置...')
    for (const [name, config] of Object.entries(mcpServers)) {
      console.log(`\n   服务器: ${name}`)
      console.log(`   - 显示名: ${config.name}`)
      console.log(`   - 传输方式: ${config.transport}`)
      if (config.url) console.log(`   - URL: ${config.url}`)
      if (config.command) console.log(`   - 命令: ${config.command}`)
      if (config.args) console.log(`   - 参数: ${JSON.stringify(config.args)}`)
      if (config.disabled) console.log(`   - 状态: 已禁用`)
    }
    
    console.log('\n✅ API 逻辑测试通过！')
    console.log('\n💡 现在可以在浏览器中访问: http://localhost:3000/api/mcp-config')
    
  } catch (error) {
    console.error('❌ 测试失败:', error)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

testAPI()
