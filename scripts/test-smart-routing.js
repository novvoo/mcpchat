#!/usr/bin/env node

/**
 * 测试智能路由功能
 */

const testCases = [
  {
    name: "安装工具测试",
    message: "安装gurddy包",
    expectedTool: "install",
    testMode: "intent-only"
  },
  {
    name: "运行示例测试",
    message: "run example lp",
    expectedTool: "run_example",
    testMode: "full"
  },
  {
    name: "N皇后问题测试",
    message: "解决8皇后问题",
    expectedTool: "solve_n_queens",
    testMode: "intent-only"
  },
  {
    name: "信息查询测试",
    message: "什么是机器学习",
    expectedTool: null,
    testMode: "intent-only"
  }
]

async function testSmartRouting(testCase) {
  try {
    const response = await fetch('http://localhost:3000/api/mcp/test-smart-routing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: testCase.message,
        testMode: testCase.testMode
      })
    })
    
    const data = await response.json()
    return data
  } catch (error) {
    console.error(`测试失败: ${testCase.name}`, error.message)
    return null
  }
}

async function getStatus() {
  try {
    const response = await fetch('http://localhost:3000/api/mcp/test-smart-routing')
    const data = await response.json()
    return data
  } catch (error) {
    console.error('获取状态失败:', error.message)
    return null
  }
}

async function runTests() {
  console.log('🧪 开始智能路由测试...\n')
  
  // 首先检查状态
  console.log('📊 检查系统状态...')
  const status = await getStatus()
  
  if (status && status.success) {
    const data = status.data
    console.log(`   ✅ MCP连接: ${data.mcpConnected ? '已连接' : '未连接'}`)
    console.log(`   ✅ 可用工具: ${data.availableTools}个`)
    console.log(`   ✅ 意图识别: ${data.capabilities.intentRecognition ? '启用' : '禁用'}`)
    console.log(`   ✅ 混合模式: ${data.capabilities.hybridMode ? '启用' : '禁用'}`)
  } else {
    console.log('   ❌ 无法获取系统状态')
    return
  }
  
  console.log('\n🔍 开始功能测试...\n')
  
  for (const testCase of testCases) {
    console.log(`📝 测试: ${testCase.name}`)
    console.log(`   输入: "${testCase.message}"`)
    console.log(`   模式: ${testCase.testMode}`)
    
    const result = await testSmartRouting(testCase)
    
    if (result && result.success) {
      const data = result.data
      
      if (testCase.testMode === 'intent-only') {
        const intent = data.intent
        console.log(`   🎯 需要MCP: ${intent.needsMCP ? '是' : '否'}`)
        console.log(`   🎯 建议工具: ${intent.suggestedTool || '无'}`)
        console.log(`   🎯 置信度: ${(intent.confidence * 100).toFixed(1)}%`)
        
        // 验证期望结果
        if (intent.suggestedTool === testCase.expectedTool) {
          console.log(`   ✅ 工具匹配正确`)
        } else {
          console.log(`   ❌ 工具匹配错误，期望: ${testCase.expectedTool}，实际: ${intent.suggestedTool}`)
        }
      } else if (testCase.testMode === 'full') {
        console.log(`   🎯 处理方式: ${data.source}`)
        console.log(`   🎯 置信度: ${data.confidence ? (data.confidence * 100).toFixed(1) + '%' : 'N/A'}`)
        console.log(`   🎯 工具执行: ${data.toolResults ? data.toolResults.length + '个' : '0个'}`)
        
        if (data.source === 'mcp' && data.toolResults && data.toolResults.length > 0) {
          console.log(`   ✅ MCP工具执行成功`)
        } else if (data.source === 'llm') {
          console.log(`   ✅ LLM处理成功`)
        } else {
          console.log(`   ⚠️  处理结果异常`)
        }
      }
      
      console.log(`   💭 推理: ${data.intent?.reasoning || data.reasoning || 'N/A'}`)
      
    } else {
      console.log(`   ❌ 测试失败: ${result?.error || '未知错误'}`)
    }
    
    console.log('')
  }
  
  console.log('🎉 测试完成！')
}

// 检查服务器是否运行
async function checkServer() {
  try {
    const response = await fetch('http://localhost:3000/api/mcp/test-smart-routing')
    return response.ok
  } catch (error) {
    return false
  }
}

async function main() {
  const serverRunning = await checkServer()
  
  if (!serverRunning) {
    console.log('❌ 服务器未运行，请先启动开发服务器:')
    console.log('   npm run dev')
    console.log('   然后访问: http://localhost:3000/admin/test-smart-routing')
    return
  }
  
  await runTests()
}

main().catch(console.error)