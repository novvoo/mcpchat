#!/usr/bin/env node

/**
 * 同步配置文件到数据库
 * 将 config/*.json 文件中的配置同步到数据库的 system_config 表
 */

const fs = require('fs').promises
const path = require('path')
const { Client } = require('pg')

async function syncConfigToDatabase() {
  console.log('=== 同步配置文件到数据库 ===\n')

  // 读取数据库配置文件
  let dbConfig
  try {
    const dbConfigPath = path.resolve(process.cwd(), 'config/database.json')
    const dbConfigContent = await fs.readFile(dbConfigPath, 'utf-8')
    const dbConfigFile = JSON.parse(dbConfigContent)
    dbConfig = dbConfigFile.postgresql
  } catch (error) {
    console.warn('⚠️  无法读取数据库配置文件，使用环境变量')
    dbConfig = {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'mcp_tools',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'password'
    }
  }

  const client = new Client(dbConfig)

  try {
    await client.connect()
    console.log('✅ 数据库连接成功')

    // 同步 LLM 配置
    await syncLLMConfig(client)
    
    // 同步 MCP 配置
    await syncMCPConfig(client)
    
    // 同步 Embeddings 配置
    await syncEmbeddingsConfig(client)

    console.log('\n✅ 配置同步完成!')

  } catch (error) {
    console.error('❌ 配置同步失败:', error)
    process.exit(1)
  } finally {
    await client.end()
  }
}

/**
 * 同步 LLM 配置
 */
async function syncLLMConfig(client) {
  console.log('\n📝 同步 LLM 配置...')
  
  try {
    const configPath = path.resolve(process.cwd(), 'config/llm.json')
    const configContent = await fs.readFile(configPath, 'utf-8')
    const llmConfig = JSON.parse(configContent)

    const configs = [
      {
        key: 'llm.default_url',
        value: llmConfig.url,
        type: 'string',
        description: '默认LLM服务URL'
      },
      {
        key: 'llm.api_key',
        value: llmConfig.apiKey,
        type: 'string',
        description: 'LLM API密钥'
      },
      {
        key: 'llm.timeout',
        value: llmConfig.timeout,
        type: 'number',
        description: 'LLM请求超时时间(毫秒)'
      },
      {
        key: 'llm.max_tokens',
        value: llmConfig.maxTokens,
        type: 'number',
        description: 'LLM最大token数'
      },
      {
        key: 'llm.temperature',
        value: llmConfig.temperature,
        type: 'number',
        description: 'LLM温度参数'
      }
    ]

    for (const config of configs) {
      await upsertSystemConfig(client, config)
    }

    console.log('✅ LLM配置同步完成')
  } catch (error) {
    console.warn('⚠️  LLM配置文件读取失败:', error.message)
  }
}

/**
 * 同步 MCP 配置
 */
async function syncMCPConfig(client) {
  console.log('\n📝 同步 MCP 配置...')
  
  try {
    const configPath = path.resolve(process.cwd(), 'config/mcp.json')
    const configContent = await fs.readFile(configPath, 'utf-8')
    const mcpConfig = JSON.parse(configContent)

    // 同步 MCP 服务器配置到 mcp_server_configs 表
    if (mcpConfig.mcpServers) {
      for (const [serverName, serverConfig] of Object.entries(mcpConfig.mcpServers)) {
        await upsertMCPServerConfig(client, serverName, serverConfig)
      }
    }

    console.log('✅ MCP配置同步完成')
  } catch (error) {
    console.warn('⚠️  MCP配置文件读取失败:', error.message)
  }
}

/**
 * 同步 Embeddings 配置
 */
async function syncEmbeddingsConfig(client) {
  console.log('\n📝 同步 Embeddings 配置...')
  
  try {
    const configPath = path.resolve(process.cwd(), 'config/embeddings.json')
    const configContent = await fs.readFile(configPath, 'utf-8')
    const embeddingsConfig = JSON.parse(configContent)

    const configs = [
      {
        key: 'embeddings.provider',
        value: embeddingsConfig.provider,
        type: 'string',
        description: 'Embeddings服务提供商'
      },
      {
        key: 'embeddings.model',
        value: embeddingsConfig.model,
        type: 'string',
        description: 'Embeddings模型名称'
      },
      {
        key: 'embeddings.dimensions',
        value: embeddingsConfig.dimensions,
        type: 'number',
        description: 'Embeddings向量维度'
      },
      {
        key: 'embeddings.batch_size',
        value: embeddingsConfig.batchSize,
        type: 'number',
        description: 'Embeddings批处理大小'
      }
    ]

    for (const config of configs) {
      await upsertSystemConfig(client, config)
    }

    console.log('✅ Embeddings配置同步完成')
  } catch (error) {
    console.warn('⚠️  Embeddings配置文件读取失败:', error.message)
  }
}

/**
 * 插入或更新系统配置
 */
async function upsertSystemConfig(client, { key, value, type, description }) {
  try {
    // 序列化值
    let serializedValue
    if (type === 'string') {
      serializedValue = JSON.stringify(value)
    } else if (type === 'number' || type === 'boolean') {
      serializedValue = String(value)
    } else {
      serializedValue = JSON.stringify(value)
    }

    await client.query(`
      INSERT INTO system_config (config_key, config_value, config_type, description)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (config_key) DO UPDATE SET
        config_value = EXCLUDED.config_value,
        config_type = EXCLUDED.config_type,
        description = COALESCE(EXCLUDED.description, system_config.description),
        updated_at = CURRENT_TIMESTAMP
    `, [key, serializedValue, type, description])

    console.log(`  ✓ ${key} = ${serializedValue}`)
  } catch (error) {
    console.error(`  ❌ 更新配置失败 ${key}:`, error.message)
  }
}

/**
 * 插入或更新 MCP 服务器配置
 */
async function upsertMCPServerConfig(client, serverName, config) {
  try {
    // 解析配置结构
    const transport = config.transport || (config.url ? 'http' : 'stdio')
    const command = config.command || null
    const args = config.args || []
    const env = config.env || {}
    const url = config.url || null
    const timeout = config.timeout || 30000
    const retryAttempts = config.retryAttempts || 3
    const retryDelay = config.retryDelay || 1000
    const autoApprove = config.autoApprove || []
    const disabled = config.disabled || false
    const priority = config.priority || 0
    const healthCheckInterval = config.healthCheckInterval || 60000
    const metadata = config.metadata || {}

    await client.query(`
      INSERT INTO mcp_server_configs (
        server_name, transport, command, args, env, url, timeout, 
        retry_attempts, retry_delay, auto_approve, disabled, priority, 
        health_check_interval, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      ON CONFLICT (server_name) DO UPDATE SET
        transport = EXCLUDED.transport,
        command = EXCLUDED.command,
        args = EXCLUDED.args,
        env = EXCLUDED.env,
        url = EXCLUDED.url,
        timeout = EXCLUDED.timeout,
        retry_attempts = EXCLUDED.retry_attempts,
        retry_delay = EXCLUDED.retry_delay,
        auto_approve = EXCLUDED.auto_approve,
        disabled = EXCLUDED.disabled,
        priority = EXCLUDED.priority,
        health_check_interval = EXCLUDED.health_check_interval,
        metadata = EXCLUDED.metadata,
        updated_at = CURRENT_TIMESTAMP
    `, [
      serverName, transport, command, JSON.stringify(args), JSON.stringify(env), 
      url, timeout, retryAttempts, retryDelay, autoApprove, disabled, priority, 
      healthCheckInterval, JSON.stringify(metadata)
    ])

    console.log(`  ✓ MCP服务器: ${serverName} (${transport})`)
  } catch (error) {
    console.error(`  ❌ 更新MCP服务器配置失败 ${serverName}:`, error.message)
  }
}

// 运行同步
if (require.main === module) {
  syncConfigToDatabase().catch(console.error)
}

module.exports = { syncConfigToDatabase }