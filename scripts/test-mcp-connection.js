#!/usr/bin/env node

/**
 * MCP 连接测试脚本
 * 支持 stdio 和 http 两种传输方式
 */

const { spawn } = require('child_process')

// 配置
const config = {
  transport: process.argv[2] || 'stdio', // stdio 或 http
  
  // stdio 配置
  stdio: {
    command: process.argv[3] || 'gurddy-mcp',
    args: process.argv[4] ? process.argv[4].split(' ') : [],
    env: {}
  },
  
  // http 配置
  http: {
    url: process.argv[3] || 'http://localhost:3001'
  },
  
  // 测试方法
  method: 'initialize',
  params: {}
}

console.log('MCP 连接测试')
console.log('='.repeat(50))
console.log(`传输方式: ${config.transport}`)
console.log('='.repeat(50))

if (config.transport === 'stdio') {
  testStdio()
} else if (config.transport === 'http') {
  testHttp()
} else {
  console.error('错误: 不支持的传输方式:', config.transport)
  console.log('用法: node test-mcp-connection.js [stdio|http] [command/url] [args]')
  process.exit(1)
}

/**
 * 测试 stdio 传输
 */
function testStdio() {
  console.log(`命令: ${config.stdio.command} ${config.stdio.args.join(' ')}`)
  console.log('-'.repeat(50))
  
  const childProcess = spawn(config.stdio.command, config.stdio.args, {
    env: { ...process.env, ...config.stdio.env },
    stdio: ['pipe', 'pipe', 'pipe']
  })
  
  let responseBuffer = ''
  const requestId = 1
  
  // 超时处理
  const timeout = setTimeout(() => {
    console.error('✗ 超时: 10秒内未收到响应')
    childProcess.kill('SIGTERM')
    process.exit(1)
  }, 10000)
  
  // 处理错误
  childProcess.on('error', (error) => {
    clearTimeout(timeout)
    console.error('✗ 进程错误:', error.message)
    process.exit(1)
  })
  
  // 处理退出
  childProcess.on('exit', (code, signal) => {
    clearTimeout(timeout)
    if (code !== 0) {
      console.error(`✗ 进程异常退出 (code: ${code}, signal: ${signal})`)
      process.exit(1)
    }
  })
  
  // 处理 stderr
  childProcess.stderr.on('data', (data) => {
    const message = data.toString()
    if (message.toLowerCase().includes('error')) {
      console.error('stderr:', message)
    }
  })
  
  // 处理 stdout
  childProcess.stdout.on('data', (data) => {
    responseBuffer += data.toString()
    const lines = responseBuffer.split('\n')
    responseBuffer = lines.pop() || ''
    
    for (const line of lines) {
      if (!line.trim()) continue
      
      try {
        const response = JSON.parse(line)
        
        if (response.id === requestId) {
          clearTimeout(timeout)
          
          if (response.error) {
            console.error('✗ MCP 错误:', response.error.message || JSON.stringify(response.error))
            childProcess.kill('SIGTERM')
            process.exit(1)
          } else {
            console.log('✓ 连接成功!')
            console.log('\n响应:')
            console.log(JSON.stringify(response.result, null, 2))
            childProcess.kill('SIGTERM')
            process.exit(0)
          }
        }
      } catch (error) {
        // 忽略非 JSON 行
      }
    }
  })
  
  // 发送请求
  const request = {
    jsonrpc: '2.0',
    id: requestId,
    method: config.method,
    params: config.method === 'initialize' ? {
      protocolVersion: '2024-11-05',
      capabilities: { tools: {} },
      clientInfo: { name: 'test-script', version: '1.0.0' },
      ...config.params
    } : config.params
  }
  
  console.log('发送请求:', JSON.stringify(request))
  console.log('-'.repeat(50))
  
  childProcess.stdin.write(JSON.stringify(request) + '\n')
}

/**
 * 测试 http 传输
 */
async function testHttp() {
  console.log(`URL: ${config.http.url}`)
  console.log('-'.repeat(50))
  
  const request = {
    jsonrpc: '2.0',
    id: 1,
    method: config.method,
    params: config.method === 'initialize' ? {
      protocolVersion: '2024-11-05',
      capabilities: { tools: {} },
      clientInfo: { name: 'test-script', version: '1.0.0' },
      ...config.params
    } : config.params
  }
  
  console.log('发送请求:', JSON.stringify(request))
  console.log('-'.repeat(50))
  
  try {
    const response = await fetch(config.http.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(10000)
    })
    
    if (!response.ok) {
      const text = await response.text()
      console.error(`✗ HTTP 错误: ${response.status} ${response.statusText}`)
      console.error('响应:', text)
      process.exit(1)
    }
    
    const result = await response.json()
    
    if (result.error) {
      console.error('✗ MCP 错误:', result.error.message || JSON.stringify(result.error))
      process.exit(1)
    }
    
    console.log('✓ 连接成功!')
    console.log('\n响应:')
    console.log(JSON.stringify(result.result, null, 2))
    process.exit(0)
    
  } catch (error) {
    console.error('✗ 请求失败:', error.message)
    process.exit(1)
  }
}
