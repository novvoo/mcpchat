#!/usr/bin/env node

/**
 * 为24点游戏工具添加更好的示例
 */

const { Client } = require('pg')
const fs = require('fs')
const path = require('path')

// 读取数据库配置
const configPath = path.join(__dirname, '../config/database.json')
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'))

async function update24PointExamples() {
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
        console.log('✅ 数据库连接成功')

        // 为24点游戏工具定义更好的示例
        const betterExamples = [
            // 基础示例
            '[8, 8, 4, 13] - 经典24点题目',
            '[1, 2, 3, 4] - 简单入门题目',
            '[3, 3, 8, 8] - 中等难度',
            '[4, 1, 8, 7] - 常见组合',
            '[2, 2, 10, 10] - 对称数字',
            
            // 有挑战性的示例
            '[1, 1, 8, 8] - 需要巧妙运算',
            '[5, 5, 5, 1] - 三个相同数字',
            '[6, 6, 6, 6] - 四个相同数字',
            '[1, 3, 4, 6] - 连续数字',
            '[2, 5, 5, 10] - 包含10的组合',
            
            // 特殊情况
            '[13, 13, 1, 1] - 大数字组合',
            '[9, 9, 9, 9] - 全9组合',
            '[1, 1, 1, 1] - 全1组合（无解）',
            '[2, 3, 5, 7] - 质数组合',
            '[4, 4, 10, 10] - 双对组合',
            
            // 用法示例
            'numbers: [8, 8, 4, 13] - 参数格式示例',
            '{"numbers": [1, 2, 3, 4]} - JSON格式',
            '用四个数字 8, 8, 4, 13 算出24',
            '计算 [3, 3, 8, 8] 的24点解法',
            '求解24点游戏: [4, 1, 8, 7]'
        ]

        // 更新数据库中的示例
        const updateQuery = `
            UPDATE mcp_tools 
            SET examples = $1, updated_at = CURRENT_TIMESTAMP
            WHERE name = 'solve_24_point_game'
        `

        await client.query(updateQuery, [betterExamples])

        console.log('✅ 24点游戏工具示例更新成功')
        console.log(`📝 添加了 ${betterExamples.length} 个示例:`)
        
        betterExamples.forEach((example, index) => {
            console.log(`   ${index + 1}. ${example}`)
        })

        // 验证更新结果
        const verifyQuery = `
            SELECT name, examples, array_length(examples, 1) as example_count
            FROM mcp_tools 
            WHERE name = 'solve_24_point_game'
        `
        
        const result = await client.query(verifyQuery)
        if (result.rows.length > 0) {
            const tool = result.rows[0]
            console.log(`\n✅ 验证成功: ${tool.name} 现在有 ${tool.example_count} 个示例`)
        }

        // 同时更新其他工具的示例（如果需要）
        await updateOtherToolExamples(client)

    } catch (error) {
        console.error('❌ 更新失败:', error.message)
    } finally {
        await client.end()
    }
}

async function updateOtherToolExamples(client) {
    console.log('\n🔄 检查其他工具的示例...')

    // 为其他缺少好示例的工具添加示例
    const toolUpdates = [
        {
            name: 'solve_n_queens',
            examples: [
                'n: 8 - 经典8皇后问题',
                'n: 4 - 简单4皇后',
                'n: 1 - 最简单情况',
                '{"n": 8} - JSON格式',
                '解决8皇后问题',
                '求解n皇后: n=6'
            ]
        },
        {
            name: 'solve_sudoku',
            examples: [
                '9x9数独谜题',
                '标准数独格式',
                '{"puzzle": [[5,3,0,0,7,0,0,0,0],...]} - 数组格式',
                '解决数独游戏',
                '求解数独谜题'
            ]
        },
        {
            name: 'solve_chicken_rabbit_problem',
            examples: [
                'total_heads: 35, total_legs: 94 - 经典鸡兔同笼',
                'total_heads: 10, total_legs: 28 - 简单例子',
                '{"total_heads": 20, "total_legs": 56}',
                '鸡兔同笼: 35个头，94条腿',
                '解决鸡兔问题'
            ]
        }
    ]

    for (const update of toolUpdates) {
        try {
            // 检查当前示例数量
            const checkQuery = `
                SELECT array_length(examples, 1) as current_count
                FROM mcp_tools 
                WHERE name = $1
            `
            const checkResult = await client.query(checkQuery, [update.name])
            
            if (checkResult.rows.length > 0) {
                const currentCount = checkResult.rows[0].current_count || 0
                
                if (currentCount <= 1) {  // 只有默认的"Server: gurddy-http"示例
                    await client.query(`
                        UPDATE mcp_tools 
                        SET examples = $1, updated_at = CURRENT_TIMESTAMP
                        WHERE name = $2
                    `, [update.examples, update.name])
                    
                    console.log(`✅ 更新了 ${update.name} 的示例 (${update.examples.length} 个)`)
                } else {
                    console.log(`ℹ️  ${update.name} 已有 ${currentCount} 个示例，跳过更新`)
                }
            }
        } catch (error) {
            console.warn(`⚠️  更新 ${update.name} 示例失败:`, error.message)
        }
    }
}

// 运行更新
update24PointExamples().catch(console.error)