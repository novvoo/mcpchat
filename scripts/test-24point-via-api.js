#!/usr/bin/env node

// 通过API测试24点游戏

async function test24PointViaAPI() {
  console.log('🎯 通过API测试24点游戏...\n')
  console.log('测试数字: [9, 32, 15, 27]\n')

  try {
    // 测试1: 直接调用MCP工具
    console.log('📤 测试1: 直接调用MCP工具')
    const mcpResponse = await fetch('http://localhost:3000/api/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'call_tool',
        toolName: 'solve_24_point_game',
        parameters: {
          numbers: [9, 32, 15, 27]
        }
      })
    })

    const mcpResult = await mcpResponse.json()
    console.log('MCP响应:', JSON.stringify(mcpResult, null, 2))
    console.log()

    // 测试2: 通过智能路由
    console.log('📤 测试2: 通过智能路由')
    const routerResponse = await fetch('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'solve 24 point game with [9,32,15,27]',
        conversationId: 'test-' + Date.now()
      })
    })

    const routerResult = await routerResponse.json()
    console.log('路由响应:', JSON.stringify(routerResult, null, 2))
    console.log()

    // 测试3: 中文描述
    console.log('📤 测试3: 中文描述')
    const chineseResponse = await fetch('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: '如何从 9、32、15、27 从简单的加减乘除运算得到 24',
        conversationId: 'test-' + Date.now()
      })
    })

    const chineseResult = await chineseResponse.json()
    console.log('中文响应:', JSON.stringify(chineseResult, null, 2))

  } catch (error) {
    console.error('❌ 测试失败:', error.message)
  }
}

test24PointViaAPI().catch(console.error)
