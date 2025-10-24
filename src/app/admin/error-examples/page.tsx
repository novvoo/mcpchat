'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'

interface ToolExample {
  example: string
  description: string
  difficulty?: string
  category?: string
}

interface ErrorTestCase {
  name: string
  toolName: string
  errorMessage: string
  errorType: string
  userInput: string
}

export default function ErrorExamplesPage() {
  const [examples, setExamples] = useState<ToolExample[]>([])
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [formattedError, setFormattedError] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [selectedTool, setSelectedTool] = useState('solve_24_point_game')

  const testCases: ErrorTestCase[] = [
    {
      name: '24点游戏 - 缺少参数',
      toolName: 'solve_24_point_game',
      errorMessage: 'Missing required parameter: numbers',
      errorType: 'missing_parameters',
      userInput: '24点游戏'
    },
    {
      name: '24点游戏 - 参数格式错误',
      toolName: 'solve_24_point_game',
      errorMessage: 'Invalid arguments: numbers must be an array of 4 integers',
      errorType: 'invalid_arguments',
      userInput: '用8、8、4算24'
    },
    {
      name: 'N皇后问题 - 缺少参数',
      toolName: 'solve_n_queens',
      errorMessage: 'Missing required parameter: n',
      errorType: 'missing_parameters',
      userInput: '皇后问题'
    },
    {
      name: '数独求解 - 缺少参数',
      toolName: 'solve_sudoku',
      errorMessage: 'Missing required parameter: puzzle',
      errorType: 'missing_parameters',
      userInput: '解数独'
    }
  ]

  const loadExamples = async (toolName: string, errorType?: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ tool: toolName })
      if (errorType) params.append('errorType', errorType)
      
      const response = await fetch(`/api/tool-examples?${params}`)
      const result = await response.json()
      
      if (result.success) {
        setExamples(result.data.examples)
        setSuggestions(result.data.suggestions)
      } else {
        console.error('Failed to load examples:', result.error)
      }
    } catch (error) {
      console.error('Error loading examples:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatError = async (testCase: ErrorTestCase) => {
    setLoading(true)
    try {
      const response = await fetch('/api/tool-examples', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolName: testCase.toolName,
          errorMessage: testCase.errorMessage,
          errorType: testCase.errorType
        })
      })
      
      const result = await response.json()
      
      if (result.success) {
        setFormattedError(result.data.formattedError)
      } else {
        console.error('Failed to format error:', result.error)
      }
    } catch (error) {
      console.error('Error formatting error:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadExamples(selectedTool)
  }, [selectedTool])

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">错误处理与示例展示</h1>
        <p className="text-muted-foreground">
          演示工具调用失败时如何显示相关示例和建议
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 左侧：工具示例查看 */}
        <div className="space-y-4">
          <div className="bg-card p-4 rounded-lg border">
            <h2 className="text-lg font-semibold mb-4">工具示例查看</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">选择工具:</label>
                <select
                  value={selectedTool}
                  onChange={(e) => setSelectedTool(e.target.value)}
                  className="w-full p-2 border rounded-md bg-background"
                >
                  <option value="solve_24_point_game">24点游戏</option>
                  <option value="solve_n_queens">N皇后问题</option>
                  <option value="solve_sudoku">数独求解</option>
                  <option value="solve_chicken_rabbit_problem">鸡兔同笼</option>
                </select>
              </div>

              <Button 
                onClick={() => loadExamples(selectedTool)}
                disabled={loading}
                className="w-full"
              >
                {loading ? '加载中...' : '获取示例'}
              </Button>
            </div>

            {examples.length > 0 && (
              <div className="mt-4">
                <h3 className="font-medium mb-2">📚 使用示例 ({examples.length}个):</h3>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {examples.map((example, index) => (
                    <div key={index} className="p-2 bg-accent rounded text-sm">
                      <div className="font-medium">{example.description}</div>
                      {example.example !== example.description && (
                        <div className="text-muted-foreground mt-1">
                          格式: <code>{example.example}</code>
                        </div>
                      )}
                      {example.difficulty && (
                        <div className="text-xs text-muted-foreground mt-1">
                          难度: {example.difficulty}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {suggestions.length > 0 && (
              <div className="mt-4">
                <h3 className="font-medium mb-2">💡 使用建议 ({suggestions.length}个):</h3>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {suggestions.map((suggestion, index) => (
                    <div key={index} className="text-sm text-muted-foreground">
                      {index + 1}. {suggestion}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 右侧：错误格式化测试 */}
        <div className="space-y-4">
          <div className="bg-card p-4 rounded-lg border">
            <h2 className="text-lg font-semibold mb-4">错误格式化测试</h2>
            
            <div className="space-y-3">
              {testCases.map((testCase, index) => (
                <div key={index} className="border rounded p-3">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-sm">{testCase.name}</h3>
                    <Button
                      size="sm"
                      onClick={() => formatError(testCase)}
                      disabled={loading}
                    >
                      测试
                    </Button>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <div>用户输入: "{testCase.userInput}"</div>
                    <div>工具: {testCase.toolName}</div>
                    <div>错误: {testCase.errorMessage}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {formattedError && (
            <div className="bg-card p-4 rounded-lg border">
              <h3 className="font-medium mb-2">格式化结果:</h3>
              <div className="bg-accent p-3 rounded text-sm whitespace-pre-wrap font-mono">
                {formattedError}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 底部：功能说明 */}
      <div className="mt-8 bg-card p-4 rounded-lg border">
        <h2 className="text-lg font-semibold mb-3">功能说明</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <h3 className="font-medium mb-2">✨ 新增功能:</h3>
            <ul className="space-y-1 text-muted-foreground">
              <li>• 工具调用失败时自动显示相关示例</li>
              <li>• 基于错误类型提供针对性建议</li>
              <li>• 支持中英文示例和说明</li>
              <li>• 从数据库动态获取最新示例</li>
            </ul>
          </div>
          <div>
            <h3 className="font-medium mb-2">🎯 使用场景:</h3>
            <ul className="space-y-1 text-muted-foreground">
              <li>• 用户输入格式不正确时</li>
              <li>• 缺少必需参数时</li>
              <li>• 参数类型错误时</li>
              <li>• 首次使用工具时的引导</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}