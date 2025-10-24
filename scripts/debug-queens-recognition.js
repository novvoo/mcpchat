#!/usr/bin/env node

// 调试N皇后问题的识别

async function debugQueensRecognition() {
  console.log('🔍 调试N皇后问题识别...\n')

  const testMessage = '在6×6的国际象棋棋盘上放置2个皇后，使得它们不能相互攻击'
  console.log(`测试消息: "${testMessage}"\n`)

  try {
    const response = await fetch('http://localhost:3000/api/test-smart-router', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: testMessage,
        testMode: 'full'
      })
    })

    const result = await response.json()
    
    if (result.success) {
      console.log('📋 意图识别结果:')
      if (result.results.intentRecognition) {
        const intent = result.results.intentRecognition
        console.log(`  需要MCP: ${intent.needsMCP}`)
        console.log(`  建议工具: ${intent.suggestedTool || '无'}`)
        console.log(`  置信度: ${intent.confidence ? (intent.confidence * 100).toFixed(1) + '%' : '无'}`)
        console.log(`  推理: ${intent.reasoning || '无'}`)
      }
      console.log()

      console.log('🔧 工具建议:')
      if (result.results.toolSuggestions) {
        const suggestions = result.results.toolSuggestions
        if (suggestions.length === 0) {
          console.log('  无工具建议')
        } else {
          suggestions.forEach((suggestion, index) => {
            console.log(`  ${index + 1}. ${suggestion.toolName}`)
            console.log(`     置信度: ${(suggestion.confidence * 100).toFixed(1)}%`)
            console.log(`     关键词: ${suggestion.keywords?.join(', ') || '无'}`)
          })
        }
      }
      console.log()

      console.log('🎯 智能路由结果:')
      if (result.results.smartRouterResult) {
        const router = result.results.smartRouterResult
        console.log(`  来源: ${router.source}`)
        console.log(`  置信度: ${router.confidence ? (router.confidence * 100).toFixed(1) + '%' : '无'}`)
        console.log(`  推理: ${router.reasoning || '无'}`)
        console.log(`  响应预览: ${router.response?.substring(0, 100)}...`)
      }
      
    } else {
      console.log('❌ 测试失败')
      console.log(JSON.stringify(result, null, 2))
    }

  } catch (error) {
    console.error('❌ 测试出错:', error.message)
  }
}

debugQueensRecognition().catch(console.error)