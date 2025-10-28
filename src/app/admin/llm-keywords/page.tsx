'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/Button'

interface LLMKeywordStats {
  totalTools: number
  toolsWithLLMKeywords: number
  totalLLMKeywords: number

  lastGenerated: string | null
}

interface GenerationResult {
  toolName: string
  keywords: string[]
  count: number
  success: boolean
  error?: string
}

export default function LLMKeywordsPage() {
  const [stats, setStats] = useState<LLMKeywordStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [results, setResults] = useState<GenerationResult[]>([])
  const [selectedTool, setSelectedTool] = useState('')
  const [forceRegenerate, setForceRegenerate] = useState(false)

  // 加载统计信息
  const loadStats = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/generate-llm-keywords')
      const data = await response.json()
      if (data.success) {
        setStats(data.data)
      }
    } catch (error) {
      console.error('加载统计失败:', error)
    } finally {
      setLoading(false)
    }
  }

  // 生成关键词
  const generateKeywords = async () => {
    setGenerating(true)
    setResults([])
    
    try {
      const response = await fetch('/api/admin/generate-llm-keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolName: selectedTool || undefined,
          forceRegenerate
        })
      })
      
      const data = await response.json()
      
      if (data.success) {
        if (selectedTool) {
          // 单个工具的结果
          setResults([{
            toolName: data.data.toolName,
            keywords: data.data.keywords,
            count: data.data.count,
            success: true
          }])
        } else {
          // 所有工具的结果
          setResults(data.data.results)
        }
        
        // 重新加载统计
        await loadStats()
      }
    } catch (error) {
      console.error('生成关键词失败:', error)
    } finally {
      setGenerating(false)
    }
  }

  useEffect(() => {
    loadStats()
  }, [])

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">LLM关键词生成管理</h1>
      
      {/* 统计信息 */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">统计信息</h2>
        {loading ? (
          <div className="text-gray-500">加载中...</div>
        ) : stats ? (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{stats.totalTools}</div>
              <div className="text-sm text-gray-600">总工具数</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{stats.toolsWithLLMKeywords}</div>
              <div className="text-sm text-gray-600">有LLM关键词</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{stats.totalLLMKeywords}</div>
              <div className="text-sm text-gray-600">LLM关键词总数</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">0</div>
              <div className="text-sm text-gray-600">已弃用功能</div>
            </div>
            <div className="text-center">
              <div className="text-sm font-medium text-gray-800">
                {stats.lastGenerated 
                  ? new Date(stats.lastGenerated).toLocaleString('zh-CN')
                  : '从未生成'
                }
              </div>
              <div className="text-sm text-gray-600">最后生成时间</div>
            </div>
          </div>
        ) : (
          <div className="text-red-500">加载失败</div>
        )}
      </div>

      {/* 生成控制 */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">生成LLM关键词</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              工具名称（留空为所有工具）
            </label>
            <input
              type="text"
              value={selectedTool}
              onChange={(e) => setSelectedTool(e.target.value)}
              placeholder="例如: solve_24_point_game"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={generating}
            />
          </div>
          
          <div className="flex items-center">
            <input
              type="checkbox"
              id="forceRegenerate"
              checked={forceRegenerate}
              onChange={(e) => setForceRegenerate(e.target.checked)}
              className="mr-2"
              disabled={generating}
            />
            <label htmlFor="forceRegenerate" className="text-sm text-gray-700">
              强制重新生成（清除现有LLM关键词）
            </label>
          </div>
          
          <div className="flex space-x-4">
            <Button
              onClick={generateKeywords}
              disabled={generating}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {generating ? '生成中...' : '开始生成'}
            </Button>
            
            <Button
              onClick={loadStats}
              disabled={loading}
              variant="outline"
            >
              刷新统计
            </Button>
          </div>
        </div>
      </div>

      {/* 生成结果 */}
      {results.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">生成结果</h2>
          
          <div className="space-y-4">
            {results.map((result, index) => (
              <div
                key={index}
                className={`border rounded-lg p-4 ${
                  result.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-medium text-gray-900">{result.toolName}</h3>
                  <span className={`px-2 py-1 rounded text-sm ${
                    result.success 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {result.success ? `${result.count} 个关键词` : '失败'}
                  </span>
                </div>
                
                {result.success ? (
                  <div className="text-sm text-gray-600">
                    <strong>关键词:</strong> {result.keywords.slice(0, 10).join(', ')}
                    {result.keywords.length > 10 && ` ... (共${result.keywords.length}个)`}
                  </div>
                ) : (
                  <div className="text-sm text-red-600">
                    <strong>错误:</strong> {result.error}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}