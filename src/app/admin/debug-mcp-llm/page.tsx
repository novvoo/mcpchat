'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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
import { Loader2, Play, CheckCircle, XCircle, Clock, MessageSquare, Cog, Activity, Zap } from 'lucide-react'

interface TraceEvent {
  type: string
  timestamp: string
  data: any
}

interface DebugResult {
  success: boolean
  results?: {
    testMode: string
    message: string
    timestamp: string
    steps: Array<{
      step: string
      success: boolean
      data?: any
      error?: string
    }>
    traces: TraceEvent[]
    summary?: {
      totalSteps: number
      successfulSteps: number
      failedSteps: number
      overallSuccess: boolean
      traceCount: number
    }
  }
  error?: string
  stack?: string
}

export default function DebugMCPLLMPage() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<DebugResult | null>(null)
  const [message, setMessage] = useState('')
  const [testMode, setTestMode] = useState('full_flow')
  const [enableTracing, setEnableTracing] = useState(true)
  const [presetTests, setPresetTests] = useState<any[]>([])
  const [loadingPresets, setLoadingPresets] = useState(true)

  const runDebug = async () => {
    setLoading(true)
    setResult(null)

    try {
      const response = await fetch('/api/debug-mcp-llm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          testMode,
          enableTracing
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

  useEffect(() => {
    loadPresetTests()
  }, [])

  const loadPresetTests = async () => {
    setLoadingPresets(true)
    try {
      // 从数据库加载样例问题
      const response = await fetch('/api/sample-problems?action=recommended&limit=6')
      const result = await response.json()
      
      const dynamicTests: any[] = []
      
      if (result.success && result.data.length > 0) {
        result.data.forEach((problem: any) => {
          const testInput = generateTestInput(problem)
          if (testInput) {
            dynamicTests.push({
              name: `${problem.title || problem.title_en} (应走MCP路径)`,
              message: testInput,
              testMode: 'smart_router',
              expectedFlow: `Smart Router → ${problem.tool_name}`,
              source: 'database'
            })
          }
        })
      }
      
      // 添加预定义的测试用例
      const staticTests = [
        {
          name: 'N皇后问题解释 (应走LLM路径)',
          message: '什么是N皇后问题？请详细解释',
          testMode: 'smart_router',
          expectedFlow: 'Smart Router → LLM',
          source: 'predefined'
        },
        {
          name: '一般对话 (应走LLM路径)',
          message: '你好，今天天气怎么样？',
          testMode: 'smart_router',
          expectedFlow: 'Smart Router → LLM',
          source: 'predefined'
        },
        {
          name: '多场景测试',
          message: dynamicTests.length > 0 ? dynamicTests[0].message : '解决问题',
          testMode: 'test_cases',
          expectedFlow: '测试多种输入场景',
          source: 'predefined'
        }
      ]
      
      setPresetTests([...dynamicTests, ...staticTests])
    } catch (error) {
      console.error('加载预设测试失败:', error)
      // 备用测试用例 - 尝试从默认样例问题生成
      try {
        const fallbackResponse = await fetch('/api/sample-problems?action=by-tool&tool_name=solve_n_queens')
        const fallbackResult = await fallbackResponse.json()
        
        const fallbackTests = [
          {
            name: '一般对话 (应走LLM路径)',
            message: '你好，今天天气怎么样？',
            testMode: 'smart_router',
            expectedFlow: 'Smart Router → LLM',
            source: 'fallback'
          }
        ]
        
        if (fallbackResult.success && fallbackResult.data.length > 0) {
          const problem = fallbackResult.data[0]
          const testInput = generateTestInput(problem)
          if (testInput) {
            fallbackTests.unshift({
              name: `${problem.title || problem.title_en} (应走MCP路径)`,
              message: testInput,
              testMode: 'smart_router',
              expectedFlow: `Smart Router → ${problem.tool_name}`,
              source: 'fallback'
            })
          }
        }
        
        setPresetTests(fallbackTests)
      } catch {
        // 最终备用
        setPresetTests([
          {
            name: '算法问题 (应走MCP路径)',
            message: '请处理一个算法问题',
            testMode: 'smart_router',
            expectedFlow: 'Smart Router → MCP Tool',
            source: 'fallback'
          },
          {
            name: '一般对话 (应走LLM路径)',
            message: '你好，今天天气怎么样？',
            testMode: 'smart_router',
            expectedFlow: 'Smart Router → LLM',
            source: 'fallback'
          }
        ])
      }
    } finally {
      setLoadingPresets(false)
    }
  }

  const generateTestInput = (problem: any): string | null => {
    const toolName = problem.tool_name
    const params = problem.parameters || {}
    
    switch (toolName) {
      case 'solve_n_queens':
        const n = params.n || 8
        return `解决${n}皇后问题`
        
      case 'solve_sudoku':
        if (params.puzzle) {
          return `帮我解这个数独：${JSON.stringify(params.puzzle)}`
        }
        return '帮我解数独'
        
      case 'run_example':
        const exampleType = params.example_type || 'basic'
        return `run example ${exampleType}`
        
      default:
        if (problem.title) {
          return `请帮我处理：${problem.title}`
        }
        return null
    }
  }

  const usePreset = (preset: typeof presetTests[0]) => {
    setMessage(preset.message)
    setTestMode(preset.testMode)
    setResult(null)
  }

  const getTraceIcon = (type: string) => {
    switch (type) {
      case 'llm_request':
      case 'llm_response':
        return <MessageSquare className="h-4 w-4" />
      case 'tool_call_start':
      case 'tool_call_end':
        return <Cog className="h-4 w-4" />
      case 'smart_router_start':
      case 'smart_router_end':
        return <Zap className="h-4 w-4" />
      default:
        return <Activity className="h-4 w-4" />
    }
  }

  const getTraceColor = (type: string) => {
    if (type.includes('error')) return 'text-red-500'
    if (type.includes('end') || type.includes('response')) return 'text-green-500'
    if (type.includes('start') || type.includes('request')) return 'text-blue-500'
    return 'text-gray-500'
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <AdminNavigation title="MCP-LLM 交互调试" />
      
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">MCP-LLM 交互调试</h1>
        <p className="text-muted-foreground">
          调试MCP工具与LLM服务的完整交互流程和流量追踪
        </p>
      </div>

      {/* 预设测试 */}
      <Card>
        <CardHeader>
          <CardTitle>预设测试场景</CardTitle>
          <CardDescription>
            选择常见的MCP-LLM交互场景
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {presetTests.map((preset, index) => (
              <Button
                key={index}
                variant="outline"
                onClick={() => usePreset(preset)}
                className="h-auto p-4 flex flex-col items-start"
              >
                <div className="font-medium">{preset.name}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {preset.testMode} | {preset.expectedFlow}
                </div>
                <div className="text-xs bg-muted p-1 rounded mt-2 w-full text-left">
                  {preset.message.length > 40 
                    ? preset.message.substring(0, 40) + '...' 
                    : preset.message}
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
            自定义测试参数和选项
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

          <div>
            <Label htmlFor="test-mode">测试模式</Label>
            <select
              id="test-mode"
              value={testMode}
              onChange={(e) => setTestMode(e.target.value)}
              className="w-full mt-1 p-2 border rounded-md"
            >
              <option value="smart_router">智能路由测试 (推荐)</option>
              <option value="full_flow">完整流程测试</option>
              <option value="test_cases">多场景测试</option>
              <option value="tools_only">仅工具测试</option>
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="enable-tracing"
              checked={enableTracing}
              onCheckedChange={setEnableTracing}
            />
            <Label htmlFor="enable-tracing">启用流量追踪</Label>
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
                  <TabsTrigger value="steps">执行步骤</TabsTrigger>
                  <TabsTrigger value="traces">流量追踪</TabsTrigger>
                  <TabsTrigger value="timeline">时间线</TabsTrigger>
                </TabsList>

                <TabsContent value="summary">
                  <div className="space-y-4">
                    <Alert>
                      <CheckCircle className="h-4 w-4" />
                      <AlertDescription>
                        测试完成: {result.results.summary?.successfulSteps}/{result.results.summary?.totalSteps} 个步骤成功
                        {enableTracing && ` | ${result.results.summary?.traceCount} 个追踪事件`}
                      </AlertDescription>
                    </Alert>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                          {result.results.summary?.traceCount || 0}
                        </div>
                        <div className="text-sm text-muted-foreground">追踪事件</div>
                      </div>
                      <div className="text-center p-4 border rounded-lg">
                        <div className="text-2xl font-bold text-purple-600">
                          {result.results.testMode}
                        </div>
                        <div className="text-sm text-muted-foreground">测试模式</div>
                      </div>
                    </div>

                    <div className="bg-muted p-4 rounded">
                      <p className="text-sm"><strong>测试消息:</strong> {result.results.message}</p>
                      <p className="text-sm"><strong>执行时间:</strong> {result.results.timestamp}</p>
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
                            {step.data.toolCount !== undefined && (
                              <div className="flex items-center gap-2 text-sm">
                                <Cog className="h-4 w-4" />
                                工具数量: {step.data.toolCount}
                              </div>
                            )}
                            {step.data.responseTime && (
                              <div className="flex items-center gap-2 text-sm">
                                <Clock className="h-4 w-4" />
                                响应时间: {step.data.responseTime}ms
                              </div>
                            )}
                            {step.data.executionTime && (
                              <div className="flex items-center gap-2 text-sm">
                                <Clock className="h-4 w-4" />
                                执行时间: {step.data.executionTime}ms
                              </div>
                            )}
                            {step.data.hasToolCalls !== undefined && (
                              <div className="flex items-center gap-2 text-sm">
                                <MessageSquare className="h-4 w-4" />
                                工具调用: {step.data.hasToolCalls ? `${step.data.toolCallCount} 个` : '无'}
                              </div>
                            )}
                            {step.data.source && (
                              <div className="flex items-center gap-2 text-sm">
                                <Zap className="h-4 w-4" />
                                处理方式: {step.data.source}
                              </div>
                            )}
                            {step.data.flowDescription && (
                              <div className="flex items-center gap-2 text-sm">
                                <Activity className="h-4 w-4" />
                                流程: {step.data.flowDescription}
                              </div>
                            )}
                            {step.data.confidence !== undefined && (
                              <div className="flex items-center gap-2 text-sm">
                                <CheckCircle className="h-4 w-4" />
                                置信度: {(step.data.confidence * 100).toFixed(1)}%
                              </div>
                            )}
                            {step.data.reasoning && (
                              <div className="text-sm text-muted-foreground mt-2">
                                <strong>推理:</strong> {step.data.reasoning}
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

                <TabsContent value="traces">
                  <div className="space-y-2">
                    {result.results.traces.map((trace, index) => (
                      <div key={index} className="border-l-4 border-blue-200 pl-4 py-2">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={getTraceColor(trace.type)}>
                            {getTraceIcon(trace.type)}
                          </span>
                          <span className="font-medium text-sm capitalize">
                            {trace.type.replace(/_/g, ' ')}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(trace.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <div className="text-sm bg-muted p-2 rounded">
                          <pre className="text-xs overflow-auto">
                            {JSON.stringify(trace.data, null, 2)}
                          </pre>
                        </div>
                      </div>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="timeline">
                  <div className="space-y-4">
                    <div className="relative">
                      {result.results.traces.map((trace, index) => (
                        <div key={index} className="flex items-center gap-4 mb-4">
                          <div className="flex-shrink-0 w-20 text-xs text-muted-foreground">
                            {new Date(trace.timestamp).toLocaleTimeString()}
                          </div>
                          <div className={`flex-shrink-0 ${getTraceColor(trace.type)}`}>
                            {getTraceIcon(trace.type)}
                          </div>
                          <div className="flex-1">
                            <div className="font-medium text-sm capitalize">
                              {trace.type.replace(/_/g, ' ')}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {trace.data.toolName && `工具: ${trace.data.toolName}`}
                              {trace.data.responseTime && ` | 耗时: ${trace.data.responseTime}ms`}
                              {trace.data.executionTime && ` | 执行: ${trace.data.executionTime}ms`}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
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
            <li>MCP工具服务的加载和可用性</li>
            <li>LLM与MCP工具的集成</li>
            <li>工具调用的执行和结果</li>
            <li>智能路由的完整流程</li>
            <li>详细的流量追踪和时间线</li>
          </ul>
          <p className="mt-4">
            启用流量追踪可以查看每个步骤的详细执行过程和性能指标。
          </p>
        </CardContent>
      </Card>
    </div>
  )
}