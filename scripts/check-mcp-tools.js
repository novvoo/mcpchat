#!/usr/bin/env node

/**
 * 检查MCP工具状态
 */

const fetchFn = globalThis.fetch

async function checkMCPTools() {
  console.log('=== 检查MCP工具状态 ===\n')

  const baseUrl = 'http://localhost:3000'

  try {
    // 1. 检查MCP管理器状态
    console.log('1. 检查MCP管理器状态:')
    const managerResponse = await fetchFn(`${baseUrl}/api/admin/debug-mcp-manager`)
    
    if (managerResponse.ok) {
      const managerResult = await managerResponse.json()
      if (managerResult.success) {
        console.log(`   ✅ MCP管理器正常`)
        const debug = managerResult.debug
        
        console.log(`   初始化状态: ${debug.initialized}`)
        console.log(`   服务器数量: ${debug.registry.serverCount}`)
        console.log(`   服务器列表: ${debug.registry.servers.join(', ')}`)
        
        console.log(`   管理器工具: ${debug.managerTools.count} 个`)
        if (debug.managerTools.error) {
          console.log(`     错误: ${debug.managerTools.error}`)
        } else if (debug.managerTools.tools.length > 0) {
          console.log(`     工具: ${debug.managerTools.tools.join(', ')}`)
        }
        
        console.log(`   服务工具: ${debug.serviceTools.count} 个`)
        if (debug.serviceTools.error) {
          console.log(`     错误: ${debug.serviceTools.error}`)
        } else if (debug.serviceTools.tools.length > 0) {
          console.log(`     工具: ${debug.serviceTools.tools.join(', ')}`)
        }
        
        console.log(`   服务器状态:`, JSON.stringify(debug.serverStatus, null, 4))
      } else {
        console.log(`   ❌ MCP管理器错误: ${managerResult.error}`)
      }
    } else {
      console.log(`   ❌ 请求失败: ${managerResponse.status}`)
    }
    console.log()

    // 2. 检查MCP配置
    console.log('2. 检查MCP配置:')
    const configResponse = await fetchFn(`${baseUrl}/api/mcp-config`)
    
    if (configResponse.ok) {
      const configResult = await configResponse.json()
      if (configResult.success) {
        console.log(`   ✅ MCP配置正常`)
        console.log(`   配置的服务器数: ${Object.keys(configResult.data.mcpServers || {}).length}`)
        
        Object.entries(configResult.data.mcpServers || {}).forEach(([name, config]) => {
          console.log(`     - ${name}: ${config.command} ${config.args?.join(' ') || ''}`)
        })
      } else {
        console.log(`   ❌ MCP配置错误: ${configResult.error}`)
      }
    } else {
      console.log(`   ❌ 配置请求失败: ${configResponse.status}`)
    }
    console.log()

    // 3. 测试意图识别
    console.log('3. 测试意图识别:')
    const intentResponse = await fetchFn(`${baseUrl}/api/test-intent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userInput: '测试工具检测' })
    })

    if (intentResponse.ok) {
      const intentResult = await intentResponse.json()
      if (intentResult.success) {
        console.log(`   ✅ 意图识别正常`)
        console.log(`   需要MCP: ${intentResult.intent.needsMCP}`)
        console.log(`   置信度: ${(intentResult.intent.confidence * 100).toFixed(1)}%`)
        console.log(`   建议工具: ${intentResult.intent.suggestedTool || '无'}`)
      } else {
        console.log(`   ❌ 意图识别错误: ${intentResult.error}`)
      }
    } else {
      console.log(`   ❌ 意图识别请求失败: ${intentResponse.status}`)
    }

  } catch (error) {
    console.error('检查过程中出错:', error)
  }
}

checkMCPTools().catch(console.error);