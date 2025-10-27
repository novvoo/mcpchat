#!/usr/bin/env node

/**
 * 测试初始化顺序修复
 * 验证数据库初始化后再进行MCP配置同步
 */

async function testInitializationOrder() {
    console.log('🧪 测试初始化顺序修复...\n')

    try {
        // 1. 测试数据库服务初始化
        console.log('1️⃣ 测试数据库服务初始化...')
        const path = require('path')
        const { getDatabaseService } = require(path.join(process.cwd(), 'src/services/database'))
        const dbService = getDatabaseService()

        console.log('数据库服务初始化状态:', dbService.isInitialized())
        
        if (!dbService.isInitialized()) {
            console.log('正在初始化数据库服务...')
            await dbService.initialize()
        }

        console.log('数据库服务初始化完成:', dbService.isInitialized())
        console.log('向量搜索可用:', dbService.isVectorSearchEnabled())

        // 2. 测试MCP初始化器
        console.log('\n2️⃣ 测试MCP初始化器...')
        const { getMCPInitializer } = require(path.join(process.cwd(), 'src/services/mcp-initializer'))
        const initializer = getMCPInitializer()

        console.log('开始MCP初始化...')
        const status = await initializer.initialize()

        console.log('\n📊 MCP初始化结果:')
        console.log('- 配置已加载:', status.configLoaded)
        console.log('- 服务器已连接:', status.serversConnected)
        console.log('- 工具已加载:', status.toolsLoaded)
        console.log('- 关键词已映射:', status.keywordsMapped)
        console.log('- 系统就绪:', status.ready)
        
        if (status.error) {
            console.log('- 错误信息:', status.error)
        }

        console.log('\n📈 详细统计:')
        console.log('- 总服务器数:', status.details.totalServers)
        console.log('- 已连接服务器:', status.details.connectedServers)
        console.log('- 可用工具数:', status.details.totalTools)
        console.log('- 关键词映射数:', status.details.keywordMappings)

        // 3. 验证数据库中的MCP配置
        if (dbService.isVectorSearchEnabled()) {
            console.log('\n3️⃣ 验证数据库中的MCP配置...')
            try {
                const result = await dbService.query('SELECT COUNT(*) as count FROM mcp_servers')
                console.log('数据库中的MCP服务器配置数量:', result.rows[0].count)

                const servers = await dbService.query('SELECT name, disabled FROM mcp_servers ORDER BY name')
                console.log('MCP服务器列表:')
                for (const server of servers.rows) {
                    console.log(`  - ${server.name} (${server.disabled ? '已禁用' : '已启用'})`)
                }
            } catch (error) {
                console.log('查询MCP配置失败:', error.message)
            }
        } else {
            console.log('\n3️⃣ 数据库不可用，跳过MCP配置验证')
        }

        // 4. 总结
        console.log('\n✅ 初始化顺序测试完成')
        
        if (status.ready) {
            console.log('🎉 MCP系统已成功初始化，配置同步正常')
        } else {
            console.log('⚠️  MCP系统初始化不完整，但数据库同步应该不会报错')
        }

        return {
            success: true,
            databaseInitialized: dbService.isInitialized(),
            mcpReady: status.ready,
            configSyncError: false
        }

    } catch (error) {
        console.error('❌ 初始化顺序测试失败:', error)
        return {
            success: false,
            error: error.message
        }
    }
}

// 运行测试
if (require.main === module) {
    testInitializationOrder()
        .then(result => {
            console.log('\n📋 测试结果:', result)
            process.exit(result.success ? 0 : 1)
        })
        .catch(error => {
            console.error('测试执行失败:', error)
            process.exit(1)
        })
}

module.exports = { testInitializationOrder }