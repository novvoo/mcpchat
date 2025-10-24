#!/usr/bin/env node

// 诊断MCP工具识别问题

async function diagnoseMCPRecognition() {
  console.log('🔍 诊断MCP工具识别问题...\n')

  const testMessage = '如何从 8、8、4、13 从简单的加减乘除运算得到 24'
  console.log(`测试消息: "${testMessage}"\n`)

  try {
    // 测试API调用
    const response = await fetch('http://localhost:3000/api/test-smart-router', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: testMessage,
        testMode: 'full'
      })
    })

    if (!response.ok) {
      console.error(`❌ API调用失败: ${response.status} ${response.statusText}`)
      const errorText = await response.text()
      console.error('错误详情:', errorText)
      return
    }

    const result = await response.json()
    
    if (!result.success) {
      console.error('❌ 测试失败:', result.error)
      if (result.details) {
        console.error('详细信息:', result.details)
      }
      return
    }

    console.log('✅ API调用成功\n')

    // 分析意图识别结果
    if (result.results.intentRecognition) {
      const intent = result.results.intentRecognition
      console.log('📋 意图识别结果:')
      console.log(`  需要MCP: ${intent.needsMCP}`)
      console.log(`  建议工具: ${intent.suggestedTool || '无'}`)
      console.log(`  置信度: ${intent.confidence ? (intent.confidence * 100).toFixed(1) + '%' : '无'}`)
      console.log(`  推理: ${intent.reasoning || '无'}`)
      console.log()
    }

    // 分析工具建议
    if (result.results.toolSuggestions) {
      const suggestions = result.results.toolSuggestions
      console.log('🔧 工具建议:')
      if (suggestions.length === 0) {
        console.log('  无工具建议')
      } else {
        suggestions.forEach((suggestion, index) => {
          console.log(`  ${index + 1}. ${suggestion.toolName}`)
          console.log(`     置信度: ${(suggestion.confidence * 100).toFixed(1)}%`)
          console.log(`     关键词: ${suggestion.keywords?.join(', ') || '无'}`)
        })
      }
      console.log()
    }

    // 分析智能路由结果
    if (result.results.smartRouterResult) {
      const router = result.results.smartRouterResult
      console.log('🎯 智能路由结果:')
      console.log(`  来源: ${router.source}`)
      console.log(`  置信度: ${router.confidence ? (router.confidence * 100).toFixed(1) + '%' : '无'}`)
      console.log(`  推理: ${router.reasoning || '无'}`)
      console.log(`  响应长度: ${router.response?.length || 0} 字符`)
      console.log()
    }

    if (result.results.smartRouterError) {
      const error = result.results.smartRouterError
      console.log('❌ 智能路由错误:')
      console.log(`  消息: ${error.message}`)
      if (error.stack) {
        console.log(`  堆栈: ${error.stack.split('\n').slice(0, 5).join('\n')}`)
      }
      console.log()
    }

    // 问题诊断
    console.log('🔍 问题诊断:')
    
    const intent = result.results.intentRecognition
    const suggestions = result.results.toolSuggestions || []
    const routerResult = result.results.smartRouterResult
    
    if (!intent?.needsMCP) {
      console.log('❌ 问题1: 意图识别器认为不需要MCP工具')
      console.log('   可能原因: 关键词匹配不足或置信度过低')
    }
    
    if (suggestions.length === 0) {
      console.log('❌ 问题2: 工具元数据服务没有返回建议')
      console.log('   可能原因: 数据库中缺少关键词映射')
    }
    
    if (!intent?.suggestedTool) {
      console.log('❌ 问题3: 没有建议的工具')
      console.log('   可能原因: 置信度低于阈值')
    }
    
    if (routerResult?.source === 'llm') {
      console.log('❌ 问题4: 智能路由选择了LLM而不是MCP工具')
      console.log('   可能原因: MCP工具识别失败或执行失败')
    }

    // 建议解决方案
    console.log('\n💡 建议解决方案:')
    console.log('1. 检查数据库中是否有24点游戏的关键词映射')
    console.log('2. 降低置信度阈值进行测试')
    console.log('3. 检查MCP工具是否正常可用')
    console.log('4. 验证工具元数据服务是否正常工作')

  } catch (error) {
    console.error('❌ 诊断过程中出错:', error)
  }
}

// 运行诊断
diagnoseMCPRecognition().catch(console.error)