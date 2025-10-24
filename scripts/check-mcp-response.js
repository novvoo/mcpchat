#!/usr/bin/env node

// 检查MCP工具的具体响应内容

async function checkMCPResponse() {
  console.log('🔍 检查MCP工具响应内容...\n')

  const testMessage = '如何从 8、8、4、13 从简单的加减乘除运算得到 24'
  console.log(`测试消息: "${testMessage}"\n`)

  try {
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

    const result = await response.json()
    
    if (result.success && result.results.smartRouterResult) {
      const routerResult = result.results.smartRouterResult
      
      console.log('📄 完整响应内容:')
      console.log('=' .repeat(50))
      console.log(routerResult.response)
      console.log('=' .repeat(50))
      console.log()
      
      console.log('📊 响应分析:')
      console.log(`  响应长度: ${routerResult.response.length} 字符`)
      console.log(`  来源: ${routerResult.source}`)
      console.log(`  置信度: ${routerResult.confidence ? (routerResult.confidence * 100).toFixed(1) + '%' : '无'}`)
      console.log()
      
      if (routerResult.toolResults && routerResult.toolResults.length > 0) {
        console.log('🔧 工具执行结果:')
        routerResult.toolResults.forEach((toolResult, index) => {
          console.log(`  工具 ${index + 1}:`)
          console.log(`    ID: ${toolResult.toolCallId}`)
          console.log(`    结果: ${JSON.stringify(toolResult.result, null, 2)}`)
          if (toolResult.error) {
            console.log(`    错误: ${toolResult.error}`)
          }
        })
        console.log()
      }
      
      // 检查是否是错误响应
      if (routerResult.response.includes('❌') || routerResult.response.includes('错误') || routerResult.response.includes('失败')) {
        console.log('⚠️  检测到错误响应')
        
        // 尝试直接调用工具来获取更详细的错误信息
        console.log('\n🔧 尝试直接调用solve_24_point_game工具...')
        
        try {
          const directResponse = await fetch('http://localhost:3000/api/mcp-tools', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              toolName: 'solve_24_point_game',
              parameters: {
                numbers: [8, 8, 4, 13]
              }
            })
          })
          
          if (directResponse.ok) {
            const directResult = await directResponse.json()
            console.log('直接调用结果:', JSON.stringify(directResult, null, 2))
          } else {
            console.log('直接调用失败:', directResponse.status, directResponse.statusText)
          }
        } catch (error) {
          console.log('直接调用出错:', error.message)
        }
      }
      
    } else {
      console.log('❌ 无法获取智能路由结果')
      console.log('完整结果:', JSON.stringify(result, null, 2))
    }

  } catch (error) {
    console.error('❌ 检查过程中出错:', error)
  }
}

// 运行检查
checkMCPResponse().catch(console.error)