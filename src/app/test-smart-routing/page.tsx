'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, CheckCircle, XCircle, Brain, Cog, MessageSquare, RefreshCw } from 'lucide-react'

interface SmartRoutingStatus {
    mcpConnected: boolean
    availableTools: number
    toolNames: string[]
    capabilities: {
        intentRecognition: boolean
        mcpDirectExecution: boolean
        llmFallback: boolean
        hybridMode: boolean
    }
}

interface IntentResult {
    shouldUseMCP: boolean
    matchedTool?: string
    confidence: number
    extractedParams?: Record<string, any>
    reasoning?: string
}

interface SmartRoutingResult {
    response: string
    source: 'mcp' | 'llm' | 'hybrid'
    confidence?: number
    reasoning?: string
    toolResults?: any[]
    conversationId: string
}

export default function TestSmartRoutingPage() {
    const [status, setStatus] = useState<SmartRoutingStatus | null>(null)
    const [loading, setLoading] = useState(false)
    const [userInput, setUserInput] = useState('')
    const [intentResult, setIntentResult] = useState<IntentResult | null>(null)
    const [routingResult, setRoutingResult] = useState<SmartRoutingResult | null>(null)
    const [error, setError] = useState<string | null>(null)

    // 预设的测试用例
    const testCases = [
        {
            name: '8皇后问题',
            input: '解决8皇后问题',
            description: '应该直接匹配到solve_n_queens工具'
        },
        {
            name: '数独求解',
            input: '帮我解这个数独：[[5,3,0,0,7,0,0,0,0],[6,0,0,1,9,5,0,0,0],[0,9,8,0,0,0,0,6,0],[8,0,0,0,6,0,0,0,3],[4,0,0,8,0,3,0,0,1],[7,0,0,0,2,0,0,0,6],[0,6,0,0,0,0,2,8,0],[0,0,0,4,1,9,0,0,5],[0,0,0,0,8,0,0,7,9]]',
            description: '应该匹配到solve_sudoku工具并提取数独网格'
        },
        {
            name: '运行示例',
            input: 'run example basic',
            description: '应该匹配到run_example工具'
        },
        {
            name: '普通对话',
            input: '你好，今天天气怎么样？',
            description: '应该使用LLM处理，不匹配MCP工具'
        },
        {
            name: '混合查询',
            input: '请帮我解决一个10皇后问题，然后解释一下算法原理',
            description: '可能触发混合模式：MCP执行+LLM解释'
        }
    ]

    useEffect(() => {
        loadStatus()
    }, [])

    const loadStatus = async () => {
        try {
            const response = await fetch('/api/mcp/test-smart-routing')
            const data = await response.json()

            if (data.success) {
                setStatus(data.data)
            } else {
                setError(data.error)
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : '加载状态失败')
        }
    }

    const initializeMCPSystem = async (force = false) => {
        setLoading(true)
        setError(null)

        try {
            const response = await fetch('/api/mcp/initialize-system', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ force })
            })

            const data = await response.json()

            if (data.success) {
                // 重新加载状态
                await loadStatus()
            } else {
                setError(data.error || '系统初始化失败')
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : '系统初始化失败')
        } finally {
            setLoading(false)
        }
    }

    const testIntentRecognition = async () => {
        if (!userInput.trim()) return

        setLoading(true)
        setError(null)
        setIntentResult(null)

        try {
            const response = await fetch('/api/mcp/test-smart-routing', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: userInput,
                    testMode: 'intent-only'
                })
            })

            const data = await response.json()

            if (data.success) {
                setIntentResult(data.data.intent)
            } else {
                setError(data.error)
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : '意图识别失败')
        } finally {
            setLoading(false)
        }
    }

    const testFullRouting = async () => {
        if (!userInput.trim()) return

        setLoading(true)
        setError(null)
        setRoutingResult(null)

        try {
            const response = await fetch('/api/mcp/test-smart-routing', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: userInput,
                    testMode: 'full'
                })
            })

            const data = await response.json()

            if (data.success) {
                setRoutingResult({
                    response: data.data.response,
                    source: data.data.source,
                    confidence: data.data.confidence,
                    reasoning: data.data.reasoning,
                    toolResults: data.data.toolResults,
                    conversationId: data.data.conversationId
                })
            } else {
                setError(data.error)
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : '智能路由失败')
        } finally {
            setLoading(false)
        }
    }

    const useTestCase = (testCase: typeof testCases[0]) => {
        setUserInput(testCase.input)
        setIntentResult(null)
        setRoutingResult(null)
        setError(null)
    }

    return (
        <div className="container mx-auto p-6 space-y-6">
            <div className="text-center space-y-2">
                <h1 className="text-3xl font-bold">MCP智能路由测试</h1>
                <p className="text-muted-foreground">
                    测试完整的MCP工具智能识别和路由功能流程
                </p>
            </div>

            {/* 系统状态和初始化 */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Cog className="h-5 w-5" />
                        系统状态
                    </CardTitle>
                    <CardDescription>
                        MCP系统初始化状态和连接信息
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {status ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="flex items-center gap-2">
                                {status.mcpConnected ? (
                                    <CheckCircle className="h-4 w-4 text-green-500" />
                                ) : (
                                    <XCircle className="h-4 w-4 text-red-500" />
                                )}
                                <span className="text-sm">
                                    MCP连接: {status.mcpConnected ? '已连接' : '未连接'}
                                </span>
                            </div>

                            <div className="flex items-center gap-2">
                                <Badge variant="secondary">
                                    {status.availableTools} 个工具
                                </Badge>
                            </div>

                            <div className="flex items-center gap-2">
                                {status.capabilities.intentRecognition ? (
                                    <CheckCircle className="h-4 w-4 text-green-500" />
                                ) : (
                                    <XCircle className="h-4 w-4 text-red-500" />
                                )}
                                <span className="text-sm">意图识别</span>
                            </div>

                            <div className="flex items-center gap-2">
                                {status.capabilities.hybridMode ? (
                                    <CheckCircle className="h-4 w-4 text-green-500" />
                                ) : (
                                    <XCircle className="h-4 w-4 text-red-500" />
                                )}
                                <span className="text-sm">混合模式</span>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>加载状态中...</span>
                        </div>
                    )}

                    <div className="flex gap-2">
                        <Button
                            onClick={() => initializeMCPSystem(false)}
                            disabled={loading}
                            variant="outline"
                        >
                            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Cog className="h-4 w-4 mr-2" />}
                            初始化系统
                        </Button>

                        <Button
                            onClick={() => initializeMCPSystem(true)}
                            disabled={loading}
                            variant="outline"
                        >
                            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                            重新初始化
                        </Button>

                        <Button
                            onClick={loadStatus}
                            disabled={loading}
                            variant="ghost"
                        >
                            <RefreshCw className="h-4 w-4 mr-2" />
                            刷新状态
                        </Button>
                    </div>

                    {status && status.toolNames.length > 0 && (
                        <div className="mt-4">
                            <p className="text-sm font-medium mb-2">可用工具:</p>
                            <div className="flex flex-wrap gap-2">
                                {status.toolNames.map(tool => (
                                    <Badge key={tool} variant="outline">
                                        {tool}
                                    </Badge>
                                ))}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* 流程说明 */}
            <Card>
                <CardHeader>
                    <CardTitle>智能路由流程</CardTitle>
                    <CardDescription>
                        完整的MCP工具智能路由处理流程
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="text-center p-4 border rounded-lg">
                            <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-2 text-sm font-bold">1</div>
                            <h4 className="font-medium mb-1">初始化MCP</h4>
                            <p className="text-xs text-muted-foreground">加载mcp.json配置，连接服务器</p>
                        </div>

                        <div className="text-center p-4 border rounded-lg">
                            <div className="w-8 h-8 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-2 text-sm font-bold">2</div>
                            <h4 className="font-medium mb-1">获取工具信息</h4>
                            <p className="text-xs text-muted-foreground">从MCP服务器获取可用工具列表</p>
                        </div>

                        <div className="text-center p-4 border rounded-lg">
                            <div className="w-8 h-8 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center mx-auto mb-2 text-sm font-bold">3</div>
                            <h4 className="font-medium mb-1">关键词映射</h4>
                            <p className="text-xs text-muted-foreground">动态初始化工具关键词映射</p>
                        </div>

                        <div className="text-center p-4 border rounded-lg">
                            <div className="w-8 h-8 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center mx-auto mb-2 text-sm font-bold">4</div>
                            <h4 className="font-medium mb-1">智能路由</h4>
                            <p className="text-xs text-muted-foreground">识别意图，选择MCP或LLM处理</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* 测试用例 */}
            <Card>
                <CardHeader>
                    <CardTitle>预设测试用例</CardTitle>
                    <CardDescription>
                        点击使用预设的测试用例来快速测试不同场景
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {testCases.map((testCase, index) => (
                            <Card key={index} className="cursor-pointer hover:bg-muted/50" onClick={() => useTestCase(testCase)}>
                                <CardContent className="p-4">
                                    <h4 className="font-medium mb-2">{testCase.name}</h4>
                                    <p className="text-sm text-muted-foreground mb-2">
                                        {testCase.description}
                                    </p>
                                    <p className="text-xs bg-muted p-2 rounded font-mono">
                                        {testCase.input.length > 50
                                            ? testCase.input.substring(0, 50) + '...'
                                            : testCase.input
                                        }
                                    </p>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* 用户输入 */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <MessageSquare className="h-5 w-5" />
                        用户输入测试
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Textarea
                        placeholder="输入你的消息..."
                        value={userInput}
                        onChange={(e) => setUserInput(e.target.value)}
                        rows={3}
                    />

                    <div className="flex gap-2">
                        <Button
                            onClick={testIntentRecognition}
                            disabled={loading || !userInput.trim()}
                            variant="outline"
                        >
                            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Brain className="h-4 w-4 mr-2" />}
                            测试意图识别
                        </Button>

                        <Button
                            onClick={testFullRouting}
                            disabled={loading || !userInput.trim()}
                        >
                            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Cog className="h-4 w-4 mr-2" />}
                            完整路由测试
                        </Button>
                    </div>
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
            <Tabs defaultValue="intent" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="intent">意图识别结果</TabsTrigger>
                    <TabsTrigger value="routing">智能路由结果</TabsTrigger>
                </TabsList>

                <TabsContent value="intent">
                    {intentResult ? (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Brain className="h-5 w-5" />
                                    意图识别结果
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <p className="text-sm font-medium">是否使用MCP</p>
                                        <Badge variant={intentResult.shouldUseMCP ? "default" : "secondary"}>
                                            {intentResult.shouldUseMCP ? "是" : "否"}
                                        </Badge>
                                    </div>

                                    <div>
                                        <p className="text-sm font-medium">置信度</p>
                                        <Badge variant={intentResult.confidence > 0.6 ? "default" : "outline"}>
                                            {(intentResult.confidence * 100).toFixed(1)}%
                                        </Badge>
                                    </div>

                                    {intentResult.matchedTool && (
                                        <div>
                                            <p className="text-sm font-medium">匹配工具</p>
                                            <Badge variant="default">{intentResult.matchedTool}</Badge>
                                        </div>
                                    )}
                                </div>

                                {intentResult.extractedParams && Object.keys(intentResult.extractedParams).length > 0 && (
                                    <div>
                                        <p className="text-sm font-medium mb-2">提取的参数</p>
                                        <pre className="bg-muted p-3 rounded text-xs overflow-auto">
                                            {JSON.stringify(intentResult.extractedParams, null, 2)}
                                        </pre>
                                    </div>
                                )}

                                {intentResult.reasoning && (
                                    <div>
                                        <p className="text-sm font-medium mb-2">推理过程</p>
                                        <p className="text-sm text-muted-foreground bg-muted p-3 rounded">
                                            {intentResult.reasoning}
                                        </p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    ) : (
                        <Card>
                            <CardContent className="p-6 text-center text-muted-foreground">
                                点击"测试意图识别"查看结果
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>

                <TabsContent value="routing">
                    {routingResult ? (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Cog className="h-5 w-5" />
                                    智能路由结果
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <p className="text-sm font-medium">处理方式</p>
                                        <Badge variant={
                                            routingResult.source === 'mcp' ? 'default' :
                                                routingResult.source === 'hybrid' ? 'secondary' : 'outline'
                                        }>
                                            {routingResult.source === 'mcp' ? 'MCP直接执行' :
                                                routingResult.source === 'hybrid' ? '混合模式' : 'LLM处理'}
                                        </Badge>
                                    </div>

                                    {routingResult.confidence && (
                                        <div>
                                            <p className="text-sm font-medium">置信度</p>
                                            <Badge variant="outline">
                                                {(routingResult.confidence * 100).toFixed(1)}%
                                            </Badge>
                                        </div>
                                    )}

                                    <div>
                                        <p className="text-sm font-medium">会话ID</p>
                                        <Badge variant="outline" className="font-mono text-xs">
                                            {routingResult.conversationId.substring(0, 12)}...
                                        </Badge>
                                    </div>
                                </div>

                                <div>
                                    <p className="text-sm font-medium mb-2">响应内容</p>
                                    <div className="bg-muted p-4 rounded">
                                        <p className="text-sm whitespace-pre-wrap">
                                            {routingResult.response}
                                        </p>
                                    </div>
                                </div>

                                {routingResult.reasoning && (
                                    <div>
                                        <p className="text-sm font-medium mb-2">处理逻辑</p>
                                        <p className="text-sm text-muted-foreground bg-muted p-3 rounded">
                                            {routingResult.reasoning}
                                        </p>
                                    </div>
                                )}

                                {routingResult.toolResults && routingResult.toolResults.length > 0 && (
                                    <div>
                                        <p className="text-sm font-medium mb-2">工具执行结果</p>
                                        <pre className="bg-muted p-3 rounded text-xs overflow-auto max-h-64">
                                            {JSON.stringify(routingResult.toolResults, null, 2)}
                                        </pre>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    ) : (
                        <Card>
                            <CardContent className="p-6 text-center text-muted-foreground">
                                点击"完整路由测试"查看结果
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    )
}