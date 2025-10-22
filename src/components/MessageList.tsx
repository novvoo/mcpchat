'use client'

// MessageList Component - Display chat messages with formatting

import React, { useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import { MessageListProps, Message, ToolCall } from '@/types'
import { ChatEmptyState } from './EmptyState'
import { LoadingMessage } from './LoadingMessage'
import { MessageLoadingIndicator, ToolExecutionIndicator } from './LoadingIndicator'

/**
 * MessageList component for displaying chat messages
 */
export const MessageList = forwardRef<MessageListHandle, MessageListProps>(({
  messages,
  isLoading = false,
  showTimestamps = false,
  showAvatars = true,
  autoScroll = true,
  className = "",
  onMessageClick,
  onToolCallClick
}, ref) => {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Expose scroll methods via ref
  useImperativeHandle(ref, () => ({
    scrollToBottom: () => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    },
    scrollToTop: () => {
      containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
    },
    scrollToMessage: (messageId: string) => {
      const element = document.getElementById(`message-${messageId}`)
      element?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }), [])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (autoScroll && messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages.length, autoScroll])

  /**
   * Format timestamp for display
   */
  const formatTimestamp = (timestamp: Date): string => {
    const now = new Date()
    const diff = now.getTime() - timestamp.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    if (days < 7) return `${days}d ago`
    
    return timestamp.toLocaleDateString()
  }

  /**
   * Get avatar for message role
   */
  const getAvatar = (role: Message['role']): string => {
    switch (role) {
      case 'user':
        return '👤'
      case 'assistant':
        return '🤖'
      case 'system':
        return '⚙️'
      default:
        return '💬'
    }
  }

  /**
   * Get role display name
   */
  const getRoleName = (role: Message['role']): string => {
    switch (role) {
      case 'user':
        return 'You'
      case 'assistant':
        return 'Assistant'
      case 'system':
        return 'System'
      default:
        return 'Unknown'
    }
  }

  /**
   * Render tool calls
   */
  const renderToolCalls = (toolCalls: ToolCall[]) => {
    if (!toolCalls || toolCalls.length === 0) return null

    return (
      <div className="mt-2 space-y-2">
        {toolCalls.map((toolCall, index) => (
          <div
            key={toolCall.id || index}
            className="bg-accent border border-border rounded-lg p-2 sm:p-3 cursor-pointer hover:bg-accent/80 transition-colors animate-slide-up"
            onClick={() => onToolCallClick?.(toolCall)}
          >
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-primary font-medium text-sm">🔧 {toolCall.name}</span>
              {toolCall.error && (
                <span className="text-destructive text-xs sm:text-sm">❌ Error</span>
              )}
              {toolCall.result && !toolCall.error && (
                <span className="text-green-600 text-xs sm:text-sm">✅ Success</span>
              )}
            </div>
            
            {Object.keys(toolCall.parameters).length > 0 && (
              <div className="text-xs sm:text-sm text-muted-foreground mb-2">
                <strong>Parameters:</strong>
                <pre className="mt-1 text-xs bg-muted p-2 rounded overflow-x-auto max-w-full">
                  {JSON.stringify(toolCall.parameters, null, 2)}
                </pre>
              </div>
            )}

            {toolCall.result && (
              <div className="text-xs sm:text-sm text-foreground">
                <strong>Result:</strong>
                <div className="mt-1 p-2 bg-background rounded border max-w-full overflow-hidden">
                  {typeof toolCall.result === 'string' 
                    ? <div className="break-words">{toolCall.result}</div>
                    : <pre className="text-xs overflow-x-auto max-w-full">{JSON.stringify(toolCall.result, null, 2)}</pre>
                  }
                </div>
              </div>
            )}

            {toolCall.error && (
              <div className="text-xs sm:text-sm text-destructive">
                <strong>Error:</strong> <span className="break-words">{toolCall.error}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    )
  }

  /**
   * Render individual message
   */
  const renderMessage = (message: Message, index: number) => {
    const isUser = message.role === 'user'
    const isSystem = message.role === 'system'
    
    return (
      <div
        key={message.id}
        id={`message-${message.id}`}
        className={`flex gap-2 sm:gap-3 md:gap-4 p-3 sm:p-4 hover:bg-accent/50 transition-colors animate-fade-in ${
          isUser ? 'flex-row-reverse' : ''
        } ${isSystem ? 'bg-muted/50' : ''}`}
        onClick={() => onMessageClick?.(message)}
      >
        {showAvatars && (
          <div className={`flex-shrink-0 w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-sm sm:text-lg ${
            isUser 
              ? 'bg-primary text-primary-foreground' 
              : isSystem 
              ? 'bg-secondary text-secondary-foreground' 
              : 'bg-muted text-muted-foreground'
          }`}>
            {getAvatar(message.role)}
          </div>
        )}

        <div className={`flex-1 min-w-0 max-w-full sm:max-w-[85%] md:max-w-[80%] lg:max-w-[75%] ${isUser ? 'text-right' : ''}`}>
          <div className={`flex items-center gap-1 sm:gap-2 mb-1 ${isUser ? 'justify-end' : ''}`}>
            <span className="font-medium text-xs sm:text-sm text-foreground">
              {getRoleName(message.role)}
            </span>
            {showTimestamps && (
              <span className="text-xs text-muted-foreground">
                {formatTimestamp(message.timestamp)}
              </span>
            )}
          </div>

          <div className={`prose prose-sm max-w-none ${
            isUser 
              ? 'bg-primary text-primary-foreground rounded-lg px-3 py-2 inline-block max-w-[280px] sm:max-w-sm md:max-w-md' 
              : isSystem
              ? 'bg-secondary/50 border border-border rounded-lg px-3 py-2'
              : 'text-foreground'
          }`}>
            <div className="whitespace-pre-wrap break-words text-sm sm:text-base leading-relaxed">
              {message.content}
            </div>
          </div>

          {message.toolCalls && renderToolCalls(message.toolCalls)}
        </div>
      </div>
    )
  }

  return (
    <div className={`flex flex-col h-full ${className}`}>
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto scroll-smooth px-2 sm:px-4 md:px-6"
      >
        <div className="max-w-4xl mx-auto">
          {messages.length === 0 ? (
            <ChatEmptyState />
          ) : (
            <div className="space-y-0.5 sm:space-y-1 py-2 sm:py-4">
              {messages.map((message, index) => renderMessage(message, index))}
            </div>
          )}

          {isLoading && <LoadingMessage />}

          <div ref={messagesEndRef} className="h-4" />
        </div>
      </div>
    </div>
  )
})

MessageList.displayName = 'MessageList'



/**
 * MessageList handle interface for imperative methods
 */
export interface MessageListHandle {
  scrollToBottom: () => void
  scrollToTop: () => void
  scrollToMessage: (messageId: string) => void
}

export default MessageList