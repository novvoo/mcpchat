const { Pool } = require('pg')
const path = require('path')
const fs = require('fs')

console.log('🔧 初始化 MCP 配置表...')

// 读取数据库配置
const dbConfigPath = path.join(__dirname, '..', 'config', 'database.json')
const dbConfig = JSON.parse(fs.readFileSync(dbConfigPath, 'utf-8'))

// 使用 postgresql 配置
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

// 创建 MCP 服务器配置表
const createMCPServersTable = `
CREATE TABLE IF NOT EXISTS mcp_servers (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  display_name TEXT,
  transport TEXT NOT NULL,
  url TEXT,
  command TEXT,
  args TEXT,
  env TEXT,
  disabled BOOLEAN DEFAULT FALSE,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
`

// 从 config/mcp.json 同步配置到数据库
async function syncMCPConfig(client) {
  const mcpConfigPath = path.join(__dirname, '..', 'config', 'mcp.json')
  
  if (!fs.existsSync(mcpConfigPath)) {
    console.log('⚠️  config/mcp.json 不存在，跳过同步')
    return
  }

  try {
    const mcpConfig = JSON.parse(fs.readFileSync(mcpConfigPath, 'utf-8'))
    
    if (!mcpConfig.mcpServers || Object.keys(mcpConfig.mcpServers).length === 0) {
      console.log('⚠️  config/mcp.json 中没有服务器配置')
      return
    }

    const servers = Object.entries(mcpConfig.mcpServers)

    for (const [name, config] of servers) {
      try {
        await client.query(`
          INSERT INTO mcp_servers 
          (name, display_name, transport, url, command, args, env, disabled, metadata, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
          ON CONFLICT (name) 
          DO UPDATE SET
            display_name = EXCLUDED.display_name,
            transport = EXCLUDED.transport,
            url = EXCLUDED.url,
            command = EXCLUDED.command,
            args = EXCLUDED.args,
            env = EXCLUDED.env,
            disabled = EXCLUDED.disabled,
            metadata = EXCLUDED.metadata,
            updated_at = CURRENT_TIMESTAMP
        `, [
          name,
          config.name || name,
          config.transport || 'stdio',
          config.url || null,
          config.command || null,
          config.args ? JSON.stringify(config.args) : null,
          config.env ? JSON.stringify(config.env) : null,
          config.disabled || false,
          JSON.stringify(config)
        ])
        
        console.log(`✅ 同步服务器: ${name}`)
      } catch (err) {
        console.error(`❌ 同步服务器 ${name} 失败:`, err.message)
      }
    }
  } catch (error) {
    console.error('❌ 读取或解析 config/mcp.json 失败:', error.message)
    throw error
  }
}

// 执行初始化
async function initialize() {
  const client = await pool.connect()
  
  try {
    // 创建表
    await client.query(createMCPServersTable)
    console.log('✅ mcp_servers 表已创建')

    // 同步配置
    await syncMCPConfig(client)

    // 显示当前配置
    const result = await client.query('SELECT * FROM mcp_servers ORDER BY name')
    
    if (result.rows.length > 0) {
      console.log('\n📋 当前 MCP 服务器配置:')
      console.table(result.rows.map(row => ({
        名称: row.name,
        显示名: row.display_name,
        传输方式: row.transport,
        URL: row.url || '-',
        命令: row.command || '-',
        状态: row.disabled ? '已禁用' : '启用'
      })))
    } else {
      console.log('\n⚠️  数据库中没有 MCP 服务器配置')
    }
    
    console.log('\n✅ MCP 配置表初始化完成')
  } catch (error) {
    console.error('❌ 初始化失败:', error)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

initialize()
