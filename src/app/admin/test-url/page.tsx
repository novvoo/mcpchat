'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import AdminNavigation from '@/components/AdminNavigation'
import { Loader2, CheckCircle, XCircle, Play } from 'lucide-react'

interface TestResult {
  success: boolean
  status?: number
  statusText?: string
  headers?: Record<string, string>
  body?: string
  error?: string
  type?: string
  url?: string
}

export default function TestUrlPage() {
  const [url, setUrl] = useState('https://gurddy-mcp.fly.dev/mcp/http')
  const [timeout, setTimeout] = useState(30000)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<TestResult | null>(null)
  const [diagnosing, setDiagnosing] = useState(false)
  const [diagnosisResult, setDiagnosisResult] = useState<any>(null)

  const testUrl = async () => {
    setLoading(true)
    setResult(null)

    try {
      const response = await fetch('/api/test-mcp-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, timeout })
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

  const diagnoseUrl = async () => {
    setDiagnosing(true)
    setDiagnosisResult(null)

    try {
      const response = await fetch('/api/diagnose-mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, timeout })
      })

      const data = await response.json()
      setDiagnosisResult(data)
    } catch (error) {
      setDiagnosisResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      setDiagnosing(false)
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <AdminNavigation title="URL 连接测试" />
      
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">URL 连接测试</h1>
        <p className="text-muted-foreground">
          测试MCP服务器URL的连接性和响应
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>测试配置</CardTitle>
          <CardDescription>
            配置要测试的URL和超时时间
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">测试URL</label>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/mcp/http"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">超时时间 (毫秒)</label>
            <Input
              type="number"
              value={timeout}
              onChange={(e) => setTimeout(parseInt(e.target.value) || 30000)}
              placeholder="30000"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button
              onClick={testUrl}
              disabled={loading || !url}
              className="w-full"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              快速测试
            </Button>
            
            <Button
              onClick={diagnoseUrl}
              disabled={diagnosing || !url}
              variant="outline"
              className="w-full"
            >
              {diagnosing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-2" />
              )}
              完整诊断
            </Button>
          </div>
        </CardContent>
      </Card>

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
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="font-medium text-muted-foreground">状态码</p>
                    <p>{result.status} {result.statusText}</p>
                  </div>
                  <div>
                    <p className="font-medium text-muted-foreground">URL</p>
                    <p className="break-all">{result.url}</p>
                  </div>
                </div>

                {result.headers && (
                  <div>
                    <p className="text-sm font-medium mb-2">响应头:</p>
                    <pre className="bg-muted p-4 rounded text-sm overflow-auto max-h-48">
                      {JSON.stringify(result.headers, null, 2)}
                    </pre>
                  </div>
                )}

                {result.body && (
                  <div>
                    <p className="text-sm font-medium mb-2">响应体:</p>
                    <pre className="bg-muted p-4 rounded text-sm overflow-auto max-h-96">
                      {result.body}
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="font-medium text-muted-foreground">错误类型</p>
                    <p>{result.type || 'Unknown'}</p>
                  </div>
                  <div>
                    <p className="font-medium text-muted-foreground">URL</p>
                    <p className="break-all">{result.url || url}</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {diagnosisResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {diagnosisResult.success ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
              完整诊断结果
            </CardTitle>
          </CardHeader>
          <CardContent>
            {diagnosisResult.success ? (
              <div className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  诊断时间: {new Date(diagnosisResult.results.timestamp).toLocaleString('zh-CN')}
                </div>
                
                <div className="space-y-4">
                  {diagnosisResult.results.tests.map((test: any, index: number) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        {test.success ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500" />
                        )}
                        <h4 className="font-medium">{test.name}</h4>
                        {test.responseTime && (
                          <span className="text-sm text-muted-foreground">
                            ({test.responseTime}ms)
                          </span>
                        )}
                      </div>
                      
                      {test.success ? (
                        <div className="space-y-2 text-sm">
                          {test.status && (
                            <p>状态: {test.status} {test.statusText}</p>
                          )}
                          {test.hostname && (
                            <p>主机: {test.hostname}:{test.port} ({test.protocol})</p>
                          )}
                          {test.body && (
                            <div>
                              <p className="font-medium mb-1">响应:</p>
                              <pre className="bg-muted p-2 rounded text-xs overflow-auto max-h-32">
                                {typeof test.body === 'string' ? test.body : JSON.stringify(test.body, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-sm text-red-600">
                          <p>错误: {test.error}</p>
                          {test.type && <p>类型: {test.type}</p>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>诊断失败: {diagnosisResult.error}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}