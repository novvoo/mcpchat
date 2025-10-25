import { NextResponse } from 'next/server'
import { getDatabaseService } from '@/services/database'

/**
 * POST /api/embeddings/status
 * Manually trigger embeddings availability check
 */
export async function POST() {
  try {
    const db = getDatabaseService()
    
    console.log('Manual embeddings availability check triggered')
    const isAvailable = await db.testEmbeddingsAvailability()
    
    const config = await db.getEmbeddingsConfig()
    
    if (!config) {
      return NextResponse.json(
        { error: 'Embeddings configuration not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      is_available: isAvailable,
      checked_at: new Date().toISOString(),
      provider: config.provider,
      model: config.model,
      last_checked: config.last_checked,
      metadata: config.metadata
    })
  } catch (error) {
    console.error('Failed to check embeddings availability:', error)
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to check embeddings availability',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/embeddings/status
 * Get current embeddings configuration and availability status
 */
export async function GET() {
  try {
    const db = getDatabaseService()
    const config = await db.getEmbeddingsConfig()

    if (!config) {
      return NextResponse.json(
        { error: 'Embeddings configuration not found' },
        { status: 404 }
      )
    }

    // Calculate uptime percentage
    const totalAttempts = config.success_count + config.failure_count
    const uptimePercentage = totalAttempts > 0 
      ? (config.success_count / totalAttempts) * 100 
      : 0

    return NextResponse.json({
      provider: config.provider,
      model: config.model,
      dimensions: config.dimensions,
      endpoint: config.endpoint,
      is_available: config.is_available,
      last_checked: config.last_checked,
      last_success: config.last_success,
      last_failure: config.last_failure,
      failure_count: config.failure_count,
      success_count: config.success_count,
      fallback_enabled: config.fallback_enabled,
      fallback_type: config.fallback_type,
      uptime_percentage: Math.round(uptimePercentage * 100) / 100,
      metadata: config.metadata
    })
  } catch (error) {
    console.error('Failed to get embeddings status:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve embeddings status' },
      { status: 500 }
    )
  }
}
