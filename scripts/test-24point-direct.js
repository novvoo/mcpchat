#!/usr/bin/env node

// 直接测试24点游戏工具调用

const { spawn } = require('child_process')

async function test24PointGame() {
  console.log('🎯 测试24点游戏工具调用...\n')
  console.log('测试数字: [9, 32, 15, 27]\n')

  const process = spawn('gurddy-mcp', [], {
    stdio: ['pipe', 'pipe', 'pipe']
  })

  let responseBuffer = ''
  let requestId = 1

  process.stdout.on('data', (data) => {
    responseBuffer += data.toString()
    const lines = responseBuffer.split('\n')
    responseBuffer = lines.pop() || ''

    for (const line of lines) {
      if (!line.trim()) continue
      
      try {
        const response = JSON.parse(line)
        console.log('📥 收到响应:', JSON.stringify(response, null, 2))
        
        if (response.id === 1) {
          // Initialize成功，发送initialized通知
          console.log('\n📤 发送 notifications/initialized')
          const notification = JSON.stringify({
            jsonrpc: '2.0',
            method: 'notifications/initialized'
          }) + '\n'
          process.stdin.write(notification)
          
          // 调用24点游戏工具
          console.log('\n📤 调用 solve_24_point_game 工具')
          const toolCall = JSON.stringify({
            jsonrpc: '2.0',
            id: 2,
            method: 'tools/call',
            params: {
              name: 'solve_24_point_game',
              arguments: {
                numbers: [9, 32, 15, 27]
              }
            }
          }) + '\n'
          process.stdin.write(toolCall)
        } else if (response.id === 2) {
          // 工具调用结果
          console.log('\n✅ 工具调用完成!')
          if (response.result) {
            console.log('\n📊 结果:')
            if (response.result.content) {
              response.result.content.forEach(item => {
                if (item.type === 'text') {
                  console.log(item.text)
                }
              })
            } else {
              console.log(JSON.stringify(response.result, null, 2))
            }
          } else if (response.error) {
            console.log('\n❌ 错误:', response.error.message || JSON.stringify(response.error))
          }
          
          process.kill()
        }
      } catch (error) {
        console.error('解析响应失败:', line, error.message)
      }
    }
  })

  process.stderr.on('data', (data) => {
    const message = data.toString()
    if (message.toLowerCase().includes('error') || message.toLowerCase().includes('fail')) {
      console.error('❌ stderr:', message)
    }
  })

  process.on('error', (error) => {
    console.error('❌ 进程错误:', error.message)
  })

  process.on('exit', (code) => {
    console.log(`\n进程退出，代码: ${code}`)
  })

  // 发送initialize请求
  console.log('📤 发送 initialize 请求')
  const initRequest = JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {
        tools: {}
      },
      clientInfo: {
        name: 'test-script',
        version: '1.0.0'
      }
    }
  }) + '\n'
  
  process.stdin.write(initRequest)
}

test24PointGame().catch(console.error)
