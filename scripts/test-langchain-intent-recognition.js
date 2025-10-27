// 测试LangChain意图识别功能 - 通过API调用

console.log('=== 测试LangChain意图识别功能 ===\n')

async function testLangChainIntentRecognition() {
  const testMessages = [
    '如何从 8、8、4、13 从简单的加减乘除运算得到 24,每个数都用一次',
    '用8,8,4,13这四个数字通过加减乘除得到24',
    '请帮我解决这个数独问题',
    '8皇后问题怎么解决',
    '什么是24点游戏？',
    '给我一个Python代码示例'
  ]

  const baseUrl = 'http://localhost:3000'
  
  console.log('正在测试LangChain意图识别API...')
  console.log(`API端点: ${baseUrl}/api/test-intent`)
  console.log()

  for (const message of testMessages) {
    console.log(`\n测试消息: "${message}"`)
    console.log('=' .repeat(60))

    try {
      const response = await fetch(`${baseUrl}/api/test-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message })
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const result = await response.json()
      
      console.log('\n🔧 处理器状态:')
      console.log('  已初始化:', result.processor_status.initialized)
      console.log('  有LLM:', result.processor_status.hasLLM)
      
      console.log('\n🔍 分词识别结果:')
      console.log('  分词:', result.tokenized_result.tokens.slice(0, 10).join(', '))
      console.log('  实体数量:', result.tokenized_result.entities.length)
      
      // 显示重要实体
      const importantEntities = result.tokenized_result.entities.filter(e => e.confidence > 0.7)
      if (importantEntities.length > 0) {
        console.log('  重要实体:')
        importantEntities.forEach(entity => {
          console.log(`    - ${entity.text} (${entity.type}, 置信度: ${entity.confidence.toFixed(2)})`)
        })
      }
      
      console.log('\n🎯 意图分析:')
      console.log('  主要意图:', result.tokenized_result.intent.primary)
      if (result.tokenized_result.intent.secondary) {
        console.log('  次要意图:', result.tokenized_result.intent.secondary)
      }
      console.log('  置信度:', result.tokenized_result.intent.confidence.toFixed(2))
      
      console.log('\n📊 上下文分析:')
      console.log('  领域:', result.tokenized_result.context.domain)
      console.log('  复杂度:', result.tokenized_result.context.complexity)
      console.log('  语言:', result.tokenized_result.context.language)
      
      // 语义分析
      if (result.semantic_analysis) {
        console.log('\n💭 语义分析:')
        console.log('  情感:', result.semantic_analysis.sentiment)
        console.log('  紧急程度:', result.semantic_analysis.urgency)
        console.log('  清晰度:', result.semantic_analysis.clarity.toFixed(2))
      }

      // 工具建议
      console.log('\n🔧 工具建议:')
      console.log('  需要MCP工具:', result.tool_suggestion.needed ? '是' : '否')
      if (result.tool_suggestion.needed) {
        console.log('  建议工具:', result.tool_suggestion.suggestedTool)
        console.log('  置信度:', result.tool_suggestion.confidence.toFixed(2))
        console.log('  理由:', result.tool_suggestion.reasoning)
        if (result.tool_suggestion.parameters) {
          console.log('  参数:', JSON.stringify(result.tool_suggestion.parameters))
        }
      }

    } catch (error) {
      console.error('❌ 测试失败:', error.message)
      
      if (error.message.includes('fetch')) {
        console.log('💡 提示: 请确保开发服务器正在运行 (npm run dev)')
        console.log('   并且可以访问 http://localhost:3000')
      }
    }
  }

  console.log('\n✅ LangChain意图识别测试完成！')
  console.log('\n📝 说明:')
  console.log('- 如果看到"有LLM: false"，说明使用的是Mock模式（离线工作）')
  console.log('- 如果看到"有LLM: true"，说明连接到了真实的OpenAI API')
  console.log('- Mock模式仍然可以进行基本的意图识别和工具匹配')
}

// 运行测试
testLangChainIntentRecognition().catch(console.error)