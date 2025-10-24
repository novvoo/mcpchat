// Error Handling Service with Examples - 带示例的错误处理服务

import { getDatabaseService } from './database'

export interface ToolExample {
    example: string
    description: string
    difficulty?: string
    category?: string
}

export interface ErrorWithExamples {
    error: string
    toolName: string
    examples: ToolExample[]
    suggestions: string[]
}

/**
 * 错误处理增强服务 - 在工具调用失败时提供相关示例
 */
export class ErrorHandlingService {
    private static instance: ErrorHandlingService

    private constructor() { }

    public static getInstance(): ErrorHandlingService {
        if (!ErrorHandlingService.instance) {
            ErrorHandlingService.instance = new ErrorHandlingService()
        }
        return ErrorHandlingService.instance
    }

    /**
     * 获取工具的示例和建议
     */
    async getToolExamplesAndSuggestions(toolName: string, errorType?: string): Promise<{
        examples: ToolExample[]
        suggestions: string[]
    }> {
        try {
            const dbService = getDatabaseService()
            const client = await dbService.getClient()
            if (!client) {
                return { examples: [], suggestions: [] }
            }

            try {
                // 从数据库获取工具示例
                const result = await client.query(
                    'SELECT examples, keywords FROM mcp_tools WHERE name = $1',
                    [toolName]
                )

                if (result.rows.length === 0) {
                    return { examples: [], suggestions: [] }
                }

                const tool = result.rows[0]
                const examples = this.formatExamples(tool.examples || [])
                const suggestions = this.generateSuggestions(toolName, errorType, tool.keywords || [])

                return { examples, suggestions }

            } finally {
                client.release()
            }
        } catch (error) {
            console.error('获取工具示例失败:', error)
            return { examples: [], suggestions: [] }
        }
    }

    /**
     * 格式化示例
     */
    private formatExamples(rawExamples: string[]): ToolExample[] {
        const examples: ToolExample[] = []

        for (const example of rawExamples) {
            // 跳过服务器标识示例
            if (example.includes('Server:')) continue

            // 解析示例格式
            const formatted = this.parseExample(example)
            if (formatted) {
                examples.push(formatted)
            }
        }

        // 限制示例数量，优先显示最有用的
        return examples.slice(0, 5)
    }

    /**
     * 解析单个示例
     */
    private parseExample(example: string): ToolExample | null {
        try {
            // 检查是否包含数组格式 [数字,数字,数字,数字]
            const arrayMatch = example.match(/\[([\d,\s]+)\]/)
            if (arrayMatch) {
                const numbers = arrayMatch[1].split(',').map(n => n.trim())
                return {
                    example: `{"numbers": [${numbers.join(', ')}]}`,
                    description: example,
                    difficulty: this.getDifficultyFromDescription(example)
                }
            }

            // 检查是否是JSON格式
            if (example.includes('{') && example.includes('}')) {
                return {
                    example: example.split(' - ')[0] || example,
                    description: example,
                    category: 'json'
                }
            }

            // 检查是否是参数格式
            if (example.includes(':')) {
                return {
                    example: example,
                    description: example,
                    category: 'parameter'
                }
            }

            // 中文描述示例
            if (example.includes('用') || example.includes('计算') || example.includes('求解')) {
                return {
                    example: example,
                    description: example,
                    category: 'chinese'
                }
            }

            return {
                example: example,
                description: example,
                category: 'general'
            }

        } catch (error) {
            console.warn('解析示例失败:', example, error)
            return null
        }
    }

    /**
     * 从描述中获取难度
     */
    private getDifficultyFromDescription(description: string): string {
        if (description.includes('简单') || description.includes('入门')) return 'easy'
        if (description.includes('中等') || description.includes('常见')) return 'medium'
        if (description.includes('巧妙') || description.includes('挑战') || description.includes('大数字')) return 'hard'
        if (description.includes('无解')) return 'impossible'
        return 'medium'
    }

    /**
     * 生成建议
     */
    private generateSuggestions(toolName: string, errorType?: string, keywords: string[] = []): string[] {
        const suggestions: string[] = []

        // 基于工具名称的通用建议
        if (toolName === 'solve_24_point_game') {
            suggestions.push('请提供4个数字，例如: [8, 8, 4, 13]')
            suggestions.push('支持中文描述: "用8、8、4、13算出24"')
            suggestions.push('支持英文描述: "solve 24 point game with [1,2,3,4]"')
            
            if (errorType === 'missing_parameters') {
                suggestions.push('缺少numbers参数，请提供4个数字的数组')
                suggestions.push('正确格式: {"numbers": [8, 8, 4, 13]}')
            }
        } else if (toolName === 'solve_n_queens') {
            suggestions.push('请提供棋盘大小，例如: {"n": 8}')
            suggestions.push('支持中文: "解决8皇后问题"')
            suggestions.push('支持英文: "solve 8 queens problem"')
        } else if (toolName === 'solve_sudoku') {
            suggestions.push('请提供9x9数独谜题数组')
            suggestions.push('支持中文: "解决数独游戏"')
            suggestions.push('0表示空格，1-9表示已填数字')
        }

        // 基于关键词的建议
        if (keywords.length > 0) {
            const keywordSample = keywords.slice(0, 3).join('、')
            suggestions.push(`可以使用这些关键词: ${keywordSample}`)
        }

        // 通用建议
        suggestions.push('尝试使用更自然的语言描述您的需求')
        suggestions.push('查看管理面板了解更多工具信息')

        return suggestions.slice(0, 6) // 限制建议数量
    }

    /**
     * 格式化错误消息，包含示例
     */
    async formatErrorWithExamples(
        toolName: string, 
        errorMessage: string, 
        errorType?: string
    ): Promise<string> {
        const { examples, suggestions } = await this.getToolExamplesAndSuggestions(toolName, errorType)

        let formatted = `❌ **工具调用失败**\n\n`
        formatted += `**工具:** ${toolName}\n`
        formatted += `**错误:** ${errorMessage}\n\n`

        if (examples.length > 0) {
            formatted += `📚 **使用示例:**\n\n`
            examples.forEach((example, index) => {
                formatted += `${index + 1}. ${example.description}\n`
                if (example.example !== example.description) {
                    formatted += `   格式: \`${example.example}\`\n`
                }
                formatted += `\n`
            })
        }

        if (suggestions.length > 0) {
            formatted += `💡 **建议:**\n\n`
            suggestions.forEach((suggestion, index) => {
                formatted += `${index + 1}. ${suggestion}\n`
            })
        }

        return formatted
    }
}

export const getErrorHandlingService = () => ErrorHandlingService.getInstance()
