'use client'

import React from 'react'
import { useMCPStatus } from '@/hooks/useMCPStatus'

export default function TestMCPStatusPage() {
  const { status, isLoading, error, checkStatus } = useMCPStatus()

  return (
    <div className="container mx-auto p-6 max-w-2xl">
      <h1 className="text-2xl font-bold mb-4">MCP状态测试页面</h1>
      
      <div className="bg-white rounded-lg shadow p-6 mb-4">
        <h2 className="text-lg font-semibold mb-3">当前状态</h2>
        
        <div className="space-y-2">
          <div>加载中: {isLoading ? '是' : '否'}</div>
          <div>错误: {error || '无'}</div>
          <div>就绪: {status?.ready ? '是' : '否'}</div>
          
          {status && (
            <div className="mt-4 p-3 bg-gray-50 rounded">
              <div>配置已加载: {status.configLoaded ? '✅' : '❌'}</div>
              <div>服务器已连接: {status.serversConnected ? '✅' : '❌'}</div>
              <div>工具已加载: {status.toolsLoaded ? '✅' : '❌'}</div>
              <div>关键词已映射: {status.keywordsMapped ? '✅' : '❌'}</div>
              <div>总工具数: {status.details.totalTools}</div>
            </div>
          )}
        </div>
        
        <button
          onClick={checkStatus}
          disabled={isLoading}
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          手动检查状态
        </button>
      </div>
      
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h3 className="font-semibold text-yellow-800 mb-2">调试信息</h3>
        <p className="text-sm text-yellow-700">
          这个页面使用了 useMCPStatus hook。如果自动检查被正确禁用，
          应该不会看到频繁的API调用。请检查浏览器开发者工具的网络面板。
        </p>
      </div>
    </div>
  )
}