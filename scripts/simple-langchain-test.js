#!/usr/bin/env node

/**
 * 简化版 LangChain 增强解析测试
 * 直接通过 API 调用测试功能
 */

async function testEnhancedParsing() {
    console.log('🧪 开始测试 LangChain 增强解析功能...\n')

    const testQuestions = [
        {
            name: '24点游戏',
            question: '帮忙解答下23,3,11,16应该如何运算才能组成24'
        },
        {
            name: '代码生成',
            question: '请用Python写一个快速排序算法'
        },
        {
            name: '紧急问题',
            question: '急！我的服务器崩溃了，怎么办？'
        }
    ]

    for (const test of testQuestions) {
        console.log(`🔍 测试: ${test.name}`)
        console.log(`问题: ${test.question}`)
        console.log('---')

        try {
            const startTime = Date.now()
            
            // 调用增强解析 API
            const response = await fetch('http://localhost:3000/api/enhanced-parse', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ question: test.question })
            })

            const result = await response.json()
            const endTime = Date.now()

            if (result.success) {
                console.log('✅ 解析成功')
                console.log(`⏱️  处理时间: ${endTime - startTime}ms`)
                console.log(`🎯 置信度: ${result.confidence_score ? (result.confidence_score * 100).toFixed(1) + '%' : 'N/A'}`)
                
                // 基础结构化数据
                console.log('\n📋 基础结构化数据:')
                console.log(`  类型: ${result.structured_question?.question_type}`)
                console.log(`  子类型: ${result.structured_question?.question_subtype}`)
                
                // LangChain 增强数据
                if (result.structured_question?.tokenized_result) {
                    const tr = result.structured_question.tokenized_result
                    console.log('\n🧠 LangChain 增强分析:')
                    console.log(`  高级分词: [${tr.tokens.join(', ')}]`)
                    console.log(`  实体数量: ${tr.entities.length}`)
                    console.log(`  主要意图: ${tr.intent.primary}`)
                    console.log(`  领域: ${tr.context.domain}`)
                }

                // 路由结果
                console.log('\n🎯 路由结果:')
                console.log(`  ${result.routed_response}`)

            } else {
                console.log('❌ 解析失败')
                console.log(`错误: ${result.error}`)
            }

        } catch (error) {
            console.log('❌ 测试异常')
            console.log(`错误: ${error.message}`)
        }

        console.log('\n' + '='.repeat(80) + '\n')
    }

    console.log('🎉 测试完成！')
}

// 检查服务器是否运行
async function checkServer() {
    try {
        const response = await fetch('http://localhost:3000/api/health')
        if (response.ok) {
            return true
        }
    } catch (error) {
        return false
    }
    return false
}

// 运行测试
async function main() {
    const serverRunning = await checkServer()
    
    if (!serverRunning) {
        console.log('❌ 服务器未运行，请先启动开发服务器:')
        console.log('   npm run dev')
        process.exit(1)
    }

    await testEnhancedParsing()
}

main().catch(error => {
    console.error('Fatal error:', error)
    process.exit(1)
})