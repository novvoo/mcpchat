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
    async updateToolMetadata(tool: Tool): Promise<void> {
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
        const keywords = await this.extractKeywords(tool.name, tool.description)

        // 从输入schema中提取有效参数
        const validParameters = this.extractValidParameters(tool.inputSchema)

        // 生成参数映射
        const parameterMappings = await this.generateParameterMappings(tool.name, validParameters)

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
     * 从工具名称和描述中提取关键词 - 增强版本，支持动态模式识别
     */
    private async extractKeywords(name: string, description: string): Promise<string[]> {
        const keywords = new Set<string>()

        // 1. 基础关键词提取
        await this.extractBasicKeywords(name, description, keywords)

        // 2. 基于模式的动态关键词生成
        await this.generatePatternBasedKeywords(name, description, keywords)

        // 3. 从数据库学习的关键词
        await this.addLearnedKeywords(name, keywords)

        // 4. 语义相似关键词（如果启用了向量搜索）
        await this.addSemanticKeywords(name, description, keywords)

        return Array.from(keywords)
    }

    /**
     * 提取基础关键词
     */
    private async extractBasicKeywords(name: string, description: string, keywords: Set<string>): Promise<void> {
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
    }

    /**
     * 基于模式的动态关键词生成 - 核心增强功能
     */
    private async generatePatternBasedKeywords(name: string, description: string, keywords: Set<string>): Promise<void> {
        try {
            // 获取所有工具名称模式
            const patterns = await this.getToolNamePatterns()

            // 为当前工具匹配模式并生成关键词
            for (const pattern of patterns) {
                if (this.matchesPattern(name, pattern)) {
                    const generatedKeywords = await this.generateKeywordsFromPattern(name, pattern)
                    generatedKeywords.forEach(keyword => keywords.add(keyword))
                }
            }

            // 基于描述内容的动态模式识别
            const descriptionPatterns = await this.identifyDescriptionPatterns(description)
            for (const pattern of descriptionPatterns) {
                const patternKeywords = await this.generateKeywordsFromDescriptionPattern(pattern)
                patternKeywords.forEach(keyword => keywords.add(keyword))
            }

        } catch (error) {
            console.warn('动态模式关键词生成失败，使用静态模式:', error)
            // 回退到静态模式
            this.addStaticPatternKeywords(name, description, keywords)
        }
    }

    /**
     * 获取工具名称模式 - 从数据库动态学习
     */
    private async getToolNamePatterns(): Promise<Array<{
        pattern: string
        keywords: string[]
        confidence: number
        usage_count: number
    }>> {
        try {
            const dbService = getDatabaseService()
            const client = await dbService.getClient()
            if (!client) return this.getStaticPatterns()

            try {
                // 从数据库获取学习到的模式
                const result = await client.query(`
                    SELECT 
                        pattern,
                        keywords,
                        confidence,
                        usage_count
                    FROM tool_name_patterns 
                    WHERE confidence > 0.3 
                    ORDER BY usage_count DESC, confidence DESC
                `)

                if (result.rows.length > 0) {
                    return result.rows.map(row => ({
                        pattern: row.pattern,
                        keywords: row.keywords,
                        confidence: parseFloat(row.confidence),
                        usage_count: parseInt(row.usage_count)
                    }))
                }

                // 如果数据库中没有模式，创建初始模式
                await this.initializeToolPatterns()
                return this.getStaticPatterns()

            } finally {
                client.release()
            }
        } catch (error) {
            console.warn('获取工具模式失败，使用静态模式:', error)
            return this.getStaticPatterns()
        }
    }

    /**
     * 获取静态模式（回退方案）
     */
    private getStaticPatterns(): Array<{
        pattern: string
        keywords: string[]
        confidence: number
        usage_count: number
    }> {
        return [
            {
                pattern: 'solve_*',
                keywords: ['解决', '求解', '解', 'solve', '问题', 'problem'],
                confidence: 0.9,
                usage_count: 100
            },
            {
                pattern: 'run_*',
                keywords: ['运行', '执行', '跑', 'run', 'execute'],
                confidence: 0.9,
                usage_count: 80
            },
            {
                pattern: '*_queens',
                keywords: ['皇后问题', 'n皇后', '八皇后', '8皇后', 'queens problem', '皇后', 'queen', 'queens'],
                confidence: 0.95,
                usage_count: 60
            },
            {
                pattern: '*_sudoku',
                keywords: ['数独', 'sudoku', '解数独', 'solve sudoku'],
                confidence: 0.95,
                usage_count: 40
            },
            {
                pattern: '*_example*',
                keywords: ['示例', '演示', 'demo', '例子', '运行示例', 'run example'],
                confidence: 0.85,
                usage_count: 70
            },
            {
                pattern: 'install*',
                keywords: ['安装', 'install', '安装包', 'package', '包管理'],
                confidence: 0.9,
                usage_count: 50
            },
            {
                pattern: '*_optimization*',
                keywords: ['优化', 'optimization', '最优化', 'optimize'],
                confidence: 0.85,
                usage_count: 30
            },
            {
                pattern: '*_lp*',
                keywords: ['线性规划', 'linear programming', 'lp', '规划', 'programming'],
                confidence: 0.8,
                usage_count: 25
            }
        ]
    }

    /**
     * 检查工具名称是否匹配模式
     */
    private matchesPattern(toolName: string, pattern: { pattern: string }): boolean {
        const regex = new RegExp(
            '^' + pattern.pattern.replace(/\*/g, '.*') + '$',
            'i'
        )
        return regex.test(toolName)
    }

    /**
     * 从模式生成关键词
     */
    private async generateKeywordsFromPattern(toolName: string, pattern: {
        pattern: string
        keywords: string[]
        confidence: number
    }): Promise<string[]> {
        const keywords = [...pattern.keywords]

        // 基于工具名称的特定部分生成额外关键词
        if (pattern.pattern.includes('*')) {
            const wildcardParts = this.extractWildcardParts(toolName, pattern.pattern)
            for (const part of wildcardParts) {
                if (part.length > 2) {
                    keywords.push(part)
                    // 添加变体
                    keywords.push(part.replace(/_/g, ' '))
                    keywords.push(part.replace(/_/g, ''))
                }
            }
        }

        return keywords
    }

    /**
     * 提取通配符部分
     */
    private extractWildcardParts(toolName: string, pattern: string): string[] {
        const parts: string[] = []

        // 将模式转换为正则表达式，捕获通配符部分
        const regexPattern = pattern.replace(/\*/g, '(.*?)')
        const regex = new RegExp('^' + regexPattern + '$', 'i')
        const match = toolName.match(regex)

        if (match) {
            // 跳过第一个元素（完整匹配），获取捕获组
            for (let i = 1; i < match.length; i++) {
                if (match[i] && match[i].length > 0) {
                    parts.push(match[i])
                }
            }
        }

        return parts
    }

    /**
     * 识别描述中的模式
     */
    private async identifyDescriptionPatterns(description: string): Promise<string[]> {
        const patterns: string[] = []
        const descLower = description.toLowerCase()

        // 数学/算法模式
        if (descLower.includes('optimization') || descLower.includes('optimize')) {
            patterns.push('optimization')
        }
        if (descLower.includes('linear programming') || descLower.includes('lp')) {
            patterns.push('linear_programming')
        }
        if (descLower.includes('constraint') || descLower.includes('csp')) {
            patterns.push('constraint_satisfaction')
        }
        if (descLower.includes('game') || descLower.includes('minimax')) {
            patterns.push('game_theory')
        }
        if (descLower.includes('graph') || descLower.includes('coloring')) {
            patterns.push('graph_theory')
        }

        return patterns
    }

    /**
     * 从描述模式生成关键词
     */
    private async generateKeywordsFromDescriptionPattern(pattern: string): Promise<string[]> {
        const patternKeywords: Record<string, string[]> = {
            'optimization': ['优化', '最优化', 'optimization', 'optimize', '最优解'],
            'linear_programming': ['线性规划', 'linear programming', 'lp', '规划问题'],
            'constraint_satisfaction': ['约束满足', 'constraint', 'csp', '约束问题'],
            'game_theory': ['博弈论', 'game theory', 'minimax', '游戏', '对弈'],
            'graph_theory': ['图论', 'graph theory', '图着色', 'coloring', '图算法']
        }

        return patternKeywords[pattern] || []
    }

    /**
     * 添加静态模式关键词（回退方案）
     */
    private addStaticPatternKeywords(name: string, description: string, keywords: Set<string>): void {
        // 特定领域的关键词 - 扩展版本
        if (name.includes('queens') || name.includes('n_queens')) {
            ['皇后问题', 'n皇后', '八皇后', '8皇后', 'queens problem', '皇后', 'queen', 'queens', 'n queens', 'solve_n_queens'].forEach(k => keywords.add(k))
        }

        if (name.includes('sudoku')) {
            ['数独', 'sudoku', '解数独', 'solve sudoku'].forEach(k => keywords.add(k))
        }

        if (name.includes('example')) {
            ['示例', '演示', 'demo', '例子', '运行示例', 'run example'].forEach(k => keywords.add(k))
        }

        // 添加动作关键词 - 扩展版本
        if (name.includes('solve')) {
            ['解决', '求解', '解', 'solve', '问题', 'problem'].forEach(k => keywords.add(k))
        }

        if (name.includes('run')) {
            ['运行', '执行', '跑', 'run', 'execute'].forEach(k => keywords.add(k))
        }

        if (name.includes('install')) {
            ['安装', 'install', '安装包', 'package'].forEach(k => keywords.add(k))
        }
    }

    /**
     * 添加从历史使用中学习的关键词
     */
    private async addLearnedKeywords(toolName: string, keywords: Set<string>): Promise<void> {
        try {
            const dbService = getDatabaseService()
            const client = await dbService.getClient()
            if (!client) return

            try {
                // 从工具使用统计中学习常用的用户输入模式
                const result = await client.query(`
                    SELECT user_input, COUNT(*) as usage_count
                    FROM tool_usage_stats 
                    WHERE tool_name = $1 AND success = true
                    GROUP BY user_input
                    HAVING COUNT(*) >= 2
                    ORDER BY usage_count DESC
                    LIMIT 10
                `, [toolName])

                for (const row of result.rows) {
                    const userInput = row.user_input.toLowerCase()
                    // 提取用户输入中的关键词
                    const inputWords = userInput.split(/\s+/).filter((word: string) => word.length > 2)
                    inputWords.forEach((word: string) => keywords.add(word))
                }
            } finally {
                client.release()
            }
        } catch (error) {
            console.warn(`获取工具 ${toolName} 的学习关键词失败:`, error)
        }
    }

    /**
     * 添加语义相似关键词（使用pgvector）
     */
    private async addSemanticKeywords(toolName: string, description: string, keywords: Set<string>): Promise<void> {
        try {
            // 检查是否启用了向量搜索
            const { getEmbeddingService } = await import('./embedding-service')
            const embeddingService = getEmbeddingService()

            // 为工具描述生成嵌入向量
            const embedding = await embeddingService.generateEmbedding(description)

            // 查找语义相似的工具和关键词
            const similarKeywords = await this.findSemanticallySimilarKeywords(embedding)
            similarKeywords.forEach(keyword => keywords.add(keyword))

        } catch (error) {
            console.warn(`为工具 ${toolName} 生成语义关键词失败:`, error)
        }
    }

    /**
     * 查找语义相似的关键词
     */
    private async findSemanticallySimilarKeywords(embedding: number[]): Promise<string[]> {
        try {
            const dbService = getDatabaseService()
            const client = await dbService.getClient()
            if (!client) return []

            try {
                // 使用pgvector查找相似的关键词
                const result = await client.query(`
                    SELECT keyword, 1 - (embedding <=> $1) as similarity
                    FROM keyword_embeddings
                    WHERE 1 - (embedding <=> $1) > 0.7
                    ORDER BY similarity DESC
                    LIMIT 5
                `, [JSON.stringify(embedding)])

                return result.rows.map(row => row.keyword)
            } finally {
                client.release()
            }
        } catch (error) {
            console.warn('语义关键词查找失败:', error)
            return []
        }
    }

    /**
     * 初始化工具模式表
     */
    private async initializeToolPatterns(): Promise<void> {
        try {
            const dbService = getDatabaseService()
            const client = await dbService.getClient()
            if (!client) return

            try {
                // 创建工具名称模式表
                await client.query(`
                    CREATE TABLE IF NOT EXISTS tool_name_patterns (
                        id SERIAL PRIMARY KEY,
                        pattern VARCHAR(255) NOT NULL UNIQUE,
                        keywords TEXT[] NOT NULL,
                        confidence FLOAT DEFAULT 0.5,
                        usage_count INTEGER DEFAULT 0,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                `)

                // 插入初始模式
                const staticPatterns = this.getStaticPatterns()
                for (const pattern of staticPatterns) {
                    await client.query(`
                        INSERT INTO tool_name_patterns (pattern, keywords, confidence, usage_count)
                        VALUES ($1, $2, $3, $4)
                        ON CONFLICT (pattern) DO UPDATE SET
                            keywords = EXCLUDED.keywords,
                            confidence = EXCLUDED.confidence,
                            usage_count = EXCLUDED.usage_count,
                            updated_at = CURRENT_TIMESTAMP
                    `, [pattern.pattern, pattern.keywords, pattern.confidence, pattern.usage_count])
                }

                console.log('工具模式表初始化完成')
            } finally {
                client.release()
            }
        } catch (error) {
            console.error('初始化工具模式表失败:', error)
        }
    }

    /**
     * 获取工具特定的关键词 - 从数据库动态获取
     */
    private async getToolSpecificKeywords(toolName: string): Promise<string[]> {
        try {
            // 从数据库获取该工具的关键词映射
            const dbService = getDatabaseService()
            const client = await dbService.getClient()
            if (!client) {
                return this.getFallbackKeywords(toolName)
            }

            try {
                const result = await client.query(
                    'SELECT keyword FROM tool_keyword_mappings WHERE tool_name = $1',
                    [toolName]
                )

                if (result.rows.length > 0) {
                    const keywords = result.rows.map(row => row.keyword)
                    console.log(`从数据库获取工具 ${toolName} 的关键词: ${keywords.length} 个`)
                    return keywords
                }

                // 如果数据库中没有，生成并存储基础关键词
                const fallbackKeywords = this.getFallbackKeywords(toolName)
                if (fallbackKeywords.length > 0) {
                    console.log(`为工具 ${toolName} 生成并存储基础关键词`)
                    await this.storeKeywordsToDatabase(toolName, fallbackKeywords)
                }
                return fallbackKeywords

            } finally {
                client.release()
            }
        } catch (error) {
            console.warn(`从数据库获取工具 ${toolName} 关键词失败，使用回退方案:`, error)
            return this.getFallbackKeywords(toolName)
        }
    }

    /**
     * 获取回退关键词（简化版本）
     */
    private getFallbackKeywords(toolName: string): string[] {
        // 基于工具名称生成基础关键词
        const keywords: string[] = [toolName]

        // 添加工具名称的变体
        if (toolName.includes('_')) {
            const parts = toolName.split('_')
            keywords.push(...parts.filter(part => part.length > 2))
            keywords.push(parts.join(' '))
        }

        // 基于工具名称模式添加关键词
        if (toolName.includes('solve')) {
            keywords.push('解决', '求解', 'solve')
        }
        if (toolName.includes('run')) {
            keywords.push('运行', '执行', 'run')
        }
        if (toolName.includes('queens')) {
            keywords.push('皇后', 'queens', '皇后问题')
        }
        if (toolName.includes('sudoku')) {
            keywords.push('数独', 'sudoku')
        }
        if (toolName.includes('example')) {
            keywords.push('示例', 'example', 'demo')
        }
        if (toolName.includes('echo')) {
            keywords.push('回显', 'echo')
        }
        if (toolName.includes('install')) {
            keywords.push('安装', 'install')
        }

        return [...new Set(keywords)] // 去重
    }

    /**
     * 将关键词存储到数据库
     */
    private async storeKeywordsToDatabase(toolName: string, keywords: string[]): Promise<void> {
        try {
            const dbService = getDatabaseService()
            const client = await dbService.getClient()
            if (!client) return

            try {
                for (const keyword of keywords) {
                    await client.query(`
                        INSERT INTO tool_keyword_mappings (tool_name, keyword, confidence, source)
                        VALUES ($1, $2, $3, $4)
                        ON CONFLICT (tool_name, keyword) DO NOTHING
                    `, [toolName, keyword, 0.8, 'auto_generated'])
                }
                console.log(`为工具 ${toolName} 存储了 ${keywords.length} 个关键词到数据库`)
            } finally {
                client.release()
            }
        } catch (error) {
            console.error(`存储关键词到数据库失败:`, error)
        }
    }

    /**
     * 动态生成参数映射
     */
    private async generateDynamicParameterMappings(
        toolName: string,
        validParameters: string[],
        mappings: Record<string, string>
    ): Promise<void> {
        try {
            // 从数据库获取现有的参数映射
            const dbService = getDatabaseService()
            const client = await dbService.getClient()
            if (!client) return

            try {
                const existingMappings = await client.query(
                    'SELECT user_input, mcp_parameter FROM tool_parameter_mappings WHERE tool_name = $1',
                    [toolName]
                )

                // 使用现有映射
                existingMappings.rows.forEach(row => {
                    mappings[row.user_input] = row.mcp_parameter
                })

                // 如果没有现有映射，生成基础映射
                if (existingMappings.rows.length === 0) {
                    this.generateBasicParameterMappings(toolName, validParameters, mappings)
                }
            } finally {
                client.release()
            }
        } catch (error) {
            console.warn(`生成工具 ${toolName} 的动态参数映射失败:`, error)
            // 回退到基础映射生成
            this.generateBasicParameterMappings(toolName, validParameters, mappings)
        }
    }

    /**
     * 生成基础参数映射（回退方案）
     */
    private generateBasicParameterMappings(
        toolName: string,
        validParameters: string[],
        mappings: Record<string, string>
    ): void {
        // 基于工具类型生成基础映射
        if (toolName === 'run_example' && validParameters.length > 0) {
            const defaultParam = validParameters.includes('lp') ? 'lp' : validParameters[0]
            mappings['basic'] = defaultParam
            mappings['simple'] = defaultParam
            mappings['linear'] = validParameters.includes('lp') ? 'lp' : defaultParam
            mappings['constraint'] = validParameters.includes('csp') ? 'csp' : defaultParam
            mappings['queens'] = validParameters.includes('n_queens') ? 'n_queens' : defaultParam
            mappings['optimization'] = validParameters.find(p => p.includes('optimization')) || defaultParam
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
    private async generateParameterMappings(toolName: string, validParameters: string[]): Promise<Record<string, string>> {
        const mappings: Record<string, string> = {}

        // 为特定工具生成参数映射 - 使用动态逻辑而不是硬编码
        try {
            await this.generateDynamicParameterMappings(toolName, validParameters, mappings)
        } catch (error) {
            console.warn(`生成参数映射失败，使用基础映射:`, error)
            this.generateBasicParameterMappings(toolName, validParameters, mappings)
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
          ON CONFLICT (tool_name, keyword) DO UPDATE SET
            confidence = EXCLUDED.confidence,
            source = EXCLUDED.source
        `, [toolName, keyword, 1.0, 'auto_extracted'])
            }

            console.log(`Updated ${keywords.length} keyword mappings for tool: ${toolName}`)
        } catch (error) {
            console.error(`Failed to update keyword mappings for ${toolName}:`, error)
            throw error
        } finally {
            client.release()
        }
    }

    /**
     * 验证关键词映射是否存在，如果不存在则强制创建
     */
    async ensureKeywordMappingsExist(): Promise<void> {
        console.log('验证关键词映射是否存在...')

        const dbService = getDatabaseService()
        const client = await dbService.getClient()
        if (!client) return

        try {
            // 检查是否有关键词映射
            const result = await client.query('SELECT COUNT(*) as count FROM tool_keyword_mappings')
            const mappingCount = parseInt(result.rows[0].count)

            console.log(`当前关键词映射数量: ${mappingCount}`)

            if (mappingCount === 0) {
                console.log('没有关键词映射，强制创建...')
                await this.forceCreateKeywordMappings()
            } else {
                // 检查特定工具的映射
                const criticalTools = ['solve_n_queens', 'solve_sudoku', 'run_example']
                for (const toolName of criticalTools) {
                    const toolResult = await client.query(
                        'SELECT COUNT(*) as count FROM tool_keyword_mappings WHERE tool_name = $1',
                        [toolName]
                    )
                    const toolMappingCount = parseInt(toolResult.rows[0].count)

                    if (toolMappingCount === 0) {
                        console.log(`工具 ${toolName} 缺少关键词映射，创建中...`)
                        await this.createKeywordMappingsForTool(toolName)
                    }
                }
            }
        } finally {
            client.release()
        }
    }

    /**
     * 强制创建关键词映射
     */
    private async forceCreateKeywordMappings(): Promise<void> {
        try {
            // 获取所有可用工具
            const mcpToolsService = getMCPToolsService()
            const tools = await mcpToolsService.getAvailableTools()

            console.log(`为 ${tools.length} 个工具创建关键词映射...`)

            for (const tool of tools) {
                await this.createKeywordMappingsForTool(tool.name, tool.description)
            }

            console.log('强制创建关键词映射完成')
        } catch (error) {
            console.error('强制创建关键词映射失败:', error)
            throw error
        }
    }

    /**
     * 为特定工具创建关键词映射
     */
    private async createKeywordMappingsForTool(toolName: string, description?: string): Promise<void> {
        const keywords = await this.getToolSpecificKeywords(toolName)

        // 如果有描述，也从描述中提取关键词
        if (description) {
            const extractedKeywords = await this.extractKeywords(toolName, description)
            keywords.push(...extractedKeywords)
        }

        // 去重
        const uniqueKeywords = Array.from(new Set(keywords))

        if (uniqueKeywords.length > 0) {
            await this.updateKeywordMappings(toolName, uniqueKeywords)
            console.log(`为工具 ${toolName} 创建了 ${uniqueKeywords.length} 个关键词映射`)
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

            // 改进分词处理用户输入，支持中文
            const inputWords = []

            // 添加整个输入
            inputWords.push(inputLower)

            // 英文分词
            const englishWords = inputLower.split(/\s+/).filter(word => word.length > 1)
            inputWords.push(...englishWords)

            // 动态中文关键词提取 - 从数据库获取常用中文关键词
            try {
                const dbService = getDatabaseService()
                const client = await dbService.getClient()
                if (client) {
                    try {
                        // 获取所有中文关键词（包含中文字符的关键词）
                        const chineseKeywordsResult = await client.query(`
                            SELECT DISTINCT keyword 
                            FROM tool_keyword_mappings 
                            WHERE keyword ~ '[\\u4e00-\\u9fff]'
                            AND LENGTH(keyword) <= 10
                        `)

                        const chineseKeywords = chineseKeywordsResult.rows.map(row => row.keyword)
                        chineseKeywords.forEach(keyword => {
                            if (inputLower.includes(keyword)) {
                                inputWords.push(keyword)
                            }
                        })
                    } finally {
                        client.release()
                    }
                }
            } catch (error) {
                console.warn('获取中文关键词失败，使用基础关键词:', error)
                // 回退到基础中文关键词
                const basicChineseKeywords = ['解决', '皇后', '问题', '数独', '示例', '运行', '求解']
                basicChineseKeywords.forEach(keyword => {
                    if (inputLower.includes(keyword)) {
                        inputWords.push(keyword)
                    }
                })
            }

            // 数字+中文组合
            const numberChineseMatches = inputLower.match(/\d+[^\d\s\w]+/g)
            if (numberChineseMatches) {
                inputWords.push(...numberChineseMatches)
            }

            // 去重
            const uniqueWords = [...new Set(inputWords)]

            // 使用改进的关键词匹配查找相关工具
            const result = await client.query(`
        SELECT DISTINCT t.name as tool_name, 
               array_agg(DISTINCT tkm.keyword) as keywords,
               -- 改进的置信度计算：更准确的匹配评分
               CASE 
                 -- 完全精确匹配 (最高置信度 0.8-1.0)
                 WHEN COUNT(CASE WHEN tkm.keyword = ANY($2) THEN 1 END) > 0 THEN
                   LEAST(1.0, 
                     0.8 + -- 基础精确匹配分数
                     (COUNT(CASE WHEN tkm.keyword = ANY($2) THEN 1 END) * 0.05) + -- 多关键词匹配奖励
                     (CASE 
                       WHEN MAX(CASE WHEN tkm.keyword = ANY($2) THEN LENGTH(tkm.keyword) ELSE 0 END) >= 6 
                       THEN 0.1 -- 长关键词奖励
                       ELSE 0 
                     END)
                   )
                 -- 部分匹配 (中等置信度 0.4-0.7)
                 WHEN COUNT(CASE WHEN $1 ILIKE '%' || tkm.keyword || '%' THEN 1 END) > 0 THEN
                   LEAST(0.7,
                     0.4 + -- 基础部分匹配分数
                     (COUNT(CASE WHEN $1 ILIKE '%' || tkm.keyword || '%' THEN 1 END) * 0.08) + -- 多关键词部分匹配奖励
                     (CASE 
                       WHEN MAX(CASE WHEN $1 ILIKE '%' || tkm.keyword || '%' THEN LENGTH(tkm.keyword) ELSE 0 END) >= 4 
                       THEN 0.1 -- 长关键词奖励
                       ELSE 0 
                     END)
                   )
                 -- 模糊匹配 (较低置信度 0.1-0.4)
                 ELSE
                   LEAST(0.4,
                     0.1 + -- 基础模糊匹配分数
                     (COUNT(CASE WHEN tkm.keyword ILIKE ANY($3) THEN 1 END) * 0.05) -- 模糊匹配奖励
                   )
               END as confidence
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
                uniqueWords,
                uniqueWords.map(word => `%${word}%`)
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