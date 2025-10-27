#!/usr/bin/env node

// Verify MCP Status Fix - 验证MCP状态修复

console.log('🔧 验证MCP状态API调用修复...')

let callCount = 0
const startTime = Date.now()

// 监控5分钟
const monitorDuration = 5 * 60 * 1000 // 5分钟

console.log(`监控时长: ${monitorDuration / 1000}秒`)
console.log('预期调用频率: 每30-60秒一次')
console.log('---')

const checkStatus = async () => {
  try {
    const response = await fetch('http://localhost:3000/api/mcp/status')
    if (response.ok) {
      callCount++
      const elapsed = Date.now() - startTime
      const avgInterval = elapsed / callCount
      
      console.log(`[${new Date().toLocaleTimeString()}] 检测到API调用 #${callCount}`)
      console.log(`  平均间隔: ${(avgInterval / 1000).toFixed(1)}秒`)
      
      if (avgInterval < 25000) { // 少于25秒
        console.log('  ⚠️  调用频率仍然过高')
      } else {
        console.log('  ✅ 调用频率正常')
      }
    }
  } catch (error) {
    console.log('API调用失败:', error.message)
  }
}

// 每5秒检查一次是否有新的API调用
const checkInterval = setInterval(checkStatus, 5000)

// 5分钟后结束监控
setTimeout(() => {
  clearInterval(checkInterval)
  
  const totalTime = Date.now() - startTime
  
  console.log('\n📊 监控结果:')
  console.log(`总监控时间: ${(totalTime / 1000).toFixed(1)}秒`)
  console.log(`检测到的API调用: ${callCount}次`)
  
  if (callCount > 0) {
    const avgInterval = totalTime / callCount
    console.log(`平均调用间隔: ${(avgInterval / 1000).toFixed(1)}秒`)
    
    if (avgInterval >= 25000) {
      console.log('✅ 修复成功！调用频率已正常化')
    } else {
      console.log('❌ 仍需进一步优化，调用频率过高')
    }
  } else {
    console.log('ℹ️  未检测到API调用')
  }
  
  process.exit(0)
}, monitorDuration)

console.log('开始监控... (按Ctrl+C提前结束)')