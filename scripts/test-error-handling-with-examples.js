#!/usr/bin/env node

/**
 * 测试增强的错误处理功能，验证是否正确显示示例
 */

const { Client } = require('pg')
const fs = require('fs')
const path = require('path')

// 读取数据库配置
const configPath = path.join(__dirname, '../config/database.json')
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'))

async function testErrorHandlingWithExamples() {
    console.log('🧪 测试增强的错误处理功能\n')

    // 测试场景
    const testCases = [
        {
            name: '24点游戏 - 缺少参数',
            toolName: 'solve_24_point_game',
            errorMessage: 'Missing required parameter: numbers',
            errorType: 'missing_parameters',
            userInput: '24点游戏'
        },
        {
            name: '24点游戏 - 参数格式错误',
            toolName: 'solve_24_point_game',
            errorMessage: 'Invalid arguments: numbers must be an array of 4 integers',
            errorType: 'invalid_arguments',
            userInput: '用8、8、4算24'
        },
        {
            name: 'N皇后问题 - 缺少参数',
            toolName: 'solve_n_queens',
            errorMessage: 'Missing required parameter: n',
            errorType: 'missing_parameters',
            userInput: '皇后问题'
        },
        {
            name: '数独求解 - 缺少参数',
            toolName: 'solve_sudoku',
            errorMessage: 'Missing required parameter: puzzle',
            errorType: 'missing_parameters',
            userInput: '解数独'
        }
    ]

    for (const testCase of testCases) {
        console.log(`📋 测试: ${testCase.name}`)
        console.log(`   用户输入: "${testCase.userInput}"`)
        console.log(`   工具: ${testCase.toolName}`)
        console.log(`   错误: ${testCase.errorMessage}`)
        
        try {
            // 模拟获取工具示例
            const examples = await getToolExamples(testCase.toolName)
            const suggestions = generateSuggestions(testCase.toolName, testCase.errorType)
            
            console.log(`   📚 找到示例: ${examples.length} 个`)
            if (examples.length > 0) {
                examples.slice(0, 3).forEach((example, index) => {
                    console.log(`      ${index + 1}. ${example}`)
                })
            }
            
            console.log(`   💡 建议: ${suggestions.length} 个`)
            suggestions.slice(0, 2).forEach((suggestion, index) => {
                console.log(`      ${index + 1}. ${suggestion}`)
            })
            
            // 生成格式化的错误消息
            const formattedError = formatErrorWithExamples(
                testCase.toolName,
                testCase.errorMessage,
                examples,
                suggestions
            )
            
            console.log(`   ✅ 格式化错误消息长度: ${formattedError.length} 字符`)
            
        } catch (error) {
            console.log(`   ❌ 测试失败: ${error.message}`)
        }
        
        console.log('')
    }

    // 测试API端点
    await testAPIEndpoints()
}

async function getToolExamples(toolName) {
    const client = new Client({
        host: config.postgresql.host,
        port: config.postgresql.port,
        database: config.postgresql.database,
        user: config.postgresql.user,
        password: config.postgresql.password,
        ssl: config.postgresql.ssl
    })

    try {
        await client.connect()
        
        const result = await client.query(
            'SELECT examples FROM mcp_tools WHERE name = $1',
            [toolName]
        )

        if (result.rows.length > 0 && result.rows[0].examples) {
            return result.rows[0].examples.filter(example => 
                !example.includes('Server:') // 过滤掉服务器标识
            )
        }

        return []
    } finally {
        await client.end()
    }
}

function generateSuggestions(toolName, errorType) {
    const suggestions = []

    if (toolName === 'solve_24_point_game') {
        suggestions.push('请提供4个数字，例如: [8, 8, 4, 13]')
        suggestions.push('支持中文描述: "用8、8、4、13算出24"')
        suggestions.push('支持英文描述: "solve 24 point game with [1,2,3,4]"')
        
        if (errorType === 'missing_parameters') {
            suggestions.push('缺少numbers参数，请提供4个数字的数组')
            suggestions.push('正确格式: {"numbers": [8, 8, 4, 13]}')
        }
    } else if (toolName === 'solve_n_queens') {
        suggestions.push('请提供棋盘大小，例如: {"n": 8}')
        suggestions.push('支持中文: "解决8皇后问题"')
        suggestions.push('支持英文: "solve 8 queens problem"')
    } else if (toolName === 'solve_sudoku') {
        suggestions.push('请提供9x9数独谜题数组')
        suggestions.push('支持中文: "解决数独游戏"')
        suggestions.push('0表示空格，1-9表示已填数字')
    }

    suggestions.push('尝试使用更自然的语言描述您的需求')
    suggestions.push('查看管理面板了解更多工具信息')

    return suggestions
}

function formatErrorWithExamples(toolName, errorMessage, examples, suggestions) {
    let formatted = `❌ **工具调用失败**\n\n`
    formatted += `**工具:** ${toolName}\n`
    formatted += `**错误:** ${errorMessage}\n\n`

    if (examples.length > 0) {
        formatted += `📚 **使用示例:**\n\n`
        examples.slice(0, 5).forEach((example, index) => {
            formatted += `${index + 1}. ${example}\n`
        })
        formatted += '\n'
    }

    if (suggestions.length > 0) {
        formatted += `💡 **建议:**\n\n`
        suggestions.slice(0, 6).forEach((suggestion, index) => {
            formatted += `${index + 1}. ${suggestion}\n`
        })
    }

    return formatted
}

async function testAPIEndpoints() {
    console.log('🌐 测试API端点...\n')

    // 这里可以添加实际的HTTP请求测试
    // 但现在只是模拟测试结构
    
    const apiTests = [
        {
            endpoint: 'GET /api/tool-examples?tool=solve_24_point_game',
            description: '获取24点游戏工具示例'
        },
        {
            endpoint: 'POST /api/tool-examples',
            description: '格式化错误消息',
            body: {
                toolName: 'solve_24_point_game',
                errorMessage: 'Missing required parameter: numbers',
                errorType: 'missing_parameters'
            }
        }
    ]

    apiTests.forEach((test, index) => {
        console.log(`${index + 1}. ${test.endpoint}`)
        console.log(`   描述: ${test.description}`)
        if (test.body) {
            console.log(`   请求体: ${JSON.stringify(test.body, null, 2)}`)
        }
        console.log(`   ✅ API结构已定义`)
        console.log('')
    })
}

// 运行测试
testErrorHandlingWithExamples().catch(console.error)