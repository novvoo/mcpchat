// Startup Check - Verify all required tables and configurations
const { Pool } = require('pg')
const fs = require('fs')
const path = require('path')

async function startupCheck() {
    let pool = null
    const results = {
        database: false,
        llm_config: false,
        mcp_tools: false,
        // embeddings_config: false, // Removed as embeddings are no longer used
        errors: []
    }
    
    try {
        // Load database configuration
        const configPath = path.join(process.cwd(), 'config', 'database.json')
        
        if (!fs.existsSync(configPath)) {
            results.errors.push('Database config not found')
            return results
        }

        const configData = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
        const dbConfig = configData.postgresql

        if (!dbConfig) {
            results.errors.push('PostgreSQL configuration not found')
            return results
        }

        // Create connection pool
        pool = new Pool({
            host: dbConfig.host,
            port: dbConfig.port,
            database: dbConfig.database,
            user: dbConfig.user,
            password: dbConfig.password,
            ssl: dbConfig.ssl ? { rejectUnauthorized: false } : false
        })

        console.log('🔍 Checking database connection...')
        await pool.query('SELECT NOW()')
        results.database = true
        console.log('✓ Database connection OK')

        // Check required tables
        const requiredTables = [
            'llm_config',
            'mcp_tools', 
            // 'embeddings_config', // Removed as embeddings are no longer used
            // 'keyword_embeddings', // Removed as embeddings are no longer used
            'tool_keyword_mappings'
        ]

        for (const tableName of requiredTables) {
            try {
                const result = await pool.query(`
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_schema = 'public' 
                        AND table_name = $1
                    )
                `, [tableName])
                
                if (result.rows[0].exists) {
                    results[tableName] = true
                    console.log(`✓ Table ${tableName} exists`)
                } else {
                    console.log(`⚠️  Table ${tableName} missing`)
                    results.errors.push(`Table ${tableName} not found`)
                }
            } catch (error) {
                console.log(`❌ Error checking table ${tableName}:`, error.message)
                results.errors.push(`Error checking ${tableName}: ${error.message}`)
            }
        }

        // Check LLM configuration
        if (results.llm_config) {
            try {
                const llmResult = await pool.query('SELECT COUNT(*) as count FROM llm_config WHERE is_active = true')
                const activeCount = parseInt(llmResult.rows[0].count)
                
                if (activeCount > 0) {
                    console.log(`✓ Found ${activeCount} active LLM configuration(s)`)
                } else {
                    console.log('⚠️  No active LLM configurations found')
                    results.errors.push('No active LLM configurations')
                }
            } catch (error) {
                console.log('❌ Error checking LLM configurations:', error.message)
                results.errors.push(`LLM config check failed: ${error.message}`)
            }
        }

        // Check pgvector extension (needed for tool vector search)
        try {
            const vectorResult = await pool.query(`
                SELECT EXISTS (
                    SELECT FROM pg_extension WHERE extname = 'vector'
                )
            `)
            
            if (vectorResult.rows[0].exists) {
                console.log('✓ pgvector extension installed')
            } else {
                console.log('⚠️  pgvector extension not installed (tool vector search disabled)')
            }
        } catch (error) {
            console.log('⚠️  Could not check pgvector extension:', error.message)
        }

        return results

    } catch (error) {
        console.error('❌ Startup check failed:', error)
        results.errors.push(`Startup check failed: ${error.message}`)
        return results
    } finally {
        if (pool) {
            await pool.end()
        }
    }
}

async function autoFix() {
    console.log('🔧 Attempting to auto-fix missing components...')
    
    try {
        // Initialize LLM config table
        console.log('📝 Initializing LLM config table...')
        const { initializeLLMConfigTable } = require('./init-llm-config-table')
        await initializeLLMConfigTable()
        
        // Initialize tool metadata tables  
        console.log('🛠️  Initializing tool metadata tables...')
        const { initializeToolMetadataTables } = require('./init-tool-metadata-tables')
        await initializeToolMetadataTables()
        
        console.log('✅ Auto-fix completed')
        return true
    } catch (error) {
        console.error('❌ Auto-fix failed:', error)
        return false
    }
}

// Run if called directly
if (require.main === module) {
    const args = process.argv.slice(2)
    const shouldAutoFix = args.includes('--fix')
    
    startupCheck().then(async (results) => {
        console.log('\n📊 Startup Check Summary:')
        console.log('Database:', results.database ? '✓' : '❌')
        console.log('LLM Config:', results.llm_config ? '✓' : '❌')
        console.log('MCP Tools:', results.mcp_tools ? '✓' : '❌')
        // console.log('Embeddings Config:', results.embeddings_config ? '✓' : '❌') // Removed as embeddings are no longer used
        
        if (results.errors.length > 0) {
            console.log('\n❌ Issues found:')
            results.errors.forEach(error => console.log(`  - ${error}`))
            
            if (shouldAutoFix) {
                console.log('\n🔧 Running auto-fix...')
                const fixed = await autoFix()
                if (fixed) {
                    console.log('✅ Auto-fix completed. Please restart the application.')
                } else {
                    console.log('❌ Auto-fix failed. Manual intervention required.')
                    process.exit(1)
                }
            } else {
                console.log('\n💡 Run with --fix to attempt automatic repair')
                process.exit(1)
            }
        } else {
            console.log('\n✅ All checks passed!')
        }
    })
}

module.exports = { startupCheck, autoFix }