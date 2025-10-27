'use client'

import { useState } from 'react'

interface ChatResponse {
  success: boolean
  data?: {
    response: string
    conversationId: string
  }
  source?: string
  confidence?: number
  reasoning?: string
  enhanced?: boolean
  error?: {
    message: string
  }
}

export default function RoutingDemoPage() {
  const [message, setMessage] = useState('如何从 8、8、4、13 从简单的加减乘除运算得到 24,每个数都用一次')
  const [useLangChain, setUseLangChain] = useState(true)
  const [responses, setResponses] = useState<{
    smartRouter?: ChatResponse
    directLLM?: ChatResponse
    enhancedChat?: ChatResponse
  }>({})
  const [loading, setLoading] = useState<{
    smartRouter: boolean
    directLLM: boolean
    enhancedChat: boolean
  }>({
    smartRouter: false,
    directLLM: false,
    enhancedChat: false
  })

  const testRoute = async (route: 'smartRouter' | 'directLLM' | 'enhancedChat') => {
    setLoading(prev => ({ ...prev, [route]: true }))
    
    try {
      let endpoint = ''
      let body: any = { message }
      
      switch (route) {
        case 'smartRouter':
          endpoint = '/api/chat'
          body.useLangChain = useLangChain
          break
        case 'directLLM':
          endpoint = '/api/direct-llm'
          break
        case 'enhancedChat':
          endpoint = '/api/enhanced-chat'
          body.useLangChain = true
          break
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body)
      })

      const result = await response.json()
      setResponses(prev => ({ ...prev, [route]: result }))
    } catch (error) {
      console.error(`Error testing ${route}:`, error)
      setResponses(prev => ({ 
        ...prev, 
        [route]: { 
          success: false, 
          error: { message: error instanceof Error ? error.message : 'Unknown error' } 
        } 
      }))
    } finally {
      setLoading(prev => ({ ...prev, [route]: false }))
    }
  }

  const testAllRoutes = async () => {
    await Promise.all([
      testRoute('smartRouter'),
      testRoute('directLLM'),
      testRoute('enhancedChat')
    ])
  }

  const renderResponse = (response: ChatResponse | undefined, title: string) => {
    if (!response) return null

    return (
      <div className="border rounded-lg p-4 mb-4">
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
        
        {response.success ? (
          <div>
            <div className="mb-2">
              <span className="inline-block bg-green-100 text-green-800 px-2 py-1 rounded text-sm">
                成功
              </span>
              {response.source && (
                <span className="inline-block bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm ml-2">
                  来源: {response.source}
                </span>
              )}
              {response.enhanced !== undefined && (
                <span className={`inline-block px-2 py-1 rounded text-sm ml-2 ${
                  response.enhanced 
                    ? 'bg-purple-100 text-purple-800' 
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {response.enhanced ? 'LangChain增强' : '传统处理'}
                </span>
              )}
              {response.confidence && (
                <span className="inline-block bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-sm ml-2">
                  置信度: {(response.confidence * 100).toFixed(1)}%
                </span>
              )}
            </div>
            
            {response.reasoning && (
              <div className="mb-2 text-sm text-gray-600">
                <strong>推理过程:</strong> {response.reasoning}
              </div>
            )}
            
            <div className="bg-gray-50 p-3 rounded">
              <strong>响应:</strong>
              <div className="mt-1 whitespace-pre-wrap">{response.data?.response}</div>
            </div>
          </div>
        ) : (
          <div>
            <span className="inline-block bg-red-100 text-red-800 px-2 py-1 rounded text-sm mb-2">
              失败
            </span>
            <div className="bg-red-50 p-3 rounded text-red-700">
              {response.error?.message || '未知错误'}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">路由演示 - Smart Router vs Direct LLM vs Enhanced Chat</h1>
      
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-4">测试消息</h2>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="w-full p-3 border rounded-lg h-24"
          placeholder="输入要测试的消息..."
        />
      </div>

      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-4">解析选项</h2>
        <div className="flex items-center space-x-4">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={useLangChain}
              onChange={(e) => setUseLangChain(e.target.checked)}
              className="mr-2"
            />
            <span>Smart Router 使用 LangChain 增强解析</span>
          </label>
          <span className="text-sm text-gray-600">
            {useLangChain ? '(推荐，更精确的意图识别)' : '(传统解析，兼容模式)'}
          </span>
        </div>
      </div>

      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-4">路由选项</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <button
            onClick={() => testRoute('smartRouter')}
            disabled={loading.smartRouter}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
          >
            {loading.smartRouter ? '测试中...' : '测试 Smart Router'}
          </button>
          
          <button
            onClick={() => testRoute('directLLM')}
            disabled={loading.directLLM}
            className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:opacity-50"
          >
            {loading.directLLM ? '测试中...' : '测试 Direct LLM'}
          </button>
          
          <button
            onClick={() => testRoute('enhancedChat')}
            disabled={loading.enhancedChat}
            className="bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600 disabled:opacity-50"
          >
            {loading.enhancedChat ? '测试中...' : '测试 Enhanced Chat'}
          </button>
          
          <button
            onClick={testAllRoutes}
            disabled={Object.values(loading).some(l => l)}
            className="bg-gray-700 text-white px-4 py-2 rounded hover:bg-gray-800 disabled:opacity-50"
          >
            {Object.values(loading).some(l => l) ? '测试中...' : '测试所有路由'}
          </button>
        </div>
      </div>

      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-4">路由说明</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="font-semibold text-blue-800 mb-2">Smart Router (LangChain增强)</h3>
            <p className="text-blue-700">
              默认使用LangChain增强解析进行意图识别，提供更精确的工具匹配和参数提取。
            </p>
          </div>
          
          <div className="bg-green-50 p-4 rounded-lg">
            <h3 className="font-semibold text-green-800 mb-2">Direct LLM</h3>
            <p className="text-green-700">
              完全跳过Smart Router，直接调用LLM服务，不使用任何工具。
            </p>
          </div>
          
          <div className="bg-purple-50 p-4 rounded-lg">
            <h3 className="font-semibold text-purple-800 mb-2">Enhanced Chat</h3>
            <p className="text-purple-700">
              使用LangChain增强的Smart Router，提供更精确的意图识别和上下文分析。
            </p>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-4">测试结果</h2>
        {renderResponse(responses.smartRouter, 'Smart Router (LangChain增强)')}
        {renderResponse(responses.directLLM, 'Direct LLM')}
        {renderResponse(responses.enhancedChat, 'Enhanced Chat (LangChain增强)')}
      </div>
    </div>
  )
}