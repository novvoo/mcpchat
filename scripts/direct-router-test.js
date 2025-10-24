// 直接测试智能路由器（绕过API）

const fetchFn = globalThis.fetch

async function directRouterTest() {
  console.log('=== 直接测试智能路由器 ===\n')

  const baseUrl = 'http://localhost:3000'
  const testMessage = '如何从 8、8、4、13 从简单的加减乘除运算得到 24'

  try {
    // 创建一个特殊的测试端点来直接调用智能路由器
    console.log('测试消息:', testMessage)
    console.log()

    // 测试不同的配置
    const configs = [
      { 
        name: '低阈值 + 禁用LLM回退',
        enableMCPFirst: true, 
        enableLLMFallback: false, 
        mcpConfidenceThreshold: 0.1 
      },
      { 
        name: '低阈值 + 启用LLM回退',
        enableMCPFirst: true, 
        enableLLMFallback: true, 
        mcpConfidenceThreshold: 0.1 
      },
      { 
        name: '默认阈值 + 禁用LLM回退',
        enableMCPFirst: true, 
        enableLLMFallback: false, 
        mcpConfidenceThreshold: 0.4 
      },
      { 
        name: '默认阈值 + 启用LLM回退',
        enableMCPFirst: true, 
        enableLLMFallback: true, 
        mcpConfidenceThreshold: 0.4 
      }
    ]

    for (const config of configs) {
      console.log(`测试配置: ${config.name}`)
      console.log(`  MCP优先: ${config.enableMCPFirst}`)
      console.log(`  LLM回退: ${config.enableLLMFallback}`)
      console.log(`  置信度阈值: ${config.mcpConfidenceThreshold * 100}%`)

      // 使用诊断API来调用智能路由器
      const response = await fetchFn(`${baseUrl}/api/diagnose-mcp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'test_smart_router',
          message: testMessage,
          options: config
        })
      })

      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          console.log(`  结果: ${result.result ? '成功' : '失败'}`)
          if (result.result) {
            console.log(`    来源: ${result.result.source}`)
            console.log(`    置信度: ${result.result.confidence ? (result.result.confidence * 100).toFixed(1) + '%' : '无'}`)
            console.log(`    推理: ${result.result.reasoning}`)
          }
        } else {
          console.log(`  失败: ${result.error}`)
        }
      } else {
        console.log(`  API调用失败: ${response.status}`)
      }
      
      console.log()
    }

  } catch (error) {
    console.error('测试过程中出错:', error)
  }
}

// 运行测试
directRouterTest().catch(console.error)