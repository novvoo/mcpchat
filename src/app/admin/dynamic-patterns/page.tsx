'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import AdminNavigation from '@/components/AdminNavigation'

interface ToolPattern {
  pattern: string
  keywords: string[]
  confidence: number
  usage_count: number
  examples: string[]
}

interface LearningStats {
  totalPatterns: number
  totalKeywords: number
  avgConfidence: number
  totalUsage: number
  recentLearning: Array<{
    toolName: string
    keywordCount: number
    method: string
    confidence: number
    timestamp: string
  }>
}

interface LearningResult {
  newKeywords: string[]
  updatedPatterns: string[]
  confidence: number
}

export default function DynamicPatternsPage() {
  const [patterns, setPatterns] = useState<ToolPattern[]>([])
  const [stats, setStats] = useState<LearningStats | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [lastLearningResult, setLastLearningResult] = useState<LearningResult | null>(null)

  useEffect(() => {
    loadPatterns()
    loadStats()
  }, [])

  const loadPatterns = async () => {
    try {
      const response = await fetch('/api/admin/dynamic-patterns?action=patterns')
      const data = await response.json()
      if (data.success) {
        setPatterns(data.data.patterns)
      }
    } catch (error) {
      console.error('加载模式失败:', error)
    }
  }

  const loadStats = async () => {
    try {
      const response = await fetch('/api/admin/dynamic-patterns?action=stats')
      const data = await response.json()
      if (data.success) {
        setStats(data.data)
      }
    } catch (error) {
      console.error('加载统计失败:', error)
    }
  }

  const initializePatternLearner = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/admin/dynamic-patterns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'initialize' })
      })
      const data = await response.json()
      if (data.success) {
        await loadPatterns()
        await loadStats()
      }
    } catch (error) {
      console.error('初始化失败:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const learnFromTools = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/admin/dynamic-patterns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'learn_from_tools' })
      })
      const data = await response.json()
      if (data.success) {
        setLastLearningResult(data.data)
        await loadPatterns()
        await loadStats()
      }
    } catch (error) {
      console.error('学习失败:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const refreshMetadata = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/admin/dynamic-patterns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'refresh_metadata' })
      })
      const data = await response.json()
      if (data.success) {
        await loadPatterns()
        await loadStats()
      }
    } catch (error) {
      console.error('刷新元数据失败:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <AdminNavigation title="动态模式学习管理" />
      
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">动态模式学习管理</h1>
        <p className="text-muted-foreground">
          基于PostgreSQL/pgvector的智能关键词生成和模式学习系统
        </p>
      </div>

      {/* 操作按钮 */}
      <div className="mb-6 flex flex-wrap gap-3">
        <Button 
          onClick={initializePatternLearner}
          disabled={isLoading}
          variant="outline"
        >
          {isLoading ? '初始化中...' : '初始化学习器'}
        </Button>
        
        <Button 
          onClick={learnFromTools}
          disabled={isLoading}
        >
          {isLoading ? '学习中...' : '从现有工具学习'}
        </Button>
        
        <Button 
          onClick={refreshMetadata}
          disabled={isLoading}
          variant="outline"
        >
          {isLoading ? '刷新中...' : '刷新工具元数据'}
        </Button>
      </div>

      {/* 学习结果 */}
      {lastLearningResult && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <h3 className="font-semibold text-green-800 mb-2">最新学习结果</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="font-medium">新关键词:</span> {lastLearningResult.newKeywords.length} 个
            </div>
            <div>
              <span className="font-medium">更新模式:</span> {lastLearningResult.updatedPatterns.length} 个
            </div>
            <div>
              <span className="font-medium">平均置信度:</span> {(lastLearningResult.confidence * 100).toFixed(1)}%
            </div>
          </div>
          {lastLearningResult.newKeywords.length > 0 && (
            <div className="mt-2">
              <span className="font-medium text-green-800">新关键词示例:</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {lastLearningResult.newKeywords.slice(0, 10).map((keyword, index) => (
                  <span key={index} className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">
                    {keyword}
                  </span>
                ))}
                {lastLearningResult.newKeywords.length > 10 && (
                  <span className="text-green-600 text-xs">
                    +{lastLearningResult.newKeywords.length - 10} 更多...
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 统计信息 */}
      {stats && (
        <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-card p-4 rounded-lg border">
            <div className="text-2xl font-bold text-blue-600">{stats.totalPatterns}</div>
            <div className="text-sm text-muted-foreground">学习模式</div>
          </div>
          <div className="bg-card p-4 rounded-lg border">
            <div className="text-2xl font-bold text-green-600">{stats.totalKeywords}</div>
            <div className="text-sm text-muted-foreground">关键词总数</div>
          </div>
          <div className="bg-card p-4 rounded-lg border">
            <div className="text-2xl font-bold text-purple-600">{(stats.avgConfidence * 100).toFixed(1)}%</div>
            <div className="text-sm text-muted-foreground">平均置信度</div>
          </div>
          <div className="bg-card p-4 rounded-lg border">
            <div className="text-2xl font-bold text-orange-600">{stats.totalUsage}</div>
            <div className="text-sm text-muted-foreground">总使用次数</div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 学习模式列表 */}
        <div className="bg-card p-6 rounded-lg border">
          <h2 className="text-lg font-semibold mb-4">学习到的模式</h2>
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {patterns.map((pattern, index) => (
              <div key={index} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <code className="bg-muted px-2 py-1 rounded text-sm font-mono">
                    {pattern.pattern}
                  </code>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>置信度: {(pattern.confidence * 100).toFixed(1)}%</span>
                    <span>使用: {pattern.usage_count}次</span>
                  </div>
                </div>
                
                <div className="mb-2">
                  <span className="text-sm font-medium">关键词:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {pattern.keywords.slice(0, 8).map((keyword, kidx) => (
                      <span key={kidx} className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                        {keyword}
                      </span>
                    ))}
                    {pattern.keywords.length > 8 && (
                      <span className="text-blue-600 text-xs">
                        +{pattern.keywords.length - 8} 更多...
                      </span>
                    )}
                  </div>
                </div>

                {pattern.examples.length > 0 && (
                  <div>
                    <span className="text-sm font-medium">示例工具:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {pattern.examples.slice(0, 3).map((example, eidx) => (
                        <code key={eidx} className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                          {example}
                        </code>
                      ))}
                      {pattern.examples.length > 3 && (
                        <span className="text-gray-600 text-xs">
                          +{pattern.examples.length - 3} 更多...
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
            
            {patterns.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                暂无学习到的模式，点击"从现有工具学习"开始学习
              </div>
            )}
          </div>
        </div>

        {/* 最近学习活动 */}
        <div className="bg-card p-6 rounded-lg border">
          <h2 className="text-lg font-semibold mb-4">最近学习活动</h2>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {stats?.recentLearning.map((activity, index) => (
              <div key={index} className="border-l-4 border-blue-500 pl-4 py-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{activity.toolName}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(activity.timestamp).toLocaleString()}
                  </span>
                </div>
                <div className="text-sm text-muted-foreground">
                  生成 {activity.keywordCount} 个关键词 | 
                  方法: {activity.method} | 
                  置信度: {(activity.confidence * 100).toFixed(1)}%
                </div>
              </div>
            ))}
            
            {(!stats?.recentLearning || stats.recentLearning.length === 0) && (
              <div className="text-center py-8 text-muted-foreground">
                暂无学习活动记录
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 说明文档 */}
      <div className="mt-8 bg-muted p-6 rounded-lg">
        <h3 className="font-semibold mb-3">动态模式学习说明</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <h4 className="font-medium mb-2">🎯 核心功能</h4>
            <ul className="space-y-1 text-muted-foreground">
              <li>• 自动分析工具名称结构</li>
              <li>• 基于模式生成关键词</li>
              <li>• 从用户反馈中学习</li>
              <li>• 语义相似性匹配</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium mb-2">🔧 技术特性</h4>
            <ul className="space-y-1 text-muted-foreground">
              <li>• PostgreSQL存储模式数据</li>
              <li>• pgvector支持语义搜索</li>
              <li>• 动态置信度调整</li>
              <li>• 实时模式更新</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}