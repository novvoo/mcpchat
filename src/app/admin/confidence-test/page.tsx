'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import AdminNavigation from '@/components/AdminNavigation'
import { Loader2, TestTube, TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface ConfidenceTestResult {
    userInput: string
    needsMCP: boolean
    suggestedTool?: string
    confidence: number
    reasoning: string
    timestamp: Date
}

export default function ConfidenceTestPage() {
    const [testInput, setTestInput] = useState('')
    const [loading, setLoading] = useState(false)
    const [results, setResults] = useState<ConfidenceTestResult[]>([])
    const [error, setError] = useState<string | null>(null)

    // 预设测试用例
    const testCases = [
        "解决8皇后问题",
        "run example lp",
        "solve sudoku puzzle",
        "什么是机器学习",
        "echo hello world",
        "安装gurddy包",
        "24点游戏 1234",
        "鸡兔同笼35头94腿",
        "今天天气怎么样",
        "计算圆周率",
        "N皇后问题求解",
        "运行线性规划示例"
    ]

    const testIntent = async (input: string) => {
        setLoading(true)
        setError(null)

        try {
            const response = await fetch('/api/test-intent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userInput: input })
            })

            const data = await response.json()

            if (data.success) {
                const result: ConfidenceTestResult = {
                    userInput: input,
                    needsMCP: data.intent.needsMCP,
                    suggestedTool: data.intent.suggestedTool,
                    confidence: data.intent.confidence,
                    reasoning: data.intent.reasoning || '',
                    timestamp: new Date()
                }

                setResults(prev => [result, ...prev])
            } else {
                setError(data.error || '测试失败')
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : '网络错误')
        } finally {
            setLoading(false)
        }
    }

    const runBatchTest = async () => {
        setResults([])
        for (const testCase of testCases) {
            await testIntent(testCase)
            // 添加小延迟避免过快请求
            await new Promise(resolve => setTimeout(resolve, 200))
        }
    }

    const getConfidenceColor = (confidence: number) => {
        if (confidence >= 0.7) return 'text-green-600 bg-green-50'
        if (confidence >= 0.4) return 'text-yellow-600 bg-yellow-50'
        return 'text-red-600 bg-red-50'
    }

    const getConfidenceIcon = (confidence: number) => {
        if (confidence >= 0.7) return <TrendingUp className="h-4 w-4" />
        if (confidence >= 0.4) return <Minus className="h-4 w-4" />
        return <TrendingDown className="h-4 w-4" />
    }

    const getConfidenceLevel = (confidence: number) => {
        if (confidence >= 0.7) return '高'
        if (confidence >= 0.4) return '中'
        return '低'
    }

    const clearResults = () => {
        setResults([])
        setError(null)
    }

    return (
        <div className="container mx-auto p-6 space-y-6">
            <AdminNavigation title="置信度测试" />

            <div className="text-center space-y-2">
                <h1 className="text-3xl font-bold">意图识别置信度测试</h1>
                <p className="text-muted-foreground">
                    测试和验证意图识别系统的置信度准确性
                </p>
            </div>

            {/* 测试控制 */}
            <Card>
                <CardHeader>
                    <CardTitle>测试控制</CardTitle>
                    <CardDescription>
                        输入测试文本或运行批量测试来验证置信度计算
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex gap-2">
                        <Input
                            value={testInput}
                            onChange={(e) => setTestInput(e.target.value)}
                            placeholder="输入测试文本..."
                            onKeyDown={(e) => e.key === 'Enter' && testInput && testIntent(testInput)}
                        />
                        <Button
                            onClick={() => testIntent(testInput)}
                            disabled={loading || !testInput}
                        >
                            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <TestTube className="h-4 w-4" />}
                            测试
                        </Button>
                    </div>

                    <div className="flex gap-2">
                        <Button
                            onClick={runBatchTest}
                            disabled={loading}
                            variant="outline"
                        >
                            批量测试 ({testCases.length}个用例)
                        </Button>
                        <Button
                            onClick={clearResults}
                            variant="outline"
                        >
                            清空结果
                        </Button>
                    </div>

                    {/* 预设测试用例 */}
                    <div>
                        <h4 className="text-sm font-medium mb-2">快速测试用例:</h4>
                        <div className="flex flex-wrap gap-2">
                            {testCases.slice(0, 6).map((testCase, index) => (
                                <Button
                                    key={index}
                                    variant="outline"
                                    size="sm"
                                    onClick={() => testIntent(testCase)}
                                    disabled={loading}
                                    className="text-xs"
                                >
                                    {testCase}
                                </Button>
                            ))}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* 错误显示 */}
            {error && (
                <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {/* 测试结果统计 */}
            {results.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>测试统计</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="text-center">
                                <div className="text-2xl font-bold">{results.length}</div>
                                <div className="text-sm text-muted-foreground">总测试数</div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-green-600">
                                    {results.filter(r => r.confidence >= 0.7).length}
                                </div>
                                <div className="text-sm text-muted-foreground">高置信度</div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-yellow-600">
                                    {results.filter(r => r.confidence >= 0.4 && r.confidence < 0.7).length}
                                </div>
                                <div className="text-sm text-muted-foreground">中置信度</div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-red-600">
                                    {results.filter(r => r.confidence < 0.4).length}
                                </div>
                                <div className="text-sm text-muted-foreground">低置信度</div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* 测试结果 */}
            {results.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>测试结果</CardTitle>
                        <CardDescription>
                            按时间倒序显示测试结果，包含置信度和推理过程
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {results.map((result, index) => (
                                <div key={index} className="border rounded-lg p-4">
                                    <div className="flex items-start justify-between mb-2">
                                        <div className="flex-1">
                                            <h4 className="font-medium">{result.userInput}</h4>
                                            <p className="text-sm text-muted-foreground">
                                                {result.timestamp.toLocaleTimeString()}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Badge
                                                variant={result.needsMCP ? "default" : "secondary"}
                                                className="flex items-center gap-1"
                                            >
                                                {result.needsMCP ? "使用MCP" : "使用LLM"}
                                            </Badge>
                                            <Badge
                                                className={`flex items-center gap-1 ${getConfidenceColor(result.confidence)}`}
                                            >
                                                {getConfidenceIcon(result.confidence)}
                                                {getConfidenceLevel(result.confidence)} ({(result.confidence * 100).toFixed(1)}%)
                                            </Badge>
                                        </div>
                                    </div>

                                    {result.suggestedTool && (
                                        <div className="mb-2">
                                            <Badge variant="outline">
                                                工具: {result.suggestedTool}
                                            </Badge>
                                        </div>
                                    )}

                                    <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded">
                                        <strong>推理过程:</strong> {result.reasoning}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}