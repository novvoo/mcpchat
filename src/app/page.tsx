'use client'

import { SimpleChatInterface } from '@/components'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Settings } from 'lucide-react'

export default function Home() {
  const [showPatterns, setShowPatterns] = useState(false)

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
              variant={showPatterns ? "primary" : "outline"}
              size="sm"
              onClick={() => setShowPatterns(!showPatterns)}
            >
              {showPatterns ? '隐藏' : '显示'}动态模式学习
            </Button>
          </div>
        </div>

        <div className="flex-1 flex">
          {/* 聊天界面 */}
          <div className={`${showPatterns ? 'w-1/2' : 'w-full'} transition-all duration-300`}>
            <SimpleChatInterface
              placeholder="Ask me anything or try: 'Solve the 8 queens problem'"
              showTimestamps={false}
              showAvatars={true}
              className="h-full"
            />
          </div>

          {/* 动态模式学习面板 */}
          {showPatterns && (
            <div className="w-1/2 border-l bg-card">
              <div className="h-full">
                <iframe
                  src="/admin/dynamic-patterns"
                  className="w-full h-full border-0"
                  title="动态模式学习管理"
                />
              </div>
            </div>
          )}
        </div>
      </main>
    </ErrorBoundary>
  )
}
