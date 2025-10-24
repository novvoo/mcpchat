#!/usr/bin/env node

// Debug Dynamic Pattern Learning - 调试动态模式学习

const fetch = require('node-fetch')

const BASE_URL = 'http://localhost:3000'

async function debugDynamicPatterns() {
  console.log('🔍 Debugging Dynamic Pattern Learning...\n')

  try {
    // 1. 检查数据库连接
    console.log('1️⃣ 检查数据库连接...')
    try {
      const dbResponse = await fetch(`${BASE_URL}/api/admin/check-keywords-db`)
      const dbResult = await dbResponse.json()
      console.log('数据库状态:', dbResult.success ? '✅ 连接正常' : '❌ 连接失败')
      if (dbResult.data) {
        console.log('数据库信息:', JSON.stringify(dbResult.data, null, 2))
      }
    } catch (error) {
      console.error('❌ 数据库检查失败:', error.message)
    }
    console.log()

    // 2. 检查MCP工具
    console.log('2️⃣ 检查MCP工具...')
    try {
      const mcpResponse = await fetch(`${BASE_URL}/api/debug-mcp-llm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: 'test',
          testMode: 'mcp_tools_only'
        })
      })
      const mcpResult = await mcpResponse.json()
      
      if (mcpResult.success && mcpResult.results.steps) {
        const toolsStep = mcpResult.results.steps.find(step => step.step === 'mcp_tools')
        if (toolsStep && toolsStep.success) {
          console.log(`✅ MCP工具: ${toolsStep.data.toolCount} 个工具可用`)
          console.log('工具列表:')
          toolsStep.data.tools.slice(0, 5).forEach((tool, index) => {
            console.log(`   ${index + 1}. ${tool.name}: ${tool.description}`)
          })
          if (toolsStep.data.tools.length > 5) {
            console.log(`   ... 还有 ${toolsStep.data.tools.length - 5} 个工具`)
          }
        } else {
          console.log('❌ MCP工具获取失败')
        }
      }
    } catch (error) {
      console.error('❌ MCP工具检查失败:', error.message)
    }
    console.log()

    // 3. 手动创建测试模式
    console.log('3️⃣ 手动创建测试模式...')
    try {
      // 直接调用数据库创建测试模式
      const testResponse = await fetch(`${BASE_URL}/api/admin/dynamic-patterns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'create_test_pattern',
          pattern: 'test_*',
          keywords: ['测试', 'test', '试验'],
          confidence: 0.8
        })
      })
      
      if (testResponse.ok) {
        const testResult = await testResponse.json()
        console.log('测试模式创建:', testResult.success ? '✅ 成功' : '❌ 失败')
      }
    } catch (error) {
      console.error('❌ 测试模式创建失败:', error.message)
    }
    console.log()

    // 4. 检查工具元数据服务
    console.log('4️⃣ 检查工具元数据服务...')
    try {
      const metadataResponse = await fetch(`${BASE_URL}/api/test-intent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: 'solve queens problem',
          testMode: 'metadata_only'
        })
      })
      
      if (metadataResponse.ok) {
        const metadataResult = await metadataResponse.json()
        console.log('元数据服务:', metadataResult.success ? '✅ 正常' : '❌ 异常')
        if (metadataResult.data) {
          console.log('元数据信息:', JSON.stringify(metadataResult.data, null, 2))
        }
      }
    } catch (error) {
      console.error('❌ 元数据服务检查失败:', error.message)
    }
    console.log()

    // 5. 检查关键词映射
    console.log('5️⃣ 检查现有关键词映射...')
    try {
      const keywordResponse = await fetch(`${BASE_URL}/api/admin/check-keywords-db`)
      const keywordResult = await keywordResponse.json()
      
      if (keywordResult.success && keywordResult.data) {
        console.log('✅ 关键词映射状态:')
        console.log(`   映射数量: ${keywordResult.data.mappingCount || 0}`)
        console.log(`   工具数量: ${keywordResult.data.toolCount || 0}`)
        
        if (keywordResult.data.sampleMappings) {
          console.log('   示例映射:')
          keywordResult.data.sampleMappings.forEach((mapping, index) => {
            console.log(`      ${index + 1}. ${mapping.tool_name}: ${mapping.keyword}`)
          })
        }
      }
    } catch (error) {
      console.error('❌ 关键词映射检查失败:', error.message)
    }
    console.log()

    // 6. 测试简单的智能路由
    console.log('6️⃣ 测试智能路由...')
    const testInputs = [
      'solve 8 queens problem',
      'run example lp',
      'install gurddy'
    ]

    for (const input of testInputs) {
      try {
        const routeResponse = await fetch(`${BASE_URL}/api/test-intent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: input })
        })
        
        if (routeResponse.ok) {
          const routeResult = await routeResponse.json()
          if (routeResult.success && routeResult.data) {
            console.log(`✅ "${input}":`)
            console.log(`   需要MCP: ${routeResult.data.needsMCP}`)
            console.log(`   置信度: ${(routeResult.data.confidence * 100).toFixed(1)}%`)
            console.log(`   建议工具: ${routeResult.data.suggestedTool || 'None'}`)
          }
        }
      } catch (error) {
        console.log(`❌ "${input}": 测试失败`)
      }
    }

  } catch (error) {
    console.error('❌ 调试过程中出现错误:', error)
  }
}

// 运行调试
if (require.main === module) {
  debugDynamicPatterns()
    .then(() => {
      console.log('\n✅ 动态模式学习调试完成')
      process.exit(0)
    })
    .catch(error => {
      console.error('\n❌ 调试失败:', error)
      process.exit(1)
    })
}

module.exports = { debugDynamicPatterns }