#!/usr/bin/env node

// 检查向量存储中的数据

const { Client } = require('pg')

async function checkVectorStore() {
  console.log('🔍 检查向量存储数据...\n')

  const client = new Client({
    host: '10.238.235.84',
    port: 5432,
    database: 'mcp_tools',
    user: 'root',
    password: '123456'
  })

  try {
    await client.connect()

    // 检查是否有向量表
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE '%vector%' OR table_name LIKE '%embedding%'
    `)

    console.log('📋 向量相关的表:')
    if (tablesResult.rows.length === 0) {
      console.log('  无向量相关表')
    } else {
      tablesResult.rows.forEach(row => {
        console.log(`  - ${row.table_name}`)
      })
    }
    console.log()

    // 检查tool_embeddings表
    try {
      const embeddingsResult = await client.query(`
        SELECT tool_name, keyword, COUNT(*) as count
        FROM tool_embeddings
        GROUP BY tool_name, keyword
        ORDER BY tool_name, keyword
        LIMIT 20
      `)

      console.log('📊 工具嵌入数据 (前20条):')
      if (embeddingsResult.rows.length === 0) {
        console.log('  无嵌入数据')
      } else {
        embeddingsResult.rows.forEach(row => {
          console.log(`  ${row.tool_name}: "${row.keyword}" (${row.count} 条)`)
        })
      }
    } catch (error) {
      console.log('❌ tool_embeddings表不存在或查询失败:', error.message)
    }
    console.log()

    // 检查所有表
    const allTablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `)

    console.log('📋 所有表:')
    allTablesResult.rows.forEach(row => {
      console.log(`  - ${row.table_name}`)
    })

  } catch (error) {
    console.error('❌ 检查失败:', error.message)
  } finally {
    await client.end()
  }
}

checkVectorStore().catch(console.error)