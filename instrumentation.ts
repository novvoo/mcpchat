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
            // 1. 初始化数据库服务
            console.log('📦 初始化数据库服务...')
            const { getDatabaseService } = await import('./src/services/database')
            const dbService = getDatabaseService()
            await dbService.initialize()

            if (dbService.isVectorSearchEnabled()) {
                console.log('✓ 数据库服务初始化成功 (pgvector 已启用)')
            } else {
                console.log('⚠️  数据库服务初始化成功 (pgvector 未启用)')
            }

            // 2. 初始化 MCP 系统
            console.log('🔧 初始化 MCP 系统...')
            const { initializeMCPSystem } = await import('./src/services/mcp-initializer')
            const status = await initializeMCPSystem()

            if (status.ready) {
                console.log(`✓ MCP 系统初始化成功 (${status.details.totalTools} 个工具可用)`)
            } else {
                console.log('⚠️  MCP 系统初始化完成但未完全就绪')
                if (status.error) {
                    console.log('错误:', status.error)
                }
            }

            console.log('✅ 服务器启动完成！\n')

        } catch (error) {
            console.error('❌ 服务器初始化失败:', error)
            // 不要抛出错误，让服务器继续启动
            // 应用可以在运行时懒加载初始化
        }
    }
}
