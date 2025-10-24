#!/usr/bin/env node

// 测试工具元数据服务

async function testMetadataService() {
  console.log('🔍 测试工具元数据服务...\n')

  try {
    // 直接调用工具元数据服务的API
    const response = await fetch('http://localhost:3000/api/test-smart-router', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: '在6×6的国际象棋棋盘上放置2个皇后，使得它们不能相互攻击',
        testMode: 'metadata'
      })
    })

    const result = await response.json()
    
    if (result.success && result.results.toolSuggestions) {
      const suggestions = result.results.toolSuggestions
      
      console.log('🔧 工具元数据服务建议:')
      if (suggestions.length === 0) {
        console.log('  无建议')
      } else {
        suggestions.forEach((suggestion, index) => {
          console.log(`  ${index + 1}. ${suggestion.toolName}`)
          console.log(`     置信度: ${(suggestion.confidence * 100).toFixed(1)}%`)
          console.log(`     关键词: ${suggestion.keywords?.join(', ') || '无'}`)
        })
      }
      
      // 分析问题
      console.log('\n🔍 问题分析:')
      const hasQueensTool = suggestions.some(s => s.toolName === 'solve_n_queens')
      const has24PointTool = suggestions.some(s => s.toolName === 'solve_24_point_game')
      
      if (!hasQueensTool) {
        console.log('❌ 没有识别出solve_n_queens工具')
      } else {
        console.log('✅ 正确识别出solve_n_queens工具')
      }
      
      if (has24PointTool) {
        console.log('❌ 错误识别出solve_24_point_game工具')
      } else {
        console.log('✅ 没有错误识别solve_24_point_game工具')
      }
      
    } else {
      console.log('❌ 无法获取工具建议')
      console.log(JSON.stringify(result, null, 2))
    }

  } catch (error) {
    console.error('❌ 测试出错:', error.message)
  }
}

testMetadataService().catch(console.error)