/**
 * 模拟前端调用 /api/mcp-config
 * 测试 API 是否能正确返回数据
 */

const http = require('http')

console.log('🧪 测试 /api/mcp-config API 调用...\n')

// 注意：这个测试需要应用正在运行
// 运行前请先启动: npm run dev

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/mcp-config',
  method: 'GET',
  headers: {
    'Content-Type': 'application/json'
  }
}

console.log('📡 发送请求到: http://localhost:3000/api/mcp-config\n')

const req = http.request(options, (res) => {
  let data = ''

  res.on('data', (chunk) => {
    data += chunk
  })

  res.on('end', () => {
    console.log(`状态码: ${res.statusCode}\n`)
    
    if (res.statusCode === 200) {
      try {
        const json = JSON.parse(data)
        console.log('✅ API 响应成功！\n')
        console.log('响应数据:')
        console.log(JSON.stringify(json, null, 2))
        
        if (json.mcpServers && Object.keys(json.mcpServers).length > 0) {
          console.log(`\n找到 ${Object.keys(json.mcpServers).length} 个 MCP 服务器`)
          Object.keys(json.mcpServers).forEach(name => {
            console.log(`  - ${name}`)
          })
        } else {
          console.log('\n⚠️  没有找到 MCP 服务器配置')
        }
      } catch (e) {
        console.error('❌ 解析 JSON 失败:', e.message)
        console.log('原始响应:', data)
      }
    } else {
      console.error('❌ API 返回错误')
      console.log('响应:', data)
    }
  })
})

req.on('error', (error) => {
  console.error('❌ 请求失败:', error.message)
  console.log('\n💡 请确保应用正在运行: npm run dev')
})

req.end()
