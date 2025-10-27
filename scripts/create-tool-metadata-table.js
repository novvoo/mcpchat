// Create tool_metadata table
const { Pool } = require('pg')
const fs = require('fs')
const path = require('path')

async function createToolMetadataTable() {
  console.log('Creating tool_metadata table...')

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

    // Check if tool_metadata table exists
    const checkResult = await client.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'tool_metadata'
    `)

    if (checkResult.rows.length > 0) {
      console.log('tool_metadata table already exists')
    } else {
      console.log('Creating tool_metadata table...')
      
      // Create tool_metadata table
      await client.query(`
        CREATE TABLE tool_metadata (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) UNIQUE NOT NULL,
          description TEXT NOT NULL,
          input_schema JSONB,
          server_name VARCHAR(255),
          keywords TEXT[] DEFAULT '{}',
          parameter_mappings JSONB,
          valid_parameters TEXT[] DEFAULT '{}',
          examples JSONB,
          category VARCHAR(100),
          metadata JSONB,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `)

      // Create indexes
      await client.query(`
        CREATE INDEX tool_metadata_name_idx ON tool_metadata (name)
      `)

      await client.query(`
        CREATE INDEX tool_metadata_category_idx ON tool_metadata (category)
      `)

      console.log('tool_metadata table created successfully!')
    }

    // Check table structure
    const columnsResult = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'tool_metadata' 
      ORDER BY ordinal_position
    `)

    console.log('tool_metadata table structure:')
    columnsResult.rows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type}`)
    })

  } catch (error) {
    console.error('Error creating tool_metadata table:', error)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

// Run the script if called directly
if (require.main === module) {
  createToolMetadataTable().catch(console.error)
}

module.exports = { createToolMetadataTable }