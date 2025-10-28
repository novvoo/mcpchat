import { NextResponse } from 'next/server'
import { getDatabaseService } from '@/services/database'

export async function GET() {
  try {
    // 获取数据库信息
    const databaseInfo = await getDatabaseInfo()
    
    // 获取服务状态
    const servicesInfo = await getServicesInfo()
    
    // 获取性能信息
    const performanceInfo = await getPerformanceInfo()

    return NextResponse.json({
      success: true,
      database: databaseInfo,
      services: servicesInfo,
      performance: performanceInfo
    })
  } catch (error) {
    console.error('Failed to get system info:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to get system info' },
      { status: 500 }
    )
  }
}

async function getDatabaseInfo() {
  try {
    const db = getDatabaseService()
    await db.initialize()
    
    // 检查数据库连接
    await db.query('SELECT 1')
    
    // 获取表列表
    const tablesResult = await db.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `)
    
    const tables = tablesResult.rows.map(row => row.table_name)
    
    // 检查pgvector扩展
    let vectorSearch = false
    try {
      const vectorResult = await db.query(`
        SELECT EXISTS(
          SELECT 1 FROM pg_extension WHERE extname = 'vector'
        ) as has_vector
      `)
      vectorSearch = vectorResult.rows[0]?.has_vector || false
    } catch (error) {
      console.warn('Could not check vector extension:', error)
    }

    // 获取连接池信息（如果可用）
    let connectionPool = null
    try {
      const poolResult = await db.query(`
        SELECT 
          count(*) as total,
          count(*) filter (where state = 'idle') as idle,
          count(*) filter (where state = 'active') as active
        FROM pg_stat_activity 
        WHERE datname = current_database()
      `)
      
      if (poolResult.rows.length > 0) {
        const row = poolResult.rows[0]
        connectionPool = {
          total: parseInt(row.total),
          idle: parseInt(row.idle),
          waiting: Math.max(0, parseInt(row.total) - parseInt(row.active) - parseInt(row.idle))
        }
      }
    } catch (error) {
      console.warn('Could not get connection pool info:', error)
    }

    return {
      connected: true,
      tables,
      vectorSearch,
      connectionPool
    }
  } catch (error) {
    console.error('Database info error:', error)
    return {
      connected: false,
      tables: [],
      vectorSearch: false,
      connectionPool: null
    }
  }
}

async function getServicesInfo() {
  try {
    const db = getDatabaseService()
    await db.initialize()
    
    // 检查LLM配置
    let llmService = false
    try {
      const llmResult = await db.query('SELECT COUNT(*) as count FROM llm_configs WHERE is_active = true')
      llmService = parseInt(llmResult.rows[0]?.count || '0') > 0
    } catch (error) {
      console.warn('Could not check LLM service:', error)
    }

    // 检查MCP配置
    let mcpService = false
    try {
      const mcpResult = await db.query('SELECT COUNT(*) as count FROM mcp_configs WHERE disabled = false')
      mcpService = parseInt(mcpResult.rows[0]?.count || '0') > 0
    } catch (error) {
      console.warn('Could not check MCP service:', error)
    }

    // 检查嵌入服务
    let embeddingService = false
    try {
      const embeddingResult = await db.query('SELECT COUNT(*) as count FROM tool_embeddings LIMIT 1')
      embeddingService = parseInt(embeddingResult.rows[0]?.count || '0') >= 0
    } catch (error) {
      console.warn('Could not check embedding service:', error)
    }

    // 检查向量存储
    let vectorStoreService = false
    try {
      const vectorResult = await db.query(`
        SELECT EXISTS(
          SELECT 1 FROM information_schema.tables 
          WHERE table_name = 'tool_embeddings'
        ) as has_table
      `)
      vectorStoreService = vectorResult.rows[0]?.has_table || false
    } catch (error) {
      console.warn('Could not check vector store:', error)
    }

    return {
      llm: llmService,
      mcp: mcpService,
      embedding: embeddingService,
      vectorStore: vectorStoreService
    }
  } catch (error) {
    console.error('Services info error:', error)
    return {
      llm: false,
      mcp: false,
      embedding: false,
      vectorStore: false
    }
  }
}

async function getPerformanceInfo() {
  try {
    const db = getDatabaseService()
    await db.initialize()
    
    // 计算运行时间（简单实现）
    const startTime = process.uptime()
    
    // 获取内存使用情况
    const memoryUsage = process.memoryUsage()
    
    // 简单的响应时间测试
    const startResponseTime = Date.now()
    await db.query('SELECT 1')
    const responseTime = Date.now() - startResponseTime

    return {
      uptime: Math.floor(startTime),
      memoryUsage: {
        used: memoryUsage.heapUsed,
        total: memoryUsage.heapTotal,
        percentage: (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100
      },
      responseTime
    }
  } catch (error) {
    console.error('Performance info error:', error)
    return {
      uptime: 0,
      memoryUsage: {
        used: 0,
        total: 0,
        percentage: 0
      },
      responseTime: 0
    }
  }
}