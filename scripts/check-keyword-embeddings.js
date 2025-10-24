#!/usr/bin/env node

// 检查关键词嵌入数据

const { Client } = require('pg')

async function checkKeywordEmbeddings() {
  console.log('🔍 检查关键词嵌入数据...\n')

  const client = new Client({
    host: '10.238.235.84',
    port: 5432,
    database: 'mcp_tools',
    user: 'root',
    password: '123456'
  })

  try {
    await client.connect()

    // 检查tool_keyword_embeddings表
    console.log('📊 tool_keyword_embeddings表数据:')
    const embeddingsResult = await client.query(`
      SELECT tool_name, keyword, created_at
      FROM tool_keyword_embeddings
      ORDER BY created_at DESC
      LIMIT 20
    `)

    if (embeddingsResult.rows.length === 0) {
      console.log('  无嵌入数据')
    } else {
      embeddingsResult.rows.forEach(row => {
        console.log(`  ${row.tool_name}: "${row.keyword}" (${row.created_at})`)
      })
    }
    console.log()

    // 统计每个工具的嵌入数量
    console.log('📈 每个工具的嵌入数量:')
    const countResult = await client.query(`
      SELECT tool_name, COUNT(*) as count
      FROM tool_keyword_embeddings
      GROUP BY tool_name
      ORDER BY tool_name
    `)

    countResult.rows.forEach(row => {
      console.log(`  ${row.tool_name}: ${row.count} 个嵌入`)
    })
    console.log()

    // 检查是否有solve_n_queens相关的嵌入
    console.log('🔍 solve_n_queens相关嵌入:')
    const queensResult = await client.query(`
      SELECT keyword, created_at
      FROM tool_keyword_embeddings
      WHERE tool_name = 'solve_n_queens'
      ORDER BY created_at DESC
    `)

    if (queensResult.rows.length === 0) {
      console.log('  无solve_n_queens嵌入')
    } else {
      queensResult.rows.forEach(row => {
        console.log(`  "${row.keyword}" (${row.created_at})`)
      })
    }
    console.log()

    // 检查是否有solve_24_point_game相关的嵌入
    console.log('🔍 solve_24_point_game相关嵌入:')
    const gameResult = await client.query(`
      SELECT keyword, created_at
      FROM tool_keyword_embeddings
      WHERE tool_name = 'solve_24_point_game'
      ORDER BY created_at DESC
    `)

    if (gameResult.rows.length === 0) {
      console.log('  无solve_24_point_game嵌入')
    } else {
      gameResult.rows.forEach(row => {
        console.log(`  "${row.keyword}" (${row.created_at})`)
      })
    }

  } catch (error) {
    console.error('❌ 检查失败:', error.message)
  } finally {
    await client.end()
  }
}

checkKeywordEmbeddings().catch(console.error)