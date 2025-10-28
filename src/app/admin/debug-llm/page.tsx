'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import AdminNavigation from '@/components/AdminNavigation'
// Simple inline components
const Switch = ({ checked, onCheckedChange, id }: { checked: boolean, onCheckedChange: (checked: boolean) => void, id?: string }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    id={id}
    className={`inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors ${
      checked ? 'bg-blue-600' : 'bg-gray-200'
    }`}
    onClick={() => onCheckedChange(!checked)}
  >
    <span
      className={`block h-5 w-5 rounded-full bg-white shadow-lg transition-transform ${
        checked ? 'translate-x-5' : 'translate-x-0'
      }`}
    />
  </button>
)

const Label = ({ htmlFor, children, className = '' }: { htmlFor?: string, children: React.ReactNode, className?: string }) => (
  <label htmlFor={htmlFor} className={`text-sm font-medium leading-none ${className}`}>
    {children}
  </label>
)
import { Loader2, Play, CheckCircle, XCircle, Clock, MessageSquare, Cog } from 'lucide-react'

interface DebugResult {
  success: boolean
  results?: {
    testType: string
    timestamp: string
    steps: Array<{
      step: string
      success: boolean
      data?: any
      error?: string
      stack?: string
    }>
    summary?: {
      totalSteps: number
      successfulSteps: number
      failedSteps: number
      overallSuccess: boolean
    }
  }
  error?: string
  stack?: string
}

export default function DebugLLMPage() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<DebugResult | null>(null)
  const [message, setMessage] = useState('Hello, this is a test message')
  const [includeTools, setIncludeTools] = useState(false)
  const [testType, setTestType] = useState('basic')

  const runDebug = async () => {
    setLoading(true)
    setResult(null)

    try {
      const response = await fetch('/api/debug-llm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          includeTools,
          testType
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
      name: '基础测试',
      message: 'Hello, how are you?',
      includeTools: false,
      testType: 'basic'
    },
    {
      name: '工具测试',
      message: 'Please use the test tool to process "hello world"',
      includeTools: true,
      testType: 'basic'
    },
    {
      name: '综合测试',
      message: 'Explain quantum computing',
      includeTools: false,
      testType: 'comprehensive'
    },
    {
      name: '数学问题',
      message: 'Calculate the factorial of 5 and explain the process',
      includeTools: true,
      testType: 'basic'
    }
  ]

  const usePreset = (preset: typeof presetTests[0]) => {
    setMessage(preset.message)
    setIncludeTools(preset.includeTools)
    setTestType(preset.testType)
    setResult(null)
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <AdminNavigation title="LLM 服务调试" />
      
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">LLM 服务调试</h1>
        <p className="text-muted-foreground">
          测试和调试LLM服务的连接、响应和工具集成
        </p>
      </div>

      {/* 预设测试 */}
      <Card>
        <CardHeader>
          <CardTitle>预设测试</CardTitle>
          <CardDescription>
            选择预设的测试场景
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {presetTests.map((preset, index) => (
              <Button
                key={index}
                variant="outline"
                onClick={() => usePreset(preset)}
                className="h-auto p-4 flex flex-col items-start"
              >
                <div className="font-medium">{preset.name}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {preset.testType} | {preset.includeTools ? '含工具' : '无工具'}
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
            自定义测试参数
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="message">测试消息</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="输入要测试的消息..."
              rows={3}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="include-tools"
              checked={includeTools}
              onCheckedChange={setIncludeTools}
            />
            <Label htmlFor="include-tools">包含工具定义</Label>
          </div>

          <div>
            <Label htmlFor="test-type">测试类型</Label>
            <select
              id="test-type"
              value={testType}
              onChange={(e) => setTestType(e.target.value)}
              className="w-full mt-1 p-2 border rounded-md"
            >
              <option value="basic">基础测试</option>
              <option value="comprehensive">综合测试</option>
            </select>
          </div>

          <Button
            onClick={runDebug}
            disabled={loading || !message.trim()}
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

      {/* 调试结果 */}
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
          <CardContent>
            {result.success && result.results ? (
              <Tabs defaultValue="summary" className="space-y-4">
                <TabsList>
                  <TabsTrigger value="summary">概览</TabsTrigger>
                  <TabsTrigger value="steps">详细步骤</TabsTrigger>
                  <TabsTrigger value="responses">响应内容</TabsTrigger>
                </TabsList>

                <TabsContent value="summary">
                  <div className="space-y-4">
                    <Alert>
                      <CheckCircle className="h-4 w-4" />
                      <AlertDescription>
                        测试完成: {result.results.summary?.successfulSteps}/{result.results.summary?.totalSteps} 个步骤成功
                      </AlertDescription>
                    </Alert>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="text-center p-4 border rounded-lg">
                        <div className="text-2xl font-bold text-green-600">
                          {result.results.summary?.successfulSteps}
                        </div>
                        <div className="text-sm text-muted-foreground">成功步骤</div>
                      </div>
                      <div className="text-center p-4 border rounded-lg">
                        <div className="text-2xl font-bold text-red-600">
                          {result.results.summary?.failedSteps}
                        </div>
                        <div className="text-sm text-muted-foreground">失败步骤</div>
                      </div>
                      <div className="text-center p-4 border rounded-lg">
                        <div className="text-2xl font-bold text-blue-600">
                          {result.results.testType}
                        </div>
                        <div className="text-sm text-muted-foreground">测试类型</div>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="steps">
                  <div className="space-y-4">
                    {result.results.steps.map((step, index) => (
                      <div key={index} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium capitalize">{step.step.replace(/_/g, ' ')}</h4>
                          <div className="flex items-center gap-2">
                            {step.success ? (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            ) : (
                              <XCircle className="h-4 w-4 text-red-500" />
                            )}
                            <Badge variant={step.success ? "default" : "destructive"}>
                              {step.success ? "成功" : "失败"}
                            </Badge>
                          </div>
                        </div>

                        {step.success && step.data && (
                          <div className="space-y-2">
                            {step.data.responseTime && (
                              <div className="flex items-center gap-2 text-sm">
                                <Clock className="h-4 w-4" />
                                响应时间: {step.data.responseTime}ms
                              </div>
                            )}
                            {step.data.responseLength && (
                              <div className="flex items-center gap-2 text-sm">
                                <MessageSquare className="h-4 w-4" />
                                响应长度: {step.data.responseLength} 字符
                              </div>
                            )}
                            {step.data.hasToolCalls !== undefined && (
                              <div className="flex items-center gap-2 text-sm">
                                <Cog className="h-4 w-4" />
                                工具调用: {step.data.hasToolCalls ? `${step.data.toolCallCount} 个` : '无'}
                              </div>
                            )}
                          </div>
                        )}

                        {!step.success && (
                          <Alert variant="destructive">
                            <XCircle className="h-4 w-4" />
                            <AlertDescription>{step.error}</AlertDescription>
                          </Alert>
                        )}
                      </div>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="responses">
                  <div className="space-y-4">
                    {result.results.steps
                      .filter(step => step.success && step.data?.response)
                      .map((step, index) => (
                        <div key={index} className="border rounded-lg p-4">
                          <h4 className="font-medium mb-2 capitalize">
                            {step.step.replace(/_/g, ' ')} 响应
                          </h4>
                          <div className="space-y-2">
                            {step.data.response.content && (
                              <div>
                                <p className="text-sm font-medium mb-1">内容:</p>
                                <div className="bg-muted p-3 rounded text-sm">
                                  {step.data.response.content}
                                </div>
                              </div>
                            )}
                            {step.data.response.toolCalls && step.data.response.toolCalls.length > 0 && (
                              <div>
                                <p className="text-sm font-medium mb-1">工具调用:</p>
                                <pre className="bg-muted p-3 rounded text-xs overflow-auto">
                                  {JSON.stringify(step.data.response.toolCalls, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                </TabsContent>
              </Tabs>
            ) : (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>
                  调试失败: {result.error}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* 说明 */}
      <Card>
        <CardHeader>
          <CardTitle>功能说明</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>这个调试工具可以测试:</p>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li>LLM服务配置和连接</li>
            <li>基础消息发送和响应</li>
            <li>工具定义的集成</li>
            <li>不同类型消息的处理</li>
            <li>响应时间和性能指标</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}