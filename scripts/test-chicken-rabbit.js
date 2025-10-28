#!/usr/bin/env node

/**
 * 鸡兔同笼问题测试脚本
 * 测试增强版智能路由器对鸡兔同笼问题的识别和工具调用
 */

const path = require('path')

// 设置环境变量
process.env.NODE_ENV = 'development'

async function testChickenRabbitProblem() {
    console.log('🐔🐰 开始测试鸡兔同笼问题识别和工具调用...\n')

    try {
        // 使用 fetch 调用 API 端点进行测试
        const baseUrl = 'http://localhost:3000'

        // 测试问题列表
        const testQuestions = [
            {
                name: '经典鸡兔同笼问题',
                question: '鸡兔同笼，共有35只，脚共94只，问鸡兔各有多少只？'
            },
            {
                name: '变体1 - 头脚描述',
                question: '笼子里有鸡和兔子，头35个，脚94只，鸡和兔子各有多少只？'
            },
            {
                name: '变体2 - 数字在前',
                question: '有35只鸡兔，总共94只脚，求鸡兔各多少只？'
            },
            {
                name: '变体3 - 英文版',
                question: 'There are chickens and rabbits in a cage. Total 35 animals and 94 legs. How many chickens and rabbits?'
            },
            {
                name: '变体4 - 简化描述',
                question: '鸡兔共35只，脚94只，各多少？'
            }
        ]

        // 逐个测试问题
        for (const test of testQuestions) {
            console.log(`🔍 测试: ${test.name}`)
            console.log(`问题: ${test.question}`)
            console.log('---')

            try {
                const startTime = Date.now()
                
                // 调用 Chat API
                const response = await fetch(`${baseUrl}/api/chat`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        message: test.question,
                        enableTools: true,
                        skipSmartRouter: false,
                        useLangChain: true
                    })
                })

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
                }

                const result = await response.json()
                const endTime = Date.now()

                if (result.success) {
                    console.log('✅ 处理成功')
                    console.log(`⏱️  处理时间: ${endTime - startTime}ms`)
                    console.log(`🎯 来源: ${result.source}`)
                    console.log(`🔧 置信度: ${result.confidence ? (result.confidence * 100).toFixed(1) + '%' : 'N/A'}`)
                    
                    if (result.reasoning) {
                        console.log(`💭 推理过程: ${result.reasoning}`)
                    }

                    if (result.toolResults && result.toolResults.length > 0) {
                        console.log('\n🛠️ 工具调用结果:')
                        result.toolResults.forEach((toolResult, index) => {
                            console.log(`  工具 ${index + 1}:`)
                            console.log(`    ID: ${toolResult.toolCallId}`)
                            if (toolResult.result) {
                                console.log(`    结果: ${JSON.stringify(toolResult.result, null, 2)}`)
                            }
                            if (toolResult.error) {
                                console.log(`    错误: ${toolResult.error}`)
                            }
                        })
                    }

                    console.log('\n📝 最终回答:')
                    console.log(result.data.response)
                } else {
                    console.log('❌ API 调用失败')
                    console.log(`错误: ${result.error?.message || '未知错误'}`)
                }

            } catch (error) {
                console.log('❌ 测试异常')
                console.log(`错误: ${error.message}`)
            }

            console.log('\n' + '='.repeat(80) + '\n')
        }

        console.log('🎉 鸡兔同笼问题测试完成！')

    } catch (error) {
        console.error('❌ 测试失败:', error)
        process.exit(1)
    }
}

// 运行测试
if (require.main === module) {
    testChickenRabbitProblem().catch(error => {
        console.error('Fatal error:', error)
        process.exit(1)
    })
}

module.exports = { testChickenRabbitProblem }