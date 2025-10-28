'use client'

// Sample Problems Management Page

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/Button'

interface SampleProblem {
  id: string
  category: string
  title: string
  title_en?: string
  description: string
  description_en?: string
  problem_type: string
  difficulty: 'easy' | 'medium' | 'hard'
  parameters: Record<string, any>
  expected_solution?: Record<string, any>
  keywords: string[]
  tool_name: string
  created_at: string
}

interface ProblemStats {
  categories: Array<{ category: string; count: string }>
  types: Array<{ problem_type: string; count: string }>
  difficulties: Array<{ difficulty: string; count: string }>
  tools: Array<{ tool_name: string; count: string }>
  total: number
}

export default function SampleProblemsPage() {
  const [problems, setProblems] = useState<SampleProblem[]>([])
  const [stats, setStats] = useState<ProblemStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('all')
  const [searchKeywords, setSearchKeywords] = useState<string>('')

  useEffect(() => {
    loadProblems()
    loadStats()
  }, [])

  const loadProblems = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/sample-problems?action=list')
      const result = await response.json()
      
      if (result.success) {
        setProblems(result.data)
      } else {
        setError(result.error || 'Failed to load problems')
      }
    } catch (err) {
      setError('Network error while loading problems')
    } finally {
      setLoading(false)
    }
  }

  const loadStats = async () => {
    try {
      const response = await fetch('/api/sample-problems?action=stats')
      const result = await response.json()
      
      if (result.success) {
        setStats(result.data)
      }
    } catch (err) {
      console.error('Failed to load stats:', err)
    }
  }

  const searchProblems = async () => {
    if (!searchKeywords.trim()) {
      loadProblems()
      return
    }

    try {
      setLoading(true)
      const keywords = searchKeywords.split(',').map(k => k.trim()).filter(k => k)
      
      const response = await fetch('/api/sample-problems', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          keywords
        })
      })
      
      const result = await response.json()
      
      if (result.success) {
        setProblems(result.data)
      } else {
        setError(result.error || 'Search failed')
      }
    } catch (err) {
      setError('Network error during search')
    } finally {
      setLoading(false)
    }
  }

  const filteredProblems = problems.filter(problem => {
    const categoryMatch = selectedCategory === 'all' || problem.category === selectedCategory
    const difficultyMatch = selectedDifficulty === 'all' || problem.difficulty === selectedDifficulty
    return categoryMatch && difficultyMatch
  })

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'text-green-600 bg-green-100'
      case 'medium': return 'text-yellow-600 bg-yellow-100'
      case 'hard': return 'text-red-600 bg-red-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  if (loading && problems.length === 0) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h2 className="text-lg font-semibold text-red-800 mb-2">Error</h2>
          <p className="text-red-600">{error}</p>
          <Button onClick={loadProblems} className="mt-4">
            Retry
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">样例问题管理</h1>
        <p className="text-gray-600">管理系统中的样例问题数据</p>
      </div>

      {/* 统计信息 */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white p-4 rounded-lg border">
            <h3 className="text-sm font-medium text-gray-500">总问题数</h3>
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          </div>
          <div className="bg-white p-4 rounded-lg border">
            <h3 className="text-sm font-medium text-gray-500">问题类型</h3>
            <p className="text-2xl font-bold text-gray-900">{stats.types.length}</p>
          </div>
          <div className="bg-white p-4 rounded-lg border">
            <h3 className="text-sm font-medium text-gray-500">分类数</h3>
            <p className="text-2xl font-bold text-gray-900">{stats.categories.length}</p>
          </div>
          <div className="bg-white p-4 rounded-lg border">
            <h3 className="text-sm font-medium text-gray-500">工具数</h3>
            <p className="text-2xl font-bold text-gray-900">{stats.tools.length}</p>
          </div>
        </div>
      )}

      {/* 搜索和过滤 */}
      <div className="bg-white p-6 rounded-lg border mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              关键词搜索
            </label>
            <input
              type="text"
              value={searchKeywords}
              onChange={(e) => setSearchKeywords(e.target.value)}
              placeholder="输入关键词，用逗号分隔"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              分类
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">所有分类</option>
              {stats?.categories.map(cat => (
                <option key={cat.category} value={cat.category}>
                  {cat.category} ({cat.count})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              难度
            </label>
            <select
              value={selectedDifficulty}
              onChange={(e) => setSelectedDifficulty(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">所有难度</option>
              {stats?.difficulties.map(diff => (
                <option key={diff.difficulty} value={diff.difficulty}>
                  {diff.difficulty} ({diff.count})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <Button onClick={searchProblems} className="w-full">
              搜索
            </Button>
          </div>
        </div>
      </div>

      {/* 问题列表 */}
      <div className="space-y-4">
        {filteredProblems.map((problem) => (
          <div key={problem.id} className="bg-white p-6 rounded-lg border hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {problem.title}
                  </h3>
                  {problem.title_en && (
                    <span className="text-sm text-gray-500">
                      ({problem.title_en})
                    </span>
                  )}
                </div>
                <p className="text-gray-600 mb-3">{problem.description}</p>
              </div>
              
              <div className="flex items-center gap-2 ml-4">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getDifficultyColor(problem.difficulty)}`}>
                  {problem.difficulty}
                </span>
                <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                  {problem.category}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-gray-700">工具:</span>
                <span className="ml-2 text-gray-600">{problem.tool_name}</span>
              </div>
              <div>
                <span className="font-medium text-gray-700">类型:</span>
                <span className="ml-2 text-gray-600">{problem.problem_type}</span>
              </div>
            </div>

            <div className="mt-4">
              <span className="font-medium text-gray-700 text-sm">关键词:</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {problem.keywords.map((keyword, index) => (
                  <span
                    key={index}
                    className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs"
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            </div>

            {problem.parameters && Object.keys(problem.parameters).length > 0 && (
              <div className="mt-4">
                <span className="font-medium text-gray-700 text-sm">参数:</span>
                <pre className="mt-1 text-xs bg-gray-50 p-2 rounded overflow-x-auto">
                  {JSON.stringify(problem.parameters, null, 2)}
                </pre>
              </div>
            )}
          </div>
        ))}
      </div>

      {filteredProblems.length === 0 && !loading && (
        <div className="text-center py-12">
          <p className="text-gray-500">没有找到匹配的问题</p>
        </div>
      )}
    </div>
  )
}