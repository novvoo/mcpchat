#!/usr/bin/env node

/**
 * 清理测试数据
 */

const fs = require('fs').promises
const path = require('path')
const { Client } = require('pg')

async function cleanTestData() {
  console.log('=== 清理测试数据 ===\n')

  // 读取数据库配置
  let dbConfig
  try {
    const dbConfigPath = path.resolve(process.cwd(), 'config/database.json')
    const dbConfigContent = await fs.readFile(dbConfigPath, 'utf-8')
    const dbConfigFile = JSON.parse(dbConfigContent)
    dbConfig = dbConfigFile.postgresql
    console.log('✅ 数据库配置读取成功')
  } catch (error) {
    console.error('❌ 无法读取数据库配置文件:', error)
    return
  }

  const client = new Client(dbConfig)

  try {
    await client.connect()
    console.log('✅ 数据库连接成功\n')

    // 清理关键词映射表
    console.log('1. 清理 tool_keyword_mappings 表...')
    const deleteKeywords = await client.query('DELETE FROM tool_keyword_mappings')
    console.log(`   删除了 ${deleteKeywords.rowCount} 条关键词记录`)

    // 清理嵌入向量表
    console.log('2. 清理 tool_keyword_embeddings 表...')
    const deleteEmbeddings = await client.query('DELETE FROM tool_keyword_embeddings')
    console.log(`   删除了 ${deleteEmbeddings.rowCount} 条嵌入向量记录`)

    // 清理工具表
    console.log('3. 清理 mcp_tools 表...')
    const deleteTools = await client.query('DELETE FROM mcp_tools')
    console.log(`   删除了 ${deleteTools.rowCount} 条工具记录`)

    console.log('\n✅ 测试数据清理完成')

  } catch (error) {
    console.error('❌ 清理失败:', error)
  } finally {
    await client.end()
  }
}

cleanTestData().catch(console.error);