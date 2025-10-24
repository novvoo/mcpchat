// Dynamic Pattern Learner - 动态学习工具名称模式和关键词

import { getDatabaseService } from './database'
import { getMCPToolsService } from './mcp-tools'

export interface ToolPattern {
    pattern: string
    keywords: string[]
    confidence: number
    usage_count: number
    examples: string[]
}

export interface KeywordLearningResult {
    newKeywords: string[]
    updatedPatterns: string[]
    confidence: number
}

/**
 * 动态模式学习器 - 基于PostgreSQL/pgvector的智能关键词生成
 */
export class DynamicPatternLearner {
    private static instance: DynamicPatternLearner

    private constructor() { }

    public static getInstance(): DynamicPatternLearner {
        if (!DynamicPatternLearner.instance) {
            DynamicPatternLearner.instance = new DynamicPatternLearner()
        }
        return DynamicPatternLearner.instance
    }

    /**
     * 初始化动态模式学习器
     */
    async initialize(): Promise<void> {
        try {
            await this.createTables()
            await this.initializeBasePatterns()
            console.log('Dynamic pattern learner initialized')
        } catch (error) {
            console.error('Failed to initialize dynamic pattern learner:', error)
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
            // 工具名称模式表
            await client.query(`
                CREATE TABLE IF NOT EXISTS tool_name_patterns (
                    id SERIAL PRIMARY KEY,
                    pattern VARCHAR(255) NOT NULL UNIQUE,
                    keywords TEXT[] NOT NULL,
                    confidence FLOAT DEFAULT 0.5,
                    usage_count INTEGER DEFAULT 0,
                    examples TEXT[] DEFAULT '{}',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `)

            // 关键词嵌入表（用于语义相似性）
            await client.query(`
                CREATE TABLE IF NOT EXISTS keyword_embeddings (
                    id SERIAL PRIMARY KEY,
                    keyword VARCHAR(255) NOT NULL UNIQUE,
                    embedding vector(1536),
                    tool_names TEXT[] DEFAULT '{}',
                    usage_count INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `)

            // 用户输入模式学习表
            await client.query(`
                CREATE TABLE IF NOT EXISTS user_input_patterns (
                    id SERIAL PRIMARY KEY,
                    input_pattern TEXT NOT NULL,
                    matched_tools TEXT[] NOT NULL,
                    success_rate FLOAT DEFAULT 0.0,
                    total_attempts INTEGER DEFAULT 0,
                    successful_attempts INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `)

            // 动态关键词生成日志
            await client.query(`
                CREATE TABLE IF NOT EXISTS keyword_generation_log (
                    id SERIAL PRIMARY KEY,
                    tool_name VARCHAR(255) NOT NULL,
                    generated_keywords TEXT[] NOT NULL,
                    generation_method VARCHAR(100) NOT NULL,
                    confidence FLOAT NOT NULL,
                    success BOOLEAN DEFAULT false,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `)

            console.log('Dynamic pattern learner tables created')
        } finally {
            client.release()
        }
    }

    /**
     * 初始化基础模式
     */
    private async initializeBasePatterns(): Promise<void> {
        const basePatterns: ToolPattern[] = [
            {
                pattern: 'solve_*',
                keywords: ['解决', '求解', '解', 'solve', '问题', 'problem', '算法', 'algorithm'],
                confidence: 0.9,
                usage_count: 0,
                examples: ['solve_n_queens', 'solve_sudoku', 'solve_lp']
            },
            {
                pattern: 'run_*',
                keywords: ['运行', '执行', '跑', 'run', 'execute', '启动', 'start'],
                confidence: 0.9,
                usage_count: 0,
                examples: ['run_example', 'run_test']
            },
            {
                pattern: '*_queens*',
                keywords: ['皇后', 'queens', '皇后问题', 'n皇后', '八皇后', '8皇后', 'n queens problem'],
                confidence: 0.95,
                usage_count: 0,
                examples: ['solve_n_queens', 'n_queens_problem']
            },
            {
                pattern: '*_sudoku*',
                keywords: ['数独', 'sudoku', '九宫格', '解数独', 'puzzle'],
                confidence: 0.95,
                usage_count: 0,
                examples: ['solve_sudoku', 'sudoku_solver']
            },
            {
                pattern: '*_optimization*',
                keywords: ['优化', 'optimization', '最优化', 'optimize', '最优解', 'optimal'],
                confidence: 0.85,
                usage_count: 0,
                examples: ['portfolio_optimization', 'scipy_optimization']
            },
            {
                pattern: '*_lp*',
                keywords: ['线性规划', 'linear programming', 'lp', '规划', 'programming', '线性'],
                confidence: 0.8,
                usage_count: 0,
                examples: ['solve_lp', 'optimized_lp']
            },
            {
                pattern: 'install*',
                keywords: ['安装', 'install', '安装包', 'package', '包管理', 'setup'],
                confidence: 0.9,
                usage_count: 0,
                examples: ['install', 'install_package']
            },
            {
                pattern: '*_game*',
                keywords: ['游戏', 'game', '博弈', '对弈', 'minimax', '游戏理论'],
                confidence: 0.8,
                usage_count: 0,
                examples: ['solve_24_point_game', 'minimax_game']
            }
        ]

        await this.storePatterns(basePatterns)
    }

    /**
     * 存储模式到数据库
     */
    private async storePatterns(patterns: ToolPattern[]): Promise<void> {
        const dbService = getDatabaseService()
        const client = await dbService.getClient()
        if (!client) return

        try {
            for (const pattern of patterns) {
                await client.query(`
                    INSERT INTO tool_name_patterns (pattern, keywords, confidence, usage_count, examples)
                    VALUES ($1, $2, $3, $4, $5)
                    ON CONFLICT (pattern) DO UPDATE SET
                        keywords = EXCLUDED.keywords,
                        confidence = EXCLUDED.confidence,
                        examples = EXCLUDED.examples,
                        updated_at = CURRENT_TIMESTAMP
                `, [pattern.pattern, pattern.keywords, pattern.confidence, pattern.usage_count, pattern.examples])
            }
        } finally {
            client.release()
        }
    }

    /**
     * 基于现有工具动态学习新模式
     */
    async learnPatternsFromExistingTools(): Promise<KeywordLearningResult> {
        try {
            const mcpToolsService = getMCPToolsService()
            const tools = await mcpToolsService.getAvailableTools()

            const newKeywords: string[] = []
            const updatedPatterns: string[] = []
            let totalConfidence = 0

            console.log(`开始从 ${tools.length} 个工具学习模式...`)

            for (const tool of tools) {
                const learningResult = await this.learnFromSingleTool(tool.name, tool.description)
                newKeywords.push(...learningResult.newKeywords)
                updatedPatterns.push(...learningResult.updatedPatterns)
                totalConfidence += learningResult.confidence
            }

            const avgConfidence = tools.length > 0 ? totalConfidence / tools.length : 0

            // 记录学习结果
            await this.logLearningResult(newKeywords, updatedPatterns, avgConfidence)

            return {
                newKeywords: [...new Set(newKeywords)],
                updatedPatterns: [...new Set(updatedPatterns)],
                confidence: avgConfidence
            }
        } catch (error) {
            console.error('从现有工具学习模式失败:', error)
            throw error
        }
    }

    /**
     * 从单个工具学习模式
     */
    private async learnFromSingleTool(toolName: string, description: string): Promise<KeywordLearningResult> {
        const newKeywords: string[] = []
        const updatedPatterns: string[] = []

        try {
            // 1. 分析工具名称结构
            const nameStructure = this.analyzeToolNameStructure(toolName)

            // 2. 查找或创建匹配的模式
            const matchingPattern = await this.findOrCreatePattern(nameStructure)

            // 3. 从描述中提取语义关键词
            const semanticKeywords = await this.extractSemanticKeywords(description)

            // 4. 生成基于名称的关键词
            const nameBasedKeywords = this.generateNameBasedKeywords(toolName)

            // 5. 合并并验证关键词
            const allKeywords = [...semanticKeywords, ...nameBasedKeywords]
            const validatedKeywords = await this.validateKeywords(allKeywords, toolName)

            // 6. 更新模式
            if (matchingPattern && validatedKeywords.length > 0) {
                await this.updatePattern(matchingPattern, validatedKeywords, toolName)
                updatedPatterns.push(matchingPattern)
                newKeywords.push(...validatedKeywords)
            }

            return {
                newKeywords,
                updatedPatterns,
                confidence: this.calculateLearningConfidence(validatedKeywords.length, nameStructure.complexity)
            }
        } catch (error) {
            console.warn(`从工具 ${toolName} 学习失败:`, error)
            return { newKeywords: [], updatedPatterns: [], confidence: 0 }
        }
    }

    /**
     * 分析工具名称结构
     */
    private analyzeToolNameStructure(toolName: string): {
        prefix: string
        suffix: string
        middle: string[]
        complexity: number
        pattern: string
    } {
        const parts = toolName.toLowerCase().split('_')

        return {
            prefix: parts[0] || '',
            suffix: parts[parts.length - 1] || '',
            middle: parts.slice(1, -1),
            complexity: parts.length,
            pattern: this.generatePatternFromName(toolName)
        }
    }

    /**
     * 从工具名称生成模式
     */
    private generatePatternFromName(toolName: string): string {
        const parts = toolName.split('_')

        // 生成通配符模式
        if (parts.length === 1) {
            return toolName + '*'
        }

        // 常见前缀模式
        const commonPrefixes = ['solve', 'run', 'execute', 'get', 'set', 'create', 'delete']
        const commonSuffixes = ['problem', 'game', 'optimization', 'solver', 'example']

        if (commonPrefixes.includes(parts[0])) {
            return parts[0] + '_*'
        }

        if (parts.length > 1 && commonSuffixes.includes(parts[parts.length - 1])) {
            return '*_' + parts[parts.length - 1]
        }

        // 中间关键词模式
        for (let i = 1; i < parts.length - 1; i++) {
            if (parts[i].length > 4) {
                return '*_' + parts[i] + '_*'
            }
        }

        return '*' + toolName + '*'
    }

    /**
     * 查找或创建匹配的模式
     */
    private async findOrCreatePattern(nameStructure: { pattern: string }): Promise<string | null> {
        const dbService = getDatabaseService()
        const client = await dbService.getClient()
        if (!client) return null

        try {
            // 查找现有模式
            const result = await client.query(
                'SELECT pattern FROM tool_name_patterns WHERE pattern = $1',
                [nameStructure.pattern]
            )

            if (result.rows.length > 0) {
                return result.rows[0].pattern
            }

            // 创建新模式
            await client.query(`
                INSERT INTO tool_name_patterns (pattern, keywords, confidence, usage_count)
                VALUES ($1, $2, $3, $4)
            `, [nameStructure.pattern, [], 0.5, 0])

            return nameStructure.pattern
        } finally {
            client.release()
        }
    }

    /**
     * 从描述中提取语义关键词
     */
    private async extractSemanticKeywords(description: string): Promise<string[]> {
        const keywords: string[] = []
        const descLower = description.toLowerCase()

        // 技术领域关键词
        const domainKeywordsMap: Record<string, string[]> = {
            'optimization': ['优化', 'optimization', 'optimize'],
            'linear programming': ['线性规划', 'linear programming', 'lp'],
            'constraint': ['约束', 'constraint', 'csp'],
            'game theory': ['博弈论', 'game theory', 'minimax'],
            'graph': ['图论', 'graph', 'coloring'],
            'scheduling': ['调度', 'scheduling', 'schedule'],
            'puzzle': ['谜题', 'puzzle', '游戏'],
            'algorithm': ['算法', 'algorithm', 'solve'],
            'mathematics': ['数学', 'mathematics', 'math'],
            'statistics': ['统计', 'statistics', 'statistical']
        }

        for (const [domain, domainKeywords] of Object.entries(domainKeywordsMap)) {
            if (descLower.includes(domain)) {
                keywords.push(...domainKeywords)
            }
        }

        // 动作关键词
        const actionWords = ['solve', 'run', 'execute', 'calculate', 'find', 'search', 'optimize']
        for (const action of actionWords) {
            if (descLower.includes(action)) {
                keywords.push(action)
                // 添加中文对应词
                const chineseActions: Record<string, string> = {
                    'solve': '解决',
                    'run': '运行',
                    'execute': '执行',
                    'calculate': '计算',
                    'find': '查找',
                    'search': '搜索',
                    'optimize': '优化'
                }
                if (chineseActions[action]) {
                    keywords.push(chineseActions[action])
                }
            }
        }

        return [...new Set(keywords)]
    }

    /**
     * 生成基于名称的关键词
     */
    private generateNameBasedKeywords(toolName: string): string[] {
        const keywords: string[] = []
        const parts = toolName.toLowerCase().split('_')

        // 添加完整名称
        keywords.push(toolName)

        // 添加各个部分
        parts.forEach(part => {
            if (part.length > 2) {
                keywords.push(part)
                // 添加无下划线版本
                keywords.push(part.replace(/_/g, ''))
            }
        })

        // 添加组合
        if (parts.length > 1) {
            keywords.push(parts.join(' '))
            keywords.push(parts.join(''))
        }

        return [...new Set(keywords)]
    }

    /**
     * 验证关键词的有效性
     */
    private async validateKeywords(keywords: string[], toolName: string): Promise<string[]> {
        const validKeywords: string[] = []

        for (const keyword of keywords) {
            // 基本验证
            if (keyword.length < 2 || keyword.length > 50) continue

            // 检查是否为有意义的关键词
            if (this.isValidKeyword(keyword)) {
                validKeywords.push(keyword)
            }
        }

        return [...new Set(validKeywords)]
    }

    /**
     * 检查关键词是否有效
     */
    private isValidKeyword(keyword: string): boolean {
        // 过滤无意义的词
        const stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by']
        if (stopWords.includes(keyword.toLowerCase())) return false

        // 检查是否包含有意义的字符
        if (!/[a-zA-Z\u4e00-\u9fff]/.test(keyword)) return false

        return true
    }

    /**
     * 更新模式
     */
    private async updatePattern(pattern: string, newKeywords: string[], toolName: string): Promise<void> {
        const dbService = getDatabaseService()
        const client = await dbService.getClient()
        if (!client) return

        try {
            // 获取现有关键词
            const result = await client.query(
                'SELECT keywords, examples FROM tool_name_patterns WHERE pattern = $1',
                [pattern]
            )

            if (result.rows.length > 0) {
                const existingKeywords = result.rows[0].keywords || []
                const existingExamples = result.rows[0].examples || []

                // 合并关键词
                const mergedKeywords = [...new Set([...existingKeywords, ...newKeywords])]
                const mergedExamples = [...new Set([...existingExamples, toolName])]

                // 更新模式
                await client.query(`
                    UPDATE tool_name_patterns 
                    SET keywords = $1, examples = $2, usage_count = usage_count + 1, updated_at = CURRENT_TIMESTAMP
                    WHERE pattern = $3
                `, [mergedKeywords, mergedExamples, pattern])
            }
        } finally {
            client.release()
        }
    }

    /**
     * 计算学习置信度
     */
    private calculateLearningConfidence(keywordCount: number, nameComplexity: number): number {
        const baseConfidence = Math.min(0.8, keywordCount * 0.1)
        const complexityBonus = Math.min(0.2, nameComplexity * 0.05)
        return Math.min(1.0, baseConfidence + complexityBonus)
    }

    /**
     * 记录学习结果
     */
    private async logLearningResult(newKeywords: string[], updatedPatterns: string[], confidence: number): Promise<void> {
        const dbService = getDatabaseService()
        const client = await dbService.getClient()
        if (!client) return

        try {
            await client.query(`
                INSERT INTO keyword_generation_log (tool_name, generated_keywords, generation_method, confidence, success)
                VALUES ($1, $2, $3, $4, $5)
            `, ['batch_learning', newKeywords, 'dynamic_pattern_learning', confidence, true])

            console.log(`学习结果已记录: ${newKeywords.length} 个新关键词, ${updatedPatterns.length} 个更新模式, 置信度: ${confidence.toFixed(2)}`)
        } finally {
            client.release()
        }
    }

    /**
     * 获取所有学习到的模式
     */
    async getLearnedPatterns(): Promise<ToolPattern[]> {
        const dbService = getDatabaseService()
        const client = await dbService.getClient()
        if (!client) return []

        try {
            const result = await client.query(`
                SELECT pattern, keywords, confidence, usage_count, examples
                FROM tool_name_patterns
                ORDER BY usage_count DESC, confidence DESC
            `)

            return result.rows.map(row => ({
                pattern: row.pattern,
                keywords: row.keywords,
                confidence: parseFloat(row.confidence),
                usage_count: parseInt(row.usage_count),
                examples: row.examples
            }))
        } finally {
            client.release()
        }
    }

    /**
     * 基于用户反馈更新模式
     */
    async updatePatternFromFeedback(toolName: string, userInput: string, success: boolean): Promise<void> {
        try {
            // 记录用户输入模式
            await this.recordUserInputPattern(userInput, [toolName], success)

            // 如果成功，从用户输入中学习新关键词
            if (success) {
                const inputKeywords = this.extractKeywordsFromUserInput(userInput)
                if (inputKeywords.length > 0) {
                    await this.addKeywordsToTool(toolName, inputKeywords)
                }
            }
        } catch (error) {
            console.error('从用户反馈更新模式失败:', error)
        }
    }

    /**
     * 记录用户输入模式
     */
    private async recordUserInputPattern(userInput: string, matchedTools: string[], success: boolean): Promise<void> {
        const dbService = getDatabaseService()
        const client = await dbService.getClient()
        if (!client) return

        try {
            const inputPattern = this.normalizeUserInput(userInput)

            await client.query(`
                INSERT INTO user_input_patterns (input_pattern, matched_tools, total_attempts, successful_attempts)
                VALUES ($1, $2, 1, $3)
                ON CONFLICT (input_pattern) DO UPDATE SET
                    matched_tools = array_cat(user_input_patterns.matched_tools, EXCLUDED.matched_tools),
                    total_attempts = user_input_patterns.total_attempts + 1,
                    successful_attempts = user_input_patterns.successful_attempts + EXCLUDED.successful_attempts,
                    success_rate = CAST(user_input_patterns.successful_attempts + EXCLUDED.successful_attempts AS FLOAT) / (user_input_patterns.total_attempts + 1),
                    updated_at = CURRENT_TIMESTAMP
            `, [inputPattern, matchedTools, success ? 1 : 0])
        } finally {
            client.release()
        }
    }

    /**
     * 标准化用户输入
     */
    private normalizeUserInput(userInput: string): string {
        return userInput.toLowerCase()
            .replace(/[^\w\s\u4e00-\u9fff]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
    }

    /**
     * 从用户输入中提取关键词
     */
    private extractKeywordsFromUserInput(userInput: string): string[] {
        const keywords: string[] = []
        const normalized = this.normalizeUserInput(userInput)

        // 分词
        const words = normalized.split(/\s+/).filter(word => word.length > 1)
        keywords.push(...words)

        // 添加完整输入（如果不太长）
        if (normalized.length <= 20) {
            keywords.push(normalized)
        }

        return [...new Set(keywords)]
    }

    /**
     * 为工具添加关键词
     */
    private async addKeywordsToTool(toolName: string, keywords: string[]): Promise<void> {
        const dbService = getDatabaseService()
        const client = await dbService.getClient()
        if (!client) return

        try {
            for (const keyword of keywords) {
                await client.query(`
                    INSERT INTO tool_keyword_mappings (tool_name, keyword, confidence, source)
                    VALUES ($1, $2, $3, $4)
                    ON CONFLICT (tool_name, keyword) DO UPDATE SET
                        confidence = GREATEST(tool_keyword_mappings.confidence, EXCLUDED.confidence)
                `, [toolName, keyword, 0.7, 'user_feedback'])
            }
        } finally {
            client.release()
        }
    }
}

/**
 * 便捷函数
 */
export const getDynamicPatternLearner = () => DynamicPatternLearner.getInstance()