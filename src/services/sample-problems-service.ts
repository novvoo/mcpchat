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
            const problem = this.generateProblemFromTool(tool, serverName)
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
   * 根据MCP工具生成样例问题
   */
  private generateProblemFromTool(tool: any, serverName: string): SampleProblem | null {
    const toolName = tool.name
    const description = tool.description || `使用${toolName}工具处理问题`
    
    switch (toolName) {
      case 'solve_n_queens':
        return {
          id: `mcp-${serverName}-n-queens-8`,
          category: 'algorithm',
          title: '8皇后问题',
          title_en: '8 Queens Problem',
          description: '在8×8的国际象棋棋盘上放置8个皇后，使得它们不能相互攻击',
          description_en: 'Place 8 queens on an 8×8 chessboard so that no two queens attack each other',
          problem_type: 'n_queens',
          difficulty: 'medium',
          parameters: { n: 8, board_size: 8 },
          expected_solution: {
            type: 'positions',
            description: '皇后的位置坐标'
          },
          keywords: ['皇后', '8皇后', 'queens', 'n-queens', 'chess', 'algorithm'],
          tool_name: toolName,
          created_at: new Date().toISOString(),
          generation_source: 'mcp'
        }
        
      case 'solve_sudoku':
        return {
          id: `mcp-${serverName}-sudoku-easy`,
          category: 'puzzle',
          title: '数独求解',
          title_en: 'Sudoku Solver',
          description: '解决9×9数独谜题',
          description_en: 'Solve 9×9 Sudoku puzzle',
          problem_type: 'sudoku',
          difficulty: 'easy',
          parameters: {
            puzzle: [
              [5,3,0,0,7,0,0,0,0],
              [6,0,0,1,9,5,0,0,0],
              [0,9,8,0,0,0,0,6,0],
              [8,0,0,0,6,0,0,0,3],
              [4,0,0,8,0,3,0,0,1],
              [7,0,0,0,2,0,0,0,6],
              [0,6,0,0,0,0,2,8,0],
              [0,0,0,4,1,9,0,0,5],
              [0,0,0,0,8,0,0,7,9]
            ]
          },
          expected_solution: {
            type: 'grid',
            description: '完整的数独解答'
          },
          keywords: ['数独', 'sudoku', 'puzzle', 'grid', '9x9'],
          tool_name: toolName,
          created_at: new Date().toISOString(),
          generation_source: 'mcp'
        }
        
      case 'run_example':
        return {
          id: `mcp-${serverName}-run-example`,
          category: 'demo',
          title: '运行示例',
          title_en: 'Run Example',
          description: '运行一个示例程序',
          description_en: 'Run an example program',
          problem_type: 'example',
          difficulty: 'easy',
          parameters: { example_type: 'basic' },
          expected_solution: {
            type: 'output',
            description: '示例程序的输出结果'
          },
          keywords: ['示例', 'example', 'demo', 'run'],
          tool_name: toolName,
          created_at: new Date().toISOString(),
          generation_source: 'mcp'
        }
        
      default:
        // 为其他工具生成通用样例问题
        return {
          id: `mcp-${serverName}-${toolName}`,
          category: 'general',
          title: tool.description || toolName,
          title_en: tool.description || toolName,
          description: description,
          description_en: description,
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
          generation_source: 'mcp'
        }
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