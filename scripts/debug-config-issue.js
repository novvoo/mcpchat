#!/usr/bin/env node

/**
 * 调试配置问题
 */

const fs = require('fs').promises
const path = require('path')
const { Client } = require('pg')

async function debugConfigIssue() {
  console.log('=== 调试配置问题 ===\n')

  // 读取数据库配置文件
  let dbConfig
  try {
    const dbConfigPath = path.resolve(process.cwd(), 'config/database.json')
    const dbConfigContent = await fs.readFile(dbConfigPath, 'utf-8')
    const dbConfigFile = JSON.parse(dbConfigContent)
    dbConfig = dbConfigFile.postgresql
    console.log('✅ 数据库配置读取成功:', dbConfig.host)
  } catch (error) {
    console.error('❌ 无法读取数据库配置文件:', error)
    return
  }

  const client = new Client(dbConfig)

  try {
    await client.connect()
    console.log('✅ 数据库连接成功\n')

    // 直接测试SQL查询
    console.log('🔍 直接查询 llm.default_url:')
    const result = await client.query(
      'SELECT config_value, config_type FROM system_config WHERE config_key = $1 AND is_active = true',
      ['llm.default_url']
    )

    if (result.rows.length === 0) {
      console.log('❌ 没有找到 llm.default_url 配置')
    } else {
      const { config_value, config_type } = result.rows[0]
      console.log(`✅ 找到配置: ${config_value} (类型: ${config_type})`)
      console.log(`原始值长度: ${config_value.length}`)
      console.log(`原始值字符: [${config_value.split('').map(c => c.charCodeAt(0)).join(', ')}]`)
      console.log(`第一个字符: "${config_value[0]}" (${config_value.charCodeAt(0)})`)
      console.log(`最后一个字符: "${config_value[config_value.length-1]}" (${config_value.charCodeAt(config_value.length-1)})`)
      
      // 模拟动态配置服务的解析逻辑
      let parsedValue
      try {
        switch (config_type) {
          case 'string':
            parsedValue = JSON.parse(config_value)
            break
          case 'number':
            parsedValue = parseFloat(config_value)
            break
          case 'boolean':
            parsedValue = config_value === 'true'
            break
          case 'object':
          case 'array':
            parsedValue = JSON.parse(config_value)
            break
          default:
            parsedValue = config_value
        }
        console.log(`✅ 解析后的值: "${parsedValue}"`)
      } catch (parseError) {
        console.error('❌ 解析失败:', parseError.message)
        console.log('尝试直接使用原始值...')
        parsedValue = config_value
        console.log(`✅ 直接使用原始值: "${parsedValue}"`)
      }
    }

    // 检查所有LLM相关配置
    console.log('\n🔍 所有LLM配置:')
    const allLlmResult = await client.query(
      'SELECT config_key, config_value, config_type, is_active FROM system_config WHERE config_key LIKE $1 ORDER BY config_key',
      ['llm.%']
    )

    for (const row of allLlmResult.rows) {
      const status = row.is_active ? '✅' : '❌'
      console.log(`  ${status} ${row.config_key}: ${row.config_value} (${row.config_type}) [is_active: ${row.is_active}]`)
    }
    
    // 测试动态配置服务使用的确切查询
    console.log('\n🔍 测试动态配置服务的查询:')
    const exactQuery = await client.query(
      'SELECT config_value, config_type FROM system_config WHERE config_key = $1 AND is_active = true',
      ['llm.default_url']
    )
    
    console.log(`查询结果数量: ${exactQuery.rows.length}`)
    if (exactQuery.rows.length > 0) {
      console.log('查询结果:', exactQuery.rows[0])
    } else {
      console.log('❌ 查询没有返回结果')
      
      // 检查不带 is_active 条件的查询
      const withoutActiveQuery = await client.query(
        'SELECT config_value, config_type, is_active FROM system_config WHERE config_key = $1',
        ['llm.default_url']
      )
      console.log(`不带 is_active 条件的查询结果数量: ${withoutActiveQuery.rows.length}`)
      if (withoutActiveQuery.rows.length > 0) {
        console.log('不带 is_active 条件的查询结果:', withoutActiveQuery.rows[0])
      }
    }

    // 测试API调用
    console.log('\n🌐 测试API调用:')
    try {
      const response = await fetch('http://localhost:3000/api/dynamic-config?action=status')
      if (response.ok) {
        const data = await response.json()
        console.log('✅ API调用成功')
        console.log('返回的systemConfig:', JSON.stringify(data.data.systemConfig, null, 2))
      } else {
        console.error(`❌ API调用失败: ${response.status}`)
      }
    } catch (apiError) {
      console.error('❌ API调用异常:', apiError.message)
    }

  } catch (error) {
    console.error('❌ 数据库操作失败:', error)
  } finally {
    await client.end()
  }
}

// 运行调试
if (require.main === module) {
  debugConfigIssue().catch(console.error)
}

module.exports = { debugConfigIssue }