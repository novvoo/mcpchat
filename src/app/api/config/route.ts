import { NextResponse } from 'next/server'
import { getConfigLoader } from '@/services/config'

export async function GET() {
  try {
    const configLoader = getConfigLoader()
    const config = await configLoader.loadConfig()
    
    return NextResponse.json(config)
  } catch (error) {
    console.error('Failed to load config:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}