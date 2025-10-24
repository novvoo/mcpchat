#!/usr/bin/env node

// 快速测试24点游戏工具识别和响应格式化

async function quickTest() {
  console.log('🎯 快速测试24点游戏...\n')

  try {
    const response = await fetch('http://localhost:3000/api/test-smart-router', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: '如何从 8、8、4、13 从简单的加减乘除运算得到 24',
        testMode: 'router'
      })
    })

    const result = await response.json()
    
    if (result.success && result.results.smartRouterResult) {
      const routerResult = result.results.smartRouterResult
      
      console.log('✅ 测试成功!')
      console.log('📄 响应内容:')
      console.log('-'.repeat(60))
      console.log(routerResult.response)
      console.log('-'.repeat(60))
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

quickTest().catch(console.error)