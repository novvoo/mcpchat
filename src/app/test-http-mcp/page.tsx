'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, CheckCircle, XCircle, Play, RefreshCw } from 'lucide-react'

interface MCPServerStatus {
  name: string
  status: 'connected' | 'disconnected' | 'error'
  transport: string
  url?: string
  toolCount: number
  tools: string[]
  error?: string
}

interface ToolCallResult {
  success: boolean
  result?: any
  error?: string
  executionTime?: number
}

export default function TestHttpMCPPage() {
  const [servers, setServers] = useState<MCPServerStatus[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedTool, setSelectedTool] = useState('')
  const [toolArgs, setToolArgs] = useState('{}')
  const [result, setResult] = useState<ToolCallResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadServerStatus()
  }, [])

  const loadServerStatus = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/mcp/status')
      const data = await response.json()

      if (data.success) {
        setServers(data.servers || [])
      } else {
        setError(data.error || '获取服务器状态失败')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '网络错误')
    } finally {
      setLoading(false)
    }
  }

  const initializeServers = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/mcp/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })

      const data = await response.json()

      if (data.success) {
        await loadServerStatus()
      } else {
        setError(data.error || '初始化失败')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '初始化失败')
    } finally {
      setLoading(false)
    }
  }

  const callTool = async () => {
    if (!selectedTool) return

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      let parsedArgs = {}
      if (toolArgs.trim()) {
        parsedArgs = JSON.parse(toolArgs)
      }

      const startTime = Date.now()
      const response = await fetch('/api/mcp/call-tool', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolName: selectedTool,
          args: parsedArgs
        })
      })

      const data = await response.json()
      const executionTime = Date.now() - startTime

      if (data.success) {
        setResult({
          success: true,
          result: data.result,
          executionTime
        })
      } else {
        setResult({
          success: false,
          error: data.error,
          executionTime
        })
      }
    } catch (err) {
      setResult({
        success: false,
        error: err instanceof Error ? err.message : '工具调用失败'
      })
    } finally {
      setLoading(false)
    }
  }

  const getAvailableTools = () => {
    const tools: string[] = []
    servers.forEach(server => {
      if (server.status === 'connected') {
        tools.push(...server.tools)
      }
    })
    return [...new Set(tools)]
  }

  const getToolExamples = (toolName: string) => {
    const examples: Record<string, any> = {
      'solve_n_queens': { n: 8 },
      'solve_sudoku': { 
        puzzle: [
          [5,3,0,0,7,0,0,0,0],
          [6,0,0,1,9,5,0,0,0],
          [0,9,8,0,0,0,0,6,0],
          [8,0,0,0,6,0,0,0,3],
          [4,0,0,8,0,3,0,0,1],
          [7,0,0,0,2,0,0,0,6],
          [0,6,0,0,0,0,2,8,0],
          [0,0,0,4,1,9,0,0,5],
          [0,0,0,0,8,0,0,7,9]
        ]
      },
      'run_example': { example: 'lp' },
      'solve_graph_coloring': { 
        edges: [[0,1], [1,2], [2,3], [3,0]], 
        num_vertices: 4, 
        max_colors: 3 
      },
      'solve_24_point_game': { numbers: [1, 2, 3, 4] },
      'solve_chicken_rabbit_problem': { total_heads: 35, total_legs: 94 },
      'info': {},
      'install': { package: 'gurddy', upgrade: false }
    }
    return examples[toolName] || {}
  }

  const useExample = (toolName: string) => {
    const example = getToolExamples(toolName)
    setSelectedTool(toolName)
    setToolArgs(JSON.stringify(example, null, 2))
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">HTTP MCP 测试</h1>
        <p className="text-muted-foreground">
          测试HTTP传输的MCP服务器连接和工具调用
        </p>
      </div>

      {/* 服务器状态 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            MCP 服务器状态
            <div className="flex gap-2">
              <Button onClick={loadServerStatus} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                刷新
              </Button>
              <Button onClick={initializeServers} disabled={loading} size="sm">
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                初始化
              </Button>
            </div>
          </CardTitle>
          <CardDescription>
            显示所有配置的MCP服务器连接状态
          </CardDescription>
        </CardHeader>
        <CardContent>
          {servers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {loading ? '加载中...' : '没有找到MCP服务器配置'}
            </div>
          ) : (
            <div className="space-y-4">
              {servers.map((server, index) => (
                <div key={index} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">{server.name}</h3>
                      {server.status === 'connected' ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                      <Badge variant={server.status === 'connected' ? 'default' : 'destructive'}>
                        {server.status}
                      </Badge>
                    </div>
                    <Badge variant="outline">{server.transport}</Badge>
                  </div>
                  
                  {server.url && (
                    <p className="text-sm text-muted-foreground mb-2">
                      URL: {server.url}
                    </p>
                  )}
                  
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm">工具数量: {server.toolCount}</span>
                  </div>
                  
                  {server.tools.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {server.tools.map(tool => (
                        <Badge key={tool} variant="outline" className="text-xs">
                          {tool}
                        </Badge>
                      ))}
                    </div>
                  )}
                  
                  {server.error && (
                    <Alert variant="destructive" className="mt-2">
                      <AlertDescription>{server.error}</AlertDescription>
                    </Alert>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 工具调用测试 */}
      <Card>
        <CardHeader>
          <CardTitle>工具调用测试</CardTitle>
          <CardDescription>
            选择一个工具并提供参数来测试MCP工具调用
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">选择工具</label>
            <div className="flex flex-wrap gap-2">
              {getAvailableTools().map(tool => (
                <Button
                  key={tool}
                  variant={selectedTool === tool ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => useExample(tool)}
                >
                  {tool}
                </Button>
              ))}
            </div>
          </div>

          {selectedTool && (
            <div>
              <label className="text-sm font-medium mb-2 block">
                工具参数 (JSON格式)
              </label>
              <Textarea
                value={toolArgs}
                onChange={(e) => setToolArgs(e.target.value)}
                placeholder="输入JSON格式的参数..."
                rows={6}
                className="font-mono text-sm"
              />
            </div>
          )}

          <Button
            onClick={callTool}
            disabled={loading || !selectedTool}
            className="w-full"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            调用工具
          </Button>
        </CardContent>
      </Card>

      {/* 错误显示 */}
      {error && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* 结果显示 */}
      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {result.success ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
              调用结果
              {result.executionTime && (
                <Badge variant="outline" className="ml-auto">
                  {result.executionTime}ms
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {result.success ? (
              <div>
                <p className="text-sm font-medium mb-2">执行成功</p>
                <pre className="bg-muted p-4 rounded text-sm overflow-auto max-h-96">
                  {JSON.stringify(result.result, null, 2)}
                </pre>
              </div>
            ) : (
              <div>
                <p className="text-sm font-medium mb-2 text-red-600">执行失败</p>
                <div className="bg-red-50 border border-red-200 p-4 rounded text-sm">
                  {result.error}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}