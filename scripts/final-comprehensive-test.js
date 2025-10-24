#!/usr/bin/env node

// 最终综合测试

async function finalComprehensiveTest() {
  console.log('🎯 最终综合测试...\n')

  const testCases = [
    {
      name: '24点游戏',
      message: '如何从 8、8、4、13 从简单的加减乘除运算得到 24',
      expectedTool: 'solve_24_point_game',
      expectedParams: { numbers: [8, 8, 4, 13] }
    },
    {
      name: 'N皇后问题',
      message: '在6×6的国际象棋棋盘上放置2个皇后，使得它们不能相互攻击',
      expectedTool: 'solve_n_queens',
      expectedParams: { n: 6 }
    },
    {
      name: '信息查询（应该用LLM）',
      message: '什么是N皇后问题？',
      expectedTool: null, // 应该不使用工具
      expectedSource: 'llm'
    }
  ]

  for (const testCase of testCases) {
    console.log(`📋 测试: ${testCase.name}`)
    console.log(`消息: "${testCase.message}"`)

    try {
      const response = await fetch('http://localhost:3000/api/test-smart-router', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: testCase.message,
          testMode: 'full'
        })
      })

      const result = await response.json()
      
      if (result.success) {
        const intent = result.results.intentRecognition
        const router = result.results.smartRouterResult

        console.log(`  🔧 识别工具: ${intent.suggestedTool || '无'}`)
        console.log(`  📊 置信度: ${intent.confidence ? (intent.confidence * 100).toFixed(1) + '%' : '无'}`)
        console.log(`  📋 参数: ${JSON.stringify(intent.parameters)}`)
        console.log(`  🎯 路由来源: ${router.source}`)

        // 验证结果
        let success = true
        if (testCase.expectedTool) {
          if (intent.suggestedTool !== testCase.expectedTool) {
            console.log(`  ❌ 工具识别错误: 期望 ${testCase.expectedTool}, 实际 ${intent.suggestedTool}`)
            success = false
          }
          if (router.source !== 'mcp') {
            console.log(`  ❌ 路由错误: 期望 mcp, 实际 ${router.source}`)
            success = false
          }
        } else if (testCase.expectedSource) {
          if (router.source !== testCase.expectedSource) {
            console.log(`  ❌ 路由错误: 期望 ${testCase.expectedSource}, 实际 ${router.source}`)
            success = false
          }
        }

        if (success) {
          console.log(`  ✅ 测试通过`)
        }
      } else {
        console.log(`  ❌ 测试失败: ${result.error}`)
      }

    } catch (error) {
      console.log(`  ❌ 测试出错: ${error.message}`)
    }

    console.log()
  }

  console.log('🎉 综合测试完成!')
}

finalComprehensiveTest().catch(console.error)