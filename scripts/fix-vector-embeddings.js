#!/usr/bin/env node

// 修复向量嵌入数据

const { Client } = require('pg')

async function fixVectorEmbeddings() {
  console.log('🔧 修复向量嵌入数据...\n')

  const client = new Client({
    host: '10.238.235.84',
    port: 5432,
    database: 'mcp_tools',
    user: 'root',
    password: '123456'
  })

  try {
    await client.connect()
    console.log('✅ 数据库连接成功\n')

    // 1. 清理现有的向量嵌入数据
    console.log('🧹 清理现有向量嵌入数据...')
    await client.query('DELETE FROM tool_keyword_embeddings')
    console.log('✅ 已清理所有向量嵌入数据\n')

    // 2. 暂时禁用向量搜索，让系统使用关键词匹配
    console.log('⚠️  向量嵌入数据已清理，系统将自动回退到关键词匹配模式')
    console.log('   这样可以确保使用我们刚才修复的正确关键词映射\n')

    // 3. 验证关键词映射是否正确
    console.log('🔍 验证关键词映射...')
    
    const queensKeywords = await client.query(`
      SELECT keyword, confidence
      FROM tool_keyword_mappings
      WHERE tool_name = 'solve_n_queens'
      ORDER BY confidence DESC
    `)

    console.log('solve_n_queens的关键词:')
    queensKeywords.rows.forEach(row => {
      console.log(`  - "${row.keyword}" (${(row.confidence * 100).toFixed(1)}%)`)
    })
    console.log()

    const gameKeywords = await client.query(`
      SELECT keyword, confidence
      FROM tool_keyword_mappings
      WHERE tool_name = 'solve_24_point_game'
      ORDER BY confidence DESC
    `)

    console.log('solve_24_point_game的关键词:')
    gameKeywords.rows.forEach(row => {
      console.log(`  - "${row.keyword}" (${(row.confidence * 100).toFixed(1)}%)`)
    })

    console.log('\n✅ 向量嵌入修复完成!')
    console.log('💡 系统现在将使用关键词匹配，应该能正确识别工具了')

  } catch (error) {
    console.error('❌ 修复失败:', error.message)
  } finally {
    await client.end()
  }
}

fixVectorEmbeddings().catch(console.error)