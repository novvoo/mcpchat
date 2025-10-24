#!/usr/bin/env node

// 调试24点游戏识别

async function debug24PointRecognition() {
  console.log('🎯 调试24点游戏识别...\n')

  try {
    const response = await fetch('http://localhost:3000/api/test-smart-router', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: '如何从 8、8、4、13 从简单的加减乘除运算得到 24',
        testMode: 'intent'
      })
    })

    const result = await response.json()
    
    if (result.success && result.results.intentRecognition) {
      const intent = result.results.intentRecognition
      
      console.log('📋 意图识别结果:')
      console.log(`  需要MCP: ${intent.needsMCP}`)
      console.log(`  建议工具: ${intent.suggestedTool || '无'}`)
      console.log(`  置信度: ${intent.confidence ? (intent.confidence * 100).toFixed(1) + '%' : '无'}`)
      console.log(`  参数: ${JSON.stringify(intent.parameters)}`)
      console.log(`  推理: ${intent.reasoning}`)
      
    } else {
      console.log('❌ 测试失败')
      console.log(JSON.stringify(result, null, 2))
    }

  } catch (error) {
    console.error('❌ 测试出错:', error.message)
  }
}

debug24PointRecognition().catch(console.error)