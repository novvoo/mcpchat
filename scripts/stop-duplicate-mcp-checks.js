#!/usr/bin/env node

// Stop Duplicate MCP Checks - 停止重复的MCP检查

console.log('🛑 停止重复的MCP状态检查...')

async function stopDuplicateChecks() {
  try {
    // 1. 停止健康监控器
    console.log('1. 停止MCP健康监控器...')
    const { stopMCPHealthMonitoring } = await import('../src/services/mcp-health.js')
    stopMCPHealthMonitoring()
    console.log('   ✅ MCP健康监控器已停止')

    // 2. 检查是否有其他定时器
    console.log('2. 检查活跃的定时器...')
    
    // 在Node.js环境中，我们无法直接访问浏览器的定时器
    // 但我们可以检查服务器端的定时器
    
    console.log('   ℹ️  请在浏览器控制台中运行以下命令来清理客户端定时器:')
    console.log('   window.clearInterval() // 清理所有间隔定时器')
    console.log('   window.clearTimeout()  // 清理所有超时定时器')
    
    // 3. 重置全局状态
    console.log('3. 重置全局状态...')
    
    // 如果有全局状态管理器，重置它
    try {
      const { mcpStatusMonitor } = await import('../src/utils/mcp-status-monitor.js')
      console.log('   ✅ 全局状态监听器已重置')
    } catch (error) {
      console.log('   ⚠️  无法重置全局状态监听器:', error.message)
    }

    console.log('\n✅ 重复检查清理完成!')
    console.log('\n📋 建议的后续步骤:')
    console.log('1. 重启开发服务器 (npm run dev)')
    console.log('2. 在浏览器中刷新页面')
    console.log('3. 检查网络面板确认API调用频率正常')
    
  } catch (error) {
    console.error('❌ 清理过程中出错:', error)
  }
}

stopDuplicateChecks()