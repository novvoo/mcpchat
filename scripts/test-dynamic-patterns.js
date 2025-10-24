#!/usr/bin/env node

// Test Dynamic Pattern Learning - 测试动态模式学习功能

const fetch = require('node-fetch')

const BASE_URL = 'http://localhost:3000'

async function testDynamicPatterns() {
  console.log('🧪 Testing Dynamic Pattern Learning...\n')

  try {
    // 1. 初始化动态模式学习器
    console.log('1️⃣ 初始化动态模式学习器...')
    const initResponse = await fetch(`${BASE_URL}/api/admin/dynamic-patterns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'initialize' })
    })
    const initResult = await initResponse.json()
    console.log('✅ 初始化结果:', initResult.success ? '成功' : '失败')
    if (!initResult.success) {
      console.error('❌ 初始化失败:', initResult.error)
    }
    console.log()

    // 2. 从现有工具学习模式
    console.log('2️⃣ 从现有工具学习模式...')
    const learnResponse = await fetch(`${BASE_URL}/api/admin/dynamic-patterns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'learn_from_tools' })
    })
    const learnResult = await learnResponse.json()
    
    if (learnResult.success) {
      console.log('✅ 学习完成!')
      console.log(`📊 新关键词: ${learnResult.data.newKeywords.length} 个`)
      console.log(`🔄 更新模式: ${learnResult.data.updatedPatterns.length} 个`)
      console.log(`🎯 平均置信度: ${(learnResult.data.confidence * 100).toFixed(1)}%`)
      
      if (learnResult.data.newKeywords.length > 0) {
        console.log('🔤 新关键词示例:')
        learnResult.data.newKeywords.slice(0, 10).forEach((keyword, index) => {
          console.log(`   ${index + 1}. ${keyword}`)
        })
        if (learnResult.data.newKeywords.length > 10) {
          console.log(`   ... 还有 ${learnResult.data.newKeywords.length - 10} 个`)
        }
      }
    } else {
      console.error('❌ 学习失败:', learnResult.error)
    }
    console.log()

    // 3. 获取学习到的模式
    console.log('3️⃣ 获取学习到的模式...')
    const patternsResponse = await fetch(`${BASE_URL}/api/admin/dynamic-patterns?action=patterns`)
    const patternsResult = await patternsResponse.json()
    
    if (patternsResult.success) {
      console.log(`✅ 获取到 ${patternsResult.data.total} 个模式:`)
      patternsResult.data.patterns.slice(0, 5).forEach((pattern, index) => {
        console.log(`   ${index + 1}. ${pattern.pattern}`)
        console.log(`      关键词: ${pattern.keywords.slice(0, 5).join(', ')}${pattern.keywords.length > 5 ? '...' : ''}`)
        console.log(`      置信度: ${(pattern.confidence * 100).toFixed(1)}% | 使用次数: ${pattern.usage_count}`)
        console.log(`      示例: ${pattern.examples.slice(0, 2).join(', ')}${pattern.examples.length > 2 ? '...' : ''}`)
        console.log()
      })
      if (patternsResult.data.patterns.length > 5) {
        console.log(`   ... 还有 ${patternsResult.data.patterns.length - 5} 个模式`)
      }
    } else {
      console.error('❌ 获取模式失败:', patternsResult.error)
    }
    console.log()

    // 4. 获取统计信息
    console.log('4️⃣ 获取学习统计信息...')
    const statsResponse = await fetch(`${BASE_URL}/api/admin/dynamic-patterns?action=stats`)
    const statsResult = await statsResponse.json()
    
    if (statsResult.success) {
      const stats = statsResult.data
      console.log('✅ 统计信息:')
      console.log(`   📊 总模式数: ${stats.totalPatterns}`)
      console.log(`   🔤 总关键词数: ${stats.totalKeywords}`)
      console.log(`   🎯 平均置信度: ${(stats.avgConfidence * 100).toFixed(1)}%`)
      console.log(`   📈 总使用次数: ${stats.totalUsage}`)
      
      if (stats.recentLearning && stats.recentLearning.length > 0) {
        console.log('   📝 最近学习活动:')
        stats.recentLearning.slice(0, 3).forEach((activity, index) => {
          console.log(`      ${index + 1}. ${activity.toolName}: ${activity.keywordCount} 个关键词 (${(activity.confidence * 100).toFixed(1)}%)`)
        })
      }
    } else {
      console.error('❌ 获取统计失败:', statsResult.error)
    }
    console.log()

    // 5. 测试用户反馈学习
    console.log('5️⃣ 测试用户反馈学习...')
    const feedbackTests = [
      { toolName: 'solve_n_queens', userInput: '解决8皇后问题', success: true },
      { toolName: 'run_example', userInput: '运行线性规划示例', success: true },
      { toolName: 'solve_sudoku', userInput: '解数独游戏', success: true }
    ]

    for (const test of feedbackTests) {
      const feedbackResponse = await fetch(`${BASE_URL}/api/admin/dynamic-patterns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_from_feedback',
          ...test
        })
      })
      const feedbackResult = await feedbackResponse.json()
      
      if (feedbackResult.success) {
        console.log(`✅ 反馈学习成功: "${test.userInput}" -> ${test.toolName}`)
      } else {
        console.error(`❌ 反馈学习失败: ${feedbackResult.error}`)
      }
    }
    console.log()

    // 6. 刷新工具元数据
    console.log('6️⃣ 刷新工具元数据...')
    const refreshResponse = await fetch(`${BASE_URL}/api/admin/dynamic-patterns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'refresh_metadata' })
    })
    const refreshResult = await refreshResponse.json()
    
    if (refreshResult.success) {
      console.log('✅ 工具元数据刷新成功')
    } else {
      console.error('❌ 刷新失败:', refreshResult.error)
    }
    console.log()

    // 7. 测试智能路由效果
    console.log('7️⃣ 测试智能路由效果...')
    const routingTests = [
      '解决8皇后问题',
      '运行线性规划示例',
      '解数独',
      '安装gurddy包',
      '优化投资组合'
    ]

    for (const testInput of routingTests) {
      try {
        const routingResponse = await fetch(`${BASE_URL}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: testInput })
        })
        const routingResult = await routingResponse.json()
        
        if (routingResult.success) {
          console.log(`✅ "${testInput}" -> ${routingResult.source} (置信度: ${routingResult.confidence ? (routingResult.confidence * 100).toFixed(1) + '%' : 'N/A'})`)
        } else {
          console.log(`❌ "${testInput}" -> 路由失败`)
        }
      } catch (error) {
        console.log(`❌ "${testInput}" -> 测试失败: ${error.message}`)
      }
    }

  } catch (error) {
    console.error('❌ 测试过程中出现错误:', error)
  }
}

// 运行测试
if (require.main === module) {
  testDynamicPatterns()
    .then(() => {
      console.log('\n✅ 动态模式学习测试完成')
      process.exit(0)
    })
    .catch(error => {
      console.error('\n❌ 测试失败:', error)
      process.exit(1)
    })
}

module.exports = { testDynamicPatterns }