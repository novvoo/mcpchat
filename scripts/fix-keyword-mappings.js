#!/usr/bin/env node

// 修复关键词映射问题

const { Client } = require('pg')

async function fixKeywordMappings() {
  console.log('🔧 修复关键词映射问题...\n')

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

    // 1. 清理错误的关键词映射
    console.log('🧹 清理错误的关键词映射...')
    
    // 删除所有现有的关键词映射
    await client.query('DELETE FROM tool_keyword_mappings')
    console.log('✅ 已清理所有现有映射\n')

    // 2. 重新创建正确的关键词映射
    console.log('📝 创建正确的关键词映射...')

    const correctMappings = [
      // solve_n_queens - N皇后问题
      { tool: 'solve_n_queens', keyword: 'queens', confidence: 0.95 },
      { tool: 'solve_n_queens', keyword: '皇后', confidence: 0.95 },
      { tool: 'solve_n_queens', keyword: 'n-queens', confidence: 0.95 },
      { tool: 'solve_n_queens', keyword: 'chess', confidence: 0.8 },
      { tool: 'solve_n_queens', keyword: '棋盘', confidence: 0.8 },
      { tool: 'solve_n_queens', keyword: 'board', confidence: 0.7 },
      { tool: 'solve_n_queens', keyword: '放置', confidence: 0.7 },
      { tool: 'solve_n_queens', keyword: '攻击', confidence: 0.7 },
      { tool: 'solve_n_queens', keyword: 'attack', confidence: 0.7 },

      // solve_24_point_game - 24点游戏
      { tool: 'solve_24_point_game', keyword: '24', confidence: 0.95 },
      { tool: 'solve_24_point_game', keyword: '24点', confidence: 0.95 },
      { tool: 'solve_24_point_game', keyword: '24 point', confidence: 0.95 },
      { tool: 'solve_24_point_game', keyword: '得到24', confidence: 0.9 },
      { tool: 'solve_24_point_game', keyword: '算出24', confidence: 0.9 },
      { tool: 'solve_24_point_game', keyword: '四则运算', confidence: 0.8 },
      { tool: 'solve_24_point_game', keyword: '加减乘除', confidence: 0.8 },
      { tool: 'solve_24_point_game', keyword: 'arithmetic', confidence: 0.7 },

      // solve_sudoku - 数独
      { tool: 'solve_sudoku', keyword: 'sudoku', confidence: 0.95 },
      { tool: 'solve_sudoku', keyword: '数独', confidence: 0.95 },
      { tool: 'solve_sudoku', keyword: 'puzzle', confidence: 0.6 },
      { tool: 'solve_sudoku', keyword: '9x9', confidence: 0.8 },

      // run_example - 运行示例
      { tool: 'run_example', keyword: 'example', confidence: 0.9 },
      { tool: 'run_example', keyword: '示例', confidence: 0.9 },
      { tool: 'run_example', keyword: 'run example', confidence: 0.95 },
      { tool: 'run_example', keyword: '运行示例', confidence: 0.95 },
      { tool: 'run_example', keyword: 'demo', confidence: 0.7 },

      // solve_chicken_rabbit_problem - 鸡兔同笼
      { tool: 'solve_chicken_rabbit_problem', keyword: 'chicken', confidence: 0.9 },
      { tool: 'solve_chicken_rabbit_problem', keyword: 'rabbit', confidence: 0.9 },
      { tool: 'solve_chicken_rabbit_problem', keyword: '鸡兔', confidence: 0.95 },
      { tool: 'solve_chicken_rabbit_problem', keyword: '鸡兔同笼', confidence: 0.95 },
      { tool: 'solve_chicken_rabbit_problem', keyword: 'heads', confidence: 0.7 },
      { tool: 'solve_chicken_rabbit_problem', keyword: 'legs', confidence: 0.7 },

      // 通用关键词 - 但置信度较低
      { tool: 'solve_n_queens', keyword: 'solve', confidence: 0.3 },
      { tool: 'solve_24_point_game', keyword: 'solve', confidence: 0.3 },
      { tool: 'solve_sudoku', keyword: 'solve', confidence: 0.3 },
      { tool: 'solve_n_queens', keyword: '解决', confidence: 0.3 },
      { tool: 'solve_24_point_game', keyword: '解决', confidence: 0.3 },
      { tool: 'solve_sudoku', keyword: '解决', confidence: 0.3 },
    ]

    // 插入正确的映射
    for (const mapping of correctMappings) {
      await client.query(`
        INSERT INTO tool_keyword_mappings (tool_name, keyword, confidence, created_at)
        VALUES ($1, $2, $3, NOW())
      `, [mapping.tool, mapping.keyword, mapping.confidence])
    }

    console.log(`✅ 已创建 ${correctMappings.length} 个关键词映射\n`)

    // 3. 验证修复结果
    console.log('🔍 验证修复结果...')
    
    const verifyResult = await client.query(`
      SELECT tool_name, COUNT(*) as keyword_count
      FROM tool_keyword_mappings
      GROUP BY tool_name
      ORDER BY tool_name
    `)

    verifyResult.rows.forEach(row => {
      console.log(`  ${row.tool_name}: ${row.keyword_count} 个关键词`)
    })

    console.log('\n✅ 关键词映射修复完成!')

  } catch (error) {
    console.error('❌ 修复失败:', error.message)
  } finally {
    await client.end()
  }
}

fixKeywordMappings().catch(console.error)