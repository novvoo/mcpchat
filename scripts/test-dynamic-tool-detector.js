#!/usr/bin/env node

// 测试动态工具检测器 - 验证从数据库获取工具元数据

const fs = require('fs').promises
const path = require('path')
const { Client } = require('pg')

async function testDynamicToolDetector() {
  console.log('🔍 测试动态工具检测器 - 验证数据库关键词映射...\n')

  try {
    // 读取数据库配置
    const dbConfigPath = path.join(__dirname, '..', 'config', 'database.json')
    const dbConfigContent = await fs.readFile(dbConfigPath, 'utf8')
    const dbConfig = JSON.parse(dbConfigContent)

    console.log('📊 连接数据库...')
    const client = new Client(dbConfig)
    await client.connect()

    // 检查关键词映射表是否存在
    console.log('🔍 检查关键词映射表...')
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'tool_keyword_mappings'
      )
    `)

    if (!tableCheck.rows[0].exists) {
      console.log('❌ tool_keyword_mappings 表不存在')
      await client.end()
      return
    }

    // 检查关键词映射数量
    const countResult = await client.query('SELECT COUNT(*) as count FROM tool_keyword_mappings')
    const mappingCount = parseInt(countResult.rows[0].count)
    console.log(`📊 当前关键词映射数量: ${mappingCount}`)

    if (mappingCount === 0) {
      console.log('⚠️  没有关键词映射，这就是为什么 tool detector 使用硬编码的原因!')
      console.log('💡 建议运行: node scripts/init-tool-metadata-tables.js')
      await client.end()
      return
    }

    // 测试关键词查询
    console.log('\n🧪 测试关键词查询...')
    
    const testInputs = ['皇后问题', '8皇后', 'queens', 'run example', '示例', 'solve', '解决']
    
    for (const input of testInputs) {
      console.log(`\n输入: "${input}"`)
      
      try {
        // 模拟 ToolMetadataService.getToolSuggestions 的查询逻辑
        const inputLower = input.toLowerCase()
        const inputWords = [inputLower, ...inputLower.split(/\s+/).filter(word => word.length > 1)]
        const uniqueWords = [...new Set(inputWords)]

        const result = await client.query(`
          SELECT DISTINCT t.name as tool_name, 
                 array_agg(DISTINCT tkm.keyword) as keywords,
                 CASE 
                   WHEN COUNT(CASE WHEN tkm.keyword = ANY($2) THEN 1 END) > 0 THEN
                     LEAST(1.0, 
                       0.8 + 
                       (COUNT(CASE WHEN tkm.keyword = ANY($2) THEN 1 END) * 0.05) + 
                       (CASE 
                         WHEN MAX(CASE WHEN tkm.keyword = ANY($2) THEN LENGTH(tkm.keyword) ELSE 0 END) >= 6 
                         THEN 0.1 
                         ELSE 0 
                       END)
                     )
                   WHEN COUNT(CASE WHEN $1 ILIKE '%' || tkm.keyword || '%' THEN 1 END) > 0 THEN
                     LEAST(0.7,
                       0.4 + 
                       (COUNT(CASE WHEN $1 ILIKE '%' || tkm.keyword || '%' THEN 1 END) * 0.08) + 
                       (CASE 
                         WHEN MAX(CASE WHEN $1 ILIKE '%' || tkm.keyword || '%' THEN LENGTH(tkm.keyword) ELSE 0 END) >= 4 
                         THEN 0.1 
                         ELSE 0 
                       END)
                     )
                   ELSE
                     LEAST(0.4,
                       0.1 + 
                       (COUNT(CASE WHEN tkm.keyword ILIKE ANY($3) THEN 1 END) * 0.05)
                     )
                 END as confidence
          FROM mcp_tools t
          JOIN tool_keyword_mappings tkm ON t.name = tkm.tool_name
          WHERE tkm.keyword = ANY($2)
             OR $1 ILIKE '%' || tkm.keyword || '%'
             OR tkm.keyword ILIKE ANY($3)
          GROUP BY t.name
          ORDER BY confidence DESC, tool_name
          LIMIT 10
        `, [
          inputLower,
          uniqueWords,
          uniqueWords.map(word => `%${word}%`)
        ])

        if (result.rows.length > 0) {
          console.log(`✅ 找到 ${result.rows.length} 个工具建议:`)
          result.rows.forEach((row, index) => {
            console.log(`  ${index + 1}. ${row.tool_name} (置信度: ${(parseFloat(row.confidence) * 100).toFixed(1)}%)`)
            console.log(`     匹配关键词: ${row.keywords.join(', ')}`)
          })
        } else {
          console.log('❌ 没有找到匹配的工具')
        }
      } catch (error) {
        console.error(`❌ 查询失败: ${error.message}`)
      }
    }

    // 显示所有可用的关键词映射
    console.log('\n📋 所有关键词映射:')
    const allMappings = await client.query(`
      SELECT tool_name, array_agg(keyword ORDER BY keyword) as keywords
      FROM tool_keyword_mappings 
      GROUP BY tool_name 
      ORDER BY tool_name
    `)

    allMappings.rows.forEach(row => {
      console.log(`${row.tool_name}: ${row.keywords.join(', ')}`)
    })

    await client.end()
    console.log('\n✅ 测试完成!')

  } catch (error) {
    console.error('❌ 测试失败:', error)
    process.exit(1)
  }
}

// 运行测试
if (require.main === module) {
  testDynamicToolDetector()
    .then(() => {
      console.log('\n🎉 测试完成!')
      process.exit(0)
    })
    .catch(error => {
      console.error('💥 测试过程中发生错误:', error)
      process.exit(1)
    })
}

module.exports = { testDynamicToolDetector }