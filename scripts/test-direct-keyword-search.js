#!/usr/bin/env node

// 直接测试关键词搜索

const { Client } = require('pg')

async function testDirectKeywordSearch() {
  console.log('🔍 直接测试关键词搜索...\n')

  const client = new Client({
    host: '10.238.235.84',
    port: 5432,
    database: 'mcp_tools',
    user: 'root',
    password: '123456'
  })

  try {
    await client.connect()

    const testMessage = '在6×6的国际象棋棋盘上放置2个皇后，使得它们不能相互攻击'
    console.log(`测试消息: "${testMessage}"\n`)

    // 提取关键词
    const words = testMessage.toLowerCase().split(/\s+/)
    console.log('提取的词汇:', words.join(', '))
    console.log()

    // 查找匹配的关键词
    console.log('🔍 查找匹配的关键词:')
    for (const word of words) {
      const result = await client.query(`
        SELECT tool_name, keyword, confidence
        FROM tool_keyword_mappings
        WHERE keyword ILIKE $1
        ORDER BY confidence DESC
      `, [`%${word}%`])

      if (result.rows.length > 0) {
        console.log(`\n"${word}" 匹配到:`)
        result.rows.forEach(row => {
          console.log(`  - ${row.tool_name}: "${row.keyword}" (${(row.confidence * 100).toFixed(1)}%)`)
        })
      }
    }

    // 特别测试关键词
    console.log('\n🎯 特别测试关键词:')
    const specialKeywords = ['皇后', 'queens', '棋盘', 'chess', '6', '2']
    
    for (const keyword of specialKeywords) {
      const result = await client.query(`
        SELECT tool_name, keyword, confidence
        FROM tool_keyword_mappings
        WHERE keyword = $1
        ORDER BY confidence DESC
      `, [keyword])

      if (result.rows.length > 0) {
        console.log(`\n"${keyword}":`)
        result.rows.forEach(row => {
          console.log(`  - ${row.tool_name} (${(row.confidence * 100).toFixed(1)}%)`)
        })
      } else {
        console.log(`\n"${keyword}": 无匹配`)
      }
    }

  } catch (error) {
    console.error('❌ 测试失败:', error.message)
  } finally {
    await client.end()
  }
}

testDirectKeywordSearch().catch(console.error)