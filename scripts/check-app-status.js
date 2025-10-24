#!/usr/bin/env node

/**
 * 检查应用状态
 */

const fetchFn = globalThis.fetch

async function checkAppStatus() {
  console.log('=== 检查应用状态 ===\n')

  const baseUrl = 'http://localhost:3000'

  try {
    console.log('1. 检查应用是否运行...')
    const response = await fetchFn(`${baseUrl}/api/mcp-config`, {
      method: 'GET',
      timeout: 5000
    })

    if (response.ok) {
      console.log('   ✅ 应用正在运行')
      const data = await response.json()
      console.log(`   响应: ${data.success ? '成功' : '失败'}`)
    } else {
      console.log(`   ❌ 应用响应异常: ${response.status}`)
    }

  } catch (error) {
    console.log(`   ❌ 应用无法访问: ${error.message}`)
    console.log('   请检查应用是否正在运行在 localhost:3000')
  }
}

checkAppStatus().catch(console.error);