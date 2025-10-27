'use client'

import { SimpleChatInterface } from '@/components'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import Link from 'next/link'
import { Settings, RefreshCw } from 'lucide-react'

export default function Home() {
  const [isRefreshing, setIsRefreshing] = useState(false)

  const refreshDynamicPatterns = async () => {
    setIsRefreshing(true)
    try {
      const response = await fetch('/api/admin/dynamic-patterns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'learn_from_tools' })
      })
      const data = await response.json()
      if (data.success) {
        alert(`刷新成功！\n新关键词: ${data.data.newKeywords.length} 个\n更新模式: ${data.data.updatedPatterns.length} 个`)
      } else {
        alert('刷新失败: ' + (data.error || '未知错误'))
      }
    } catch (error) {
      console.error('刷新动态模式失败:', error)
      alert('刷新失败: ' + (error instanceof Error ? error.message : '未知错误'))
    } finally {
      setIsRefreshing(false)
    }
  }

  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        console.error('Application error:', error, errorInfo)
        // In production, you might want to send this to an error reporting service
      }}
    >
      <main className="h-screen flex flex-col bg-background text-foreground">
        {/* 顶部工具栏 */}
        <div className="flex items-center justify-between p-4 border-b bg-card">
          <h1 className="text-xl font-semibold">MCP 智能路由系统</h1>
          <div className="flex gap-2">
            <Link href="/admin">
              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4 mr-2" />
                管理面板
              </Button>
            </Link>
            <Button
              variant="outline"
              size="sm"
              onClick={refreshDynamicPatterns}
              disabled={isRefreshing}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? '刷新中...' : '刷新动态模式'}
            </Button>
          </div>
        </div>

        <div className="flex-1">
          {/* 聊天界面 */}
          <SimpleChatInterface
            placeholder="Ask me anything or try: 'Solve the 8 queens problem'"
            showTimestamps={false}
            showAvatars={true}
            className="h-full"
          />
        </div>
      </main>
    </ErrorBoundary>
  )
}
