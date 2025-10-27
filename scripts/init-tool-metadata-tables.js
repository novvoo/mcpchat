// Initialize Tool Metadata Tables
// This script creates the necessary database tables for the tool metadata service

const { Pool } = require('pg')
const fs = require('fs')
const path = require('path')

async function initializeToolMetadataTables() {
  console.log('Initializing tool metadata tables...')

  // Load database configuration
  const configPath = path.join(process.cwd(), 'config', 'database.json')
  if (!fs.existsSync(configPath)) {
    console.error('Database config not found at:', configPath)
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
    console.log('Connected to database successfully')

    // 1. Extend mcp_tools table with metadata fields
    console.log('Extending mcp_tools table...')
    await client.query(`
      ALTER TABLE mcp_tools 
      ADD COLUMN IF NOT EXISTS keywords TEXT[],
      ADD COLUMN IF NOT EXISTS parameter_mappings JSONB,
      ADD COLUMN IF NOT EXISTS valid_parameters TEXT[],
      ADD COLUMN IF NOT EXISTS examples TEXT[],
      ADD COLUMN IF NOT EXISTS category VARCHAR(100)
    `)

    // 2. Create tool_keyword_mappings table
    console.log('Creating tool_keyword_mappings table...')
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

    // 3. Create tool_parameter_mappings table
    console.log('Creating tool_parameter_mappings table...')
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

    // 4. Create tool_usage_stats table
    console.log('Creating tool_usage_stats table...')
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

    // 5. Create tool_name_patterns table
    console.log('Creating tool_name_patterns table...')
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

    // 5. Insert initial keyword mappings for common tools
    console.log('Inserting initial keyword mappings...')
    
    const keywordMappings = [
      // solve_n_queens keywords
      { tool: 'solve_n_queens', keyword: '皇后问题', confidence: 1.0 },
      { tool: 'solve_n_queens', keyword: 'n皇后', confidence: 1.0 },
      { tool: 'solve_n_queens', keyword: '八皇后', confidence: 1.0 },
      { tool: 'solve_n_queens', keyword: 'queens', confidence: 1.0 },
      { tool: 'solve_n_queens', keyword: 'queen', confidence: 0.8 },
      { tool: 'solve_n_queens', keyword: '解决', confidence: 0.6 },
      { tool: 'solve_n_queens', keyword: 'solve', confidence: 0.6 },
      
      // run_example keywords
      { tool: 'run_example', keyword: '示例', confidence: 1.0 },
      { tool: 'run_example', keyword: '演示', confidence: 1.0 },
      { tool: 'run_example', keyword: 'example', confidence: 1.0 },
      { tool: 'run_example', keyword: 'demo', confidence: 0.9 },
      { tool: 'run_example', keyword: '运行', confidence: 0.7 },
      { tool: 'run_example', keyword: 'run', confidence: 0.7 },
      
      // solve_sudoku keywords
      { tool: 'solve_sudoku', keyword: '数独', confidence: 1.0 },
      { tool: 'solve_sudoku', keyword: 'sudoku', confidence: 1.0 },
      { tool: 'solve_sudoku', keyword: '解数独', confidence: 1.0 },
      
      // echo keywords
      { tool: 'echo', keyword: '回显', confidence: 1.0 },
      { tool: 'echo', keyword: 'echo', confidence: 1.0 },
      { tool: 'echo', keyword: '重复', confidence: 0.8 }
    ]

    for (const mapping of keywordMappings) {
      await client.query(`
        INSERT INTO tool_keyword_mappings (tool_name, keyword, confidence, source)
        VALUES ($1, $2, $3, 'initial_setup')
        ON CONFLICT (tool_name, keyword) DO UPDATE SET
          confidence = EXCLUDED.confidence,
          source = EXCLUDED.source
      `, [mapping.tool, mapping.keyword, mapping.confidence])
    }

    // 6. Insert initial parameter mappings
    console.log('Inserting initial parameter mappings...')
    
    const parameterMappings = [
      // run_example parameter mappings
      { tool: 'run_example', userInput: 'basic', mcpParam: 'lp', confidence: 1.0 },
      { tool: 'run_example', userInput: 'simple', mcpParam: 'lp', confidence: 1.0 },
      { tool: 'run_example', userInput: 'linear', mcpParam: 'lp', confidence: 1.0 },
      { tool: 'run_example', userInput: 'constraint', mcpParam: 'csp', confidence: 1.0 },
      { tool: 'run_example', userInput: 'queens', mcpParam: 'n_queens', confidence: 1.0 },
      { tool: 'run_example', userInput: 'optimization', mcpParam: 'optimization', confidence: 1.0 },
      
      // solve_n_queens parameter mappings
      { tool: 'solve_n_queens', userInput: '8', mcpParam: '8', confidence: 1.0 },
      { tool: 'solve_n_queens', userInput: '4', mcpParam: '4', confidence: 1.0 },
      { tool: 'solve_n_queens', userInput: 'eight', mcpParam: '8', confidence: 0.9 },
      { tool: 'solve_n_queens', userInput: 'four', mcpParam: '4', confidence: 0.9 }
    ]

    for (const mapping of parameterMappings) {
      await client.query(`
        INSERT INTO tool_parameter_mappings (tool_name, user_input, mcp_parameter, confidence)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (tool_name, user_input) DO UPDATE SET
          mcp_parameter = EXCLUDED.mcp_parameter,
          confidence = EXCLUDED.confidence,
          updated_at = CURRENT_TIMESTAMP
      `, [mapping.tool, mapping.userInput, mapping.mcpParam, mapping.confidence])
    }

    console.log('Tool metadata tables initialized successfully!')

  } catch (error) {
    console.error('Error initializing tool metadata tables:', error)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}


// Run the initialization if called directly
if (require.main === module) {
  initializeToolMetadataTables().catch(console.error)
}

// Export the function for use by other scripts
module.exports = { initializeToolMetadataTables }