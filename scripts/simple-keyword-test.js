#!/usr/bin/env node

/**
 * 简单的关键词测试
 */

const fetchFn = globalThis.fetch

async function simpleKeywordTest() {
  console.log('=== 简单关键词测试 ===\n')

  const baseUrl = 'http://localhost:3000'

  try {
    console.log('1. 生成关键词...')
    const response = await fetchFn(`${baseUrl}/api/admin/generate-llm-keywords`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        toolName: 'solve_24_point_game',
        forceRegenerate: true
      })
    })

    if (response.ok) {
      const result = await response.json()
      console.log(`   结果: ${result.success ? '成功' : '失败'}`)
      if (result.success) {
        console.log(`   关键词数: ${result.data.count}`)
      } else {
        console.log(`   错误: ${result.error}`)
      }
    } else {
      console.log(`   请求失败: ${response.status}`)
    }

    console.log('\n2. 等待3秒...')
    await new Promise(resolve => setTimeout(resolve, 3000))

    console.log('3. 检查数据库...')
    const checkResponse = await fetchFn(`${baseUrl}/api/admin/check-keywords-db`)
    
    if (checkResponse.ok) {
      const checkResult = await checkResponse.json()
      if (checkResult.success) {
        console.log(`   总关键词: ${checkResult.data.totalKeywords}`)
        console.log(`   有关键词的工具: ${checkResult.data.toolsWithKeywords.length}`)
        if (checkResult.data.toolsWithKeywords.length > 0) {
          console.log(`   工具: ${checkResult.data.toolsWithKeywords.join(', ')}`)
        }
      } else {
        console.log(`   检查失败: ${checkResult.error}`)
      }
    } else {
      console.log(`   检查请求失败: ${checkResponse.status}`)
    }

  } catch (error) {
    console.error('测试失败:', error.message)
  }
}

simpleKeywordTest().catch(console.error);