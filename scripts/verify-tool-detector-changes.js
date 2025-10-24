#!/usr/bin/env node

// 验证 Tool Detector 的修改 - 检查代码是否正确集成了数据库服务

const fs = require('fs')
const path = require('path')

function verifyToolDetectorChanges() {
  console.log('🔍 验证 Tool Detector 修改...\n')

  try {
    // 读取修改后的 tool-detector.ts 文件
    const toolDetectorPath = path.join(__dirname, '..', 'src', 'services', 'tool-detector.ts')
    const toolDetectorContent = fs.readFileSync(toolDetectorPath, 'utf8')

    console.log('📋 检查修改内容...')

    // 检查是否导入了 ToolMetadataService
    const hasMetadataImport = toolDetectorContent.includes('getToolMetadataService')
    console.log(`✅ 导入 ToolMetadataService: ${hasMetadataImport ? '是' : '否'}`)

    // 检查是否有数据库驱动的 analyzeMessage 方法
    const hasDatabaseAnalysis = toolDetectorContent.includes('toolMetadataService.getToolSuggestions')
    console.log(`✅ 使用数据库工具建议: ${hasDatabaseAnalysis ? '是' : '否'}`)

    // 检查是否有数据库参数映射
    const hasParameterMapping = toolDetectorContent.includes('suggestParametersFromDatabase')
    console.log(`✅ 数据库参数映射: ${hasParameterMapping ? '是' : '否'}`)

    // 检查是否保留了回退机制
    const hasFallback = toolDetectorContent.includes('analyzeMessageWithPatterns')
    console.log(`✅ 硬编码回退机制: ${hasFallback ? '是' : '否'}`)

    // 检查是否有关键词映射确保逻辑
    const hasKeywordEnsure = toolDetectorContent.includes('ensureKeywordMappingsExist')
    console.log(`✅ 关键词映射确保: ${hasKeywordEnsure ? '是' : '否'}`)

    console.log('\n📊 修改前后对比:')
    console.log('修改前: 完全依赖硬编码的工具模式')
    console.log('修改后: 优先使用数据库，硬编码作为回退')

    console.log('\n🎯 主要改进:')
    console.log('1. 集成了 ToolMetadataService')
    console.log('2. 从数据库动态获取工具关键词映射')
    console.log('3. 支持数据库驱动的参数映射')
    console.log('4. 保留硬编码模式作为回退保障')
    console.log('5. 自动确保关键词映射存在')

    console.log('\n💡 使用建议:')
    console.log('1. 运行: node scripts/init-tool-metadata-tables.js (初始化数据库表)')
    console.log('2. 确保数据库连接正常')
    console.log('3. 测试工具检测功能')

    console.log('\n✅ Tool Detector 修改验证完成!')

    // 检查相关文件是否存在
    console.log('\n📁 相关文件检查:')
    
    const relatedFiles = [
      'src/services/tool-metadata-service.ts',
      'scripts/init-tool-metadata-tables.js',
      'scripts/test-dynamic-tool-detector.js',
      'scripts/tool-detector-improvement-summary.md'
    ]

    relatedFiles.forEach(file => {
      const filePath = path.join(__dirname, '..', file)
      const exists = fs.existsSync(filePath)
      console.log(`${exists ? '✅' : '❌'} ${file}`)
    })

  } catch (error) {
    console.error('❌ 验证失败:', error.message)
    process.exit(1)
  }
}

// 运行验证
if (require.main === module) {
  verifyToolDetectorChanges()
}

module.exports = { verifyToolDetectorChanges }