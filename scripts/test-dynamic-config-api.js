#!/usr/bin/env node

/**
 * 测试动态配置API
 */

const http = require('http')

async function testDynamicConfigAPI() {
  console.log('=== 测试动态配置API ===\n')

  try {
    // 测试状态API
    console.log('📡 测试状态API...')
    const response = await fetch('http://localhost:3000/api/dynamic-config?action=status')
    
    if (!response.ok) {
      console.error(`❌ API请求失败: ${response.status} ${response.statusText}`)
      const errorText = await response.text()
      console.error('错误详情:', errorText)
      return
    }

    const data = await response.json()
    console.log('✅ API响应成功')
    console.log('📋 响应数据:')
    console.log(JSON.stringify(data, null, 2))

    // 分析响应数据
    if (data.success) {
      const { systemConfig } = data.data
      console.log('\n🔍 系统配置分析:')
      console.log(`  LLM URL: ${systemConfig.llmUrl || '❌ 未设置'}`)
      console.log(`  工具阈值: ${systemConfig.toolThreshold}`)
      console.log(`  MCP服务器数量: ${systemConfig.mcpServerCount}`)
      console.log(`  启用的服务器: ${systemConfig.enabledServers}`)

      if (!systemConfig.llmUrl) {
        console.log('\n⚠️  LLM URL未设置，这是问题所在！')
      }
    } else {
      console.error('❌ API返回失败状态:', data.error)
    }

    // 测试系统配置API
    console.log('\n📡 测试系统配置API...')
    const configResponse = await fetch('http://localhost:3000/api/dynamic-config?action=system-config')
    
    if (configResponse.ok) {
      const configData = await configResponse.json()
      console.log('✅ 系统配置API响应成功')
      console.log('📋 系统配置数据:')
      console.log(JSON.stringify(configData, null, 2))
    } else {
      console.error(`❌ 系统配置API请求失败: ${configResponse.status}`)
    }

  } catch (error) {
    console.error('❌ 测试失败:', error.message)
  }
}

// 运行测试
if (require.main === module) {
  testDynamicConfigAPI().catch(console.error)
}

module.exports = { testDynamicConfigAPI }