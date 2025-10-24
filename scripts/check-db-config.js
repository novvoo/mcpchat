#!/usr/bin/env node

/**
 * 检查数据库中的配置
 */

const fs = require('fs').promises
const path = require('path')
const { Client } = require('pg')

async function checkDatabaseConfig() {
  console.log('=== 检查数据库配置 ===\n')

  // 读取数据库配置文件
  let dbConfig
  try {
    const dbConfigPath = path.resolve(process.cwd(), 'config/database.json')
    const dbConfigContent = await fs.readFile(dbConfigPath, 'utf-8')
    const dbConfigFile = JSON.parse(dbConfigContent)
    dbConfig = dbConfigFile.postgresql
  } catch (error) {
    console.error('❌ 无法读取数据库配置文件:', error)
    return
  }

  const client = new Client(dbConfig)

  try {
    await client.connect()
    console.log('✅ 数据库连接成功\n')

    // 检查系统配置表
    console.log('📋 系统配置表内容:')
    const systemConfigResult = await client.query(`
      SELECT config_key, config_value, config_type, description, is_active, updated_at
      FROM system_config 
      WHERE config_key LIKE 'llm.%'
      ORDER BY config_key
    `)
    
    console.log('原始数据库值:')
    for (const row of systemConfigResult.rows) {
      console.log(`  ${row.config_key}: "${row.config_value}" (类型: ${row.config_type})`)
    }

    if (systemConfigResult.rows.length === 0) {
      console.log('  ❌ 没有找到LLM相关配置')
    } else {
      for (const row of systemConfigResult.rows) {
        console.log(`  ✓ ${row.config_key}: ${row.config_value} (${row.config_type}) - ${row.is_active ? '激活' : '未激活'}`)
      }
    }

    // 检查MCP服务器配置表
    console.log('\n📋 MCP服务器配置表内容:')
    const mcpConfigResult = await client.query(`
      SELECT server_name, transport, command, url, disabled, updated_at
      FROM mcp_server_configs 
      ORDER BY server_name
    `)

    if (mcpConfigResult.rows.length === 0) {
      console.log('  ❌ 没有找到MCP服务器配置')
    } else {
      for (const row of mcpConfigResult.rows) {
        console.log(`  ✓ ${row.server_name}: ${row.transport} - ${row.disabled ? '禁用' : '启用'}`)
        if (row.url) console.log(`    URL: ${row.url}`)
        if (row.command) console.log(`    命令: ${row.command}`)
      }
    }

    console.log('\n✅ 数据库配置检查完成')

  } catch (error) {
    console.error('❌ 数据库操作失败:', error)
  } finally {
    await client.end()
  }
}

// 运行检查
if (require.main === module) {
  checkDatabaseConfig().catch(console.error)
}

module.exports = { checkDatabaseConfig }