'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'

export default function TestSmartRouterPage() {
    const [message, setMessage] = useState('')
    const [testMode, setTestMode] = useState('full')
    const [result, setResult] = useState<any>(null)
    const [loading, setLoading] = useState(false)

    const [testExamples, setTestExamples] = useState<string[]>([])
    const [loadingExamples, setLoadingExamples] = useState(true)

    useEffect(() => {
        loadTestExamples()
    }, [])

    const loadTestExamples = async () => {
        setLoadingExamples(true)
        try {
            // 从数据库加载样例问题
            const response = await fetch('/api/sample-problems?action=recommended&limit=4')
            const result = await response.json()
            
            const dynamicExamples: string[] = []
            
            if (result.success && result.data.length > 0) {
                result.data.forEach((problem: any) => {
                    const testInput = generateTestInput(problem)
                    if (testInput) {
                        dynamicExamples.push(testInput)
                    }
                })
            }
            
            // 添加一些预定义的示例
            const staticExamples = [
                '什么是N皇后问题？',
                'solve n queens',
                'run example'
            ]
            
            setTestExamples([...dynamicExamples, ...staticExamples])
        } catch (error) {
            console.error('加载测试示例失败:', error)
            // 备用示例 - 尝试从默认样例问题生成
            try {
                const fallbackResponse = await fetch('/api/sample-problems?action=by-tool&tool_name=solve_n_queens')
                const fallbackResult = await fallbackResponse.json()
                
                const fallbackExamples = ['什么是N皇后问题？', 'solve n queens', 'run example']
                
                if (fallbackResult.success && fallbackResult.data.length > 0) {
                    const problem = fallbackResult.data[0]
                    const testInput = generateTestInput(problem)
                    if (testInput) {
                        fallbackExamples.unshift(testInput)
                    }
                }
                
                setTestExamples(fallbackExamples)
            } catch {
                // 最终备用
                setTestExamples([
                    '请处理一个算法问题',
                    '运行一个示例',
                    '什么是N皇后问题？',
                    'solve n queens',
                    'run example'
                ])
            }
        } finally {
            setLoadingExamples(false)
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
                return '帮我解数独'
                
            case 'run_example':
                const exampleType = params.example_type || 'basic'
                return `run example ${exampleType}`
                
            default:
                if (problem.title) {
                    return `请处理：${problem.title}`
                }
                return null
        }
    }

    const handleTest = async () => {
        if (!message.trim()) return

        setLoading(true)
        try {
            const response = await fetch('/api/test-smart-router', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: message.trim(),
                    testMode
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

    const handleExampleClick = (example: string) => {
        setMessage(example)
    }

    return (
        <div className="container mx-auto p-6 max-w-4xl">
            <h1 className="text-2xl font-bold mb-6">Smart Router Test</h1>

            <div className="space-y-6">
                {/* Input Section */}
                <div className="bg-white p-6 rounded-lg shadow">
                    <h2 className="text-lg font-semibold mb-4">Test Input</h2>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-2">Test Message:</label>
                            <input
                                type="text"
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                className="w-full p-3 border border-gray-300 rounded-md"
                                placeholder="Enter message to test..."
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">Test Mode:</label>
                            <select
                                value={testMode}
                                onChange={(e) => setTestMode(e.target.value)}
                                className="w-full p-3 border border-gray-300 rounded-md"
                            >
                                <option value="full">Full Test (Intent + Metadata + Router)</option>
                                <option value="intent">Intent Recognition Only</option>
                                <option value="metadata">Tool Metadata Only</option>
                                <option value="router">Smart Router Only</option>
                            </select>
                        </div>

                        <Button
                            onClick={handleTest}
                            disabled={loading || !message.trim()}
                            className="w-full"
                        >
                            {loading ? 'Testing...' : 'Test Smart Router'}
                        </Button>
                    </div>
                </div>

                {/* Examples Section */}
                <div className="bg-white p-6 rounded-lg shadow">
                    <h2 className="text-lg font-semibold mb-4">Test Examples</h2>
                    <div className="grid grid-cols-2 gap-2">
                        {testExamples.map((example, index) => (
                            <button
                                key={index}
                                onClick={() => handleExampleClick(example)}
                                className="p-2 text-left bg-gray-100 hover:bg-gray-200 rounded border text-sm"
                            >
                                {example}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Results Section */}
                {result && (
                    <div className="bg-white p-6 rounded-lg shadow">
                        <h2 className="text-lg font-semibold mb-4">Test Results</h2>

                        {result.success ? (
                            <div className="space-y-4">
                                {/* Intent Recognition Results */}
                                {result.results.intentRecognition && (
                                    <div className="border-l-4 border-blue-500 pl-4">
                                        <h3 className="font-medium text-blue-700">Intent Recognition</h3>
                                        <div className="mt-2 text-sm">
                                            <div className="grid grid-cols-2 gap-2">
                                                <div>Needs MCP: <span className={result.results.intentRecognition.needsMCP ? 'text-green-600 font-bold' : 'text-red-600'}>{result.results.intentRecognition.needsMCP ? 'YES' : 'NO'}</span></div>
                                                <div>Confidence: <span className="font-mono">{(result.results.intentRecognition.confidence * 100).toFixed(1)}%</span></div>
                                                <div>Suggested Tool: <span className="font-mono">{result.results.intentRecognition.suggestedTool || 'None'}</span></div>
                                            </div>
                                            <div className="mt-2">
                                                <div className="text-gray-600">Reasoning: {result.results.intentRecognition.reasoning}</div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Tool Suggestions Results */}
                                {result.results.toolSuggestions && (
                                    <div className="border-l-4 border-green-500 pl-4">
                                        <h3 className="font-medium text-green-700">Tool Suggestions</h3>
                                        <div className="mt-2">
                                            {result.results.toolSuggestions.length > 0 ? (
                                                <div className="space-y-2">
                                                    {result.results.toolSuggestions.map((suggestion: any, index: number) => (
                                                        <div key={index} className="bg-gray-50 p-2 rounded text-sm">
                                                            <div className="font-mono font-bold">{suggestion.toolName}</div>
                                                            <div>Confidence: {(suggestion.confidence * 100).toFixed(1)}%</div>
                                                            <div>Keywords: {suggestion.keywords.join(', ')}</div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="text-gray-500">No tool suggestions found</div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Smart Router Results */}
                                {result.results.smartRouterResult && (
                                    <div className="border-l-4 border-purple-500 pl-4">
                                        <h3 className="font-medium text-purple-700">Smart Router Result</h3>
                                        <div className="mt-2 text-sm">
                                            <div className="grid grid-cols-2 gap-2">
                                                <div>Source: <span className="font-mono font-bold">{result.results.smartRouterResult.source}</span></div>
                                                <div>Confidence: <span className="font-mono">{result.results.smartRouterResult.confidence ? (result.results.smartRouterResult.confidence * 100).toFixed(1) + '%' : 'N/A'}</span></div>
                                            </div>
                                            <div className="mt-2">
                                                <div className="text-gray-600">Reasoning: {result.results.smartRouterResult.reasoning}</div>
                                            </div>
                                            <div className="mt-2">
                                                <div className="font-medium">Response:</div>
                                                <div className="bg-gray-50 p-2 rounded mt-1 font-mono text-xs max-h-32 overflow-y-auto">
                                                    {result.results.smartRouterResult.response}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Smart Router Error */}
                                {result.results.smartRouterError && (
                                    <div className="border-l-4 border-red-500 pl-4">
                                        <h3 className="font-medium text-red-700">Smart Router Error</h3>
                                        <div className="mt-2 text-sm text-red-600">
                                            {result.results.smartRouterError.message}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="text-red-600">
                                <div className="font-medium">Test Failed</div>
                                <div className="text-sm mt-1">{result.error}</div>
                            </div>
                        )}

                        {/* Raw JSON */}
                        <details className="mt-4">
                            <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-800">
                                Show Raw JSON
                            </summary>
                            <pre className="mt-2 bg-gray-100 p-3 rounded text-xs overflow-auto max-h-64">
                                {JSON.stringify(result, null, 2)}
                            </pre>
                        </details>
                    </div>
                )}
            </div>
        </div>
    )
}