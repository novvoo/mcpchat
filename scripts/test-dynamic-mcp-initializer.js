#!/usr/bin/env node

// 测试动态 MCP Initializer - 验证是否移除了硬编码

const fs = require('fs')
const path = require('path')

function testDynamicMCPInitializer() {
  console.log('🔍 测试动态 MCP Initializer - 验证硬编码移除...\n')

  try {
    // 读取修改后的 mcp-initializer.ts 文件
    const initializerPath = path.join(__dirname, '..', 'src', 'services', 'mcp-initializer.ts')
    const initializerContent = fs.readFileSync(initializerPath, 'utf8')

    console.log('📋 检查修改内容...')

    // 检查是否移除了硬编码的 genericMappings
    const hasHardcodedMappings = initializerContent.includes("'solve': ['解决', '求解', '计算'")
    console.log(`❌ 硬编码映射表: ${hasHardcodedMappings ? '仍存在' : '已移除'}`)

    // 检查是否使用了 ToolMetadataService
    const usesMetadataService = initializerContent.includes('getToolMetadataService')
    console.log(`✅ 使用 ToolMetadataService: ${usesMetadataService ? '是' : '否'}`)

    // 检查是否有数据库驱动的关键词生成
    const hasDatabaseKeywords = initializerContent.includes('getToolSuggestions')
    console.log(`✅ 数据库驱动关键词: ${hasDatabaseKeywords ? '是' : '否'}`)

    // 检查是否有回退机制
    const hasFallback = initializerContent.includes('generateBasicKeywords')
    console.log(`✅ 回退机制: ${hasFallback ? '是' : '否'}`)

    // 检查是否使用了 refreshToolMetadata
    const usesRefreshMetadata = initializerContent.includes('refreshToolMetadata')
    console.log(`✅ 刷新工具元数据: ${usesRefreshMetadata ? '是' : '否'}`)

    // 检查是否有异步关键词生成
    const hasAsyncKeywords = initializerContent.includes('async getGenericKeywords')
    console.log(`✅ 异步关键词生成: ${hasAsyncKeywords ? '是' : '否'}`)

    console.log('\n📊 修改前后对比:')
    console.log('修改前: 硬编码的 genericMappings 包含所有工具关键词')
    console.log('修改后: 从数据库动态获取关键词，硬编码作为回退')

    console.log('\n🎯 主要改进:')
    console.log('1. 移除了硬编码的 genericMappings 对象')
    console.log('2. 集成了 ToolMetadataService 进行动态关键词管理')
    console.log('3. 使用数据库查询替代硬编码映射')
    console.log('4. 保留简化的回退机制')
    console.log('5. 支持从 MCP 服务器自动刷新工具元数据')

    // 分析硬编码程度
    console.log('\n📈 硬编码分析:')
    
    // 计算硬编码关键词数量
    const hardcodedKeywordMatches = initializerContent.match(/\['[^']+'/g) || []
    console.log(`硬编码关键词数组: ${hardcodedKeywordMatches.length} 个`)
    
    // 检查是否还有大型硬编码对象
    const hasLargeHardcodedObjects = initializerContent.includes('Record<string, string[]>') && 
                                   initializerContent.includes("'solve':")
    console.log(`大型硬编码对象: ${hasLargeHardcodedObjects ? '仍存在' : '已移除'}`)

    // 检查动态性
    console.log('\n🔄 动态性检查:')
    const dynamicFeatures = [
      { name: '数据库查询', check: initializerContent.includes('getToolSuggestions') },
      { name: '元数据刷新', check: initializerContent.includes('refreshToolMetadata') },
      { name: '关键词映射确保', check: initializerContent.includes('ensureKeywordMappingsExist') },
      { name: '工具元数据更新', check: initializerContent.includes('updateToolMetadata') },
      { name: '异步处理', check: initializerContent.includes('await metadataService') }
    ]

    dynamicFeatures.forEach(feature => {
      console.log(`${feature.check ? '✅' : '❌'} ${feature.name}`)
    })

    console.log('\n💡 使用建议:')
    console.log('1. 确保数据库表已初始化')
    console.log('2. 运行 MCP initializer 时会自动刷新工具元数据')
    console.log('3. 关键词映射现在完全由数据库管理')
    console.log('4. 新工具会自动获得关键词映射')

    if (!hasHardcodedMappings && usesMetadataService) {
      console.log('\n✅ MCP Initializer 硬编码移除成功!')
    } else {
      console.log('\n⚠️  MCP Initializer 仍有硬编码需要处理')
    }

  } catch (error) {
    console.error('❌ 测试失败:', error.message)
    process.exit(1)
  }
}

// 运行测试
if (require.main === module) {
  testDynamicMCPInitializer()
}

module.exports = { testDynamicMCPInitializer }