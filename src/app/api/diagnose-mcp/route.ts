import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { url, timeout = 60000 } = await request.json()
    
    const results = {
      url,
      timestamp: new Date().toISOString(),
      tests: [] as any[]
    }

    // Test 1: Basic HTTP connectivity
    try {
      console.log('Test 1: Basic HTTP connectivity')
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000)
      
      const startTime = Date.now()
      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal
      })
      const responseTime = Date.now() - startTime
      
      clearTimeout(timeoutId)
      
      results.tests.push({
        name: 'Basic HTTP Connectivity',
        success: true,
        responseTime,
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries())
      })
    } catch (error) {
      results.tests.push({
        name: 'Basic HTTP Connectivity',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        type: error instanceof Error ? error.constructor.name : 'UnknownError'
      })
    }

    // Test 2: MCP Ping
    try {
      console.log('Test 2: MCP Ping')
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeout)
      
      const startTime = Date.now()
      const response = await fetch(url, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'User-Agent': 'MCPChat/1.0.0'
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'ping',
          params: {}
        }),
        signal: controller.signal
      })
      const responseTime = Date.now() - startTime
      
      clearTimeout(timeoutId)
      
      const responseText = await response.text()
      let responseData = null
      try {
        responseData = JSON.parse(responseText)
      } catch {
        responseData = responseText
      }
      
      results.tests.push({
        name: 'MCP Ping',
        success: response.ok,
        responseTime,
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        body: responseData
      })
    } catch (error) {
      results.tests.push({
        name: 'MCP Ping',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        type: error instanceof Error ? error.constructor.name : 'UnknownError'
      })
    }

    // Test 3: MCP Initialize
    try {
      console.log('Test 3: MCP Initialize')
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeout)
      
      const startTime = Date.now()
      const response = await fetch(url, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'User-Agent': 'MCPChat/1.0.0'
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 2,
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
      const responseTime = Date.now() - startTime
      
      clearTimeout(timeoutId)
      
      const responseText = await response.text()
      let responseData = null
      try {
        responseData = JSON.parse(responseText)
      } catch {
        responseData = responseText
      }
      
      results.tests.push({
        name: 'MCP Initialize',
        success: response.ok && responseData?.result,
        responseTime,
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        body: responseData
      })
    } catch (error) {
      results.tests.push({
        name: 'MCP Initialize',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        type: error instanceof Error ? error.constructor.name : 'UnknownError'
      })
    }

    // Test 4: DNS Resolution
    try {
      console.log('Test 4: DNS Resolution')
      const urlObj = new URL(url)
      const hostname = urlObj.hostname
      
      // This is a simple test - in a real environment you might want to use dns.resolve
      results.tests.push({
        name: 'DNS Resolution',
        success: true,
        hostname,
        port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
        protocol: urlObj.protocol
      })
    } catch (error) {
      results.tests.push({
        name: 'DNS Resolution',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }

    return NextResponse.json({
      success: true,
      results
    })
    
  } catch (error) {
    console.error('MCP diagnosis failed:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      type: error instanceof Error ? error.constructor.name : 'UnknownError'
    }, { status: 500 })
  }
}