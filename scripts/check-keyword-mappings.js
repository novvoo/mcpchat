#!/usr/bin/env node

// 检查数据库中的关键词映射

const { Client } = require('pg')

async function checkKeywordMappings() {
  console.log('🔍 检查数据库关键词映射...\n')

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

    // 检查所有工具的关键词映射
    console.log('📋 所有工具的关键词映射:')
    const toolsResult = await client.query(`
      SELECT DISTINCT tool_name 
      FROM tool_keyword_mappings 
      ORDER BY tool_name
    `)

    for (const tool of toolsResult.rows) {
      console.log(`\n🔧 ${tool.tool_name}:`)
      
      const keywordsResult = await client.query(`
        SELECT keyword, confidence 
        FROM tool_keyword_mappings 
        WHERE tool_name = $1 
        ORDER BY confidence DESC
        LIMIT 10
      `, [tool.tool_name])

      keywordsResult.rows.forEach((row, index) => {
        console.log(`  ${index + 1}. "${row.keyword}" (${(row.confidence * 100).toFixed(1)}%)`)
      })
    }

    // 特别检查可能导致混淆的关键词
    console.log('\n🚨 检查可能导致混淆的关键词:')
    
    const conflictResult = await client.query(`
      SELECT keyword, tool_name, confidence
      FROM tool_keyword_mappings 
      WHERE keyword IN ('皇后', 'queens', '棋盘', '6', '2', '攻击', 'chess')
      ORDER BY keyword, confidence DESC
    `)

    const keywordGroups = {}
    conflictResult.rows.forEach(row => {
      if (!keywordGroups[row.keyword]) {
        keywordGroups[row.keyword] = []
      }
      keywordGroups[row.keyword].push({
        tool: row.tool_name,
        confidence: row.confidence
      })
    })

    Object.entries(keywordGroups).forEach(([keyword, tools]) => {
      console.log(`\n"${keyword}":`)
      tools.forEach(tool => {
        console.log(`  - ${tool.tool} (${(tool.confidence * 100).toFixed(1)}%)`)
      })
    })

  } catch (error) {
    console.error('❌ 检查失败:', error.message)
  } finally {
    await client.end()
  }
}

checkKeywordMappings().catch(console.error)