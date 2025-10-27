// LLM Configuration Service - Manages LLM configurations in database

import { getDatabaseService } from './database'

export interface LLMConfigRecord {
    id: number
    name: string
    provider: string
    model: string
    base_url: string
    api_key_configured: boolean
    timeout: number
    max_tokens: number
    temperature: number
    headers: Record<string, string>
    is_active: boolean
    is_available: boolean
    last_checked: Date | null
    last_success: Date | null
    last_failure: Date | null
    failure_count: number
    success_count: number
    metadata: any
    created_at: Date
    updated_at: Date
}

export interface LLMConfigForChat {
    url: string
    timeout: number
    headers: Record<string, string>
    temperature: number
    max_tokens: number
}

/**
 * LLM Configuration Service - Manages LLM configurations in PostgreSQL
 */
export class LLMConfigService {
    private static instance: LLMConfigService

    private constructor() {}

    public static getInstance(): LLMConfigService {
        if (!LLMConfigService.instance) {
            LLMConfigService.instance = new LLMConfigService()
        }
        return LLMConfigService.instance
    }

    /**
     * Get the active LLM configuration
     */
    async getActiveLLMConfig(): Promise<LLMConfigRecord | null> {
        try {
            const dbService = getDatabaseService()
            await dbService.initialize()

            const result = await dbService.query(
                'SELECT * FROM llm_config WHERE is_active = true ORDER BY updated_at DESC LIMIT 1'
            )

            if (result.rows.length === 0) {
                return null
            }

            const row = result.rows[0]
            return {
                id: row.id,
                name: row.name,
                provider: row.provider,
                model: row.model,
                base_url: row.base_url,
                api_key_configured: row.api_key_configured,
                timeout: row.timeout,
                max_tokens: row.max_tokens,
                temperature: row.temperature,
                headers: typeof row.headers === 'string' ? JSON.parse(row.headers) : row.headers,
                is_active: row.is_active,
                is_available: row.is_available,
                last_checked: row.last_checked,
                last_success: row.last_success,
                last_failure: row.last_failure,
                failure_count: row.failure_count,
                success_count: row.success_count,
                metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
                created_at: row.created_at,
                updated_at: row.updated_at
            }
        } catch (error) {
            console.error('Failed to get active LLM config:', error)
            return null
        }
    }

    /**
     * Get LLM configuration formatted for chat service
     */
    async getLLMConfigForChat(): Promise<LLMConfigForChat | null> {
        try {
            const config = await this.getActiveLLMConfig()
            if (!config) {
                return null
            }

            // Build headers, adding API key if configured
            const headers = { ...config.headers }
            if (config.api_key_configured && process.env.LLM_API_KEY) {
                headers['Authorization'] = `Bearer ${process.env.LLM_API_KEY}`
            }

            return {
                url: config.base_url,
                timeout: config.timeout,
                headers,
                temperature: config.temperature,
                max_tokens: config.max_tokens
            }
        } catch (error) {
            console.error('Failed to get LLM config for chat:', error)
            return null
        }
    }
}

/**
 * Convenience function to get the singleton LLMConfigService instance
 */
export const getLLMConfigService = () => LLMConfigService.getInstance()