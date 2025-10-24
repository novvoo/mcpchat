#!/usr/bin/env node

/**
 * 测试前端和后端字段一致性
 */

async function testFieldConsistency() {
  console.log('🔍 测试前端和后端字段一致性...\n')
  
  const testMessage = "安装gurddy包"
  
  try {
    // 测试intent-only模式
    const response = await fetch('http://localhost:3000/api/mcp/test-smart-routing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: testMessage,
        testMode: 'intent-only'
      })
    })
    
    const data = await response.json()
    
    if (data.success) {
      const intent = data.data.intent
      
      console.log('📊 API返回的字段:')
      console.log(`   needsMCP: ${intent.needsMCP}`)
      console.log(`   suggestedTool: ${intent.suggestedTool}`)
      console.log(`   confidence: ${intent.confidence}`)
      console.log(`   parameters: ${JSON.stringify(intent.parameters)}`)
      console.log(`   reasoning: ${intent.reasoning}`)
      
      // 检查前端期望的字段
      const expectedFields = ['needsMCP', 'suggestedTool', 'confidence', 'parameters', 'reasoning']
      const missingFields = expectedFields.filter(field => !(field in intent))
      
      if (missingFields.length === 0) {
        console.log('\n✅ 所有前端期望的字段都存在')
      } else {
        console.log(`\n❌ 缺少字段: ${missingFields.join(', ')}`)
      }
      
      // 检查是否有旧字段
      const oldFields = ['shouldUseMCP', 'matchedTool', 'extractedParams']
      const foundOldFields = oldFields.filter(field => field in intent)
      
      if (foundOldFields.length === 0) {
        console.log('✅ 没有发现旧的字段名')
      } else {
        console.log(`⚠️  发现旧字段: ${foundOldFields.join(', ')}`)
      }
      
    } else {
      console.log('❌ API调用失败:', data.error)
    }
    
  } catch (error) {
    console.log('❌ 测试失败:', error.message)
  }
}

// 测试routing-info模式
async function testRoutingInfoMode() {
  console.log('\n🔍 测试routing-info模式字段...\n')
  
  const testMessage = "安装gurddy包"
  
  try {
    const response = await fetch('http://localhost:3000/api/mcp/test-smart-routing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: testMessage,
        testMode: 'routing-info'
      })
    })
    
    const data = await response.json()
    
    if (data.success) {
      const result = data.data
      
      console.log('📊 routing-info模式返回的字段:')
      console.log(`   wouldUseMCP: ${result.wouldUseMCP}`)
      console.log(`   mcpConnected: ${result.mcpConnected}`)
      console.log(`   availableTools: ${result.availableTools.length}个`)
      console.log(`   intent.needsMCP: ${result.intent.needsMCP}`)
      
      // 验证逻辑一致性
      const shouldMatch = result.intent.needsMCP && result.intent.confidence >= 0.4
      if (result.wouldUseMCP === shouldMatch) {
        console.log('✅ wouldUseMCP逻辑正确')
      } else {
        console.log(`❌ wouldUseMCP逻辑错误: 期望${shouldMatch}, 实际${result.wouldUseMCP}`)
      }
      
    } else {
      console.log('❌ API调用失败:', data.error)
    }
    
  } catch (error) {
    console.log('❌ 测试失败:', error.message)
  }
}

async function main() {
  await testFieldConsistency()
  await testRoutingInfoMode()
  console.log('\n🎉 字段一致性测试完成！')
}

main().catch(console.error)