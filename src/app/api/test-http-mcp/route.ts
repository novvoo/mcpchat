import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { url, method = 'initialize', params = {} } = await request.json()
    
    if (!url) {
      return NextResponse.json({
        success: false,
        error: 'URL is required'
      }, { status: 400 })
    }

    console.log(`Testing HTTP MCP connection to: ${url}`)

    // Test MCP JSON-RPC request
    const mcpRequest = {
      jsonrpc: '2.0',
      id: 1,
      method: method,
      params: method === 'initialize' ? {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {}
        },
        clientInfo: {
          name: 'mcpchat-test',
          version: '1.0.0'
        },
        ...params
      } : params
    }

    console.log('Sending MCP request:', mcpRequest)

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(mcpRequest),
      signal: AbortSignal.timeout(10000)
    })

    console.log(`Response status: ${response.status} ${response.statusText}`)

    if (!response.ok) {
      const responseText = await response.text()
      console.error('HTTP request failed:', responseText)
      return NextResponse.json({
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
        details: responseText
      })
    }

    const result = await response.json()
    console.log('MCP response:', result)

    if (result.error) {
      return NextResponse.json({
        success: false,
        error: `MCP Error: ${result.error.message || JSON.stringify(result.error)}`,
        mcpError: result.error
      })
    }

    return NextResponse.json({
      success: true,
      result: result.result,
      fullResponse: result
    })

  } catch (error) {
    console.error('Test HTTP MCP error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}