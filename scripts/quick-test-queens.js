#!/usr/bin/env node

// 快速测试N皇后问题

async function quickTestQueens() {
  console.log('♛ 快速测试N皇后问题...\n')

  try {
    const response = await fetch('http://localhost:3000/api/test-smart-router', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: '在6×6的国际象棋棋盘上放置2个皇后，使得它们不能相互攻击',
        testMode: 'intent'
      })
    })

    const result = await response.json()
    
    if (result.success && result.results.intentRecognition) {
      const intent = result.results.intentRecognition
      
      console.log('✅ 意图识别成功!')
      console.log(`🔧 建议工具: ${intent.suggestedTool}`)
      console.log(`📊 置信度: ${intent.confidence ? (intent.confidence * 100).toFixed(1) + '%' : '无'}`)
      console.log(`📋 参数: ${JSON.stringify(intent.parameters)}`)
      console.log(`💭 推理: ${intent.reasoning}`)
      
    } else {
      console.log('❌ 测试失败')
      console.log(JSON.stringify(result, null, 2))
    }

  } catch (error) {
    console.error('❌ 测试出错:', error.message)
  }
}

quickTestQueens().catch(console.error)