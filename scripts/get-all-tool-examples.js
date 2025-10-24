#!/usr/bin/env node

/**
 * 获取数据库中所有工具的示例信息
 */

const { Client } = require('pg')
const fs = require('fs')
const path = require('path')

// 读取数据库配置
const configPath = path.join(__dirname, '../config/database.json')
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'))

async function getAllToolExamples() {
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

        // 查询所有工具的基本信息和示例
        const toolsQuery = `
            SELECT 
                name,
                description,
                examples,
                keywords,
                category,
                server_name,
                input_schema,
                updated_at
            FROM mcp_tools 
            ORDER BY name
        `

        const result = await client.query(toolsQuery)
        console.log(`\n📊 找到 ${result.rows.length} 个工具\n`)

        if (result.rows.length === 0) {
            console.log('❌ 数据库中没有找到任何工具')
            return
        }

        // 格式化输出所有工具的示例
        const toolsWithExamples = []
        
        for (const tool of result.rows) {
            const toolInfo = {
                name: tool.name,
                description: tool.description,
                category: tool.category,
                serverName: tool.server_name,
                examples: tool.examples || [],
                keywords: tool.keywords || [],
                inputSchema: tool.input_schema,
                lastUpdated: tool.updated_at
            }

            toolsWithExamples.push(toolInfo)

            console.log(`🔧 工具: ${tool.name}`)
            console.log(`   描述: ${tool.description || '无描述'}`)
            console.log(`   分类: ${tool.category || '未分类'}`)
            console.log(`   服务器: ${tool.server_name || '未知'}`)
            
            if (tool.examples && tool.examples.length > 0) {
                console.log(`   示例 (${tool.examples.length}个):`)
                tool.examples.forEach((example, index) => {
                    console.log(`     ${index + 1}. ${example}`)
                })
            } else {
                console.log(`   示例: 无示例`)
            }

            if (tool.keywords && tool.keywords.length > 0) {
                console.log(`   关键词: ${tool.keywords.slice(0, 5).join(', ')}${tool.keywords.length > 5 ? '...' : ''}`)
            }

            // 显示输入参数
            if (tool.input_schema) {
                try {
                    const schema = typeof tool.input_schema === 'string' 
                        ? JSON.parse(tool.input_schema) 
                        : tool.input_schema
                    
                    if (schema.properties) {
                        const params = Object.keys(schema.properties)
                        console.log(`   参数: ${params.join(', ')}`)
                    }
                } catch (e) {
                    console.log(`   参数: 解析失败`)
                }
            }

            console.log(`   更新时间: ${tool.updated_at || '未知'}`)
            console.log('')
        }

        // 统计信息
        const withExamples = toolsWithExamples.filter(t => t.examples.length > 0)
        const withoutExamples = toolsWithExamples.filter(t => t.examples.length === 0)
        
        console.log('\n📈 统计信息:')
        console.log(`   总工具数: ${toolsWithExamples.length}`)
        console.log(`   有示例的工具: ${withExamples.length}`)
        console.log(`   无示例的工具: ${withoutExamples.length}`)

        if (withoutExamples.length > 0) {
            console.log('\n❌ 缺少示例的工具:')
            withoutExamples.forEach(tool => {
                console.log(`   - ${tool.name}`)
            })
        }

        // 按分类统计
        const categories = {}
        toolsWithExamples.forEach(tool => {
            const cat = tool.category || '未分类'
            if (!categories[cat]) categories[cat] = 0
            categories[cat]++
        })

        console.log('\n📂 按分类统计:')
        Object.entries(categories).forEach(([category, count]) => {
            console.log(`   ${category}: ${count} 个工具`)
        })

        // 保存详细信息到文件
        const outputFile = path.join(__dirname, '../tool-examples-report.json')
        fs.writeFileSync(outputFile, JSON.stringify({
            timestamp: new Date().toISOString(),
            totalTools: toolsWithExamples.length,
            toolsWithExamples: withExamples.length,
            toolsWithoutExamples: withoutExamples.length,
            categories,
            tools: toolsWithExamples
        }, null, 2))

        console.log(`\n💾 详细报告已保存到: ${outputFile}`)

    } catch (error) {
        console.error('❌ 查询失败:', error.message)
        if (error.code === 'ECONNREFUSED') {
            console.error('💡 请检查数据库是否运行，连接信息是否正确')
        }
    } finally {
        await client.end()
    }
}

// 运行查询
getAllToolExamples().catch(console.error)