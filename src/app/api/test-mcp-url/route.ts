import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { url, timeout = 30000 } = await request.json()
    
    console.log(`Testing MCP URL: ${url} with timeout: ${timeout}ms`)
    
    // Test basic connectivity
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'User-Agent': 'MCPChat/1.0.0'
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            capabilities: {
              tools: {}
            },
            clientInfo: {
              name: 'mcpchat',
              version: '1.0.0'
            }
          }
        }),
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)
      
      const responseText = await response.text()
      
      return NextResponse.json({
        success: true,
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        body: responseText,
        url: url
      })
      
    } catch (fetchError) {
      clearTimeout(timeoutId)
      throw fetchError
    }
    
  } catch (error) {
    console.error('MCP URL test failed:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      type: error instanceof Error ? error.constructor.name : 'UnknownError',
      url: (await request.json().catch(() => ({})))?.url
    }, { status: 500 })
  }
}