#!/usr/bin/env node

// 测试硬编码修复效果

const fs = require('fs')
const path = require('path')

function testHardcodeFixes() {
  console.log('🔍 测试硬编码修复效果...\n')

  const results = {
    fixed: [],
    remaining: [],
    improved: []
  }

  // 1. 检查 tool-metadata-service.ts 的修复
  console.log('📁 检查 tool-metadata-service.ts 修复效果...')
  const toolMetadataPath = path.join(__dirname, '..', 'src', 'services', 'tool-metadata-service.ts')
  const toolMetadataContent = fs.readFileSync(toolMetadataPath, 'utf8')

  // 检查是否移除了硬编码的 specificMappings
  const hasSpecificMappings = toolMetadataContent.includes("'solve_n_queens': [")
  if (!hasSpecificMappings) {
    results.fixed.push({
      file: 'tool-metadata-service.ts',
      issue: '移除了硬编码的 specificMappings 对象',
      status: '✅ 已修复'
    })
  } else {
    results.remaining.push({
      file: 'tool-metadata-service.ts',
      issue: 'specificMappings 仍然存在',
      status: '❌ 未修复'
    })
  }

  // 检查是否添加了数据库查询
  const hasDatabaseQuery = toolMetadataContent.includes('SELECT keyword FROM tool_keyword_mappings')
  if (hasDatabaseQuery) {
    results.improved.push({
      file: 'tool-metadata-service.ts',
      improvement: '添加了从数据库获取关键词的功能',
      status: '✅ 已改进'
    })
  }

  // 检查是否有回退机制
  const hasFallback = toolMetadataContent.includes('getFallbackKeywords')
  if (hasFallback) {
    results.improved.push({
      file: 'tool-metadata-service.ts',
      improvement: '保留了简化的回退机制',
      status: '✅ 已改进'
    })
  }

  // 检查是否移除了硬编码的中文关键词
  const hasHardcodedChinese = toolMetadataContent.includes("const chineseKeywords = ['解决', '皇后'")
  if (!hasHardcodedChinese) {
    results.fixed.push({
      file: 'tool-metadata-service.ts',
      issue: '移除了硬编码的中文关键词列表',
      status: '✅ 已修复'
    })
  }

  // 检查是否添加了动态中文关键词查询
  const hasDynamicChinese = toolMetadataContent.includes('keyword ~ \'[\\\\u4e00-\\\\u9fff]\'')
  if (hasDynamicChinese) {
    results.improved.push({
      file: 'tool-metadata-service.ts',
      improvement: '添加了动态中文关键词查询',
      status: '✅ 已改进'
    })
  }

  // 检查是否改进了参数映射
  const hasDynamicParams = toolMetadataContent.includes('generateDynamicParameterMappings')
  if (hasDynamicParams) {
    results.improved.push({
      file: 'tool-metadata-service.ts',
      improvement: '添加了动态参数映射生成',
      status: '✅ 已改进'
    })
  }

  // 2. 检查其他文件的状态
  console.log('📁 检查其他服务文件...')

  // simple-intent-recognizer.ts
  const simpleRecognizerPath = path.join(__dirname, '..', 'src', 'services', 'simple-intent-recognizer.ts')
  const simpleRecognizerContent = fs.readFileSync(simpleRecognizerPath, 'utf8')
  
  if (simpleRecognizerContent.includes('private readonly keywordMappings')) {
    results.remaining.push({
      file: 'simple-intent-recognizer.ts',
      issue: '仍有硬编码的关键词映射（作为回退方案可接受）',
      status: '⚠️  待优化'
    })
  }

  // sample-problems-service.ts
  const sampleProblemsPath = path.join(__dirname, '..', 'src', 'services', 'sample-problems-service.ts')
  const sampleProblemsContent = fs.readFileSync(sampleProblemsPath, 'utf8')
  
  if (sampleProblemsContent.includes("case 'solve_n_queens':")) {
    results.remaining.push({
      file: 'sample-problems-service.ts',
      issue: '仍有硬编码的样例问题生成逻辑',
      status: '⚠️  待修复'
    })
  }

  // mcp-intent-recognizer.ts
  const mcpIntentPath = path.join(__dirname, '..', 'src', 'services', 'mcp-intent-recognizer.ts')
  const mcpIntentContent = fs.readFileSync(mcpIntentPath, 'utf8')
  
  if (mcpIntentContent.includes('const toolSuccessRates: Record<string, number>')) {
    results.remaining.push({
      file: 'mcp-intent-recognizer.ts',
      issue: '仍有硬编码的工具成功率',
      status: '⚠️  待修复'
    })
  }

  // 输出结果
  console.log('\n📊 修复效果总结:')
  console.log(`✅ 已修复问题: ${results.fixed.length} 个`)
  console.log(`✅ 已改进功能: ${results.improved.length} 个`)
  console.log(`⚠️  待处理问题: ${results.remaining.length} 个\n`)

  console.log('🎉 已修复的问题:')
  results.fixed.forEach(item => {
    console.log(`  ${item.status} ${item.file}: ${item.issue}`)
  })

  console.log('\n🚀 已改进的功能:')
  results.improved.forEach(item => {
    console.log(`  ${item.status} ${item.file}: ${item.improvement}`)
  })

  console.log('\n⚠️  仍需处理的问题:')
  results.remaining.forEach(item => {
    console.log(`  ${item.status} ${item.file}: ${item.issue}`)
  })

  console.log('\n💡 下一步建议:')
  console.log('1. 修复 sample-problems-service.ts 中的硬编码样例问题生成')
  console.log('2. 将工具成功率改为从数据库统计获取')
  console.log('3. 进一步简化 simple-intent-recognizer.ts 的硬编码')
  console.log('4. 测试数据库驱动的功能是否正常工作')

  return {
    totalFixed: results.fixed.length + results.improved.length,
    totalRemaining: results.remaining.length,
    details: results
  }
}

// 运行测试
if (require.main === module) {
  const result = testHardcodeFixes()
  console.log(`\n✅ 修复测试完成! 已处理 ${result.totalFixed} 个问题，还有 ${result.totalRemaining} 个待处理`)
}

module.exports = { testHardcodeFixes }