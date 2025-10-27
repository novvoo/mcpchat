'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/Button'

interface FormatTestResult {
    original: any
    formatted: string
    toolName: string
    params: Record<string, any>
}

export default function TestFormattingPage() {
    const [results, setResults] = useState<FormatTestResult[]>([])
    const [isLoading, setIsLoading] = useState(false)

    const testCases = [
        {
            name: '线性规划示例',
            message: 'run example lp',
            toolName: 'run_example',
            params: { example_name: 'lp' },
            mockResult: {
                rc: 0,
                output: "Advanced Linear Programming Examples with Gurddy\n============================================================\n=== Portfolio Optimization Problem ===\nAssets: ['Stock_A', 'Stock_B', 'Stock_C']\nExpected returns: {'Stock_A': 0.12, 'Stock_B': 0.1, 'Stock_C': 0.15}\n\nOptimal Portfolio Allocation:\n  Stock_A :   0.0% (return:  0.0%, risk:  0.0%)\n  Stock_B :   0.0% (return:  0.0%, risk:  0.0%)\n  Stock_C :   0.0% (return:  0.0%, risk:  0.0%)\n\nPortfolio Summary:\n  Expected Return:  4.4%\n  Risk Level:  2.0%\n  Solve Time: 0.0288s"
            }
        },
        {
            name: '包安装',
            message: 'install gurddy',
            toolName: 'install',
            params: { package: 'gurddy' },
            mockResult: {
                rc: 0,
                output: "Requirement already satisfied: gurddy in /usr/local/lib/python3.12/site-packages (0.1.8)\nRequirement already satisfied: scipy>=1.9.0\n\nWARNING: Running pip as the 'root' user can result in broken permissions"
            }
        },
        {
            name: 'N皇后问题',
            message: 'solve 8 queens problem',
            toolName: 'solve_n_queens',
            params: { n: 8 },
            mockResult: {
                rc: 0,
                output: "Solution found:\nBoard:\n. Q . . . . . .\nQ . . . . . . .\n. . . . Q . . .\n. . . . . . . Q\n. . . . . Q . .\n. . Q . . . . .\n. . . . . . Q .\n. . . Q . . . ."
            }
        }
    ]

    const testFormatting = async () => {
        setIsLoading(true)
        setResults([])

        try {
            const response = await fetch('/api/test-formatting', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ testCases })
            })

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`)
            }

            const data = await response.json()
            if (data.success) {
                setResults(data.results)
            } else {
                console.error('测试失败:', data.error)
            }
        } catch (error) {
            console.error('测试格式化失败:', error)
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="container mx-auto p-6 max-w-6xl">
            <div className="mb-6">
                <h1 className="text-2xl font-bold mb-2">MCP响应格式化测试</h1>
                <p className="text-muted-foreground">
                    测试MCP工具返回结果的格式化效果，对比原始响应和格式化后的显示
                </p>
            </div>

            <div className="mb-6">
                <Button
                    onClick={testFormatting}
                    disabled={isLoading}
                    className="w-full sm:w-auto"
                >
                    {isLoading ? '测试中...' : '开始格式化测试'}
                </Button>
            </div>

            {results.length > 0 && (
                <div className="space-y-8">
                    {results.map((result, index) => (
                        <div key={index} className="border rounded-lg p-6 bg-card">
                            <h3 className="text-lg font-semibold mb-4">
                                {testCases[index]?.name} ({result.toolName})
                            </h3>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* 原始响应 */}
                                <div>
                                    <h4 className="font-medium mb-2 text-sm text-muted-foreground">
                                        原始响应 (JSON)
                                    </h4>
                                    <pre className="bg-muted p-4 rounded text-xs overflow-auto max-h-64 border">
                                        {JSON.stringify(result.original, null, 2)}
                                    </pre>
                                </div>

                                {/* 格式化后 */}
                                <div>
                                    <h4 className="font-medium mb-2 text-sm text-muted-foreground">
                                        格式化后显示
                                    </h4>
                                    <div className="bg-background p-4 rounded border max-h-64 overflow-auto">
                                        <div
                                            className="prose prose-sm max-w-none"
                                            dangerouslySetInnerHTML={{
                                                __html: result.formatted
                                                    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                                                    .replace(/\n/g, '<br>')
                                                    .replace(/^(#{1,6})\s+(.+)$/gm, (match, hashes, text) => {
                                                        const level = hashes.length
                                                        return `<h${level} class="font-semibold mt-4 mb-2">${text}</h${level}>`
                                                    })
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="mt-4 pt-4 border-t">
                                <div className="text-sm text-muted-foreground">
                                    <strong>工具:</strong> {result.toolName} |
                                    <strong> 参数:</strong> {JSON.stringify(result.params)}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {results.length === 0 && !isLoading && (
                <div className="text-center py-12 text-muted-foreground">
                    点击上方按钮开始测试MCP响应格式化效果
                </div>
            )}
        </div>
    )
}