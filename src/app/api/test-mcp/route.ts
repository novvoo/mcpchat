import { NextRequest, NextResponse } from 'next/server'
import { spawn, ChildProcess } from 'child_process'

/**
 * 通用 MCP 测试端点
 * 支持 stdio 和 http 两种传输方式
 */
export async function POST(request: NextRequest) {
  try {
    const { 
      transport = 'stdio', 
      url, 
      command, 
      args = [], 
      env = {},
      method = 'initialize', 
      params = {} 
    } = await request.json()

    console.log(`Testing MCP connection with transport: ${transport}`)

    if (transport === 'http') {
      return await testHttpMCP(url, method, params)
    } else if (transport === 'stdio') {
      return await testStdioMCP(command, args, env, method, params)
    } else {
      return NextResponse.json({
        success: false,
        error: `Unsupported transport: ${transport}. Use 'stdio' or 'http'`
      }, { status: 400 })
    }

  } catch (error) {
    console.error('Test MCP error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}

/**
 * 测试 HTTP 传输的 MCP 服务器
 */
async function testHttpMCP(url: string | undefined, method: string, params: any) {
  if (!url) {
    return NextResponse.json({
      success: false,
      error: 'URL is required for HTTP transport'
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
    transport: 'http',
    result: result.result,
    fullResponse: result
  })
}

/**
 * 测试 stdio 传输的 MCP 服务器
 */
async function testStdioMCP(
  command: string | undefined, 
  args: string[], 
  env: Record<string, string>,
  method: string,
  params: any
): Promise<NextResponse> {
  if (!command) {
    return NextResponse.json({
      success: false,
      error: 'Command is required for stdio transport'
    }, { status: 400 })
  }

  console.log(`Testing stdio MCP with command: ${command} ${args.join(' ')}`)

  return new Promise((resolve) => {
    let childProcess: ChildProcess | null = null
    let responseBuffer = ''
    let hasResolved = false
    let requestId = 1

    const cleanup = () => {
      if (childProcess && !childProcess.killed) {
        childProcess.kill('SIGTERM')
        setTimeout(() => {
          if (childProcess && !childProcess.killed) {
            childProcess.kill('SIGKILL')
          }
        }, 1000)
      }
    }

    const resolveOnce = (response: NextResponse) => {
      if (!hasResolved) {
        hasResolved = true
        cleanup()
        resolve(response)
      }
    }

    try {
      childProcess = spawn(command, args, {
        env: { ...process.env, ...env },
        stdio: ['pipe', 'pipe', 'pipe']
      })

      // 超时处理
      const timeout = setTimeout(() => {
        resolveOnce(NextResponse.json({
          success: false,
          error: 'Timeout waiting for MCP response (10s)'
        }, { status: 408 }))
      }, 10000)

      // 处理进程错误
      childProcess.on('error', (error: Error) => {
        clearTimeout(timeout)
        console.error('Process error:', error)
        resolveOnce(NextResponse.json({
          success: false,
          error: `Process error: ${error.message}`
        }, { status: 500 }))
      })

      // 处理进程退出
      childProcess.on('exit', (code: number | null, signal: string | null) => {
        clearTimeout(timeout)
        if (!hasResolved) {
          console.log(`Process exited with code ${code}, signal ${signal}`)
          resolveOnce(NextResponse.json({
            success: false,
            error: `Process exited unexpectedly (code: ${code}, signal: ${signal})`
          }, { status: 500 }))
        }
      })

      // 处理 stderr
      if (childProcess.stderr) {
        childProcess.stderr.on('data', (data) => {
          const message = data.toString()
          console.error('MCP stderr:', message)
        })
      }

      // 处理 stdout - MCP JSON-RPC 响应
      if (childProcess.stdout) {
        childProcess.stdout.on('data', (data: Buffer) => {
          responseBuffer += data.toString()
          const lines = responseBuffer.split('\n')
          responseBuffer = lines.pop() || ''

          for (const line of lines) {
            if (!line.trim()) continue

            try {
              const response = JSON.parse(line)
              console.log('Received MCP response:', response)

              // 检查是否是我们请求的响应
              if (response.id === requestId) {
                clearTimeout(timeout)

                if (response.error) {
                  resolveOnce(NextResponse.json({
                    success: false,
                    error: `MCP Error: ${response.error.message || JSON.stringify(response.error)}`,
                    mcpError: response.error
                  }))
                } else {
                  resolveOnce(NextResponse.json({
                    success: true,
                    transport: 'stdio',
                    result: response.result,
                    fullResponse: response
                  }))
                }
              }
            } catch (error) {
              console.error('Failed to parse MCP response:', line, error)
            }
          }
        })
      }

      // 发送 MCP 请求
      const mcpRequest = {
        jsonrpc: '2.0',
        id: requestId,
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
      const requestStr = JSON.stringify(mcpRequest) + '\n'
      
      if (childProcess.stdin) {
        childProcess.stdin.write(requestStr)
      } else {
        clearTimeout(timeout)
        resolveOnce(NextResponse.json({
          success: false,
          error: 'Failed to write to process stdin'
        }, { status: 500 }))
      }

    } catch (error) {
      console.error('Failed to spawn process:', error)
      resolveOnce(NextResponse.json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 }))
    }
  })
}