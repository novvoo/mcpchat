// Tool Metadata Service - 动态管理工具元数据

import { Tool } from '@/types'
import { getDatabaseService } from './database'
import { getMCPToolsService } from './mcp-tools'

export interface ToolMetadata {
    name: string
    description: string
    inputSchema: any
    serverName: string
    keywords: string[]
    parameterMappings: Record<string, string>
    validParameters: string[]
    examples: string[]
    category: string
    lastUpdated: Date
}

export interface ToolKeywordMapping {
    toolName: string
    keywords: string[]
    confidence: number
}

/**
 * 工具元数据服务 - 从MCP动态获取并存储工具信息
 */
export class ToolMetadataService {
    private static instance: ToolMetadataService
    private initialized = false

    private constructor() { }

    public static getInstance(): ToolMetadataService {
        if (!ToolMetadataService.instance) {
            ToolMetadataService.instance = new ToolMetadataService()
        }
        return ToolMetadataService.instance
    }

    /**
     * 初始化服务并创建必要的数据库表
     */
    async initialize(): Promise<void> {
        if (this.initialized) return

        try {
            await this.createTables()
            this.initialized = true
            console.log('Tool metadata service initialized')
        } catch (error) {
            console.error('Failed to initialize tool metadata service:', error)
            throw error
        }
    }

    /**
     * 创建必要的数据库表
     */
    private async createTables(): Promise<void> {
        const dbService = getDatabaseService()
        const client = await dbService.getClient()
        if (!client) return

        try {
            // 扩展 mcp_tools 表，添加更多元数据字段
            await client.query(`
        ALTER TABLE mcp_tools 
        ADD COLUMN IF NOT EXISTS keywords TEXT[],
        ADD COLUMN IF NOT EXISTS parameter_mappings JSONB,
        ADD COLUMN IF NOT EXISTS valid_parameters TEXT[],
        ADD COLUMN IF NOT EXISTS examples TEXT[],
        ADD COLUMN IF NOT EXISTS category VARCHAR(100)
      `)

            // 创建工具关键词映射表
            await client.query(`
        CREATE TABLE IF NOT EXISTS tool_keyword_mappings (
          id SERIAL PRIMARY KEY,
          tool_name VARCHAR(255) NOT NULL,
          keyword VARCHAR(255) NOT NULL,
          confidence FLOAT DEFAULT 1.0,
          source VARCHAR(50) DEFAULT 'manual',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(tool_name, keyword)
        )
      `)

            // 创建参数映射表
            await client.query(`
        CREATE TABLE IF NOT EXISTS tool_parameter_mappings (
          id SERIAL PRIMARY KEY,
          tool_name VARCHAR(255) NOT NULL,
          user_input VARCHAR(255) NOT NULL,
          mcp_parameter VARCHAR(255) NOT NULL,
          confidence FLOAT DEFAULT 1.0,
          usage_count INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(tool_name, user_input)
        )
      `)

            // 创建工具使用统计表
            await client.query(`
        CREATE TABLE IF NOT EXISTS tool_usage_stats (
          id SERIAL PRIMARY KEY,
          tool_name VARCHAR(255) NOT NULL,
          user_input TEXT NOT NULL,
          parameters JSONB,
          success BOOLEAN NOT NULL,
          execution_time INTEGER,
          error_message TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `)

            console.log('Tool metadata tables created successfully')
        } finally {
            client.release()
        }
    }

    /**
     * 从MCP服务器获取并更新工具元数据
     */
    async refreshToolMetadata(): Promise<void> {
        console.log('Refreshing tool metadata from MCP servers...')

        try {
            const mcpToolsService = getMCPToolsService()
            const tools = await mcpToolsService.getAvailableTools()

            console.log(`Found ${tools.length} tools from MCP servers`)

            for (const tool of tools) {
                await this.updateToolMetadata(tool)
            }

            console.log('Tool metadata refresh completed')
        } catch (error) {
            console.error('Failed to refresh tool metadata:', error)
            throw error
        }
    }

    /**
     * 更新单个工具的元数据
     */
    private async updateToolMetadata(tool: Tool): Promise<void> {
        const dbService = getDatabaseService()
        const client = await dbService.getClient()
        if (!client) return

        try {
            // 从工具描述和schema中提取元数据
            const metadata = await this.extractToolMetadata(tool)

            // 更新工具基本信息
            await client.query(`
        INSERT INTO mcp_tools (
          name, description, input_schema, server_name, 
          keywords, parameter_mappings, valid_parameters, examples, category,
          metadata, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)
        ON CONFLICT (name) DO UPDATE SET
          description = EXCLUDED.description,
          input_schema = EXCLUDED.input_schema,
          server_name = EXCLUDED.server_name,
          keywords = EXCLUDED.keywords,
          parameter_mappings = EXCLUDED.parameter_mappings,
          valid_parameters = EXCLUDED.valid_parameters,
          examples = EXCLUDED.examples,
          category = EXCLUDED.category,
          metadata = EXCLUDED.metadata,
          updated_at = CURRENT_TIMESTAMP
      `, [
                tool.name,
                tool.description,
                JSON.stringify(tool.inputSchema),
                metadata.serverName,
                metadata.keywords,
                JSON.stringify(metadata.parameterMappings),
                metadata.validParameters,
                metadata.examples,
                metadata.category,
                JSON.stringify({ lastUpdated: new Date().toISOString() })
            ])

            // 更新关键词映射
            await this.updateKeywordMappings(tool.name, metadata.keywords)

            // 更新参数映射
            await this.updateParameterMappings(tool.name, metadata.parameterMappings)

            console.log(`Updated metadata for tool: ${tool.name}`)
        } finally {
            client.release()
        }
    }

    /**
     * 从工具信息中提取元数据
     */
    private async extractToolMetadata(tool: Tool): Promise<{
        serverName: string
        keywords: string[]
        parameterMappings: Record<string, string>
        validParameters: string[]
        examples: string[]
        category: string
    }> {
        // 从工具名称和描述中提取关键词
        const keywords = this.extractKeywords(tool.name, tool.description)

        // 从输入schema中提取有效参数
        const validParameters = this.extractValidParameters(tool.inputSchema)

        // 生成参数映射
        const parameterMappings = this.generateParameterMappings(tool.name, validParameters)

        // 从描述中提取示例
        const examples = this.extractExamples(tool.description)

        // 确定工具类别
        const category = this.categorizeTools(tool.name, tool.description)

        return {
            serverName: 'gurddy-http', // TODO: 从实际服务器获取
            keywords,
            parameterMappings,
            validParameters,
            examples,
            category
        }
    }

    /**
     * 从工具名称和描述中提取关键词
     */
    private extractKeywords(name: string, description: string): string[] {
        const keywords = new Set<string>()

        // 从工具名称提取
        const nameWords = name.toLowerCase().split(/[_\-\s]+/)
        nameWords.forEach(word => {
            if (word.length > 2) keywords.add(word)
        })

        // 从描述中提取关键词
        const descWords = description.toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length > 3)

        // 添加重要的关键词
        const importantWords = ['solve', 'run', 'execute', 'calculate', 'optimize', 'find', 'search']
        descWords.forEach(word => {
            if (importantWords.includes(word) || word.length > 4) {
                keywords.add(word)
            }
        })

        // 添加特定领域的关键词
        if (name.includes('queens')) {
            keywords.add('皇后问题')
            keywords.add('n皇后')
            keywords.add('八皇后')
            keywords.add('queens problem')
            keywords.add('皇后')
            keywords.add('queen')
        }

        if (name.includes('sudoku')) {
            keywords.add('数独')
            keywords.add('sudoku')
            keywords.add('解数独')
            keywords.add('solve sudoku')
        }

        if (name.includes('example')) {
            keywords.add('示例')
            keywords.add('演示')
            keywords.add('demo')
            keywords.add('例子')
            keywords.add('运行示例')
            keywords.add('run example')
        }

        // 添加动作关键词
        if (name.includes('solve')) {
            keywords.add('解决')
            keywords.add('求解')
            keywords.add('解')
            keywords.add('solve')
        }

        if (name.includes('run')) {
            keywords.add('运行')
            keywords.add('执行')
            keywords.add('跑')
            keywords.add('run')
            keywords.add('execute')
        }

        return Array.from(keywords)
    }

    /**
     * 从输入schema中提取有效参数
     */
    private extractValidParameters(inputSchema: any): string[] {
        if (!inputSchema || !inputSchema.properties) return []

        const parameters: string[] = []

        for (const [paramName, paramDef] of Object.entries(inputSchema.properties)) {
            parameters.push(paramName)

            // 如果参数有枚举值，添加这些值
            if (typeof paramDef === 'object' && paramDef !== null && 'enum' in paramDef) {
                const enumValues = (paramDef as any).enum
                if (Array.isArray(enumValues)) {
                    parameters.push(...enumValues.map(String))
                }
            }
        }

        return parameters
    }

    /**
     * 生成参数映射
     */
    private generateParameterMappings(toolName: string, validParameters: string[]): Record<string, string> {
        const mappings: Record<string, string> = {}

        // 为 run_example 工具生成特殊映射
        if (toolName === 'run_example') {
            mappings['basic'] = validParameters.includes('lp') ? 'lp' : validParameters[0] || 'basic'
            mappings['simple'] = validParameters.includes('lp') ? 'lp' : validParameters[0] || 'basic'
            mappings['linear'] = validParameters.includes('lp') ? 'lp' : validParameters[0] || 'basic'
            mappings['constraint'] = validParameters.includes('csp') ? 'csp' : validParameters[0] || 'basic'
            mappings['queens'] = validParameters.includes('n_queens') ? 'n_queens' : validParameters[0] || 'basic'
            mappings['optimization'] = validParameters.find(p => p.includes('optimization')) || validParameters[0] || 'basic'
        }

        // 为其他工具生成通用映射
        validParameters.forEach(param => {
            const paramLower = param.toLowerCase()

            // 添加简化映射
            if (paramLower.includes('_')) {
                const simplified = paramLower.replace(/_/g, '')
                mappings[simplified] = param
            }

            // 添加部分匹配映射
            const words = paramLower.split('_')
            words.forEach(word => {
                if (word.length > 3) {
                    mappings[word] = param
                }
            })
        })

        return mappings
    }

    /**
     * 从描述中提取示例
     */
    private extractExamples(description: string): string[] {
        const examples: string[] = []

        // 使用正则表达式提取括号中的内容作为示例
        const bracketMatches = description.match(/\(([^)]+)\)/g)
        if (bracketMatches) {
            bracketMatches.forEach(match => {
                const content = match.slice(1, -1) // 去掉括号
                if (content.includes(',')) {
                    // 如果包含逗号，分割成多个示例
                    examples.push(...content.split(',').map(s => s.trim()))
                } else {
                    examples.push(content.trim())
                }
            })
        }

        return examples
    }

    /**
     * 工具分类
     */
    private categorizeTools(name: string, description: string): string {
        const nameLower = name.toLowerCase()
        const descLower = description.toLowerCase()

        if (nameLower.includes('solve')) return 'solver'
        if (nameLower.includes('run') || nameLower.includes('example')) return 'example'
        if (nameLower.includes('optimization') || descLower.includes('optimize')) return 'optimization'
        if (nameLower.includes('game') || descLower.includes('game')) return 'game'
        if (nameLower.includes('graph') || nameLower.includes('coloring')) return 'graph'
        if (nameLower.includes('scheduling')) return 'scheduling'
        if (nameLower.includes('logic')) return 'logic'

        return 'general'
    }

    /**
     * 更新关键词映射
     */
    private async updateKeywordMappings(toolName: string, keywords: string[]): Promise<void> {
        const dbService = getDatabaseService()
        const client = await dbService.getClient()
        if (!client) return

        try {
            // 删除旧的关键词映射
            await client.query('DELETE FROM tool_keyword_mappings WHERE tool_name = $1', [toolName])

            // 插入新的关键词映射
            for (const keyword of keywords) {
                await client.query(`
          INSERT INTO tool_keyword_mappings (tool_name, keyword, confidence, source)
          VALUES ($1, $2, $3, $4)
        `, [toolName, keyword, 1.0, 'auto_extracted'])
            }
        } finally {
            client.release()
        }
    }

    /**
     * 更新参数映射
     */
    private async updateParameterMappings(toolName: string, mappings: Record<string, string>): Promise<void> {
        const dbService = getDatabaseService()
        const client = await dbService.getClient()
        if (!client) return

        try {
            // 删除旧的参数映射
            await client.query('DELETE FROM tool_parameter_mappings WHERE tool_name = $1', [toolName])

            // 插入新的参数映射
            for (const [userInput, mcpParameter] of Object.entries(mappings)) {
                await client.query(`
          INSERT INTO tool_parameter_mappings (tool_name, user_input, mcp_parameter, confidence)
          VALUES ($1, $2, $3, $4)
        `, [toolName, userInput, mcpParameter, 1.0])
            }
        } finally {
            client.release()
        }
    }

    /**
     * 根据用户输入获取工具建议
     */
    async getToolSuggestions(userInput: string): Promise<ToolKeywordMapping[]> {
        const dbService = getDatabaseService()
        const client = await dbService.getClient()
        if (!client) return []

        try {
            const inputLower = userInput.toLowerCase()

            // 分词处理用户输入
            const inputWords = inputLower.split(/\s+/).filter(word => word.length > 1)

            // 使用关键词匹配查找相关工具
            const result = await client.query(`
        SELECT DISTINCT t.name as tool_name, 
               array_agg(DISTINCT tkm.keyword) as keywords,
               COUNT(DISTINCT tkm.keyword) * AVG(tkm.confidence) as confidence
        FROM mcp_tools t
        JOIN tool_keyword_mappings tkm ON t.name = tkm.tool_name
        WHERE tkm.keyword = ANY($2)
           OR $1 ILIKE '%' || tkm.keyword || '%'
           OR tkm.keyword ILIKE ANY($3)
        GROUP BY t.name
        ORDER BY confidence DESC, tool_name
        LIMIT 10
      `, [
                inputLower,
                inputWords,
                inputWords.map(word => `%${word}%`)
            ])

            return result.rows.map(row => ({
                toolName: row.tool_name,
                keywords: row.keywords,
                confidence: parseFloat(row.confidence)
            }))
        } finally {
            client.release()
        }
    }

    /**
     * 获取工具的参数映射
     */
    async getParameterMapping(toolName: string, userInput: string): Promise<string | null> {
        const dbService = getDatabaseService()
        const client = await dbService.getClient()
        if (!client) return null

        try {
            const result = await client.query(`
        SELECT mcp_parameter, confidence
        FROM tool_parameter_mappings
        WHERE tool_name = $1 AND user_input = $2
        ORDER BY confidence DESC
        LIMIT 1
      `, [toolName, userInput.toLowerCase()])

            if (result.rows.length > 0) {
                return result.rows[0].mcp_parameter
            }

            // 如果没有精确匹配，尝试部分匹配
            const partialResult = await client.query(`
        SELECT mcp_parameter, confidence
        FROM tool_parameter_mappings
        WHERE tool_name = $1 AND (
          user_input ILIKE '%' || $2 || '%' OR
          $2 ILIKE '%' || user_input || '%'
        )
        ORDER BY confidence DESC
        LIMIT 1
      `, [toolName, userInput.toLowerCase()])

            return partialResult.rows.length > 0 ? partialResult.rows[0].mcp_parameter : null
        } finally {
            client.release()
        }
    }

    /**
     * 记录工具使用统计
     */
    async recordToolUsage(
        toolName: string,
        userInput: string,
        parameters: Record<string, any>,
        success: boolean,
        executionTime?: number,
        errorMessage?: string
    ): Promise<void> {
        const dbService = getDatabaseService()
        const client = await dbService.getClient()
        if (!client) return

        try {
            await client.query(`
        INSERT INTO tool_usage_stats (
          tool_name, user_input, parameters, success, execution_time, error_message
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `, [
                toolName,
                userInput,
                JSON.stringify(parameters),
                success,
                executionTime,
                errorMessage
            ])

            // 更新参数映射的使用计数
            if (success) {
                for (const [key, value] of Object.entries(parameters)) {
                    await client.query(`
            UPDATE tool_parameter_mappings 
            SET usage_count = usage_count + 1, updated_at = CURRENT_TIMESTAMP
            WHERE tool_name = $1 AND mcp_parameter = $2
          `, [toolName, value])
                }
            }
        } finally {
            client.release()
        }
    }
}

/**
 * 便捷函数
 */
export const getToolMetadataService = () => ToolMetadataService.getInstance()