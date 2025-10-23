// 初始化样例问题数据 - 从MCP服务器动态获取工具名称
const path = require('path')
const fs = require('fs')

// 动态导入 ES 模块
async function importDatabaseService() {
  const { getDatabaseService } = await import('../src/services/database.ts')
  return getDatabaseService
}

// 动态导入 MCP 服务器管理器
async function importMCPServerManager() {
  const { MCPServerManager } = await import('../src/services/mcp-server-manager.ts')
  return MCPServerManager
}

/**
 * 从MCP服务器获取可用工具并生成样例问题
 */
async function generateSampleProblemsFromMCP() {
  try {
    const MCPServerManager = await importMCPServerManager()
    const mcpManager = MCPServerManager.getInstance()
    
    // 初始化MCP服务器
    await mcpManager.initializeFromConfig()
    
    // 获取所有服务器状态
    const servers = mcpManager.getServerStatus()
    const problems = []
    
    for (const [serverName, serverInfo] of Object.entries(servers)) {
      if (serverInfo.status === 'connected' && serverInfo.tools.length > 0) {
        console.log(`从服务器 ${serverName} 生成样例问题...`)
        
        for (const tool of serverInfo.tools) {
          const problem = generateProblemFromTool(tool, serverName)
          if (problem) {
            problems.push(problem)
            console.log(`✓ 生成样例问题: ${problem.title} (工具: ${tool.name})`)
          }
        }
      }
    }
    
    if (problems.length === 0) {
      console.log('未找到MCP工具，使用备用样例数据')
      return getBackupSampleProblems()
    }
    
    return problems
  } catch (error) {
    console.error('从MCP服务器生成样例问题失败:', error)
    console.log('使用备用样例数据')
    return getBackupSampleProblems()
  }
}

/**
 * 根据MCP工具生成样例问题
 */
function generateProblemFromTool(tool, serverName) {
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
        created_at: new Date().toISOString()
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
        created_at: new Date().toISOString()
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
        created_at: new Date().toISOString()
      }
      
    case 'solve_graph_coloring':
      return {
        id: `mcp-${serverName}-graph-coloring`,
        category: 'algorithm',
        title: '图着色问题',
        title_en: 'Graph Coloring Problem',
        description: '解决图着色问题',
        description_en: 'Solve graph coloring problem',
        problem_type: 'graph_coloring',
        difficulty: 'hard',
        parameters: { colors: 3 },
        expected_solution: {
          type: 'coloring',
          description: '图的着色方案'
        },
        keywords: ['图', 'graph', 'coloring', '着色', 'algorithm'],
        tool_name: toolName,
        created_at: new Date().toISOString()
      }
      
    case 'solve_lp':
      return {
        id: `mcp-${serverName}-linear-programming`,
        category: 'optimization',
        title: '线性规划',
        title_en: 'Linear Programming',
        description: '解决线性规划问题',
        description_en: 'Solve linear programming problem',
        problem_type: 'linear_programming',
        difficulty: 'medium',
        parameters: { type: 'maximize' },
        expected_solution: {
          type: 'optimal_solution',
          description: '最优解'
        },
        keywords: ['线性规划', 'linear programming', 'optimization', 'lp'],
        tool_name: toolName,
        created_at: new Date().toISOString()
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
        created_at: new Date().toISOString()
      }
  }
}

/**
 * 备用样例问题数据（当MCP服务器不可用时使用）
 */
function getBackupSampleProblems() {
  return [
    {
      id: 'backup-n-queens-8',
      category: 'algorithm',
      title: '8皇后问题',
      title_en: '8 Queens Problem',
      description: '在8×8的国际象棋棋盘上放置8个皇后，使得它们不能相互攻击',
      description_en: 'Place 8 queens on an 8×8 chessboard so that no two queens attack each other',
      problem_type: 'n_queens',
      difficulty: 'medium',
      parameters: {
        n: 8,
        board_size: 8
      },
      expected_solution: {
        type: 'positions',
        description: '皇后的位置坐标',
        example: [[0,1], [1,3], [2,5], [3,7], [4,2], [5,0], [6,6], [7,4]]
      },
      keywords: ['皇后', '8皇后', 'queens', 'n-queens', 'chess', 'algorithm'],
      tool_name: 'solve_n_queens',
      created_at: new Date().toISOString()
    },
    
    {
      id: 'backup-sudoku-easy',
      category: 'puzzle',
      title: '简单数独',
      title_en: 'Easy Sudoku',
      description: '解决一个简单难度的9×9数独谜题',
      description_en: 'Solve an easy 9×9 Sudoku puzzle',
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
        description: '完整的数独解答',
        example: [
          [5,3,4,6,7,8,9,1,2],
          [6,7,2,1,9,5,3,4,8],
          [1,9,8,3,4,2,5,6,7],
          [8,5,9,7,6,1,4,2,3],
          [4,2,6,8,5,3,7,9,1],
          [7,1,3,9,2,4,8,5,6],
          [9,6,1,5,3,7,2,8,4],
          [2,8,7,4,1,9,6,3,5],
          [3,4,5,2,8,6,1,7,9]
        ]
      },
      keywords: ['数独', 'sudoku', 'puzzle', 'grid', '9x9'],
      tool_name: 'solve_sudoku',
      created_at: new Date().toISOString()
    }
  ]
}

/**
 * 创建样例问题表
 */
async function createSampleProblemsTable() {
  const getDatabaseService = await importDatabaseService()
  const dbService = getDatabaseService()
  const client = await dbService.getClient()
  
  if (!client) {
    console.error('无法连接到数据库')
    return false
  }

  try {
    // 创建样例问题表
    await client.query(`
      CREATE TABLE IF NOT EXISTS sample_problems (
        id VARCHAR(100) PRIMARY KEY,
        category VARCHAR(50) NOT NULL,
        title VARCHAR(200) NOT NULL,
        title_en VARCHAR(200),
        description TEXT NOT NULL,
        description_en TEXT,
        problem_type VARCHAR(50) NOT NULL,
        difficulty VARCHAR(20) NOT NULL,
        parameters JSONB NOT NULL,
        expected_solution JSONB,
        keywords TEXT[] NOT NULL,
        tool_name VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // 创建索引
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_sample_problems_category 
      ON sample_problems (category)
    `)
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_sample_problems_type 
      ON sample_problems (problem_type)
    `)
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_sample_problems_difficulty 
      ON sample_problems (difficulty)
    `)
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_sample_problems_tool 
      ON sample_problems (tool_name)
    `)

    // 创建关键词搜索索引
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_sample_problems_keywords 
      ON sample_problems USING GIN (keywords)
    `)

    console.log('✓ 样例问题表创建成功')
    return true
  } catch (error) {
    console.error('创建样例问题表失败:', error)
    return false
  } finally {
    client.release()
  }
}

/**
 * 插入样例数据
 */
async function insertSampleProblems() {
  const getDatabaseService = await importDatabaseService()
  const dbService = getDatabaseService()
  const client = await dbService.getClient()
  
  if (!client) {
    console.error('无法连接到数据库')
    return false
  }

  try {
    // 清空现有数据
    await client.query('DELETE FROM sample_problems')
    console.log('✓ 清空现有样例数据')

    // 从MCP服务器动态生成样例问题
    console.log('正在从MCP服务器获取工具信息...')
    const sampleProblems = await generateSampleProblemsFromMCP()

    // 插入新数据
    for (const problem of sampleProblems) {
      await client.query(`
        INSERT INTO sample_problems (
          id, category, title, title_en, description, description_en,
          problem_type, difficulty, parameters, expected_solution,
          keywords, tool_name, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `, [
        problem.id,
        problem.category,
        problem.title,
        problem.title_en,
        problem.description,
        problem.description_en,
        problem.problem_type,
        problem.difficulty,
        JSON.stringify(problem.parameters),
        JSON.stringify(problem.expected_solution),
        problem.keywords,
        problem.tool_name,
        problem.created_at
      ])
      
      console.log(`✓ 插入样例问题: ${problem.title} (工具: ${problem.tool_name})`)
    }

    console.log(`✓ 成功插入 ${sampleProblems.length} 个样例问题`)
    return true
  } catch (error) {
    console.error('插入样例数据失败:', error)
    return false
  } finally {
    client.release()
  }
}

/**
 * 主函数
 */
async function initializeSampleProblems() {
  console.log('=== 初始化样例问题数据 ===\n')
  
  try {
    // 初始化数据库连接
    const getDatabaseService = await importDatabaseService()
    const dbService = getDatabaseService()
    await dbService.initialize()
    
    // 创建表
    const tableCreated = await createSampleProblemsTable()
    if (!tableCreated) {
      console.error('表创建失败，终止初始化')
      return
    }
    
    // 插入数据
    const dataInserted = await insertSampleProblems()
    if (!dataInserted) {
      console.error('数据插入失败')
      return
    }
    
    console.log('\n=== 样例问题数据初始化完成 ===')
  } catch (error) {
    console.error('初始化过程中出错:', error)
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  initializeSampleProblems().then(() => {
    process.exit(0)
  }).catch(error => {
    console.error('初始化失败:', error)
    process.exit(1)
  })
}

module.exports = {
  initializeSampleProblems,
  createSampleProblemsTable,
  insertSampleProblems,
  generateSampleProblemsFromMCP,
  generateProblemFromTool,
  getBackupSampleProblems
}