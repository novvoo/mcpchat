'use client'

// SimpleChatInterface Component - Simplified chat interface using useChat hook

import React, { useRef, useCallback } from 'react'
import { Message, ToolCall } from '@/types'
import { useChat } from '@/hooks/useChat'
import { useMCPStatus } from '@/hooks/useMCPStatus'
import { MessageInput } from './MessageInput'
import { MessageList, MessageListHandle } from './MessageList'
import { ErrorState, ChatEmptyState } from './EmptyState'
import { ThemeToggle } from './ThemeProvider'
import { KeywordMappingStatus } from './KeywordMappingStatus'

interface SimpleChatInterfaceProps {
  apiKey?: string
  conversationId?: string
  initialMessages?: Message[]
  onMessageClick?: (message: Message) => void
  onToolCallClick?: (toolCall: ToolCall) => void
  onError?: (error: string) => void
  className?: string
  showTimestamps?: boolean
  showAvatars?: boolean
  placeholder?: string
}

/**
 * Simplified ChatInterface component using useChat hook
 */
export const SimpleChatInterface: React.FC<SimpleChatInterfaceProps> = ({
  apiKey,
  conversationId: initialConversationId,
  initialMessages = [],
  onMessageClick,
  onToolCallClick,
  onError,
  className = "",
  showTimestamps = false,
  showAvatars = true,
  placeholder = "Type your message..."
}) => {
  const messageListRef = useRef<MessageListHandle>(null)

  // MCP系统状态管理 - 使用全局状态管理器
  const { status: mcpStatus, isLoading: mcpLoading, checkStatus } = useMCPStatus({
    onStatusChange: (status) => {
      if (status.ready) {
        console.log('MCP系统已就绪，工具数量:', status.details.totalTools)
      } else if (status.error) {
        console.warn('MCP系统状态异常:', status.error)
      } else {
        console.log('MCP系统状态更新:', {
          configLoaded: status.configLoaded,
          serversConnected: status.serversConnected,
          toolsLoaded: status.toolsLoaded,
          keywordsMapped: status.keywordsMapped
        })
      }
    },
    onInitializationComplete: () => {
      console.log('🎉 MCP系统初始化完成！')
    }
  })

  const {
    messages,
    isLoading,
    error,
    sendMessage: originalSendMessage,
    clearMessages,
    retryLastMessage,
    setError
  } = useChat({
    initialMessages,
    apiKey,
    conversationId: initialConversationId,
    onError
  })

  // 包装sendMessage，在MCP系统未就绪时提供友好提示
  const sendMessage = useCallback(async (content: string) => {
    // 如果MCP系统正在初始化，等待一下
    if (mcpLoading) {
      setError('系统正在初始化中，请稍候...')
      setTimeout(() => setError(null), 3000)
      return
    }

    // 如果MCP系统未就绪但不是致命错误，仍然允许发送（会降级到纯LLM模式）
    if (mcpStatus && !mcpStatus.ready && mcpStatus.error) {
      console.warn('MCP系统未完全就绪，将使用纯LLM模式处理请求')
    }

    await originalSendMessage(content)
  }, [originalSendMessage, mcpStatus, mcpLoading, setError])



  // Show error state if there's a critical error and no messages
  if (error && messages.length === 0) {
    return (
      <div className={`flex flex-col h-full ${className}`}>
        <ErrorState
          title="Connection Error"
          message={error}
          onRetry={retryLastMessage}
        />
      </div>
    )
  }

  return (
    <div className={`flex flex-col h-full bg-background text-foreground ${className}`}>
      {/* Header */}
      <div className="flex-shrink-0 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-3 py-2 sm:px-4 sm:py-3 md:px-6 md:py-4 animate-slide-down">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <div className="min-w-0 flex-1">
            <h1 className="text-base sm:text-lg md:text-xl font-semibold text-foreground truncate">
              MCP Chat
            </h1>
            <div className="space-y-1">
              <p className="text-xs sm:text-sm text-muted-foreground truncate">
                {messages.length === 0
                  ? "Start a conversation with AI tools"
                  : `${messages.length} message${messages.length !== 1 ? 's' : ''}`
                }
              </p>
              <KeywordMappingStatus className="max-w-xs" showDetails={false} />
              {/* MCP系统状态指示器 */}
              {mcpStatus && (
                <div className="flex items-center gap-1 text-xs">
                  <div className={`w-2 h-2 rounded-full ${mcpStatus.ready
                    ? 'bg-green-500'
                    : mcpLoading
                      ? 'bg-yellow-500 animate-pulse'
                      : 'bg-red-500'
                    }`} />
                  <span className="text-muted-foreground">
                    {mcpStatus.ready
                      ? `MCP就绪 (${mcpStatus.details.totalTools}工具)`
                      : mcpLoading
                        ? 'MCP初始化中...'
                        : 'MCP未就绪'}
                  </span>
                  <button
                    onClick={async () => {
                      // 先触发API刷新
                      try {
                        const { mcpApi } = await import('@/services/api-client')
                        await mcpApi.refreshStatus()
                      } catch (error) {
                        console.warn('API刷新失败:', error)
                      }
                      // 然后检查状态
                      checkStatus()
                    }}
                    disabled={mcpLoading}
                    className="ml-1 p-0.5 text-muted-foreground hover:text-foreground transition-colors rounded hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    title="刷新MCP状态"
                    aria-label="刷新MCP状态"
                  >
                    <svg className={`w-3 h-3 ${mcpLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-2 ml-2">
            {/* Admin Panel Link */}
            <a
              href="/admin"
              className="p-1.5 sm:p-2 text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              title="管理面板"
              aria-label="管理面板"
            >
              <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </a>

            <ThemeToggle />

            {messages.length > 0 && (
              <>
                <button
                  onClick={() => messageListRef.current?.scrollToTop()}
                  className="p-1.5 sm:p-2 text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  title="Scroll to top"
                  aria-label="Scroll to top"
                >
                  <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                  </svg>
                </button>

                <button
                  onClick={clearMessages}
                  className="p-1.5 sm:p-2 text-muted-foreground hover:text-destructive transition-colors rounded-md hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  title="Clear conversation"
                  aria-label="Clear conversation"
                >
                  <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 min-h-0">
        {messages.length === 0 && !isLoading ? (
          <ChatEmptyState onSuggestionClick={sendMessage} />
        ) : (
          <MessageList
            ref={messageListRef}
            messages={messages}
            isLoading={isLoading}
            showTimestamps={showTimestamps}
            showAvatars={showAvatars}
            autoScroll={true}
            onMessageClick={onMessageClick}
            onToolCallClick={onToolCallClick}
          />
        )}
      </div>

      {/* Error banner */}
      {error && messages.length > 0 && (
        <div className="flex-shrink-0 bg-destructive/10 border-t border-destructive/20 p-3 animate-slide-up">
          <div className="flex items-center justify-between max-w-4xl mx-auto">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <svg className="w-4 h-4 text-destructive flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm text-destructive truncate">{error}</span>
            </div>
            <div className="flex items-center gap-2 ml-2">
              <button
                onClick={retryLastMessage}
                className="text-xs text-destructive hover:text-destructive/80 font-medium px-2 py-1 rounded hover:bg-destructive/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Retry
              </button>
              <button
                onClick={() => setError(null)}
                className="text-xs text-destructive hover:text-destructive/80 px-2 py-1 rounded hover:bg-destructive/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="flex-shrink-0 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-3 sm:p-4 md:p-6">
        <div className="max-w-4xl mx-auto">
          <MessageInput
            onSubmit={sendMessage}
            disabled={isLoading}
            placeholder={placeholder}
            maxLength={10000}
            autoFocus={messages.length === 0}
            showCharCount={false}
            multiline={true}
          />
        </div>
      </div>
    </div>
  )
}

export default SimpleChatInterface