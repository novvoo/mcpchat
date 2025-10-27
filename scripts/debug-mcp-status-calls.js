#!/usr/bin/env node

// Debug MCP Status API Calls - 调试MCP状态API调用

const http = require('http')
const url = require('url')

console.log('🔍 开始监控 /api/mcp/status 的调用...')
console.log('时间戳格式: [HH:MM:SS.mmm]')
console.log('---')

// 创建一个简单的代理服务器来监控请求
const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true)
  
  if (parsedUrl.pathname === '/api/mcp/status') {
    const timestamp = new Date().toLocaleTimeString('zh-CN', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
      fractionalSecondDigits: 3
    })
    
    console.log(`[${timestamp}] ${req.method} /api/mcp/status`)
    console.log(`  User-Agent: ${req.headers['user-agent'] || 'Unknown'}`)
    console.log(`  Referer: ${req.headers.referer || 'None'}`)
    console.log(`  Origin: ${req.headers.origin || 'None'}`)
    console.log('---')
  }
  
  // 转发请求到实际的Next.js服务器
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: req.url,
    method: req.method,
    headers: req.headers
  }
  
  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers)
    proxyRes.pipe(res)
  })
  
  proxyReq.on('error', (err) => {
    console.error('代理请求错误:', err)
    res.writeHead(500)
    res.end('代理错误')
  })
  
  req.pipe(proxyReq)
})

server.listen(3001, () => {
  console.log('代理服务器运行在 http://localhost:3001')
  console.log('请将浏览器指向 http://localhost:3001 来监控API调用')
  console.log('按 Ctrl+C 停止监控')
})

// 同时直接监控API调用频率
let callCount = 0
let lastCallTime = Date.now()

const checkApiCalls = async () => {
  try {
    const startTime = Date.now()
    const response = await fetch('http://localhost:3000/api/mcp/status')
    const endTime = Date.now()
    
    callCount++
    const timeSinceLastCall = startTime - lastCallTime
    lastCallTime = startTime
    
    const timestamp = new Date(startTime).toLocaleTimeString('zh-CN', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
      fractionalSecondDigits: 3
    })
    
    console.log(`[${timestamp}] 直接调用 #${callCount} (间隔: ${timeSinceLastCall}ms, 响应时间: ${endTime - startTime}ms)`)
    
    if (response.ok) {
      const data = await response.json()
      if (data.success && data.data) {
        console.log(`  状态: ${data.data.ready ? '就绪' : '未就绪'} | 工具: ${data.data.details?.totalTools || 0}`)
      }
    } else {
      console.log(`  错误: HTTP ${response.status}`)
    }
    
  } catch (error) {
    console.log(`[${new Date().toLocaleTimeString()}] 调用失败:`, error.message)
  }
}

// 每5秒检查一次API调用
const interval = setInterval(checkApiCalls, 5000)

// 优雅退出
process.on('SIGINT', () => {
  console.log('\n停止监控...')
  clearInterval(interval)
  server.close(() => {
    console.log('代理服务器已关闭')
    process.exit(0)
  })
})

// 立即执行一次检查
checkApiCalls()