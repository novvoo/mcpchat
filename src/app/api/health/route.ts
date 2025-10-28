// Health Check API - Check system status
import { NextRequest, NextResponse } from 'next/server'
import { getDatabaseService } from '@/services/database'
import { getLLMConfigService } from '@/services/llm-config-service'

export async function GET(request: NextRequest) {
    const checks = {
        database: false,
        llm_config: false,
        llm_service: false,
        timestamp: new Date().toISOString(),
        details: {} as any
    }

    try {
        // Check database connection
        try {
            const dbService = getDatabaseService()
            await dbService.initialize()
            checks.database = true
            checks.details.database = {

                status: 'connected'
            }
        } catch (error) {
            checks.details.database = {
                status: 'error',
                error: error instanceof Error ? error.message : 'Unknown error'
            }
        }

        // Check LLM configuration
        try {
            const llmConfigService = getLLMConfigService()
            const activeConfig = await llmConfigService.getActiveLLMConfig()
            
            if (activeConfig) {
                checks.llm_config = true
                checks.details.llm_config = {
                    name: activeConfig.name,
                    provider: activeConfig.provider,
                    model: activeConfig.model,
                    is_available: activeConfig.is_available,
                    status: 'configured'
                }
            } else {
                checks.details.llm_config = {
                    status: 'no_active_config'
                }
            }
        } catch (error) {
            checks.details.llm_config = {
                status: 'error',
                error: error instanceof Error ? error.message : 'Unknown error'
            }
        }

        // Check LLM service
        try {
            const { getLLMService } = await import('@/services/llm-service')
            const llmService = getLLMService()
            const config = llmService.getConfig()
            
            checks.llm_service = true
            checks.details.llm_service = {
                base_url: config.baseUrl,
                timeout: config.timeout,
                status: 'initialized'
            }
        } catch (error) {
            checks.details.llm_service = {
                status: 'error',
                error: error instanceof Error ? error.message : 'Unknown error'
            }
        }

        // Check MCP system (non-blocking)
        try {
            const { MCPInitializer } = await import('@/services/mcp-initializer')
            const initializer = MCPInitializer.getInstance()
            const status = initializer.getStatus()
            
            checks.details.mcp_system = {
                total_tools: status.details.totalTools,
                status: status.ready ? 'ready' : (status.error ? 'error' : 'initializing'),
                ready: status.ready,
                error: status.error
            }
        } catch (error) {
            checks.details.mcp_system = {
                status: 'error',
                error: error instanceof Error ? error.message : 'Unknown error',
                ready: false
            }
        }

        // Overall health
        const isHealthy = checks.database && checks.llm_config && checks.llm_service
        const status = isHealthy ? 200 : 503

        return NextResponse.json({
            healthy: isHealthy,
            checks,
            version: '1.0.0',
            environment: process.env.NODE_ENV || 'development'
        }, { status })

    } catch (error) {
        return NextResponse.json({
            healthy: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            checks,
            timestamp: new Date().toISOString()
        }, { status: 500 })
    }
}