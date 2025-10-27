#!/usr/bin/env node

// 分析 src/services 目录中的硬编码问题

const fs = require('fs')
const path = require('path')

function analyzeHardcodedServices() {
  console.log('🔍 分析 src/services 目录中的硬编码问题...\n')

  const hardcodedIssues = []

  // 1. tool-metadata-service.ts 中的硬编码
  console.log('📁 检查 tool-metadata-service.ts...')
  const toolMetadataPath = path.join(__dirname, '..', 'src', 'services', 'tool-metadata-service.ts')
  const toolMetadataContent = fs.readFileSync(toolMetadataPath, 'utf8')

  // 检查 getToolSpecificKeywords 方法中的硬编码映射
  if (toolMetadataContent.includes('specificMappings: Record<string, string[]>')) {
    hardcodedIssues.push({
      file: 'tool-metadata-service.ts',
      method: 'getToolSpecificKeywords',
      issue: '巨大的硬编码工具关键词映射表',
      severity: 'high',
      lines: '324-380',
      description: '包含所有工具的硬编码关键词映射，应该从数据库动态获取'
    })
  }

  // 检查 generateParameterMappings 方法中的硬编码
  if (toolMetadataContent.includes("mappings['basic'] = validParameters.includes('lp')")) {
    hardcodedIssues.push({
      file: 'tool-metadata-service.ts',
      method: 'generateParameterMappings',
      issue: 'run_example 工具的硬编码参数映射',
      severity: 'medium',
      lines: '414-421',
      description: '为 run_example 工具硬编码了参数映射逻辑'
    })
  }

  // 检查中文关键词硬编码
  if (toolMetadataContent.includes("const chineseKeywords = ['解决', '皇后'")) {
    hardcodedIssues.push({
      file: 'tool-metadata-service.ts',
      method: 'getToolSuggestions',
      issue: '硬编码的中文关键词列表',
      severity: 'medium',
      lines: '648',
      description: '硬编码了中文关键词列表，应该从数据库获取'
    })
  }

  // 2. simple-intent-recognizer.ts 中的硬编码
  console.log('📁 检查 simple-intent-recognizer.ts...')
  const simpleRecognizerPath = path.join(__dirname, '..', 'src', 'services', 'simple-intent-recognizer.ts')
  const simpleRecognizerContent = fs.readFileSync(simpleRecognizerPath, 'utf8')

  if (simpleRecognizerContent.includes('private readonly keywordMappings: Record<string, string[]>')) {
    hardcodedIssues.push({
      file: 'simple-intent-recognizer.ts',
      method: 'keywordMappings',
      issue: '完整的硬编码关键词映射表',
      severity: 'high',
      lines: '12-35',
      description: '整个类依赖硬编码的关键词映射，应该作为数据库的回退方案'
    })
  }

  if (simpleRecognizerContent.includes('const toolSuccessRates: Record<string, number>')) {
    hardcodedIssues.push({
      file: 'simple-intent-recognizer.ts',
      method: 'calibrateConfidence',
      issue: '硬编码的工具成功率',
      severity: 'medium',
      lines: '150-158',
      description: '工具成功率应该从实际使用统计中获取'
    })
  }

  // 3. sample-problems-service.ts 中的硬编码
  console.log('📁 检查 sample-problems-service.ts...')
  const sampleProblemsPath = path.join(__dirname, '..', 'src', 'services', 'sample-problems-service.ts')
  const sampleProblemsContent = fs.readFileSync(sampleProblemsPath, 'utf8')

  if (sampleProblemsContent.includes("case 'solve_n_queens':")) {
    hardcodedIssues.push({
      file: 'sample-problems-service.ts',
      method: 'generateProblemFromTool',
      issue: '硬编码的样例问题生成逻辑',
      severity: 'high',
      lines: '200-300',
      description: '为每个工具硬编码了样例问题生成逻辑，应该使用模板系统'
    })
  }

  // 4. tool-detector.ts 中的硬编码（已知问题）
  console.log('📁 检查 tool-detector.ts...')
  const toolDetectorPath = path.join(__dirname, '..', 'src', 'services', 'tool-detector.ts')
  const toolDetectorContent = fs.readFileSync(toolDetectorPath, 'utf8')

  if (toolDetectorContent.includes("keywords: ['queens', 'n-queens'")) {
    hardcodedIssues.push({
      file: 'tool-detector.ts',
      method: 'initializePatterns',
      issue: '硬编码的工具检测模式（回退机制）',
      severity: 'low',
      lines: '54-130',
      description: '虽然现在主要使用数据库，但回退机制仍有大量硬编码'
    })
  }

  // 5. mcp-intent-recognizer.ts 已移除
  console.log('📁 mcp-intent-recognizer.ts 已移除，跳过检查...')

  // 输出分析结果
  console.log('\n📊 硬编码问题分析结果:')
  console.log(`发现 ${hardcodedIssues.length} 个硬编码问题\n`)

  // 按严重程度分组
  const highSeverity = hardcodedIssues.filter(issue => issue.severity === 'high')
  const mediumSeverity = hardcodedIssues.filter(issue => issue.severity === 'medium')
  const lowSeverity = hardcodedIssues.filter(issue => issue.severity === 'low')

  console.log(`🔴 高严重性问题 (${highSeverity.length} 个):`)
  highSeverity.forEach(issue => {
    console.log(`  - ${issue.file}:${issue.method}`)
    console.log(`    问题: ${issue.issue}`)
    console.log(`    描述: ${issue.description}`)
    console.log(`    行数: ${issue.lines}\n`)
  })

  console.log(`🟡 中等严重性问题 (${mediumSeverity.length} 个):`)
  mediumSeverity.forEach(issue => {
    console.log(`  - ${issue.file}:${issue.method}`)
    console.log(`    问题: ${issue.issue}`)
    console.log(`    描述: ${issue.description}`)
    console.log(`    行数: ${issue.lines}\n`)
  })

  console.log(`🟢 低严重性问题 (${lowSeverity.length} 个):`)
  lowSeverity.forEach(issue => {
    console.log(`  - ${issue.file}:${issue.method}`)
    console.log(`    问题: ${issue.issue}`)
    console.log(`    描述: ${issue.description}`)
    console.log(`    行数: ${issue.lines}\n`)
  })

  // 提供修复建议
  console.log('💡 修复建议:')
  console.log('1. 优先修复高严重性问题，这些直接影响系统的动态性')
  console.log('2. tool-metadata-service.ts 中的 getToolSpecificKeywords 应该完全从数据库获取')
  console.log('3. simple-intent-recognizer.ts 应该作为纯回退方案，减少硬编码')
  console.log('4. sample-problems-service.ts 应该使用模板系统而不是硬编码')
  console.log('5. 工具成功率应该从 tool_usage_stats 表中动态计算')
  console.log('6. 所有关键词映射应该统一使用 tool_keyword_mappings 表')

  console.log('\n🎯 推荐修复顺序:')
  console.log('1. tool-metadata-service.ts 的 getToolSpecificKeywords 方法')
  console.log('2. sample-problems-service.ts 的样例问题生成逻辑')
  console.log('3. 工具成功率的动态计算')
  console.log('4. simple-intent-recognizer.ts 的简化')

  return hardcodedIssues
}

// 运行分析
if (require.main === module) {
  const issues = analyzeHardcodedServices()
  console.log(`\n✅ 分析完成，发现 ${issues.length} 个硬编码问题`)
}

module.exports = { analyzeHardcodedServices }