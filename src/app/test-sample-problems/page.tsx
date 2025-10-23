'use client'

// Test Sample Problems Page

import React, { useState, useEffect } from 'react'
import { ChatEmptyState } from '@/components/EmptyState'

export default function TestSampleProblemsPage() {
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [selectedSuggestion, setSelectedSuggestion] = useState<string>('')

  const handleSuggestionClick = (suggestion: string) => {
    setSelectedSuggestion(suggestion)
    console.log('Selected suggestion:', suggestion)
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        <h1 className="text-2xl font-bold mb-6">测试样例问题组件</h1>
        
        {selectedSuggestion && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="font-semibold text-blue-800">选中的建议:</h3>
            <p className="text-blue-600">{selectedSuggestion}</p>
          </div>
        )}
        
        <div className="h-96 border border-gray-200 rounded-lg">
          <ChatEmptyState onSuggestionClick={handleSuggestionClick} />
        </div>
        
        <div className="mt-6">
          <h3 className="text-lg font-semibold mb-4">API测试</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={async () => {
                try {
                  const response = await fetch('/api/sample-problems?action=recommended&limit=5')
                  const result = await response.json()
                  console.log('Recommended problems:', result)
                  alert(`获取到 ${result.data?.length || 0} 个推荐问题`)
                } catch (error) {
                  console.error('Error:', error)
                  alert('API调用失败')
                }
              }}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              测试推荐问题API
            </button>
            
            <button
              onClick={async () => {
                try {
                  const response = await fetch('/api/sample-problems?action=stats')
                  const result = await response.json()
                  console.log('Problem stats:', result)
                  alert(`总问题数: ${result.data?.total || 0}`)
                } catch (error) {
                  console.error('Error:', error)
                  alert('API调用失败')
                }
              }}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
            >
              测试统计API
            </button>
            
            <button
              onClick={async () => {
                try {
                  const response = await fetch('/api/sample-problems', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                      keywords: ['皇后', 'queens']
                    })
                  })
                  const result = await response.json()
                  console.log('Search results:', result)
                  alert(`搜索到 ${result.data?.length || 0} 个相关问题`)
                } catch (error) {
                  console.error('Error:', error)
                  alert('搜索API调用失败')
                }
              }}
              className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
            >
              测试关键词搜索
            </button>
            
            <button
              onClick={async () => {
                try {
                  const response = await fetch('/api/sample-problems?action=by-tool&tool_name=solve_n_queens')
                  const result = await response.json()
                  console.log('Tool problems:', result)
                  alert(`找到 ${result.data?.length || 0} 个相关工具问题`)
                } catch (error) {
                  console.error('Error:', error)
                  alert('工具搜索API调用失败')
                }
              }}
              className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600"
            >
              测试工具搜索
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}