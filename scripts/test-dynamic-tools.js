// 测试动态获取MCP工具名称的功能
const { generateSampleProblemsFromMCP } = require('./init-sample-problems.js')

async function testDynamicToolGeneration() {
  console.log('=== 测试动态工具获取功能 ===\n')
  
  try {
    console.log('正在从MCP服务器获取工具信息...')
    const problems = await generateSampleProblemsFromMCP()
    
    console.log(`\n✓ 成功生成 ${problems.length} 个样例问题`)
    
    // 显示生成的问题摘要
    const toolCounts = {}
    problems.forEach(problem => {
      toolCounts[problem.tool_name] = (toolCounts[problem.tool_name] || 0) + 1
    })
    
    console.log('\n工具统计:')
    Object.entries(toolCounts).forEach(([toolName, count]) => {
      console.log(`  - ${toolName}: ${count} 个问题`)
    })
    
    console.log('\n样例问题列表:')
    problems.forEach(problem => {
      console.log(`  - ${problem.title} (${problem.tool_name})`)
    })
    
  } catch (error) {
    console.error('测试失败:', error)
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  testDynamicToolGeneration().then(() => {
    console.log('\n=== 测试完成 ===')
    process.exit(0)
  }).catch(error => {
    console.error('测试失败:', error)
    process.exit(1)
  })
}

module.exports = { testDynamicToolGeneration }