#!/usr/bin/env node

/**
 * 测试MCP初始化修复效果
 * 验证系统启动后MCP状态是否正确持久化
 */

const { getMCPInitializer, isMCPSystemReady } = require('../src/services/mcp-initializer')

async function testMCPInitializationFix() {
    console.log('🧪 测试MCP初始化修复效果...\n')

    try {
        // 1. 检查初始状态
        console.log('1. 检查初始状态:')
        const initializer = getMCPInitializer()
        const initialStatus = initializer.getStatus()
        console.log('   - 系统就绪:', initialStatus.ready)
        console.log('   - 配置已加载:', initialStatus.configLoaded)
        console.log('   - 服务器已连接:', initialStatus.serversConnected)
        console.log('   - 工具已加载:', initialStatus.toolsLoaded)
        console.log('   - 关键词已映射:', initialStatus.keywordsMapped)
        console.log('   - isMCPSystemReady():', isMCPSystemReady())
        console.log()

        // 2. 如果未就绪，进行初始化
        if (!initialStatus.ready) {
            console.log('2. 系统未就绪，开始初始化...')
            const status = await initializer.initialize()
            console.log('   - 初始化结果:', status.ready ? '成功' : '失败')
            if (status.error) {
                console.log('   - 错误信息:', status.error)
            }
            console.log('   - 工具数量:', status.details.totalTools)
            console.log()
        } else {
            console.log('2. 系统已就绪，跳过初始化\n')
        }

        // 3. 验证状态持久化
        console.log('3. 验证状态持久化:')
        const finalStatus = initializer.getStatus()
        console.log('   - 系统就绪:', finalStatus.ready)
        console.log('   - isMCPSystemReady():', isMCPSystemReady())
        console.log()

        // 4. 测试重复调用
        console.log('4. 测试重复初始化调用:')
        const startTime = Date.now()
        const status1 = await initializer.initialize()
        const time1 = Date.now() - startTime
        
        const startTime2 = Date.now()
        const status2 = await initializer.initialize()
        const time2 = Date.now() - startTime2
        
        console.log(`   - 第一次调用: ${time1}ms, 结果: ${status1.ready}`)
        console.log(`   - 第二次调用: ${time2}ms, 结果: ${status2.ready}`)
        console.log(`   - 第二次调用是否更快: ${time2 < time1 ? '是' : '否'} (应该更快，因为跳过了重复初始化)`)
        console.log()

        // 5. 获取系统详细信息
        console.log('5. 系统详细信息:')
        const systemInfo = await initializer.getSystemInfo()
        console.log('   - 服务器状态:', Object.keys(systemInfo.servers).length, '个服务器')
        console.log('   - 可用工具:', systemInfo.tools.length, '个')
        console.log('   - 系统能力:', systemInfo.capabilities.join(', '))
        console.log()

        console.log('✅ 测试完成！')
        
        if (finalStatus.ready && time2 < time1) {
            console.log('🎉 修复效果良好：')
            console.log('   - MCP系统正确初始化并持久化状态')
            console.log('   - 重复调用被正确优化，避免了重复初始化')
            console.log('   - 系统可以正常处理聊天请求而不会触发额外的初始化')
        } else {
            console.log('⚠️  可能仍有问题：')
            if (!finalStatus.ready) {
                console.log('   - MCP系统未能正确初始化')
            }
            if (time2 >= time1) {
                console.log('   - 重复初始化优化可能未生效')
            }
        }

    } catch (error) {
        console.error('❌ 测试失败:', error.message)
        console.error('详细错误:', error)
    }
}

// 运行测试
if (require.main === module) {
    testMCPInitializationFix()
        .then(() => process.exit(0))
        .catch(error => {
            console.error('测试执行失败:', error)
            process.exit(1)
        })
}

module.exports = { testMCPInitializationFix }