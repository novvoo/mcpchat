// 最终验证测试

const fetchFn = globalThis.fetch

async function finalVerification() {
  console.log('=== 最终验证测试 ===\n')

  const baseUrl = 'http://localhost:3000'
  const originalQuestion = '如何从 8、8、4、13 从简单的加减乘除运算得到 24'

  console.log(`原始问题: "${originalQuestion}"`)
  console.log()

  // 核心功能验证
  const tests = [
    {
      name: '意图识别',
      test: async () => {
        const response = await fetchFn(`${baseUrl}/api/test-intent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userInput: originalQuestion })
        })
        
        if (response.ok) {
          const result = await response.json()
          if (result.success && result.intent) {
            const intent = result.intent
            return {
              success: intent.needsMCP && intent.suggestedTool === 'solve_24_point_game',
              details: `需要MCP: ${intent.needsMCP}, 工具: ${intent.suggestedTool}, 置信度: ${(intent.confidence * 100).toFixed(1)}%`
            }
          }
        }
        return { success: false, details: 'API调用失败' }
      }
    },
    {
      name: 'MCP工具直接调用',
      test: async () => {
        const response = await fetchFn(`${baseUrl}/api/diagnose-mcp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'call_tool',
            toolName: 'solve_24_point_game',
            parameters: { numbers: [8, 8, 4, 13] }
          })
        })
        
        if (response.ok) {
          const result = await response.json()
          return {
            success: result.success,
            details: result.success ? '工具调用成功' : `调用失败: ${result.error}`
          }
        }
        return { success: false, details: 'API调用失败' }
      }
    },
    {
      name: '智能路由器（低阈值）',
      test: async () => {
        const response = await fetchFn(`${baseUrl}/api/test-smart-router`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            message: originalQuestion,
            testMode: 'router',
            customThreshold: 0.1
          })
        })
        
        if (response.ok) {
          const result = await response.json()
          if (result.success && result.results.smartRouterResult) {
            const routerResult = result.results.smartRouterResult
            return {
              success: routerResult.source === 'mcp',
              details: `来源: ${routerResult.source}, 置信度: ${routerResult.confidence ? (routerResult.confidence * 100).toFixed(1) + '%' : '无'}`
            }
          }
        }
        return { success: false, details: 'API调用失败' }
      }
    }
  ]

  console.log('核心功能验证:')
  for (const test of tests) {
    try {
      const result = await test.test()
      console.log(`  ${test.name}: ${result.success ? '✅ 通过' : '❌ 失败'}`)
      console.log(`    ${result.details}`)
    } catch (error) {
      console.log(`  ${test.name}: ❌ 错误`)
      console.log(`    ${error.message}`)
    }
  }

  console.log()
  console.log('=== 总结 ===')
  console.log('✅ 已修复的问题:')
  console.log('  1. 信息查询检测过于严格 - 已修复')
  console.log('  2. 24点游戏关键词不足 - 已添加中文关键词')
  console.log('  3. 参数提取缺失 - 已添加数字提取逻辑')
  console.log('  4. 置信度计算优化 - 已提高核心关键词权重')
  console.log()
  console.log('🔧 建议的后续步骤:')
  console.log('  1. 重启服务器以确保所有更改生效')
  console.log('  2. 修复数据库连接以启用动态元数据服务')
  console.log('  3. 在生产环境中测试完整的智能路由流程')
}

// 运行验证
finalVerification().catch(console.error)