// Dynamic Patterns API - 管理动态模式学习

import { NextRequest, NextResponse } from 'next/server'
import { getDynamicPatternLearner } from '@/services/dynamic-pattern-learner'
import { getToolMetadataService } from '@/services/tool-metadata-service'

export async function POST(request: NextRequest) {
  try {
    const { action, ...params } = await request.json()

    const patternLearner = getDynamicPatternLearner()
    
    switch (action) {
      case 'initialize':
        await patternLearner.initialize()
        return NextResponse.json({
          success: true,
          message: 'Dynamic pattern learner initialized'
        })

      case 'learn_from_tools':
        const learningResult = await patternLearner.learnPatternsFromExistingTools()
        return NextResponse.json({
          success: true,
          data: learningResult,
          message: `学习完成: ${learningResult.newKeywords.length} 个新关键词, ${learningResult.updatedPatterns.length} 个更新模式`
        })

      case 'update_from_feedback':
        const { toolName, userInput, success } = params
        if (!toolName || !userInput || success === undefined) {
          return NextResponse.json(
            { success: false, error: 'Missing required parameters: toolName, userInput, success' },
            { status: 400 }
          )
        }
        
        await patternLearner.updatePatternFromFeedback(toolName, userInput, success)
        return NextResponse.json({
          success: true,
          message: 'Pattern updated from user feedback'
        })

      case 'refresh_metadata':
        const metadataService = getToolMetadataService()
        await metadataService.initialize()
        await metadataService.refreshToolMetadata()
        return NextResponse.json({
          success: true,
          message: 'Tool metadata refreshed with dynamic patterns'
        })

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        )
    }

  } catch (error) {
    console.error('Dynamic patterns API error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const action = url.searchParams.get('action')

    const patternLearner = getDynamicPatternLearner()

    switch (action) {
      case 'patterns':
        const patterns = await patternLearner.getLearnedPatterns()
        return NextResponse.json({
          success: true,
          data: {
            patterns,
            total: patterns.length
          }
        })

      case 'stats':
        // 获取学习统计信息
        const stats = await getPatternLearningStats()
        return NextResponse.json({
          success: true,
          data: stats
        })

      default:
        return NextResponse.json({
          success: true,
          data: {
            message: 'Dynamic Patterns API',
            endpoints: {
              'GET ?action=patterns': '获取所有学习到的模式',
              'GET ?action=stats': '获取学习统计信息',
              'POST {action: "initialize"}': '初始化动态模式学习器',
              'POST {action: "learn_from_tools"}': '从现有工具学习模式',
              'POST {action: "update_from_feedback", toolName, userInput, success}': '从用户反馈更新模式',
              'POST {action: "refresh_metadata"}': '刷新工具元数据'
            }
          }
        })
    }

  } catch (error) {
    console.error('Dynamic patterns GET API error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}

/**
 * 获取模式学习统计信息
 */
async function getPatternLearningStats() {
  try {
    const { getDatabaseService } = await import('@/services/database')
    const dbService = getDatabaseService()
    const client = await dbService.getClient()
    
    if (!client) {
      return {
        totalPatterns: 0,
        totalKeywords: 0,
        avgConfidence: 0,
        recentLearning: []
      }
    }

    try {
      // 获取模式统计
      const patternsResult = await client.query(`
        SELECT 
          COUNT(*) as total_patterns,
          AVG(confidence) as avg_confidence,
          SUM(usage_count) as total_usage
        FROM tool_name_patterns
      `)

      // 获取关键词统计
      const keywordsResult = await client.query(`
        SELECT COUNT(DISTINCT keyword) as total_keywords
        FROM tool_keyword_mappings
      `)

      // 获取最近的学习活动
      const recentResult = await client.query(`
        SELECT 
          tool_name,
          generated_keywords,
          generation_method,
          confidence,
          created_at
        FROM keyword_generation_log
        ORDER BY created_at DESC
        LIMIT 10
      `)

      return {
        totalPatterns: parseInt(patternsResult.rows[0]?.total_patterns || 0),
        totalKeywords: parseInt(keywordsResult.rows[0]?.total_keywords || 0),
        avgConfidence: parseFloat(patternsResult.rows[0]?.avg_confidence || 0),
        totalUsage: parseInt(patternsResult.rows[0]?.total_usage || 0),
        recentLearning: recentResult.rows.map(row => ({
          toolName: row.tool_name,
          keywordCount: row.generated_keywords?.length || 0,
          method: row.generation_method,
          confidence: parseFloat(row.confidence),
          timestamp: row.created_at
        }))
      }
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('获取模式学习统计失败:', error)
    return {
      totalPatterns: 0,
      totalKeywords: 0,
      avgConfidence: 0,
      totalUsage: 0,
      recentLearning: [],
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}