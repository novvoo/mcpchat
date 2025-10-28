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

            console.log('✓ 数据库服务初始化成功')

            // 2. 执行启动初始化
            console.log('🔍 执行启动初始化...')
            try {
                const { StartupInitializer } = await import('./scripts/startup-init')
                const initializer = new StartupInitializer()
                const success = await initializer.initialize()
                
                if (!success) {
                    console.log('⚠️  启动初始化未完全成功，但继续启动')
                }
            } catch (error) {
                console.log('⚠️  启动初始化失败，继续启动:', error instanceof Error ? error.message : error)
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

            // 5. 初始化 MCP 系统 - 添加延迟以确保其他服务就绪
            console.log('🔧 初始化 MCP 系统...')
            
            // 添加启动延迟，确保数据库和其他服务完全就绪
            const startupDelay = parseInt(process.env.MCP_STARTUP_DELAY || '2000')
            if (startupDelay > 0) {
                console.log(`⏱️  等待 ${startupDelay}ms 以确保服务就绪...`)
                await new Promise(resolve => setTimeout(resolve, startupDelay))
            }
            
            const { initializeMCPSystem, getMCPInitializer } = await import('./src/services/mcp-initializer')
            
            // 强制进行完整初始化，设置启动标志
            process.env.MCP_STARTUP_INITIALIZING = 'true'
            
            try {
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
                        console.log('⚠️  MCP 系统状态持久化可能有问题，将在后台重试')
                        // 后台重试初始化
                        setTimeout(async () => {
                            try {
                                console.log('🔄 后台重试MCP初始化...')
                                await initializeMCPSystem()
                                console.log('✓ 后台MCP初始化成功')
                            } catch (retryError) {
                                console.warn('⚠️  后台MCP初始化重试失败:', retryError instanceof Error ? retryError.message : retryError)
                            }
                        }, 5000)
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
                    
                    // 启动后台重试
                    console.log('🔄 将在5秒后启动后台重试...')
                    setTimeout(async () => {
                        try {
                            console.log('🔄 后台重试MCP初始化...')
                            const retryStatus = await initializeMCPSystem()
                            if (retryStatus.ready) {
                                console.log('✓ 后台MCP初始化重试成功')
                            } else {
                                console.log('⚠️  后台MCP初始化重试仍未完全成功')
                            }
                        } catch (retryError) {
                            console.warn('⚠️  后台MCP初始化重试失败:', retryError instanceof Error ? retryError.message : retryError)
                        }
                    }, 5000)
                    
                    // 即使未完全就绪，也记录为部分可用
                    console.log('系统将以降级模式运行，部分功能可能不可用')
                }
            } catch (mcpError) {
                console.error('❌ MCP 系统初始化失败:', mcpError instanceof Error ? mcpError.message : mcpError)
                process.env.MCP_STARTUP_INITIALIZING = 'false'
                
                // 启动后台重试
                console.log('🔄 将在10秒后启动后台重试...')
                setTimeout(async () => {
                    try {
                        console.log('🔄 后台重试MCP初始化...')
                        const retryStatus = await initializeMCPSystem()
                        if (retryStatus.ready) {
                            console.log('✓ 后台MCP初始化重试成功')
                        } else {
                            console.log('⚠️  后台MCP初始化重试仍未完全成功')
                        }
                    } catch (retryError) {
                        console.warn('⚠️  后台MCP初始化重试失败:', retryError instanceof Error ? retryError.message : retryError)
                    }
                }, 10000)
            }

            console.log('✅ 服务器启动完成！\n')

        } catch (error) {
            console.error('❌ 服务器初始化失败:', error)
            // 不要抛出错误，让服务器继续启动
            // 应用可以在运行时懒加载初始化
        }
    }
}
