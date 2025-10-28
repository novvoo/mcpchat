/**
 * Next.js Instrumentation Hook
 * 在服务器启动时执行初始化逻辑
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
    // 只在 Node.js 运行时执行（服务器端）
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        console.log('🚀 服务器启动中...')

        try {
            // 1. 首先初始化数据库服务（确保数据库存在）
            console.log('📦 初始化数据库服务...')
            const { getDatabaseService } = await import('./src/services/database')
            const dbService = getDatabaseService()
            await dbService.initialize()

            if (dbService.isVectorSearchEnabled()) {
                console.log('✓ 数据库服务初始化成功 (pgvector 已启用)')
            } else {
                console.log('⚠️  数据库服务初始化成功 (pgvector 未启用)')
            }

            // 2. 执行启动检查
            console.log('🔍 执行启动检查...')
            try {
                const { startupCheck } = await import('./scripts/startup-check')
                const checkResults = await startupCheck()
                
                if (checkResults.errors.length > 0) {
                    console.log('⚠️  发现配置问题，尝试自动修复...')
                    const { autoFix } = await import('./scripts/startup-check')
                    await autoFix()
                }
            } catch (error) {
                console.log('⚠️  启动检查失败，继续初始化:', error instanceof Error ? error.message : error)
            }

            // 3. 初始化 LLM 服务
            console.log('�  初始化 LLM 服务...')
            try {
                const { initializeLLMService } = await import('./src/services/llm-service')
                await initializeLLMService()
                console.log('✓ LLM 服务初始化成功')
            } catch (error) {
                console.log('⚠️  LLM 服务初始化失败:', error instanceof Error ? error.message : error)
                console.log('   LLM 服务将在首次使用时懒加载')
            }

            // 4. 初始化 LangChain 增强解析器
            console.log('🧠 初始化 LangChain 增强解析器...')
            try {
                const { getEnhancedStructuredParser } = await import('./src/services/enhanced-structured-parser')
                const parser = getEnhancedStructuredParser()
                await parser.initialize()
                console.log('✓ LangChain 增强解析器初始化成功')
            } catch (error) {
                console.log('⚠️  LangChain 增强解析器初始化失败:', error instanceof Error ? error.message : error)
                console.log('   增强解析器将在首次使用时懒加载')
            }

            // 5. 初始化 MCP 系统
            console.log('🔧 初始化 MCP 系统...')
            const { initializeMCPSystem, getMCPInitializer } = await import('./src/services/mcp-initializer')
            
            // 强制进行完整初始化，设置启动标志
            process.env.MCP_STARTUP_INITIALIZING = 'true'
            const status = await initializeMCPSystem()
            process.env.MCP_STARTUP_INITIALIZING = 'false'

            if (status.ready) {
                console.log(`✓ MCP 系统初始化成功 (${status.details.totalTools} 个工具可用)`)
                
                // 验证初始化状态持久化
                const initializer = getMCPInitializer()
                const verifyStatus = initializer.getStatus()
                if (verifyStatus.ready) {
                    console.log('✓ MCP 系统状态已正确持久化')
                } else {
                    console.log('⚠️  MCP 系统状态持久化可能有问题')
                }
            } else {
                console.log('⚠️  MCP 系统初始化完成但未完全就绪')
                console.log('详细状态:', {
                    configLoaded: status.configLoaded,
                    serversConnected: status.serversConnected,
                    toolsLoaded: status.toolsLoaded,
                    keywordsMapped: status.keywordsMapped,
                    error: status.error
                })
                
                // 即使未完全就绪，也记录为部分可用
                console.log('系统将以降级模式运行，部分功能可能不可用')
            }

            console.log('✅ 服务器启动完成！\n')

        } catch (error) {
            console.error('❌ 服务器初始化失败:', error)
            // 不要抛出错误，让服务器继续启动
            // 应用可以在运行时懒加载初始化
        }
    }
}
