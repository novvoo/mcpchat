#!/usr/bin/env node

// 分析24点游戏关键词匹配

const { Client } = require('pg')

async function analyze24PointKeywords() {
  console.log('🔍 分析24点游戏关键词匹配...\n')

  const client = new Client({
    host: '10.238.235.84',
    port: 5432,
    database: 'mcp_tools',
    user: 'root',
    password: '123456'
  })

  try {
    await client.connect()

    const testMessage = '如何从 8、8、4、13 从简单的加减乘除运算得到 24'
    console.log(`测试消息: "${testMessage}"\n`)

    // 获取24点游戏的所有关键词
    const keywordsResult = await client.query(`
      SELECT keyword, confidence
      FROM tool_keyword_mappings
      WHERE tool_name = 'solve_24_point_game'
      ORDER BY confidence DESC
    `)

    console.log('📋 solve_24_point_game的关键词:')
    keywordsResult.rows.forEach(row => {
      console.log(`  - "${row.keyword}" (${(row.confidence * 100).toFixed(1)}%)`)
    })
    console.log()

    // 检查哪些关键词在消息中匹配
    console.log('🎯 匹配分析:')
    const messageLower = testMessage.toLowerCase()
    let totalScore = 0
    let matchCount = 0

    for (const row of keywordsResult.rows) {
      const keyword = row.keyword.toLowerCase()
      const confidence = row.confidence
      
      if (messageLower.includes(keyword)) {
        console.log(`  ✅ "${row.keyword}" 匹配 (${(confidence * 100).toFixed(1)}%)`)
        totalScore += confidence
        matchCount++
      } else {
        console.log(`  ❌ "${row.keyword}" 不匹配`)
      }
    }

    console.log(`\n📊 匹配统计:`)
    console.log(`  匹配关键词数: ${matchCount}`)
    console.log(`  总分: ${totalScore.toFixed(3)}`)
    console.log(`  平均置信度: ${matchCount > 0 ? (totalScore / matchCount * 100).toFixed(1) + '%' : '0%'}`)

    // 建议改进
    console.log('\n💡 改进建议:')
    if (matchCount === 0) {
      console.log('  - 没有关键词匹配，需要添加更多相关关键词')
      console.log('  - 建议添加: "得到", "运算", "数字", "计算"')
    } else if (totalScore < 0.4) {
      console.log('  - 匹配置信度较低，需要提高关键词权重或添加更精确的关键词')
    }

  } catch (error) {
    console.error('❌ 分析失败:', error.message)
  } finally {
    await client.end()
  }
}

analyze24PointKeywords().catch(console.error)