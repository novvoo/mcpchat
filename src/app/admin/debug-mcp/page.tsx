'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import AdminNavigation from '@/components/AdminNavigation'
import { Loader2, Play, CheckCircle, XCircle, AlertTriangle } from 'lucide-react'

interface DebugResult {
  success: boolean
  results?: Array<{
    server: string
    success: boolean
    toolCount?: number
    tools?: string[]
    error?: string
    toolError?: string
    stack?: string
  }>
  summary?: {
    totalServers: number
    successfulServers: number
    failedServers: number
  }
  error?: string
  stack?: string
}

export default function DebugMCPPage() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<DebugResult | null>(null)

  const runDebug = async () => {
    setLoading(true)
    setResult(null)

    try {
      const response = await fetch('/api/debug-mcp-init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
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

  return (
    <div className="container mx-auto p-6 space-y-6">
      <AdminNavigation title="MCP 初始化调试" />
      
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">MCP 初始化调试</h1>
        <p className="text-muted-foreground">
          详细调试MCP服务器初始化过程
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>调试控制</CardTitle>
          <CardDescription>
            运行详细的MCP初始化调试，查看每个步骤的执行情况
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={runDebug}
            disabled={loading}
            className="w-full"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            开始调试
          </Button>
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
              调试结果
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {result.success && result.summary ? (
              <div>
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    调试完成: {result.summary.successfulServers}/{result.summary.totalServers} 个服务器成功初始化
                  </AlertDescription>
                </Alert>

                {result.results && (
                  <div className="space-y-4 mt-4">
                    <h3 className="font-medium">服务器详情:</h3>
                    {result.results.map((serverResult, index) => (
                      <div key={index} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium">{serverResult.server}</h4>
                          <div className="flex items-center gap-2">
                            {serverResult.success ? (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            ) : (
                              <XCircle className="h-4 w-4 text-red-500" />
                            )}
                            <Badge variant={serverResult.success ? "default" : "destructive"}>
                              {serverResult.success ? "成功" : "失败"}
                            </Badge>
                          </div>
                        </div>

                        {serverResult.success && (
                          <div className="space-y-2">
                            <p className="text-sm">
                              工具数量: {serverResult.toolCount || 0}
                            </p>
                            {serverResult.tools && serverResult.tools.length > 0 && (
                              <div>
                                <p className="text-sm font-medium mb-1">可用工具:</p>
                                <div className="flex flex-wrap gap-1">
                                  {serverResult.tools.map(tool => (
                                    <Badge key={tool} variant="outline" className="text-xs">
                                      {tool}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                            {serverResult.toolError && (
                              <Alert variant="destructive">
                                <AlertTriangle className="h-4 w-4" />
                                <AlertDescription>
                                  工具加载失败: {serverResult.toolError}
                                </AlertDescription>
                              </Alert>
                            )}
                          </div>
                        )}

                        {!serverResult.success && (
                          <div className="space-y-2">
                            <Alert variant="destructive">
                              <XCircle className="h-4 w-4" />
                              <AlertDescription>
                                {serverResult.error}
                              </AlertDescription>
                            </Alert>
                            {serverResult.stack && (
                              <details className="text-xs">
                                <summary className="cursor-pointer text-muted-foreground">
                                  查看错误堆栈
                                </summary>
                                <pre className="mt-2 bg-muted p-2 rounded overflow-auto max-h-32">
                                  {serverResult.stack}
                                </pre>
                              </details>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertDescription>
                    调试失败: {result.error}
                  </AlertDescription>
                </Alert>
                {result.stack && (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground">
                      查看错误堆栈
                    </summary>
                    <pre className="mt-2 bg-muted p-2 rounded overflow-auto max-h-64">
                      {result.stack}
                    </pre>
                  </details>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>说明</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>这个调试工具会:</p>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li>加载MCP配置文件</li>
            <li>逐个初始化每个启用的服务器</li>
            <li>测试每个服务器的工具加载</li>
            <li>显示详细的错误信息和堆栈跟踪</li>
          </ul>
          <p className="mt-4">
            查看浏览器控制台和服务器日志获取更多详细信息。
          </p>
        </CardContent>
      </Card>
    </div>
  )
}