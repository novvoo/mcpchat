import { NextRequest, NextResponse } from 'next/server'
import { getEmbeddingService } from '@/services/embedding-service'

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json()
    
    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: 'Text parameter is required and must be a string' },
        { status: 400 }
      )
    }

    // Initialize and test embedding service
    const embeddingService = getEmbeddingService()
    await embeddingService.initialize()
    
    console.log('Testing embedding generation for text:', text.substring(0, 100))
    
    const embedding = await embeddingService.generateEmbedding(text)
    
    return NextResponse.json({
      success: true,
      text: text,
      embedding: {
        dimensions: embedding.length,
        sample: embedding.slice(0, 5), // First 5 values for preview
        full: embedding // Full embedding vector
      }
    })
    
  } catch (error) {
    console.error('Embedding test error:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Embedding test endpoint. Send POST request with { "text": "your text here" }'
  })
}