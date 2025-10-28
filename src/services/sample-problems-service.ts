// Sample Problems Service - 基于PostgreSQL的动态样例问题管理

import { getDatabaseService } from './database'
import { getDynamicConfigService } from './dynamic-config-service'
import { MCPServerManager } from './mcp-server-manager'

export interface SampleProblem {
  id: string
  category: string
  title: string
  title_en?: string
  description: string
  description_en?: string
  problem_type: string
  difficulty: 'easy' | 'medium' | 'hard'
  parameters: Record<string, any>
  expected_solution?: Record<string, any>
  keywords: string[]
  tool_name: string
  created_at: string
  updated_at?: string
  generation_source?: 'template' | 'mcp' | 'learned' | 'manual'
  popularity_score?: number
  success_rate?: number
}

export interface ProblemSearchOptions {
  category?: string
  problem_type?: string
  difficulty?: string
  tool_name?: string
  keywords?: string[]
  limit?: number
}

/**
 * 样例问题服务
 */
export class SampleProblemsService {
  private static instance: SampleProblemsService
  private configService = getDynamicConfigService()

  private constructor() { }

  public static getInstance(): SampleProblemsService {
    if (!SampleProblemsService.instance) {
      SampleProblemsService.instance = new SampleProblemsService()
    }
    return SampleProblemsService.instance
  }

  /**
   * 获取所有样例问题
   */
  async getAllProblems(): Promise<SampleProblem[]> {
    const dbService = getDatabaseService()
    const client = await dbService.getClient()

    if (!client) {
      return []
    }

    try {
      const result = await client.query(`
        SELECT * FROM sample_problems 
        ORDER BY difficulty, category, title
      `)

      return result.rows.map(this.mapRowToProblem)
    } catch (error) {
      console.error('获取样例问题失败:', error)
      return []
    } finally {
      client.release()
    }
  }

  /**
   * 根据ID获取样例问题
   */
  async getProblemById(id: string): Promise<SampleProblem | null> {
    const dbService = getDatabaseService()
    const client = await dbService.getClient()

    if (!client) {
      return null
    }

    try {
      const result = await client.query(
        'SELECT * FROM sample_problems WHERE id = $1',
        [id]
      )

      if (result.rows.length === 0) {
        return null
      }

      return this.mapRowToProblem(result.rows[0])
    } catch (error) {
      console.error('获取样例问题失败:', error)
      return null
    } finally {
      client.release()
    }
  }

  /**
   * 根据条件搜索样例问题
   */
  async searchProblems(options: ProblemSearchOptions): Promise<SampleProblem[]> {
    const dbService = getDatabaseService()
    const client = await dbService.getClient()

    if (!client) {
      return []
    }

    try {
      let query = 'SELECT * FROM sample_problems WHERE 1=1'
      const params: any[] = []
      let paramIndex = 1

      // 构建查询条件
      if (options.category) {
        query += ` AND category = $${paramIndex}`
        params.push(options.category)
        paramIndex++
      }

      if (options.problem_type) {
        query += ` AND problem_type = $${paramIndex}`
        params.push(options.problem_type)
        paramIndex++
      }

      if (options.difficulty) {
        query += ` AND difficulty = $${paramIndex}`
        params.push(options.difficulty)
        paramIndex++
      }

      if (options.tool_name) {
        query += ` AND tool_name = $${paramIndex}`
        params.push(options.tool_name)
        paramIndex++
      }

      if (options.keywords && options.keywords.length > 0) {
        query += ` AND keywords && $${paramIndex}`
        params.push(options.keywords)
        paramIndex++
      }

      query += ' ORDER BY difficulty, category, title'

      if (options.limit) {
        query += ` LIMIT $${paramIndex}`
        params.push(options.limit)
      }

      const result = await client.query(query, params)
      return result.rows.map(this.mapRowToProblem)
    } catch (error) {
      console.error('搜索样例问题失败:', error)
      return []
    } finally {
      client.release()
    }
  }

  /**
   * 获取问题统计分析
   */
  async getProblemAnalytics(days: number = 7): Promise<any> {
    const dbService = getDatabaseService()
    const client = await dbService.getClient()

    if (!client) {
      return {
        categories: [],
        difficulties: [],
        tools: [],
        trends: [],
        totalProblems: 0
      }
    }

    try {
      // 简化的统计查询
      const categoryStats = await client.query(`
        SELECT category, COUNT(*) as count 
        FROM sample_problems 
        GROUP BY category 
        ORDER BY count DESC
      `)

      const difficultyStats = await client.query(`
        SELECT difficulty, COUNT(*) as count 
        FROM sample_problems 
        GROUP BY difficulty 
        ORDER BY count DESC
      `)

      return {
        categories: categoryStats.rows,
        difficulties: difficultyStats.rows,
        tools: [],
        trends: [],
        totalProblems: categoryStats.rows.reduce((sum, row) => sum + parseInt(row.count), 0)
      }
    } catch (error) {
      console.error('获取问题分析失败:', error)
      return {
        categories: [],
        difficulties: [],
        tools: [],
        trends: [],
        totalProblems: 0
      }
    } finally {
      client.release()
    }
  }

  /**
   * 生成样例问题
   */
  async generateProblemsIntelligently(options: any = {}): Promise<SampleProblem[]> {
    try {
      // 基于MCP工具动态生成
      const mcpProblems = await this.generateProblemsFromMCP()
      return mcpProblems.slice(0, options.count || 5)
    } catch (error) {
      console.error('智能生成样例问题失败:', error)
      return []
    }
  }

  /**
   * 从MCP服务器生成样例问题
   */
  async generateProblemsFromMCP(): Promise<SampleProblem[]> {
    try {
      const mcpManager = MCPServerManager.getInstance()
      const servers = mcpManager.getServerStatus()
      
      const problems: SampleProblem[] = []
      
      for (const [serverName, serverInfo] of Object.entries(servers)) {
        if (serverInfo.status === 'connected' && serverInfo.tools.length > 0) {
          for (const tool of serverInfo.tools) {
            const problem = await this.generateProblemFromTool(tool, serverName)
            if (problem) {
              problems.push(problem)
            }
          }
        }
      }
      
      return problems
    } catch (error) {
      console.error('从MCP服务器生成样例问题失败:', error)
      return []
    }
  }

  /**
   * 根据MCP工具生成样例问题 - 使用模板系统
   */
  private async generateProblemFromTool(tool: any, serverName: string): Promise<SampleProblem | null> {
    try {
      // 首先尝试从数据库获取问题模板
      const template = await this.getProblemTemplate(tool.name)
      if (template) {
        return this.generateFromTemplate(template, tool, serverName)
      }

      // 如果没有模板，使用动态生成
      return this.generateDynamicProblem(tool, serverName)
    } catch (error) {
      console.error(`生成工具 ${tool.name} 的样例问题失败:`, error)
      return this.generateFallbackProblem(tool, serverName)
    }
  }

  /**
   * 从数据库获取问题模板
   */
  private async getProblemTemplate(toolName: string): Promise<any | null> {
    try {
      const dbService = getDatabaseService()
      const client = await dbService.getClient()
      if (!client) return null

      try {
        const result = await client.query(`
          SELECT 
            template_name,
            tool_name,
            category,
            difficulty,
            title_template,
            description_template,
            parameter_generators,
            expected_solution_template,
            keywords_template,
            generation_rules
          FROM sample_problem_templates 
          WHERE tool_name = $1 AND is_active = true
          ORDER BY priority DESC
          LIMIT 1
        `, [toolName])

        if (result.rows.length > 0) {
          return result.rows[0]
        }
        return null
      } finally {
        client.release()
      }
    } catch (error) {
      // 模板获取失败是正常情况，使用动态生成即可
      console.debug(`工具 ${toolName} 暂无问题模板，将使用动态生成`)
      return null
    }
  }

  /**
   * 根据模板生成问题
   */
  private generateFromTemplate(template: any, tool: any, serverName: string): SampleProblem {
    const toolName = tool.name
    
    // 生成参数（如果有参数生成器）
    let parameters = {}
    if (template.parameter_generators) {
      try {
        // 这里可以根据parameter_generators的规则生成实际参数
        parameters = typeof template.parameter_generators === 'string' 
          ? JSON.parse(template.parameter_generators) 
          : template.parameter_generators
      } catch (error) {
        console.warn('解析参数生成器失败:', error)
      }
    }

    // 处理期望解决方案
    let expectedSolution = {
      type: 'result',
      description: '工具执行结果'
    }
    if (template.expected_solution_template) {
      try {
        expectedSolution = typeof template.expected_solution_template === 'string'
          ? JSON.parse(template.expected_solution_template)
          : template.expected_solution_template
      } catch (error) {
        console.warn('解析期望解决方案模板失败:', error)
      }
    }
    
    return {
      id: `mcp-${serverName}-${toolName}-${Date.now()}`,
      category: template.category || 'general',
      title: template.title_template || tool.description || toolName,
      title_en: template.title_template || tool.description || toolName,
      description: template.description_template || `使用${toolName}工具处理问题`,
      description_en: template.description_template || `Use ${toolName} tool to solve problems`,
      problem_type: 'general', // 可以从generation_rules中推断
      difficulty: template.difficulty || 'medium',
      parameters: parameters,
      expected_solution: expectedSolution,
      keywords: template.keywords_template || [toolName, 'tool', 'mcp'],
      tool_name: toolName,
      created_at: new Date().toISOString(),
      generation_source: 'template'
    }
  }

  /**
   * 动态生成问题（基于工具元数据）
   */
  private async generateDynamicProblem(tool: any, serverName: string): Promise<SampleProblem> {
    const toolName = tool.name
    
    // 从工具元数据服务获取关键词
    let keywords = [toolName, 'tool', 'mcp']
    try {
      const { getToolMetadataService } = await import('./tool-metadata-service')
      const metadataService = getToolMetadataService()
      const suggestions = await metadataService.getToolSuggestions(toolName)
      
      if (suggestions.length > 0) {
        keywords = [...new Set([...keywords, ...suggestions[0].keywords])]
      }
    } catch (error) {
      console.warn('获取工具关键词失败:', error)
    }

    // 基于工具名称推断类别和难度
    const category = this.inferCategory(toolName)
    const difficulty = this.inferDifficulty(toolName)
    const problemType = this.inferProblemType(toolName)

    return {
      id: `mcp-${serverName}-${toolName}-${Date.now()}`,
      category,
      title: tool.description || toolName,
      title_en: tool.description || toolName,
      description: tool.description || `使用${toolName}工具处理问题`,
      description_en: tool.description || `Use ${toolName} tool to solve problems`,
      problem_type: problemType,
      difficulty,
      parameters: this.generateDefaultParameters(toolName),
      expected_solution: {
        type: 'result',
        description: '工具执行结果'
      },
      keywords,
      tool_name: toolName,
      created_at: new Date().toISOString(),
      generation_source: 'mcp'
    }
  }

  /**
   * 推断工具类别
   */
  private inferCategory(toolName: string): string {
    if (toolName.includes('solve')) return 'algorithm'
    if (toolName.includes('run') || toolName.includes('example')) return 'demo'
    if (toolName.includes('echo') || toolName.includes('info')) return 'utility'
    if (toolName.includes('install')) return 'system'
    if (toolName.includes('optimization')) return 'optimization'
    if (toolName.includes('game')) return 'game'
    return 'general'
  }

  /**
   * 推断问题难度
   */
  private inferDifficulty(toolName: string): 'easy' | 'medium' | 'hard' {
    if (toolName.includes('echo') || toolName.includes('info') || toolName.includes('run_example')) {
      return 'easy'
    }
    if (toolName.includes('optimization') || toolName.includes('minimax')) {
      return 'hard'
    }
    return 'medium'
  }

  /**
   * 推断问题类型
   */
  private inferProblemType(toolName: string): string {
    if (toolName.includes('queens')) return 'n_queens'
    if (toolName.includes('sudoku')) return 'sudoku'
    if (toolName.includes('example')) return 'example'
    if (toolName.includes('optimization')) return 'optimization'
    if (toolName.includes('game')) return 'game'
    return 'general'
  }

  /**
   * 生成默认参数
   */
  private generateDefaultParameters(toolName: string): Record<string, any> {
    if (toolName.includes('queens')) {
      return { n: 8 }
    }
    if (toolName.includes('example')) {
      return { example_type: 'basic' }
    }
    return {}
  }

  /**
   * 生成回退问题（最简单的实现）
   */
  private generateFallbackProblem(tool: any, serverName: string): SampleProblem {
    const toolName = tool.name
    
    return {
      id: `mcp-${serverName}-${toolName}-fallback`,
      category: 'general',
      title: tool.description || toolName,
      title_en: tool.description || toolName,
      description: tool.description || `使用${toolName}工具处理问题`,
      description_en: tool.description || `Use ${toolName} tool to solve problems`,
      problem_type: 'general',
      difficulty: 'medium',
      parameters: {},
      expected_solution: {
        type: 'result',
        description: '工具执行结果'
      },
      keywords: [toolName, 'tool', 'mcp'],
      tool_name: toolName,
      created_at: new Date().toISOString(),
      generation_source: 'manual'
    }
  }

  /**
   * 获取推荐问题
   */
  async getRecommendedProblems(options: any = {}): Promise<SampleProblem[]> {
    try {
      // 首先尝试从MCP服务器生成
      const mcpProblems = await this.generateProblemsFromMCP()
      if (mcpProblems.length > 0) {
        return mcpProblems.slice(0, options.limit || 5)
      }
    } catch (error) {
      console.error('从MCP生成样例问题失败，回退到数据库:', error)
    }
    
    // 回退到数据库
    return this.getAllProblems()
  }

  /**
   * 记录问题使用情况
   */
  async recordProblemUsage(
    problemId: string, 
    userSession: string, 
    success: boolean, 
    satisfaction?: number
  ): Promise<void> {
    const dbService = getDatabaseService()
    const client = await dbService.getClient()

    if (!client) {
      return
    }

    try {
      // 获取问题信息
      const problem = await this.getProblemById(problemId)
      if (!problem) {
        return
      }

      // 记录使用行为
      await client.query(`
        INSERT INTO user_behavior_patterns (
          user_session, input_text, selected_tool, parameters_used,
          execution_success, user_satisfaction
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        userSession,
        `sample_problem:${problemId}`,
        problem.tool_name,
        JSON.stringify(problem.parameters),
        success,
        satisfaction
      ])

      console.log(`记录问题使用: ${problemId} (成功: ${success})`)
    } catch (error) {
      console.error('记录问题使用失败:', error)
    } finally {
      client.release()
    }
  }

  /**
   * 将数据库行映射为问题对象
   */
  private mapRowToProblem(row: any): SampleProblem {
    return {
      id: row.id,
      category: row.category,
      title: row.title,
      title_en: row.title_en,
      description: row.description,
      description_en: row.description_en,
      problem_type: row.problem_type,
      difficulty: row.difficulty,
      parameters: row.parameters,
      expected_solution: row.expected_solution,
      keywords: row.keywords,
      tool_name: row.tool_name,
      created_at: row.created_at,
      updated_at: row.updated_at,
      generation_source: row.generation_source,
      popularity_score: row.popularity_score,
      success_rate: row.success_rate
    }
  }
}

/**
 * 便利函数
 */
export const getSampleProblemsService = () => SampleProblemsService.getInstance()