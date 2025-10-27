#!/usr/bin/env node

// Test MCP Status Fix - 测试MCP状态修复

// 使用Node.js 18+的内置fetch

async function testMCPStatus() {
  console.log('🔍 测试MCP状态API...')
  
  try {
    const response = await fetch('http://localhost:3000/api/mcp/status')
    const data = await response.json()
    
    console.log('\n📊 API响应状态:', response.status)
    console.log('✅ 响应成功:', data.success)
    
    if (data.success && data.data) {
      const status = data.data
      console.log('\n🔧 MCP系统状态:')
      console.log('  - 系统就绪:', status.ready ? '✅' : '❌')
      console.log('  - 配置加载:', status.configLoaded ? '✅' : '❌')
      console.log('  - 服务器连接:', status.serversConnected ? '✅' : '❌')
      console.log('  - 工具加载:', status.toolsLoaded ? '✅' : '❌')
      console.log('  - 关键词映射:', status.keywordsMapped ? '✅' : '❌')
      
      if (status.details) {
        console.log('\n📈 详细信息:')
        console.log(`  - 服务器: ${status.details.connectedServers}/${status.details.totalServers}`)
        console.log(`  - 工具: ${status.details.totalTools}`)
        console.log(`  - 关键词映射: ${status.details.keywordMappings}`)
      }
      
      if (status.error) {
        console.log('\n❌ 错误信息:', status.error)
      }
      
      console.log('\n📝 状态消息:', status.statusMessage || '无')
      
    } else {
      console.log('❌ API返回失败:', data.error)
    }
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message)
  }
}

async function testMultipleRequests() {
  console.log('\n🔄 测试多次请求（检查是否频繁刷新）...')
  
  const startTime = Date.now()
  const requests = []
  
  for (let i = 0; i < 5; i++) {
    requests.push(
      fetch('http://localhost:3000/api/mcp/status')
        .then(res => res.json())
        .then(data => ({
          index: i + 1,
          ready: data.data?.ready,
          timestamp: data.data?.timestamp
        }))
    )
  }
  
  try {
    const results = await Promise.all(requests)
    const endTime = Date.now()
    
    console.log(`⏱️  总耗时: ${endTime - startTime}ms`)
    console.log('📊 请求结果:')
    
    results.forEach(result => {
      console.log(`  ${result.index}. 就绪: ${result.ready ? '✅' : '❌'} | 时间戳: ${result.timestamp}`)
    })
    
  } catch (error) {
    console.error('❌ 多次请求测试失败:', error.message)
  }
}

async function main() {
  console.log('🚀 开始MCP状态修复测试\n')
  
  await testMCPStatus()
  await testMultipleRequests()
  
  console.log('\n✨ 测试完成')
}

if (require.main === module) {
  main().catch(console.error)
}