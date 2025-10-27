'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface ProblemTemplate {
  id: number
  template_name: string
  tool_name: string
  category: string
  difficulty: string
  title_template: string
  description_template: string
  parameter_generators: any
  keywords_template: string[]
  generation_rules: any
  is_active: boolean
  priority: number
}

interface SampleProblem {
  id: string
  category: string
  title: string
  description: string
  problem_type: string
  difficulty: string
  parameters: Record<string, any>
  keywords: string[]
  tool_name: string
  generation_source: string
}

function ProblemTemplatesPage() {
  const [templates, setTemplates] = useState<ProblemTemplate[]>([])
  const [generatedProblems, setGeneratedProblems] = useState<SampleProblem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 获取问题模板
  const fetchTemplates = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch('/api/problem-templates')
      if (!response.ok) throw new Error('获取模板失败')
      const data = await response.json()
      setTemplates(data.templates || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误')
    } finally {
      setLoading(false)
    }
  }

  // 生成样例问题
  const generateProblems = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch('/api/sample-problems/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: 10 })
      })
      if (!response.ok) throw new Error('生成问题失败')
      const data = await response.json()
      setGeneratedProblems(data.problems || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTemplates()
  }, [])

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 导航栏 */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">问题模板管理</h1>
            <div className="flex gap-4">
              <Link href="/admin" className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700">
                返回管理面板
              </Link>
              <Link href="/" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                返回首页
              </Link>
            </div>
          </div>
        </div>
      </div>
      
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <p className="text-gray-600">
            问题模板用于自动生成样例问题，帮助用户了解工具的使用方法
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* 模板列表 */}
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-6 border-b">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold text-gray-900">问题模板</h2>
                <button
                  onClick={fetchTemplates}
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  刷新
                </button>
              </div>
            </div>
            
            <div className="p-6">
              {loading && templates.length === 0 ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-2 text-gray-600">加载中...</p>
                </div>
              ) : templates.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">暂无问题模板</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {templates.map((template) => (
                    <div key={template.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-medium text-gray-900">
                          {template.template_name}
                        </h3>
                        <div className="flex gap-2">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            template.is_active 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {template.is_active ? '活跃' : '禁用'}
                          </span>
                          <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                            {template.difficulty}
                          </span>
                        </div>
                      </div>
                      
                      <div className="text-sm text-gray-700 mb-2">
                        <p><strong className="text-gray-900">工具:</strong> {template.tool_name}</p>
                        <p><strong className="text-gray-900">类别:</strong> {template.category}</p>
                        <p><strong className="text-gray-900">标题模板:</strong> {template.title_template}</p>
                        <p><strong className="text-gray-900">描述模板:</strong> {template.description_template}</p>
                      </div>
                      
                      {template.keywords_template && template.keywords_template.length > 0 && (
                        <div className="mb-2">
                          <div className="flex flex-wrap gap-1">
                            {template.keywords_template.map((keyword, idx) => (
                              <span key={idx} className="px-2 py-1 text-xs bg-blue-50 text-blue-800 rounded border border-blue-200">
                                {keyword}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 生成的问题 */}
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-6 border-b">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold text-gray-900">生成的样例问题</h2>
                <button
                  onClick={generateProblems}
                  disabled={loading}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  生成问题
                </button>
              </div>
            </div>
            
            <div className="p-6">
              {generatedProblems.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">点击"生成问题"按钮来测试模板功能</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {generatedProblems.map((problem) => (
                    <div key={problem.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-medium text-gray-900">
                          {problem.title}
                        </h3>
                        <div className="flex gap-2">
                          <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                            {problem.difficulty}
                          </span>
                          <span className="px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded-full">
                            {problem.generation_source}
                          </span>
                        </div>
                      </div>
                      
                      <p className="text-sm text-gray-700 mb-2">{problem.description}</p>
                      
                      <div className="text-sm text-gray-700 mb-2">
                        <p><strong className="text-gray-900">工具:</strong> {problem.tool_name}</p>
                        <p><strong className="text-gray-900">类别:</strong> {problem.category}</p>
                        {Object.keys(problem.parameters).length > 0 && (
                          <p><strong className="text-gray-900">参数:</strong> {JSON.stringify(problem.parameters)}</p>
                        )}
                      </div>
                      
                      {problem.keywords && problem.keywords.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {problem.keywords.map((keyword, idx) => (
                            <span key={idx} className="px-2 py-1 text-xs bg-green-50 text-green-800 rounded border border-green-200">
                              {keyword}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 功能说明 */}
        <div className="mt-8 bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">问题模板功能说明</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-medium text-gray-900 mb-2">主要用途</h3>
              <ul className="text-sm text-gray-700 space-y-1">
                <li>• 自动生成样例问题，展示工具使用方法</li>
                <li>• 为用户提供学习和练习的案例</li>
                <li>• 标准化问题格式和描述</li>
                <li>• 支持参数化生成，提高灵活性</li>
              </ul>
            </div>
            <div>
              <h3 className="font-medium text-gray-900 mb-2">模板组成</h3>
              <ul className="text-sm text-gray-700 space-y-1">
                <li>• <strong className="text-gray-900">标题模板:</strong> 支持变量替换的标题格式</li>
                <li>• <strong className="text-gray-900">描述模板:</strong> 详细的问题描述</li>
                <li>• <strong className="text-gray-900">参数生成器:</strong> 自动生成测试参数</li>
                <li>• <strong className="text-gray-900">关键词:</strong> 用于搜索和分类</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProblemTemplatesPage