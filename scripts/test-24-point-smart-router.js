// 测试Smart Router的24点游戏识别

async function test24PointSmartRouter() {
  console.log('=== 测试Smart Router的24点游戏识别 ===\n')

  const testMessage = '如何从 8、8、4、13 从简单的加减乘除运算得到 24,每个数都用一次'

  try {
    const response = await fetch('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: testMessage,
        useLangChain: true
      })
    })

    const result = await response.json()
    
    console.log('测试消息:', testMessage)
    console.log('\n响应结果:')
    console.log('- 成功:', result.success)
    console.log('- 来源:', result.source)
    console.log('- 置信度:', result.confidence)
    console.log('- 推理过程:', result.reasoning)
    
    if (result.toolResults && result.toolResults.length > 0) {
      console.log('- 工具执行结果:', result.toolResults[0])
    }
    
    console.log('\n完整响应:')
    console.log(result.data?.response)

  } catch (error) {
    console.error('测试失败:', error.message)
  }
}

// 运行测试
test24PointSmartRouter()