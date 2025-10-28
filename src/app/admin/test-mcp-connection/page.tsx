'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import AdminNavigation from '@/components/AdminNavigation'
import { Loader2, CheckCircle, XCircle, Play, RefreshCw } from 'lucide-react'

interface TestResult {
  success: boolean
  result?: any
  error?: string
  details?: string
  mcpError?: any
  fullResponse?: any
}

interface MCPServer {
  name: string
  transport: string
  url?: string
  command?: string
  args?: string[]
  env?: Record<string, string>
  disabled?: boolean
  [key: string]: any
}

interface MCPConfig {
  mcpServers: Record<string, MCPServer>
}

export default function TestMCPConnectionPage() {
  const [mcpConfig, setMcpConfig] = useState<MCPConfig | null>(null)
  const [selectedServer, setSelectedServer] = useState<string>('')
  const [transport, setTransport] = useState<'http' | 'stdio'>('http')
  const [url, setUrl] = useState('')
  const [command, setCommand] = useState('')
  const [args, setArgs] = useState('')
  const [env, setEnv] = useState('{}')
  const [method, setMethod] = useState('initialize')
  const [params, setParams] = useState('{}')
  const [loading, setLoading] = useState(false)
  const [configLoading, setConfigLoading] = useState(true)
  const [result, setResult] = useState<TestResult | null>(null)

  // 加载MCP配置
  const loadMCPConfig = async () => {
    setConfigLoading(true)
    try {
      const response = await fetch('/api/mcp-config')
      if (response.ok) {
        const config = await response.json()
        console.log('MCP config loaded:', config)
        setMcpConfig(config)

        // 自动选择第一个可用的服务器
        const availableServers = Object.entries(config.mcpServers || {}).filter(
          ([_, server]) => !(server as MCPServer).disabled
        )
        if (availableServers.length > 0) {
          const [serverName, server] = availableServers[0]
          setSelectedServer(serverName)
          const mcpServer = server as MCPServer
          setTransport(mcpServer.transport as 'http' | 'stdio')
          if (mcpServer.transport === 'http') {
            setUrl(mcpServer.url || '')
          } else {
            setCommand(mcpServer.command || '')
            setArgs((mcpServer.args || []).join(' '))
            setEnv(JSON.stringify(mcpServer.env || {}, null, 2))
          }
        }
      } else {
        const errorData = await response.json()
        console.error('Failed to load MCP config:', response.status, errorData)
        // 即使失败也设置一个空配置，避免显示"无法加载"
        setMcpConfig({ mcpServers: {} })
      }
    } catch (error) {
      console.error('Failed to load MCP config:', error)
      // 设置空配置
      setMcpConfig({ mcpServers: {} })
    } finally {
      setConfigLoading(false)
    }
  }

  useEffect(() => {
    loadMCPConfig()
  }, [])

  // 当选择的服务器改变时，更新配置
  const handleServerChange = (serverName: string) => {
    setSelectedServer(serverName)
    if (mcpConfig && mcpConfig.mcpServers[serverName]) {
      const server = mcpConfig.mcpServers[serverName]
      setTransport(server.transport as 'http' | 'stdio')
      if (server.transport === 'http') {
        setUrl(server.url || '')
        setCommand('')
        setArgs('')
        setEnv('{}')
      } else {
        setCommand(server.command || '')
        setArgs((server.args || []).join(' '))
        setEnv(JSON.stringify(server.env || {}, null, 2))
        setUrl('')
      }
    }
    setResult(null)
  }

  const testConnection = async () => {
    setLoading(true)
    setResult(null)

    try {
      let parsedParams = {}
      if (params.trim()) {
        parsedParams = JSON.parse(params)
      }

      let parsedEnv = {}
      if (env.trim()) {
        parsedEnv = JSON.parse(env)
      }

      const requestBody: any = {
        transport,
        method,
        params: parsedParams
      }

      if (transport === 'http') {
        requestBody.url = url
      } else {
        requestBody.command = command
        requestBody.args = args.trim() ? args.trim().split(/\s+/) : []
        requestBody.env = parsedEnv
      }

      const response = await fetch('/api/test-mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      })

      const data = await response.json()
      setResult(data)
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      setLoading(false)
    }
  }

  const presetTests = [
    {
      name: 'Initialize',
      method: 'initialize',
      params: '{}'
    },
    {
      name: 'List Tools',
      method: 'tools/list',
      params: '{}'
    },
    {
      name: 'Solve 4-Queens',
      method: 'tools/call',
      params: '{"name": "solve_n_queens", "arguments": {"n": 4}}'
    }
  ]

  const usePreset = (preset: typeof presetTests[0]) => {
    setMethod(preset.method)
    setParams(preset.params)
    setResult(null)
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <AdminNavigation title="MCP 连接测试" />
      
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">MCP 连接测试</h1>
        <p className="text-muted-foreground">
          从数据库读取MCP服务器配置进行测试（支持 HTTP 和 stdio 传输方式）
        </p>
      </div>

      {/* MCP服务器选择 */}
      {configLoading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            <span>加载MCP配置中...</span>
          </CardContent>
        </Card>
      ) : !mcpConfig ? (
        <Card>
          <CardContent className="text-center py-8">
            <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <p className="text-lg font-medium mb-2">无法加载MCP配置</p>
            <p className="text-muted-foreground mb-4">
              无法从数据库读取MCP配置。请检查：
            </p>
            <ul className="text-left text-sm text-muted-foreground mb-4 space-y-1">
              <li>• 数据库是否正在运行</li>
              <li>• mcp_servers 表是否存在</li>
              <li>• 是否已运行初始化脚本</li>
            </ul>
            <div className="space-x-2">
              <Button onClick={loadMCPConfig} variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                重试加载
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : Object.keys(mcpConfig.mcpServers || {}).length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <XCircle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
            <p className="text-lg font-medium mb-2">没有找到MCP服务器配置</p>
            <p className="text-muted-foreground mb-4">
              数据库中没有MCP服务器配置。请运行初始化脚本：
            </p>
            <div className="bg-muted p-3 rounded-md font-mono text-sm mb-4">
              npm run db:init:mcp
            </div>
            <Button onClick={loadMCPConfig} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              重新加载
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>MCP服务器配置</CardTitle>
                <CardDescription>
                  从数据库读取的服务器配置
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={loadMCPConfig}
                disabled={configLoading}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                刷新配置
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">选择MCP服务器</label>
              <select
                value={selectedServer}
                onChange={(e) => handleServerChange(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md"
              >
                <option value="">请选择服务器</option>
                {Object.entries(mcpConfig.mcpServers || {})
                  .map(([name, server]) => {
                    const mcpServer = server as MCPServer
                    const isDisabled = mcpServer.disabled
                    return (
                      <option key={name} value={name} disabled={isDisabled}>
                        {mcpServer.name || name} ({mcpServer.transport})
                        {mcpServer.disabled ? ' (已禁用)' : ''}
                      </option>
                    )
                  })}
              </select>
            </div>

            {selectedServer && mcpConfig.mcpServers && mcpConfig.mcpServers[selectedServer] && (
              <div className="bg-muted p-3 rounded-md border border-border">
                <p className="text-sm font-medium mb-1">服务器信息:</p>
                <p className="text-sm text-gray-600">
                  名称: {mcpConfig.mcpServers[selectedServer].name || selectedServer}
                </p>
                <p className="text-sm text-gray-600">
                  传输方式: {mcpConfig.mcpServers[selectedServer].transport}
                </p>
                {mcpConfig.mcpServers[selectedServer].transport === 'http' ? (
                  <p className="text-sm text-gray-600">
                    URL: {mcpConfig.mcpServers[selectedServer].url}
                  </p>
                ) : (
                  <>
                    <p className="text-sm text-gray-600">
                      命令: {mcpConfig.mcpServers[selectedServer].command}
                    </p>
                    <p className="text-sm text-gray-600">
                      参数: {(mcpConfig.mcpServers[selectedServer].args || []).join(' ')}
                    </p>
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 预设测试 */}
      <Card>
        <CardHeader>
          <CardTitle>预设测试</CardTitle>
          <CardDescription>
            点击使用预设的测试配置
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {presetTests.map((preset, index) => (
              <Button
                key={index}
                variant="outline"
                onClick={() => usePreset(preset)}
                className="h-auto p-4 flex flex-col items-start"
              >
                <div className="font-medium">{preset.name}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {preset.method}
                </div>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 测试配置 */}
      <Card>
        <CardHeader>
          <CardTitle>测试配置</CardTitle>
          <CardDescription>
            配置MCP服务器连接参数
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">传输方式</label>
            <select
              value={transport}
              onChange={(e) => setTransport(e.target.value as 'http' | 'stdio')}
              className="w-full p-2 border border-gray-300 rounded-md"
            >
              <option value="http">HTTP</option>
              <option value="stdio">stdio</option>
            </select>
          </div>

          {transport === 'http' ? (
            <div>
              <label className="text-sm font-medium mb-2 block">MCP服务器URL</label>
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/mcp/http"
              />
            </div>
          ) : (
            <>
              <div>
                <label className="text-sm font-medium mb-2 block">命令</label>
                <Input
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  placeholder="uvx"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">参数 (空格分隔)</label>
                <Input
                  value={args}
                  onChange={(e) => setArgs(e.target.value)}
                  placeholder="mcp-server-fetch"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">环境变量 (JSON格式)</label>
                <Textarea
                  value={env}
                  onChange={(e) => setEnv(e.target.value)}
                  placeholder='{"KEY": "value"}'
                  rows={3}
                  className="font-mono text-sm"
                />
              </div>
            </>
          )}

          <div>
            <label className="text-sm font-medium mb-2 block">MCP方法</label>
            <Input
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              placeholder="initialize"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">参数 (JSON格式)</label>
            <Textarea
              value={params}
              onChange={(e) => setParams(e.target.value)}
              placeholder='{"key": "value"}'
              rows={4}
              className="font-mono text-sm"
            />
          </div>

          <Button
            onClick={testConnection}
            disabled={loading || !method || !selectedServer || (transport === 'http' ? !url : !command)}
            className="w-full"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            测试连接
          </Button>
        </CardContent>
      </Card>

      {/* 测试结果 */}
      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {result.success ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
              测试结果
            </CardTitle>
          </CardHeader>
          <CardContent>
            {result.success ? (
              <div className="space-y-4">
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>连接成功！</AlertDescription>
                </Alert>

                {result.result && (
                  <div>
                    <p className="text-sm font-medium mb-2">MCP响应结果:</p>
                    <pre className="bg-muted p-4 rounded text-sm overflow-auto max-h-96">
                      {JSON.stringify(result.result, null, 2)}
                    </pre>
                  </div>
                )}

                {result.fullResponse && (
                  <div>
                    <p className="text-sm font-medium mb-2">完整响应:</p>
                    <pre className="bg-muted p-4 rounded text-sm overflow-auto max-h-96">
                      {JSON.stringify(result.fullResponse, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertDescription>连接失败: {result.error}</AlertDescription>
                </Alert>

                {result.details && (
                  <div>
                    <p className="text-sm font-medium mb-2">错误详情:</p>
                    <pre className="bg-red-50 border border-red-200 p-4 rounded text-sm overflow-auto max-h-64">
                      {result.details}
                    </pre>
                  </div>
                )}

                {result.mcpError && (
                  <div>
                    <p className="text-sm font-medium mb-2">MCP错误:</p>
                    <pre className="bg-red-50 border border-red-200 p-4 rounded text-sm overflow-auto max-h-64">
                      {JSON.stringify(result.mcpError, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}