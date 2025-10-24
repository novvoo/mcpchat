#!/usr/bin/env node

// 测试N皇后问题的工具识别

async function testQueensProblem() {
  console.log('♛ 测试N皇后问题...\n')

  const testMessage = '在6×6的国际象棋棋盘上放置2个皇后，使得它们不能相互攻击'
  console.log(`测试消息: "${testMessage}"\n`)

  try {
    const response = await fetch('http://localhost:3000/api/test-smart-router', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: testMessage,
        testMode: 'router'
      })
    })

    const result = await response.json()
    
    if (result.success && result.results.smartRouterResult) {
      const routerResult = result.results.smartRouterResult
      
      console.log('✅ 测试成功!')
      console.log('📄 响应内容:')
      console.log('-'.repeat(80))
      console.log(routerResult.response)
      console.log('-'.repeat(80))
      console.log(`\n📊 来源: ${routerResult.source}`)
      console.log(`📊 置信度: ${routerResult.confidence ? (routerResult.confidence * 100).toFixed(1) + '%' : '无'}`)
      
    } else {
      console.log('❌ 测试失败')
      console.log(JSON.stringify(result, null, 2))
    }

  } catch (error) {
    console.error('❌ 测试出错:', error.message)
  }
}

testQueensProblem().catch(console.error)