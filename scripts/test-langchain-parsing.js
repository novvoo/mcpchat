#!/usr/bin/env node

/**
 * LangChain 增强解析测试脚本
 * 测试集成 LangChain 的结构化问题解析功能
 */

const path = require('path')

// 设置环境变量
process.env.NODE_ENV = 'development'

async function testLangChainParsing() {
    console.log('🧪 开始测试 LangChain 增强解析功能...\n')

    try {
        // 动态导入 ES 模块
        const { getEnhancedStructuredParser } = await import('../src/services/enhanced-structured-parser.js')
        
        const parser = getEnhancedStructuredParser()
        
        // 检查服务状态
        console.log('📊 检查服务状态...')
        const status = parser.getStatus()
        console.log('状态:', JSON.stringify(status, null, 2))
        console.log()

        // 测试问题列表
        const testQuestions = [
            {
                name: '24点游戏',
                question: '帮忙解答下23,3,11,16应该如何运算才能组成24'
            },
            {
                name: '代码生成',
                question: '请用Python写一个快速排序算法，要求时间复杂度O(nlogn)'
            },
            {
                name: '调试帮助',
                question: '我的React组件报错了TypeError: Cannot read property \'map\' of undefined，怎么调试？'
            },
            {
                name: '信息查询',
                question: '什么是GPT模型的工作原理？请详细解释Transformer架构'
            },
            {
                name: '紧急问题',
                question: '急！我的服务器崩溃了，数据库连接失败，怎么快速恢复？'
            },
            {
                name: '简单问题',
                question: '你好'
            }
        ]

        // 逐个测试问题
        for (const test of testQuestions) {
            console.log(`🔍 测试: ${test.name}`)
            console.log(`问题: ${test.question}`)
            console.log('---')

            try {
                const startTime = Date.now()
                const result = await parser.parseQuestion(test.question)
                const endTime = Date.now()

                if (result.success) {
                    console.log('✅ 解析成功')
                    console.log(`⏱️  处理时间: ${endTime - startTime}ms`)
                    console.log(`🎯 置信度: ${result.confidence_score ? (result.confidence_score * 100).toFixed(1) + '%' : 'N/A'}`)
                    
                    // 基础结构化数据
                    console.log('\n📋 基础结构化数据:')
                    console.log(`  类型: ${result.structured_question?.question_type}`)
                    console.log(`  子类型: ${result.structured_question?.question_subtype}`)
                    console.log(`  基础分词: [${result.structured_question?.question_sentences.join(', ')}]`)
                    
                    // LangChain 增强数据
                    if (result.structured_question?.tokenized_result) {
                        const tr = result.structured_question.tokenized_result
                        console.log('\n🧠 LangChain 增强分析:')
                        console.log(`  高级分词: [${tr.tokens.join(', ')}]`)
                        console.log(`  实体数量: ${tr.entities.length}`)
                        if (tr.entities.length > 0) {
                            tr.entities.forEach(entity => {
                                console.log(`    - ${entity.text} (${entity.type}, ${(entity.confidence * 100).toFixed(1)}%)`)
                            })
                        }
                        console.log(`  主要意图: ${tr.intent.primary} (${(tr.intent.confidence * 100).toFixed(1)}%)`)
                        if (tr.intent.secondary) {
                            console.log(`  次要意图: ${tr.intent.secondary}`)
                        }
                        console.log(`  领域: ${tr.context.domain}`)
                        console.log(`  复杂度: ${tr.context.complexity}`)
                        console.log(`  语言: ${tr.context.language}`)
                    }

                    // 语义分析
                    if (result.structured_question?.semantic_analysis) {
                        const sa = result.structured_question.semantic_analysis
                        console.log('\n💭 语义情感分析:')
                        console.log(`  情感倾向: ${sa.sentiment}`)
                        console.log(`  紧急程度: ${sa.urgency}`)
                        console.log(`  表达清晰度: ${(sa.clarity * 100).toFixed(1)}%`)
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

        console.log('🎉 LangChain 增强解析测试完成！')

    } catch (error) {
        console.error('❌ 测试失败:', error)
        process.exit(1)
    }
}

// 运行测试
if (require.main === module) {
    testLangChainParsing().catch(error => {
        console.error('Fatal error:', error)
        process.exit(1)
    })
}

module.exports = { testLangChainParsing }