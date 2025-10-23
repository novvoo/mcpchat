// 初始化动态配置表 - 深度使用PostgreSQL替代硬编码
const { Pool } = require('pg')
const fs = require('fs')
const path = require('path')

/**
 * 初始化动态配置系统的数据库表
 * 这将替代大部分硬编码配置，实现完全基于数据库的配置管理
 */
async function initializeDynamicConfigTables() {
  console.log('=== 初始化动态配置表系统 ===\n')

  // 加载数据库配置
  const configPath = path.join(process.cwd(), 'config', 'database.json')
  if (!fs.existsSync(configPath)) {
    console.error('数据库配置文件不存在:', configPath)
    process.exit(1)
  }

  const configData = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
  const dbConfig = configData.postgresql

  const pool = new Pool({
    host: dbConfig.host,
    port: dbConfig.port,
    database: dbConfig.database,
    user: dbConfig.user,
    password: dbConfig.password,
    ssl: dbConfig.ssl ? { rejectUnauthorized: false } : false
  })

  const client = await pool.connect()

  try {
    console.log('✓ 数据库连接成功')

    // 1. 系统配置表 - 替代硬编码的配置常量
    console.log('\n1. 创建系统配置表...')
    await client.query(`
      CREATE TABLE IF NOT EXISTS system_config (
        id SERIAL PRIMARY KEY,
        config_key VARCHAR(100) UNIQUE NOT NULL,
        config_value JSONB NOT NULL,
        config_type VARCHAR(50) NOT NULL, -- 'string', 'number', 'boolean', 'object', 'array'
        description TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // 2. MCP服务器配置表 - 替代config/mcp.json
    console.log('2. 创建MCP服务器配置表...')
    await client.query(`
      CREATE TABLE IF NOT EXISTS mcp_server_configs (
        id SERIAL PRIMARY KEY,
        server_name VARCHAR(100) UNIQUE NOT NULL,
        transport VARCHAR(20) DEFAULT 'stdio', -- 'stdio', 'http'
        command VARCHAR(500),
        args JSONB DEFAULT '[]',
        env JSONB DEFAULT '{}',
        url VARCHAR(500),
        timeout INTEGER DEFAULT 30000,
        retry_attempts INTEGER DEFAULT 3,
        retry_delay INTEGER DEFAULT 1000,
        auto_approve TEXT[] DEFAULT '{}',
        disabled BOOLEAN DEFAULT false,
        priority INTEGER DEFAULT 0, -- 服务器优先级
        health_check_interval INTEGER DEFAULT 60000, -- 健康检查间隔
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // 3. 工具分类和标签表 - 动态工具分类
    console.log('3. 创建工具分类表...')
    await client.query(`
      CREATE TABLE IF NOT EXISTS tool_categories (
        id SERIAL PRIMARY KEY,
        category_name VARCHAR(100) UNIQUE NOT NULL,
        display_name VARCHAR(200) NOT NULL,
        description TEXT,
        icon VARCHAR(100),
        color VARCHAR(20),
        parent_category_id INTEGER REFERENCES tool_categories(id),
        sort_order INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS tool_tags (
        id SERIAL PRIMARY KEY,
        tag_name VARCHAR(100) UNIQUE NOT NULL,
        display_name VARCHAR(200) NOT NULL,
        description TEXT,
        color VARCHAR(20),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // 4. 智能工具映射表 - 基于学习的工具选择
    console.log('4. 创建智能工具映射表...')
    await client.query(`
      CREATE TABLE IF NOT EXISTS intelligent_tool_mappings (
        id SERIAL PRIMARY KEY,
        pattern_text TEXT NOT NULL, -- 用户输入模式
        pattern_type VARCHAR(50) NOT NULL, -- 'exact', 'regex', 'semantic', 'keyword'
        tool_name VARCHAR(255) NOT NULL,
        confidence FLOAT DEFAULT 1.0,
        success_rate FLOAT DEFAULT 1.0, -- 成功率统计
        usage_count INTEGER DEFAULT 0,
        last_used TIMESTAMP,
        context_tags TEXT[] DEFAULT '{}', -- 上下文标签
        parameter_hints JSONB DEFAULT '{}', -- 参数提示
        is_active BOOLEAN DEFAULT true,
        created_by VARCHAR(100) DEFAULT 'system',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // 5. 动态参数映射表 - 学习用户输入习惯
    console.log('5. 创建动态参数映射表...')
    await client.query(`
      CREATE TABLE IF NOT EXISTS dynamic_parameter_mappings (
        id SERIAL PRIMARY KEY,
        tool_name VARCHAR(255) NOT NULL,
        user_input_pattern TEXT NOT NULL,
        parameter_name VARCHAR(255) NOT NULL,
        parameter_value JSONB NOT NULL,
        mapping_type VARCHAR(50) NOT NULL, -- 'direct', 'transform', 'computed'
        transform_function TEXT, -- JavaScript函数代码
        confidence FLOAT DEFAULT 1.0,
        success_count INTEGER DEFAULT 0,
        failure_count INTEGER DEFAULT 0,
        last_success TIMESTAMP,
        validation_rules JSONB DEFAULT '{}',
        examples JSONB DEFAULT '[]',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // 6. 样例问题模板表 - 动态生成样例问题
    console.log('6. 创建样例问题模板表...')
    await client.query(`
      CREATE TABLE IF NOT EXISTS sample_problem_templates (
        id SERIAL PRIMARY KEY,
        template_name VARCHAR(200) NOT NULL,
        tool_name VARCHAR(255) NOT NULL,
        category VARCHAR(100) NOT NULL,
        difficulty VARCHAR(20) NOT NULL,
        title_template TEXT NOT NULL, -- 支持变量替换
        description_template TEXT NOT NULL,
        parameter_generators JSONB NOT NULL, -- 参数生成规则
        expected_solution_template JSONB,
        keywords_template TEXT[] DEFAULT '{}',
        generation_rules JSONB DEFAULT '{}', -- 生成规则
        priority INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // 7. 工具性能监控表 - 动态优化
    console.log('7. 创建工具性能监控表...')
    await client.query(`
      CREATE TABLE IF NOT EXISTS tool_performance_metrics (
        id SERIAL PRIMARY KEY,
        tool_name VARCHAR(255) NOT NULL,
        server_name VARCHAR(100) NOT NULL,
        execution_time INTEGER NOT NULL, -- 毫秒
        success BOOLEAN NOT NULL,
        error_type VARCHAR(100),
        error_message TEXT,
        input_size INTEGER, -- 输入数据大小
        output_size INTEGER, -- 输出数据大小
        memory_usage INTEGER, -- 内存使用量
        cpu_usage FLOAT, -- CPU使用率
        context_info JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // 8. 用户行为学习表 - 个性化推荐
    console.log('8. 创建用户行为学习表...')
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_behavior_patterns (
        id SERIAL PRIMARY KEY,
        user_session VARCHAR(255), -- 会话ID或用户ID
        input_text TEXT NOT NULL,
        selected_tool VARCHAR(255),
        parameters_used JSONB,
        execution_success BOOLEAN,
        user_satisfaction INTEGER, -- 1-5评分
        interaction_duration INTEGER, -- 交互时长
        context_before JSONB DEFAULT '{}', -- 之前的上下文
        context_after JSONB DEFAULT '{}', -- 之后的上下文
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // 9. 配置变更历史表 - 审计和回滚
    console.log('9. 创建配置变更历史表...')
    await client.query(`
      CREATE TABLE IF NOT EXISTS config_change_history (
        id SERIAL PRIMARY KEY,
        table_name VARCHAR(100) NOT NULL,
        record_id INTEGER NOT NULL,
        change_type VARCHAR(20) NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE'
        old_values JSONB,
        new_values JSONB,
        changed_by VARCHAR(100) DEFAULT 'system',
        change_reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // 创建索引以提高查询性能
    console.log('\n创建性能优化索引...')
    
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_system_config_key ON system_config (config_key)',
      'CREATE INDEX IF NOT EXISTS idx_mcp_servers_name ON mcp_server_configs (server_name)',
      'CREATE INDEX IF NOT EXISTS idx_mcp_servers_active ON mcp_server_configs (disabled, priority)',
      'CREATE INDEX IF NOT EXISTS idx_tool_mappings_pattern ON intelligent_tool_mappings USING gin(to_tsvector(\'english\', pattern_text))',
      'CREATE INDEX IF NOT EXISTS idx_tool_mappings_tool ON intelligent_tool_mappings (tool_name, is_active)',
      'CREATE INDEX IF NOT EXISTS idx_param_mappings_tool ON dynamic_parameter_mappings (tool_name, is_active)',
      'CREATE INDEX IF NOT EXISTS idx_performance_tool_time ON tool_performance_metrics (tool_name, created_at)',
      'CREATE INDEX IF NOT EXISTS idx_user_behavior_session ON user_behavior_patterns (user_session, created_at)',
      'CREATE INDEX IF NOT EXISTS idx_config_history_table ON config_change_history (table_name, record_id, created_at)'
    ]

    for (const indexSql of indexes) {
      await client.query(indexSql)
    }

    console.log('✓ 索引创建完成')

    // 插入初始系统配置
    console.log('\n插入初始系统配置...')
    await insertInitialSystemConfig(client)

    // 插入初始工具分类
    console.log('插入初始工具分类...')
    await insertInitialToolCategories(client)

    // 插入初始智能映射
    console.log('插入初始智能工具映射...')
    await insertInitialIntelligentMappings(client)

    // 插入样例问题模板
    console.log('插入样例问题模板...')
    await insertSampleProblemTemplates(client)

    console.log('\n=== 动态配置表系统初始化完成 ===')
    console.log('✓ 所有表和索引创建成功')
    console.log('✓ 初始数据插入完成')
    console.log('✓ 系统现在支持完全动态配置管理')

  } catch (error) {
    console.error('初始化过程中出错:', error)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

/**
 * 插入初始系统配置
 */
async function insertInitialSystemConfig(client) {
  const configs = [
    {
      key: 'llm.default_url',
      value: '"https://ch.at/v1/chat/completions"',
      type: 'string',
      description: '默认LLM服务URL'
    },
    {
      key: 'llm.timeout',
      value: '30000',
      type: 'number',
      description: 'LLM请求超时时间(毫秒)'
    },
    {
      key: 'llm.max_tokens',
      value: '2000',
      type: 'number',
      description: 'LLM最大token数'
    },
    {
      key: 'llm.temperature',
      value: '0.7',
      type: 'number',
      description: 'LLM温度参数'
    },
    {
      key: 'mcp.health_check_interval',
      value: '60000',
      type: 'number',
      description: 'MCP服务器健康检查间隔(毫秒)'
    },
    {
      key: 'mcp.default_timeout',
      value: '30000',
      type: 'number',
      description: 'MCP默认超时时间(毫秒)'
    },
    {
      key: 'tool_selection.confidence_threshold',
      value: '0.7',
      type: 'number',
      description: '工具选择置信度阈值'
    },
    {
      key: 'tool_selection.max_suggestions',
      value: '5',
      type: 'number',
      description: '最大工具建议数量'
    },
    {
      key: 'embeddings.batch_size',
      value: '100',
      type: 'number',
      description: '向量嵌入批处理大小'
    },
    {
      key: 'performance.metrics_retention_days',
      value: '30',
      type: 'number',
      description: '性能指标保留天数'
    }
  ]

  for (const config of configs) {
    await client.query(`
      INSERT INTO system_config (config_key, config_value, config_type, description)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (config_key) DO UPDATE SET
        config_value = EXCLUDED.config_value,
        updated_at = CURRENT_TIMESTAMP
    `, [config.key, config.value, config.type, config.description])
  }
}

/**
 * 插入初始工具分类
 */
async function insertInitialToolCategories(client) {
  const categories = [
    { name: 'algorithm', display: '算法', description: '算法相关工具', icon: 'algorithm', color: '#2196F3' },
    { name: 'puzzle', display: '谜题', description: '谜题解决工具', icon: 'puzzle', color: '#4CAF50' },
    { name: 'optimization', display: '优化', description: '优化问题工具', icon: 'optimization', color: '#FF9800' },
    { name: 'demo', display: '演示', description: '演示和示例工具', icon: 'demo', color: '#9C27B0' },
    { name: 'general', display: '通用', description: '通用工具', icon: 'general', color: '#607D8B' },
    { name: 'math', display: '数学', description: '数学计算工具', icon: 'math', color: '#E91E63' },
    { name: 'graph', display: '图论', description: '图论相关工具', icon: 'graph', color: '#00BCD4' }
  ]

  for (const category of categories) {
    await client.query(`
      INSERT INTO tool_categories (category_name, display_name, description, icon, color)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (category_name) DO UPDATE SET
        display_name = EXCLUDED.display_name,
        description = EXCLUDED.description,
        icon = EXCLUDED.icon,
        color = EXCLUDED.color
    `, [category.name, category.display, category.description, category.icon, category.color])
  }

  const tags = [
    { name: 'beginner', display: '初学者', description: '适合初学者的工具' },
    { name: 'advanced', display: '高级', description: '高级用户工具' },
    { name: 'interactive', display: '交互式', description: '需要用户交互的工具' },
    { name: 'batch', display: '批处理', description: '批处理工具' },
    { name: 'realtime', display: '实时', description: '实时处理工具' }
  ]

  for (const tag of tags) {
    await client.query(`
      INSERT INTO tool_tags (tag_name, display_name, description)
      VALUES ($1, $2, $3)
      ON CONFLICT (tag_name) DO UPDATE SET
        display_name = EXCLUDED.display_name,
        description = EXCLUDED.description
    `, [tag.name, tag.display, tag.description])
  }
}

/**
 * 插入初始智能工具映射
 */
async function insertInitialIntelligentMappings(client) {
  const mappings = [
    // N皇后问题映射
    { pattern: '皇后问题|n皇后|八皇后|queens problem', type: 'regex', tool: 'solve_n_queens', confidence: 0.95 },
    { pattern: '在.*棋盘.*放置.*皇后', type: 'regex', tool: 'solve_n_queens', confidence: 0.9 },
    { pattern: 'n queens', type: 'exact', tool: 'solve_n_queens', confidence: 1.0 },
    
    // 数独映射
    { pattern: '数独|sudoku', type: 'regex', tool: 'solve_sudoku', confidence: 0.95 },
    { pattern: '解.*数独|solve.*sudoku', type: 'regex', tool: 'solve_sudoku', confidence: 0.9 },
    
    // 示例运行映射
    { pattern: '示例|演示|demo|example', type: 'regex', tool: 'run_example', confidence: 0.8 },
    { pattern: '运行.*示例|run.*example', type: 'regex', tool: 'run_example', confidence: 0.9 },
    
    // 图着色映射
    { pattern: '图着色|graph coloring', type: 'regex', tool: 'solve_graph_coloring', confidence: 0.95 },
    { pattern: '给.*图.*着色', type: 'regex', tool: 'solve_graph_coloring', confidence: 0.9 },
    
    // 线性规划映射
    { pattern: '线性规划|linear programming|lp', type: 'regex', tool: 'solve_lp', confidence: 0.95 },
    { pattern: '优化.*问题|optimization', type: 'regex', tool: 'solve_lp', confidence: 0.7 },
    
    // 回显映射
    { pattern: '回显|echo|重复', type: 'regex', tool: 'echo', confidence: 0.9 }
  ]

  for (const mapping of mappings) {
    await client.query(`
      INSERT INTO intelligent_tool_mappings (pattern_text, pattern_type, tool_name, confidence)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT DO NOTHING
    `, [mapping.pattern, mapping.type, mapping.tool, mapping.confidence])
  }
}

/**
 * 插入样例问题模板
 */
async function insertSampleProblemTemplates(client) {
  const templates = [
    {
      name: 'n_queens_template',
      tool: 'solve_n_queens',
      category: 'algorithm',
      difficulty: 'medium',
      title: '{{n}}皇后问题',
      description: '在{{n}}×{{n}}的国际象棋棋盘上放置{{n}}个皇后，使得它们不能相互攻击',
      parameters: {
        n: { type: 'range', min: 4, max: 12, default: 8 }
      },
      keywords: ['皇后', 'n皇后', 'queens', 'chess', 'algorithm']
    },
    {
      name: 'sudoku_template',
      tool: 'solve_sudoku',
      category: 'puzzle',
      difficulty: 'easy',
      title: '数独求解 - {{difficulty}}难度',
      description: '解决一个{{difficulty}}难度的9×9数独谜题',
      parameters: {
        difficulty: { type: 'enum', values: ['简单', '中等', '困难'], default: '简单' }
      },
      keywords: ['数独', 'sudoku', 'puzzle', 'grid']
    }
  ]

  for (const template of templates) {
    await client.query(`
      INSERT INTO sample_problem_templates (
        template_name, tool_name, category, difficulty,
        title_template, description_template, parameter_generators, keywords_template
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT DO NOTHING
    `, [
      template.name, template.tool, template.category, template.difficulty,
      template.title, template.description, JSON.stringify(template.parameters), template.keywords
    ])
  }
}

// 运行初始化
if (require.main === module) {
  initializeDynamicConfigTables().catch(console.error)
}

module.exports = {
  initializeDynamicConfigTables,
  insertInitialSystemConfig,
  insertInitialToolCategories,
  insertInitialIntelligentMappings,
  insertSampleProblemTemplates
}