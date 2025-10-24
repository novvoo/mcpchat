'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import AdminNavigation from '@/components/AdminNavigation'
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

interface Tool {
  name: string
  description: string
  inputSchema: {
    type: string
    properties: Record<string, any>
    required?: string[]
  }
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
  const [allTools, setAllTools] = useState<Tool[]>([])
  const [loadingTools, setLoadingTools] = useState(false)

  useEffect(() => {
    loadServerStatus()
  }, [])

  // 加载所有工具的详细信息
  const loadAllTools = async () => {
    setLoadingTools(true)
    try {
      const tools: Tool[] = []
      
      for (const server of servers) {
        if (server.status === 'connected') {
          try {
            const response = await fetch(`/api/mcp/tools?server=${server.name}`)
            const data = await response.json()
            
            if (data.tools) {
              tools.push(...data.tools)
            }
          } catch (err) {
            console.error(`Failed to load tools for server ${server.name}:`, err)
          }
        }
      }
      
      setAllTools(tools)
    } catch (err) {
      console.error('Failed to load tools:', err)
    } finally {
      setLoadingTools(false)
    }
  }

  // 当服务器状态更新时，加载工具详细信息
  useEffect(() => {
    if (servers.length > 0) {
      loadAllTools()
    }
  }, [servers])

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
    return allTools.map(tool => tool.name)
  }



  // 根据真实的inputSchema生成示例参数
  const getToolExamples = (tool: Tool) => {
    // 如果没有inputSchema或properties，返回空对象
    if (!tool.inputSchema || !tool.inputSchema.properties || Object.keys(tool.inputSchema.properties).length === 0) {
      return {}
    }

    const examples: Record<string, any> = {}
    const required = tool.inputSchema.required || []

    for (const [propName, propSchema] of Object.entries(tool.inputSchema.properties)) {
      const schema = propSchema as any
      
      // 优先使用默认值
      if (schema.default !== undefined) {
        examples[propName] = schema.default
      } 
      // 如果有枚举值，使用第一个
      else if (schema.enum && schema.enum.length > 0) {
        examples[propName] = schema.enum[0]
      } 
      // 如果是必需参数，生成合适的示例值
      else if (required.includes(propName)) {
        switch (schema.type) {
          case 'string':
            // 为特定参数生成有意义的示例
            if (propName === 'example_name') {
              examples[propName] = 'lp'  // run_example工具的默认示例
            } else if (propName === 'package') {
              examples[propName] = 'gurddy'  // install工具的默认包名
            } else {
              examples[propName] = ''
            }
            break
          case 'integer':
          case 'number':
            if (propName === 'n') {
              examples[propName] = 8  // N-Queens默认8x8
            } else if (propName === 'total_heads') {
              examples[propName] = 35
            } else if (propName === 'total_legs') {
              examples[propName] = 94
            } else {
              examples[propName] = 1
            }
            break
          case 'boolean':
            examples[propName] = false
            break
          case 'array':
            // 为特定的工具生成更有意义的示例
            if (propName === 'puzzle' && tool.name === 'solve_sudoku') {
              examples[propName] = [
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
            } else if (propName === 'numbers' && tool.name === 'solve_24_point_game') {
              examples[propName] = [1, 2, 3, 4]
            } else if (propName === 'edges') {
              examples[propName] = [[0,1], [1,2], [2,3], [3,0]]
            } else {
              examples[propName] = []
            }
            break
          case 'object':
            // 为特定的工具生成更有意义的示例
            if (propName === 'profits') {
              examples[propName] = { "product_a": 10, "product_b": 15 }
            } else if (propName === 'consumption') {
              examples[propName] = { 
                "product_a": { "material": 2, "labor": 1 },
                "product_b": { "material": 1, "labor": 2 }
              }
            } else if (propName === 'capacities') {
              examples[propName] = { "material": 100, "labor": 80 }
            } else {
              examples[propName] = {}
            }
            break
          default:
            examples[propName] = null
        }
      }
      // 对于可选参数，只在有默认值或枚举值时才添加
    }
    
    return examples
  }

  const useExample = (toolName: string) => {
    const tool = allTools.find(t => t.name === toolName)
    let example = {}
    
    // 使用经过测试验证的参数示例
    const knownExamples: Record<string, any> = {
      'info': {},
      'run_example': { 'example_name': 'lp' },  // 修正：参数名是 example_name
      'solve_n_queens': { 'n': 8 },
      'solve_sudoku': { 
        'puzzle': [
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
      'solve_24_point_game': { 'numbers': [1, 2, 3, 4] },
      'solve_chicken_rabbit_problem': { 'total_heads': 35, 'total_legs': 94 },
      'install': { 'package': 'gurddy', 'upgrade': false }
    }
    
    if (knownExamples[toolName]) {
      example = knownExamples[toolName]
    } else if (tool) {
      // 对于未知工具，尝试从schema生成
      example = getToolExamples(tool)
    }
    
    setSelectedTool(toolName)
    setToolArgs(JSON.stringify(example, null, 2))
  }

  // 获取选中工具的详细信息
  const getSelectedToolInfo = () => {
    return allTools.find(t => t.name === selectedTool)
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <AdminNavigation title="HTTP MCP 测试" />
      
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
            <label className="text-sm font-medium mb-2 block">
              选择工具 {loadingTools && <span className="text-muted-foreground">(加载中...)</span>}
            </label>
            <div className="flex flex-wrap gap-2">
              {getAvailableTools().map(tool => (
                <Button
                  key={tool}
                  variant={selectedTool === tool ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => useExample(tool)}
                  disabled={loadingTools}
                >
                  {tool}
                </Button>
              ))}
            </div>
            {getAvailableTools().length === 0 && !loadingTools && (
              <p className="text-sm text-muted-foreground mt-2">
                没有可用的工具。请确保MCP服务器已连接。
              </p>
            )}
          </div>

          {selectedTool && (
            <div className="space-y-4">
              {/* 工具信息 */}
              {(() => {
                const toolInfo = getSelectedToolInfo()
                return toolInfo && (
                  <div className="bg-muted/50 p-4 rounded-lg">
                    <h4 className="font-medium mb-2">{toolInfo.name}</h4>
                    <p className="text-sm text-muted-foreground mb-3">{toolInfo.description}</p>
                    
                    {toolInfo.inputSchema && toolInfo.inputSchema.properties && (
                      <div>
                        <h5 className="text-sm font-medium mb-2">参数说明:</h5>
                        <div className="space-y-2">
                          {Object.entries(toolInfo.inputSchema.properties).map(([propName, propSchema]) => {
                            const schema = propSchema as any
                            const isRequired = toolInfo.inputSchema.required?.includes(propName)
                            
                            return (
                              <div key={propName} className="text-sm border-l-2 border-muted pl-3">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-mono bg-muted px-2 py-1 rounded text-xs">
                                    {propName}
                                  </span>
                                  <Badge variant={isRequired ? "destructive" : "secondary"} className="text-xs">
                                    {isRequired ? '必需' : '可选'}
                                  </Badge>
                                  <Badge variant="outline" className="text-xs">
                                    {schema.type}
                                  </Badge>
                                </div>
                                
                                {schema.description && (
                                  <p className="text-muted-foreground text-xs mb-1">
                                    {schema.description}
                                  </p>
                                )}
                                
                                {schema.enum && (
                                  <div className="text-xs">
                                    <span className="text-muted-foreground">可选值: </span>
                                    <span className="font-mono">
                                      {schema.enum.join(', ')}
                                    </span>
                                  </div>
                                )}
                                
                                {schema.default !== undefined && (
                                  <div className="text-xs">
                                    <span className="text-muted-foreground">默认值: </span>
                                    <span className="font-mono">
                                      {JSON.stringify(schema.default)}
                                    </span>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })()}
              
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium">
                    工具参数 (JSON格式)
                  </label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => useExample(selectedTool)}
                    className="text-xs"
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    重新生成
                  </Button>
                </div>
                <Textarea
                  value={toolArgs}
                  onChange={(e) => setToolArgs(e.target.value)}
                  placeholder="输入JSON格式的参数..."
                  rows={8}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  参数基于工具的真实inputSchema生成。你可以修改这些值或点击"重新生成"按钮。
                </p>
              </div>
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