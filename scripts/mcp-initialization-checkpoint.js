#!/usr/bin/env node
/**
 * MCP初始化检查点脚本
 * 用于验证和修复MCP初始化状态
 */

async function runCheckpoint() {
    console.log('🔍 运行MCP初始化检查点...');
    
    try {
        // 检查数据库连接
        console.log('1. 检查数据库连接...');
        try {
            const { getDatabaseService } = await import('../src/services/database.js');
            const dbService = getDatabaseService();
            
            if (!dbService.isInitialized()) {
                console.log('   数据库未初始化，正在初始化...');
                await dbService.initialize();
            }
            console.log('   ✓ 数据库连接正常');
        } catch (error) {
            console.log('   ⚠️  数据库检查失败:', error.message);
            console.log('   继续检查其他组件...');
        }
        
        // 检查MCP配置
        console.log('2. 检查MCP配置...');
        try {
            const { getConfigLoader } = await import('../src/services/config.js');
            const configLoader = getConfigLoader();
            await configLoader.loadConfig();
            
            const serverConfigs = configLoader.getAllMCPServerConfigs();
            console.log(`   ✓ 找到 ${Object.keys(serverConfigs).length} 个MCP服务器配置`);
        } catch (error) {
            console.log('   ⚠️  MCP配置检查失败:', error.message);
            console.log('   继续检查其他组件...');
        }
        
        // 检查MCP系统状态
        console.log('3. 检查MCP系统状态...');
        try {
            const { getMCPInitializer } = await import('../src/services/mcp-initializer.js');
            const initializer = getMCPInitializer();
            const status = initializer.getStatus();
        
            console.log('   当前状态:', {
                configLoaded: status.configLoaded,
                serversConnected: status.serversConnected,
                toolsLoaded: status.toolsLoaded,
                keywordsMapped: status.keywordsMapped,
                ready: status.ready
            });
            
            // 如果系统未就绪，尝试重新初始化
            if (!status.ready) {
                console.log('4. 系统未就绪，尝试重新初始化...');
                const newStatus = await initializer.initialize(true);
                
                if (newStatus.ready) {
                    console.log('   ✓ 重新初始化成功');
                } else {
                    console.log('   ⚠️  重新初始化未完全成功');
                    console.log('   详细信息:', newStatus);
                }
            } else {
                console.log('   ✓ MCP系统已就绪');
            }
        } catch (error) {
            console.log('   ⚠️  MCP系统状态检查失败:', error.message);
            console.log('   这可能是正常的，如果系统尚未启动');
        }
        
        console.log('\n✅ 检查点完成');
        
    } catch (error) {
        console.error('❌ 检查点执行失败:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    runCheckpoint().catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

module.exports = { runCheckpoint };
