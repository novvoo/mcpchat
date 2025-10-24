#!/usr/bin/env node

/**
 * 直接测试数据库连接和关键词插入
 */

const fs = require('fs').promises
const path = require('path')
const { Client } = require('pg')

async function directDBTest() {
  console.log('=== 直接数据库测试 ===\n')

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

    // 1. 检查表是否存在
    console.log('1. 检查表结构:')
    const tableCheck = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('tool_keyword_mappings', 'mcp_tools')
      ORDER BY table_name
    `)
    
    console.log(`   找到表: ${tableCheck.rows.map(r => r.table_name).join(', ')}`)

    // 2. 检查 tool_keyword_mappings 表结构
    console.log('\n2. 检查 tool_keyword_mappings 表结构:')
    const columnCheck = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'tool_keyword_mappings'
      ORDER BY ordinal_position
    `)
    
    if (columnCheck.rows.length > 0) {
      console.log('   列信息:')
      columnCheck.rows.forEach(row => {
        console.log(`     - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`)
      })
    } else {
      console.log('   ❌ tool_keyword_mappings 表不存在')
    }

    // 3. 直接插入测试数据
    console.log('\n3. 直接插入测试关键词:')
    try {
      await client.query(`
        INSERT INTO tool_keyword_mappings (tool_name, keyword, confidence, source)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (tool_name, keyword) DO UPDATE SET
          confidence = EXCLUDED.confidence,
          source = EXCLUDED.source
      `, ['solve_24_point_game', '测试关键词', 0.9, 'llm_generated'])
      
      console.log('   ✅ 测试关键词插入成功')
    } catch (insertError) {
      console.log('   ❌ 插入失败:', insertError.message)
    }

    // 4. 查询插入的数据
    console.log('\n4. 查询插入的数据:')
    const queryResult = await client.query(`
      SELECT tool_name, keyword, confidence, source, created_at
      FROM tool_keyword_mappings
      WHERE tool_name = 'solve_24_point_game'
      ORDER BY created_at DESC
    `)
    
    console.log(`   找到 ${queryResult.rows.length} 条记录`)
    queryResult.rows.forEach(row => {
      console.log(`     - ${row.keyword} (${row.source}, ${row.confidence}, ${row.created_at})`)
    })

    // 5. 测试批量插入
    console.log('\n5. 测试批量插入:')
    const testKeywords = ['24点游戏', '求解24点', 'solve 24-point', '四则运算']
    
    for (const keyword of testKeywords) {
      try {
        await client.query(`
          INSERT INTO tool_keyword_mappings (tool_name, keyword, confidence, source)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (tool_name, keyword) DO UPDATE SET
            confidence = EXCLUDED.confidence,
            source = EXCLUDED.source
        `, ['solve_24_point_game', keyword, 0.9, 'llm_generated'])
      } catch (error) {
        console.log(`     ❌ 插入 "${keyword}" 失败:`, error.message)
      }
    }
    
    console.log(`   ✅ 批量插入完成`)

    // 6. 最终查询
    console.log('\n6. 最终查询结果:')
    const finalResult = await client.query(`
      SELECT COUNT(*) as total_count
      FROM tool_keyword_mappings
      WHERE tool_name = 'solve_24_point_game'
    `)
    
    console.log(`   solve_24_point_game 总关键词数: ${finalResult.rows[0].total_count}`)

  } catch (error) {
    console.error('❌ 数据库操作失败:', error)
  } finally {
    await client.end()
  }
}

directDBTest().catch(console.error);