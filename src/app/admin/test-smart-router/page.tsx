'use client'

import { useState } from 'react'

interface TestResult {
  success: boolean
  source?: string
  confidence?: number
  reasoning?: string
  response?: string
  toolResults?: any[]
  error?: string
}

export default function TestSmartRouterPage() {
  const [message, setMessage] = useState('如何从 8、8、4、13 从简单的加减乘除运算得到 24,每个数都用一次')
  const [useLangChain, setUseLangChain] = useState(true)
  const [result, setResult] = useState<TestResult | null>(null)
  const [loading, setLoading] = useState(false)

  const testSmartRouter = async () => {
    setLoading(true)
    setResult(null)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          useLangChain
        })
      })

      const data = await response.json()
      
      if (data.success) {
        setResult({
          success: true,
          source: data.source,
          confidence: data.confidence,
          reasoning: data.reasoning,
          response: data.data?.response,
          toolResults: data.toolResults
        })
      } else {
        setResult({
          success: false,
          error: data.error?.message || '未知错误'
        })
      }
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : '网络错误'
      })
    } finally {
      setLoading(false)
    }
  }

  const testCases = [
    '如何从 8、8、4、13 从简单的加减乘除运算得到 24,每个数都用一次',
    '用1,2,3,4这四个数字通过加减乘除得到24',
    '解决8皇后问题',
    '帮我解一个数独',
    '运行一个基础示例',
    '显示系统信息',
    '什么是机器学习？',
    '如何优化投资组合？'
  ]

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Smart Router 测试 (LangChain增强)</h1>
      
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-4">测试配置</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">测试消息</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full p-3 border rounded-lg h-24"
              placeholder="输入要测试的消息..."
            />
          </div>
          
          <div className="flex items-center space-x-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={useLangChain}
                onChange={(e) => setUseLangChain(e.target.checked)}
                className="mr-2"
              />
              <span>使用 LangChain 增强解析</span>
            </label>
            <span className="text-sm text-gray-600">
              {useLangChain ? '(推荐，更精确)' : '(传统模式)'}
            </span>
          </div>
        </div>
      </div>

      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-4">快速测试用例</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {testCases.map((testCase, index) => (
            <button
              key={index}
              onClick={() => setMessage(testCase)}
              className="text-left p-2 text-sm bg-gray-100 hover:bg-gray-200 rounded border"
            >
              {testCase}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-6">
        <button
          onClick={testSmartRouter}
          disabled={loading || !message.trim()}
          className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? '测试中...' : '测试 Smart Router'}
        </button>
      </div>

      {result && (
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-4">测试结果</h2>
          <div className="border rounded-lg p-4">
            <div className="mb-4">
              <span className={`inline-block px-3 py-1 rounded text-sm font-medium ${
                result.success 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-red-100 text-red-800'
              }`}>
                {result.success ? '成功' : '失败'}
              </span>
              
              {result.source && (
                <span className="inline-block bg-blue-100 text-blue-800 px-3 py-1 rounded text-sm ml-2">
                  来源: {result.source}
                </span>
              )}
              
              {result.confidence !== undefined && (
                <span className="inline-block bg-yellow-100 text-yellow-800 px-3 py-1 rounded text-sm ml-2">
                  置信度: {(result.confidence * 100).toFixed(1)}%
                </span>
              )}
            </div>

            {result.reasoning && (
              <div className="mb-4">
                <h3 className="font-semibold mb-2">推理过程:</h3>
                <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded">
                  {result.reasoning}
                </p>
              </div>
            )}

            {result.toolResults && result.toolResults.length > 0 && (
              <div className="mb-4">
                <h3 className="font-semibold mb-2">工具执行结果:</h3>
                <pre className="text-sm bg-gray-50 p-3 rounded overflow-x-auto">
                  {JSON.stringify(result.toolResults, null, 2)}
                </pre>
              </div>
            )}

            {result.response && (
              <div className="mb-4">
                <h3 className="font-semibold mb-2">最终响应:</h3>
                <div className="bg-gray-50 p-3 rounded whitespace-pre-wrap">
                  {result.response}
                </div>
              </div>
            )}

            {result.error && (
              <div className="mb-4">
                <h3 className="font-semibold mb-2 text-red-600">错误信息:</h3>
                <p className="text-red-700 bg-red-50 p-3 rounded">
                  {result.error}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="bg-blue-50 p-4 rounded-lg">
        <h3 className="font-semibold text-blue-800 mb-2">说明</h3>
        <ul className="text-blue-700 text-sm space-y-1">
          <li>• Smart Router 现在默认使用 LangChain 增强解析</li>
          <li>• 支持24点游戏、N皇后、数独等数学问题的自动识别</li>
          <li>• 提供详细的推理过程和置信度评分</li>
          <li>• 可以选择关闭 LangChain 使用传统解析模式</li>
        </ul>
      </div>
    </div>
  )
}