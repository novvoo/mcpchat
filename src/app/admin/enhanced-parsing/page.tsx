'use client'

import { useState } from 'react'

interface TokenizedResult {
  tokens: string[]
  entities: Array<{
    text: string
    type: 'number' | 'keyword' | 'action' | 'constraint' | 'domain'
    confidence: number
  }>
  intent: {
    primary: string
    secondary?: string
    confidence: number
  }
  context: {
    domain: string
    complexity: 'simple' | 'medium' | 'complex'
    language: 'zh' | 'en' | 'mixed'
  }
}

interface StructuredQuestion {
  question_type: string
  question_subtype: string
  question_conditions: string[]
  question_sentences: string[]
  tokenized_result?: TokenizedResult
  semantic_analysis?: {
    sentiment: 'positive' | 'neutral' | 'negative'
    urgency: 'low' | 'medium' | 'high'
    clarity: number
  }
}

interface EnhancedParseResult {
  success: boolean
  structured_question?: StructuredQuestion
  routed_response?: string
  processing_time?: number
  confidence_score?: number
  error?: string
}

export default function EnhancedParsingPage() {
  const [question, setQuestion] = useState('')
  const [result, setResult] = useState<EnhancedParseResult | null>(null)
  const [loading, setLoading] = useState(false)

  const testQuestions = [
    "帮忙解答下23,3,11,16应该如何运算才能组成24",
    "请用Python写一个快速排序算法，要求时间复杂度O(nlogn)",
    "我的React组件报错了TypeError: Cannot read property 'map' of undefined，怎么调试？",
    "什么是GPT模型的工作原理？请详细解释Transformer架构",
    "用Pydantic创建一个用户模型，需要包含姓名、邮箱和年龄字段，并添加数据验证",
    "急！我的服务器崩溃了，数据库连接失败，怎么快速恢复？"
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!question.trim()) return

    setLoading(true)
    setResult(null)

    try {
      const response = await fetch('/api/enhanced-parse', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ question })
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

  const handleTestQuestion = (testQuestion: string) => {
    setQuestion(testQuestion)
  }

  const getEntityTypeColor = (type: string) => {
    const colors = {
      number: 'bg-blue-100 text-blue-800',
      keyword: 'bg-green-100 text-green-800',
      action: 'bg-purple-100 text-purple-800',
      constraint: 'bg-yellow-100 text-yellow-800',
      domain: 'bg-red-100 text-red-800'
    }
    return colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-800'
  }

  const getSentimentColor = (sentiment: string) => {
    const colors = {
      positive: 'text-green-600',
      neutral: 'text-gray-600',
      negative: 'text-red-600'
    }
    return colors[sentiment as keyof typeof colors] || 'text-gray-600'
  }

  const getUrgencyColor = (urgency: string) => {
    const colors = {
      low: 'text-green-600',
      medium: 'text-yellow-600',
      high: 'text-red-600'
    }
    return colors[urgency as keyof typeof colors] || 'text-gray-600'
  }

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">LangChain 增强版结构化解析</h1>
      
      <div className="mb-6">
        <p className="text-gray-600 mb-4">
          这个页面展示了集成 LangChain 的增强版结构化问题解析功能，提供更精确的分词识别、实体提取、意图分析和语义理解。
        </p>
        <div className="bg-blue-50 p-4 rounded-lg">
          <h3 className="font-semibold text-blue-800 mb-2">增强功能：</h3>
          <ul className="text-blue-700 text-sm space-y-1">
            <li>• 高级分词识别和实体提取</li>
            <li>• 意图分析和置信度评分</li>
            <li>• 语义情感分析（情感、紧急程度、清晰度）</li>
            <li>• 智能上下文理解（领域、复杂度、语言）</li>
            <li>• 基于 LangChain 的链式处理</li>
          </ul>
        </div>
      </div>

      {/* Test Questions */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-3">测试问题</h2>
        <div className="grid gap-2">
          {testQuestions.map((testQuestion, index) => (
            <button
              key={index}
              onClick={() => handleTestQuestion(testQuestion)}
              className="text-left p-3 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors text-sm"
            >
              {testQuestion}
            </button>
          ))}
        </div>
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="mb-6">
        <div className="mb-4">
          <label htmlFor="question" className="block text-sm font-medium text-gray-700 mb-2">
            输入问题
          </label>
          <textarea
            id="question"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            rows={3}
            placeholder="输入你的问题..."
          />
        </div>
        <button
          type="submit"
          disabled={loading || !question.trim()}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? '解析中...' : '增强解析'}
        </button>
      </form>

      {/* Results */}
      {result && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">增强解析结果</h2>
            {result.success && (
              <div className="flex gap-4 text-sm text-gray-600">
                {result.processing_time && (
                  <span>处理时间: {result.processing_time}ms</span>
                )}
                {result.confidence_score && (
                  <span>置信度: {(result.confidence_score * 100).toFixed(1)}%</span>
                )}
              </div>
            )}
          </div>
          
          {result.success ? (
            <div className="space-y-6">
              {/* Basic Structured Data */}
              <div>
                <h3 className="text-lg font-medium mb-3">基础结构化数据</h3>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="grid gap-3">
                    <div>
                      <span className="font-medium text-gray-700">问题类型:</span>
                      <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm">
                        {result.structured_question?.question_type}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">问题子类型:</span>
                      <span className="ml-2 px-2 py-1 bg-green-100 text-green-800 rounded text-sm">
                        {result.structured_question?.question_subtype}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">基础分词:</span>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {result.structured_question?.question_sentences.map((sentence, index) => (
                          <span key={index} className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-sm">
                            {sentence}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* LangChain Enhanced Analysis */}
              {result.structured_question?.tokenized_result && (
                <div>
                  <h3 className="text-lg font-medium mb-3">LangChain 增强分析</h3>
                  <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-4 rounded-lg">
                    {/* Tokens */}
                    <div className="mb-4">
                      <span className="font-medium text-gray-700">高级分词:</span>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {result.structured_question.tokenized_result.tokens.map((token, index) => (
                          <span key={index} className="px-2 py-1 bg-indigo-100 text-indigo-800 rounded text-sm">
                            {token}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Entities */}
                    <div className="mb-4">
                      <span className="font-medium text-gray-700">实体识别:</span>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {result.structured_question.tokenized_result.entities.map((entity, index) => (
                          <span 
                            key={index} 
                            className={`px-2 py-1 rounded text-sm ${getEntityTypeColor(entity.type)}`}
                            title={`置信度: ${(entity.confidence * 100).toFixed(1)}%`}
                          >
                            {entity.text} ({entity.type})
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Intent */}
                    <div className="mb-4">
                      <span className="font-medium text-gray-700">意图分析:</span>
                      <div className="mt-1">
                        <span className="px-3 py-1 bg-orange-100 text-orange-800 rounded text-sm">
                          {result.structured_question.tokenized_result.intent.primary}
                          {result.structured_question.tokenized_result.intent.secondary && 
                            ` / ${result.structured_question.tokenized_result.intent.secondary}`
                          }
                          <span className="ml-2 text-xs">
                            ({(result.structured_question.tokenized_result.intent.confidence * 100).toFixed(1)}%)
                          </span>
                        </span>
                      </div>
                    </div>

                    {/* Context */}
                    <div>
                      <span className="font-medium text-gray-700">上下文分析:</span>
                      <div className="mt-1 flex gap-2">
                        <span className="px-2 py-1 bg-teal-100 text-teal-800 rounded text-sm">
                          领域: {result.structured_question.tokenized_result.context.domain}
                        </span>
                        <span className="px-2 py-1 bg-cyan-100 text-cyan-800 rounded text-sm">
                          复杂度: {result.structured_question.tokenized_result.context.complexity}
                        </span>
                        <span className="px-2 py-1 bg-pink-100 text-pink-800 rounded text-sm">
                          语言: {result.structured_question.tokenized_result.context.language}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Semantic Analysis */}
              {result.structured_question?.semantic_analysis && (
                <div>
                  <h3 className="text-lg font-medium mb-3">语义情感分析</h3>
                  <div className="bg-gradient-to-r from-green-50 to-yellow-50 p-4 rounded-lg">
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <span className="font-medium text-gray-700">情感倾向:</span>
                        <div className={`mt-1 font-semibold ${getSentimentColor(result.structured_question.semantic_analysis.sentiment)}`}>
                          {result.structured_question.semantic_analysis.sentiment}
                        </div>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">紧急程度:</span>
                        <div className={`mt-1 font-semibold ${getUrgencyColor(result.structured_question.semantic_analysis.urgency)}`}>
                          {result.structured_question.semantic_analysis.urgency}
                        </div>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">表达清晰度:</span>
                        <div className="mt-1">
                          <div className="flex items-center">
                            <div className="w-20 bg-gray-200 rounded-full h-2 mr-2">
                              <div 
                                className="bg-blue-600 h-2 rounded-full" 
                                style={{ width: `${result.structured_question.semantic_analysis.clarity * 100}%` }}
                              ></div>
                            </div>
                            <span className="text-sm font-semibold">
                              {(result.structured_question.semantic_analysis.clarity * 100).toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Routed Response */}
              <div>
                <h3 className="text-lg font-medium mb-2">智能路由结果</h3>
                <div className="bg-green-50 p-4 rounded-lg">
                  <p className="text-green-800">{result.routed_response}</p>
                </div>
              </div>

              {/* JSON Output */}
              <div>
                <h3 className="text-lg font-medium mb-2">完整 JSON 输出</h3>
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-xs">
                  {JSON.stringify(result.structured_question, null, 2)}
                </pre>
              </div>
            </div>
          ) : (
            <div className="bg-red-50 p-4 rounded-lg">
              <p className="text-red-800">
                <span className="font-medium">错误:</span> {result.error}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}