#!/usr/bin/env node

/**
 * 快速测试置信度修复效果
 */

const testCases = [
  {
    input: "run example basic",
    expectedTool: "run_example",
    expectedParam: "example_name"
  },
  {
    input: "解决8皇后问题", 
    expectedTool: "solve_n_queens",
    expectedParam: "n"
  },
  {
    input: "echo hello world",
    expectedTool: "echo", 
    expectedParam: "message"
  }
]

async function testIntent(input) {
  try {
    const response = await fetch('http://localhost:3000/api/test-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userInput: input })
    })
    
    const data = await response.json()
    return data
  } catch (error) {
    console.error(`测试失败: ${input}`, error.message)
    return null
  }
}

async function runTests() {
  console.log('🧪 开始置信度修复测试...\n')
  
  for (const testCase of testCases) {
    console.log(`📝 测试: "${testCase.input}"`)
    
    const result = await testIntent(testCase.input)
    
    if (result && result.success) {
      const intent = result.intent
      console.log(`   ✅ 置信度: ${(intent.confidence * 100).toFixed(1)}%`)
      console.log(`   🎯 建议工具: ${intent.suggestedTool || '无'}`)
      console.log(`   🤔 需要MCP: ${intent.needsMCP ? '是' : '否'}`)
      console.log(`   💭 推理: ${intent.reasoning}`)
      
      // 验证期望结果
      if (intent.suggestedTool === testCase.expectedTool) {
        console.log(`   ✅ 工具匹配正确`)
      } else {
        console.log(`   ❌ 工具匹配错误，期望: ${testCase.expectedTool}`)
      }
      
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
    const response = await fetch('http://localhost:3000/api/test-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userInput: 'test' })
    })
    return response.ok || response.status === 400 // 400也表示服务器在运行
  } catch (error) {
    return false
  }
}

async function main() {
  const serverRunning = await checkServer()
  
  if (!serverRunning) {
    console.log('❌ 服务器未运行，请先启动开发服务器:')
    console.log('   npm run dev')
    console.log('   然后访问: http://localhost:3000/admin/confidence-test')
    return
  }
  
  await runTests()
}

main().catch(console.error)