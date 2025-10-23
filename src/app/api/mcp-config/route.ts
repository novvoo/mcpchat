import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export async function GET() {
  try {
    const configPath = path.join(process.cwd(), 'config', 'mcp.json')
    
    if (!fs.existsSync(configPath)) {
      return NextResponse.json({ error: 'config/mcp.json not found' }, { status: 404 })
    }

    const configContent = fs.readFileSync(configPath, 'utf-8')
    const config = JSON.parse(configContent)
    
    return NextResponse.json(config)
  } catch (error) {
    console.error('Error reading config/mcp.json:', error)
    return NextResponse.json(
      { error: 'Failed to read config/mcp.json' }, 
      { status: 500 }
    )
  }
}