'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, CheckCircle, XCircle, Play } from 'lucide-react'

interface TestResult {
  success: boolean
  result?: any
  error?: string
  details?: string
  mcpError?: any
  fullResponse?: any
}

export default function TestMCPConnectionPage() {
  const [url, setUrl] = useState('https://gurddy-mcp.fly.dev/mcp/http')
  const [method, setMethod] = useState('initialize')
  const [params, setParams] = useState('{}')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<TestResult | null>(null)

  const testConnection = async () => {
    setLoading(true)
    setResult(null)

    try {
      let parsedParams = {}
      if (params.trim()) {
        parsedParams = JSON.parse(params)
      }

      const response = await fetch('/api/test-http-mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          method,
          params: parsedParams
        })
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
      name: 'Initialize Gurddy MCP',
      url: 'https://gurddy-mcp.fly.dev/mcp/http',
      method: 'initialize',
      params: '{}'
    },
    {
      name: 'List Tools',
      url: 'https://gurddy-mcp.fly.dev/mcp/http',
      method: 'tools/list',
      params: '{}'
    },
    {
      name: 'Solve 4-Queens',
      url: 'https://gurddy-mcp.fly.dev/mcp/http',
      method: 'tools/call',
      params: '{"name": "solve_n_queens", "arguments": {"n": 4}}'
    }
  ]

  const usePreset = (preset: typeof presetTests[0]) => {
    setUrl(preset.url)
    setMethod(preset.method)
    setParams(preset.params)
    setResult(null)
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">MCP 连接测试</h1>
        <p className="text-muted-foreground">
          直接测试HTTP MCP服务器的连接和通信
        </p>
      </div>

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
            <label className="text-sm font-medium mb-2 block">MCP服务器URL</label>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/mcp/http"
            />
          </div>

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
            disabled={loading || !url || !method}
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