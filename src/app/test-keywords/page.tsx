'use client'

import { KeywordMappingStatus } from '@/components/KeywordMappingStatus'

export default function TestKeywordsPage() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">关键词映射状态测试</h1>
      
      <div className="space-y-4">
        <div className="border rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-2">紧凑模式（首页用）</h2>
          <KeywordMappingStatus showDetails={false} />
        </div>
        
        <div className="border rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-2">详细模式（管理页面用）</h2>
          <KeywordMappingStatus showDetails={true} />
        </div>
      </div>
      
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">API测试</h2>
        <div className="space-x-2">
          <button 
            onClick={() => fetch('/api/tools/keyword-stats').then(r => r.json()).then(console.log)}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            获取统计信息
          </button>
          <button 
            onClick={() => fetch('/api/tools/ensure-keywords', {method: 'POST'}).then(r => r.json()).then(console.log)}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
          >
            确保关键词映射
          </button>
        </div>
        <p className="text-sm text-gray-600">结果会在浏览器控制台中显示</p>
      </div>
    </div>
  )
}