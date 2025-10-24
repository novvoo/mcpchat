#!/usr/bin/env node

/**
 * 确保数据库存在并正确初始化
 */

const fs = require('fs').promises
const path = require('path')
const { Client } = require('pg')

async function ensureDatabaseExists() {
  console.log('=== 确保数据库存在并正确初始化 ===\n')

  // 读取数据库配置
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

  const targetDatabase = dbConfig.database
  let tempClient = null

  try {
    // 1. 连接到默认的 postgres 数据库来检查/创建目标数据库
    console.log('1. 连接到 postgres 数据库检查目标数据库...')
    tempClient = new Client({
      host: dbConfig.host,
      port: dbConfig.port,
      database: 'postgres', // 连接到默认数据库
      user: dbConfig.user,
      password: dbConfig.password,
      ssl: dbConfig.ssl ? { rejectUnauthorized: false } : false
    })

    await tempClient.connect()
    console.log('✅ 成功连接到 postgres 数据库')

    // 2. 检查目标数据库是否存在
    console.log(`2. 检查数据库 '${targetDatabase}' 是否存在...`)
    const result = await tempClient.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [targetDatabase]
    )

    if (result.rows.length === 0) {
      // 数据库不存在，创建它
      console.log(`❌ 数据库 '${targetDatabase}' 不存在，正在创建...`)
      await tempClient.query(`CREATE DATABASE "${targetDatabase}"`)
      console.log(`✅ 数据库 '${targetDatabase}' 创建成功`)
    } else {
      console.log(`✅ 数据库 '${targetDatabase}' 已存在`)
    }

    await tempClient.end()
    tempClient = null

    // 3. 连接到目标数据库并初始化表结构
    console.log(`3. 连接到目标数据库 '${targetDatabase}' 并初始化表结构...`)
    const targetClient = new Client({
      host: dbConfig.host,
      port: dbConfig.port,
      database: targetDatabase,
      user: dbConfig.user,
      password: dbConfig.password,
      ssl: dbConfig.ssl ? { rejectUnauthorized: false } : false
    })

    await targetClient.connect()
    console.log('✅ 成功连接到目标数据库')

    // 4. 检查并创建 pgvector 扩展
    console.log('4. 检查并创建 pgvector 扩展...')
    try {
      // 检查 pgvector 扩展是否可用
      const extensionCheck = await targetClient.query(`
        SELECT 1 FROM pg_available_extensions WHERE name = 'vector'
      `)

      if (extensionCheck.rows.length === 0) {
        console.log('⚠️  pgvector 扩展不可用，跳过向量搜索功能')
      } else {
        // 创建 pgvector 扩展
        await targetClient.query('CREATE EXTENSION IF NOT EXISTS vector')
        console.log('✅ pgvector 扩展已启用')
      }
    } catch (error) {
      console.log('⚠️  pgvector 扩展创建失败，跳过向量搜索功能:', error.message)
    }

    // 5. 创建必要的表
    console.log('5. 创建必要的数据库表...')

    // 创建 mcp_tools 表
    await targetClient.query(`
      CREATE TABLE IF NOT EXISTS mcp_tools (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        description TEXT NOT NULL,
        input_schema JSONB,
        server_name VARCHAR(255),
        embedding vector(1536),
        keywords TEXT[],
        parameter_mappings JSONB,
        valid_parameters TEXT[],
        examples TEXT[],
        category VARCHAR(100),
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    console.log('✅ mcp_tools 表已创建')

    // 创建 tool_keyword_mappings 表
    await targetClient.query(`
      CREATE TABLE IF NOT EXISTS tool_keyword_mappings (
        id SERIAL PRIMARY KEY,
        tool_name VARCHAR(255) NOT NULL,
        keyword VARCHAR(255) NOT NULL,
        confidence FLOAT DEFAULT 1.0,
        source VARCHAR(50) DEFAULT 'manual',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(tool_name, keyword)
      )
    `)
    console.log('✅ tool_keyword_mappings 表已创建')

    // 创建 tool_parameter_mappings 表
    await targetClient.query(`
      CREATE TABLE IF NOT EXISTS tool_parameter_mappings (
        id SERIAL PRIMARY KEY,
        tool_name VARCHAR(255) NOT NULL,
        user_input VARCHAR(255) NOT NULL,
        mcp_parameter VARCHAR(255) NOT NULL,
        confidence FLOAT DEFAULT 1.0,
        usage_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(tool_name, user_input)
      )
    `)
    console.log('✅ tool_parameter_mappings 表已创建')

    // 创建 tool_usage_stats 表
    await targetClient.query(`
      CREATE TABLE IF NOT EXISTS tool_usage_stats (
        id SERIAL PRIMARY KEY,
        tool_name VARCHAR(255) NOT NULL,
        user_input TEXT NOT NULL,
        parameters JSONB,
        success BOOLEAN NOT NULL,
        execution_time INTEGER,
        error_message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    console.log('✅ tool_usage_stats 表已创建')

    // 创建 tool_keyword_embeddings 表
    await targetClient.query(`
      CREATE TABLE IF NOT EXISTS tool_keyword_embeddings (
        id SERIAL PRIMARY KEY,
        tool_name VARCHAR(255) NOT NULL,
        keyword VARCHAR(255) NOT NULL,
        embedding vector(1536),
        source VARCHAR(50) DEFAULT 'manual',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(tool_name, keyword)
      )
    `)
    console.log('✅ tool_keyword_embeddings 表已创建')

    // 创建 system_config 表（用于动态配置）
    await targetClient.query(`
      CREATE TABLE IF NOT EXISTS system_config (
        id SERIAL PRIMARY KEY,
        config_key VARCHAR(255) UNIQUE NOT NULL,
        config_value TEXT NOT NULL,
        config_type VARCHAR(50) DEFAULT 'string',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    console.log('✅ system_config 表已创建')

    // 创建 tool_name_patterns 表
    await targetClient.query(`
      CREATE TABLE IF NOT EXISTS tool_name_patterns (
        id SERIAL PRIMARY KEY,
        pattern VARCHAR(255) NOT NULL UNIQUE,
        keywords TEXT[] NOT NULL,
        confidence FLOAT DEFAULT 0.5,
        usage_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    console.log('✅ tool_name_patterns 表已创建')

    // 创建 sample_problem_templates 表
    await targetClient.query(`
      CREATE TABLE IF NOT EXISTS sample_problem_templates (
        id SERIAL PRIMARY KEY,
        template_name VARCHAR(200) NOT NULL,
        tool_name VARCHAR(255) NOT NULL,
        category VARCHAR(100) NOT NULL,
        difficulty VARCHAR(20) NOT NULL,
        title_template TEXT NOT NULL,
        description_template TEXT NOT NULL,
        parameter_generators JSONB NOT NULL,
        expected_solution_template JSONB,
        keywords_template TEXT[] DEFAULT '{}',
        generation_rules JSONB DEFAULT '{}',
        priority INTEGER DEFAULT 0,
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    console.log('✅ sample_problem_templates 表已创建')

    // 6. 创建索引
    console.log('6. 创建数据库索引...')
    
    try {
      // 为 mcp_tools 创建索引
      await targetClient.query(`
        CREATE INDEX IF NOT EXISTS mcp_tools_name_idx ON mcp_tools (name)
      `)
      
      // 为向量搜索创建索引（如果 pgvector 可用）
      try {
        await targetClient.query(`
          CREATE INDEX IF NOT EXISTS mcp_tools_embedding_idx 
          ON mcp_tools 
          USING ivfflat (embedding vector_cosine_ops)
          WITH (lists = 100)
        `)
        console.log('✅ 向量搜索索引已创建')
      } catch (vectorError) {
        console.log('⚠️  向量搜索索引创建跳过（pgvector 不可用）')
      }

      // 为 tool_keyword_embeddings 创建索引
      try {
        await targetClient.query(`
          CREATE INDEX IF NOT EXISTS tool_keyword_embeddings_vector_idx 
          ON tool_keyword_embeddings 
          USING ivfflat (embedding vector_cosine_ops)
          WITH (lists = 100)
        `)
        console.log('✅ 关键词嵌入向量索引已创建')
      } catch (vectorError) {
        console.log('⚠️  关键词嵌入向量索引创建跳过（pgvector 不可用）')
      }

      // 为关键词映射创建索引
      await targetClient.query(`
        CREATE INDEX IF NOT EXISTS tool_keyword_mappings_tool_name_idx 
        ON tool_keyword_mappings (tool_name)
      `)
      
      await targetClient.query(`
        CREATE INDEX IF NOT EXISTS tool_keyword_mappings_keyword_idx 
        ON tool_keyword_mappings (keyword)
      `)

      console.log('✅ 所有索引已创建')
    } catch (indexError) {
      console.log('⚠️  部分索引创建失败:', indexError.message)
    }

    await targetClient.end()

    console.log('\n🎉 数据库初始化完成！')
    console.log('现在可以运行应用程序了。')

  } catch (error) {
    console.error('❌ 数据库初始化失败:', error)
    if (tempClient) {
      try {
        await tempClient.end()
      } catch (closeError) {
        // 忽略关闭错误
      }
    }
    process.exit(1)
  }
}

// 运行脚本
if (require.main === module) {
  ensureDatabaseExists().catch(console.error)
}

module.exports = { ensureDatabaseExists }