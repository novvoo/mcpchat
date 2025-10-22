'use client'

// MessageBubble Component - Individual message display with formatting

import React from 'react'
import { Message, ToolCall } from '@/types'
import { ToolExecutionProgress } from './ToolExecutionProgress'

interface MessageBubbleProps {
  message: Message
  showTimestamp?: boolean
  showAvatar?: boolean
  onToolCallClick?: (toolCall: ToolCall) => void
  onMessageClick?: (message: Message) => void
}

/**
 * MessageBubble component for individual message display
 */
export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  showTimestamp = false,
  showAvatar = true,
  onToolCallClick,
  onMessageClick
}) => {
  const isUser = message.role === 'user'
  const isSystem = message.role === 'system'
  const isAssistant = message.role === 'assistant'

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
      <div className="mt-3 space-y-2">
        {toolCalls.map((toolCall, index) => (
          <ToolCallDisplay
            key={toolCall.id || index}
            toolCall={toolCall}
            onClick={() => onToolCallClick?.(toolCall)}
          />
        ))}
      </div>
    )
  }

  return (
    <div
      className={`flex gap-2 sm:gap-3 p-3 sm:p-4 hover:bg-accent/50 transition-all duration-200 group animate-fade-in ${
        isUser ? 'flex-row-reverse' : ''
      } ${isSystem ? 'bg-muted/50' : ''}`}
      onClick={() => onMessageClick?.(message)}
    >
      {showAvatar && (
        <div className={`flex-shrink-0 w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-sm sm:text-lg shadow-sm ${
          isUser 
            ? 'bg-primary text-primary-foreground' 
            : isSystem 
            ? 'bg-secondary text-secondary-foreground' 
            : 'bg-muted text-muted-foreground'
        }`}>
          {getAvatar(message.role)}
        </div>
      )}

      <div className={`flex-1 min-w-0 max-w-[85%] ${isUser ? 'text-right' : ''}`}>
        <div className={`flex items-center gap-2 mb-1 ${isUser ? 'justify-end' : ''}`}>
          <span className="font-medium text-xs sm:text-sm text-foreground">
            {getRoleName(message.role)}
          </span>
          {showTimestamp && (
            <span className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-all duration-200">
              {formatTimestamp(message.timestamp)}
            </span>
          )}
        </div>

        <div className={`transition-all duration-200 hover:shadow-sm ${
          isUser 
            ? 'bg-primary text-primary-foreground rounded-2xl px-3 sm:px-4 py-2 inline-block max-w-[280px] sm:max-w-sm ml-auto shadow-sm' 
            : isSystem
            ? 'bg-secondary/50 border border-border rounded-lg px-3 py-2 text-secondary-foreground'
            : 'text-foreground bg-accent rounded-2xl px-3 sm:px-4 py-2 inline-block max-w-[280px] sm:max-w-sm shadow-sm'
        }`}>
          <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">
            {message.content}
          </div>
        </div>

        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="mt-3 animate-slide-up">
            {/* Show progress for running tools */}
            {message.toolCalls.some(tc => !tc.result && !tc.error) && (
              <ToolExecutionProgress
                toolCalls={message.toolCalls}
                showDetails={true}
                className="mb-3"
              />
            )}
            
            {/* Show completed tool calls */}
            {renderToolCalls(message.toolCalls)}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * ToolCallDisplay component for individual tool calls
 */
interface ToolCallDisplayProps {
  toolCall: ToolCall
  onClick?: () => void
}

const ToolCallDisplay: React.FC<ToolCallDisplayProps> = ({ toolCall, onClick }) => {
  const hasError = !!toolCall.error
  const hasResult = !!toolCall.result && !hasError

  return (
    <div
      className={`border rounded-lg p-2 sm:p-3 cursor-pointer transition-all duration-200 hover:shadow-md hover:scale-[1.02] ${
        hasError 
          ? 'bg-destructive/10 border-destructive/20 hover:bg-destructive/20' 
          : hasResult
          ? 'bg-green-50 border-green-200 hover:bg-green-100'
          : 'bg-accent border-border hover:bg-accent/80'
      }`}
      onClick={onClick}
    >
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span className={`font-medium text-xs sm:text-sm ${
          hasError ? 'text-destructive' : hasResult ? 'text-green-700' : 'text-primary'
        }`}>
          🔧 {toolCall.name}
        </span>
        {hasError && <span className="text-destructive text-xs">❌ Failed</span>}
        {hasResult && <span className="text-green-600 text-xs">✅ Success</span>}
        {!hasError && !hasResult && <span className="text-primary text-xs">⏳ Running</span>}
      </div>
      
      {Object.keys(toolCall.parameters).length > 0 && (
        <div className="mb-2">
          <div className="text-xs font-medium text-muted-foreground mb-1">Parameters:</div>
          <div className="text-xs bg-background rounded p-2 border font-mono overflow-x-auto max-w-full">
            {JSON.stringify(toolCall.parameters, null, 2)}
          </div>
        </div>
      )}

      {hasResult && (
        <div>
          <div className="text-xs font-medium text-muted-foreground mb-1">Result:</div>
          <div className="text-xs bg-background rounded p-2 border max-w-full overflow-hidden">
            {typeof toolCall.result === 'string' 
              ? <div className="break-words">{toolCall.result}</div>
              : <pre className="font-mono overflow-x-auto max-w-full">{JSON.stringify(toolCall.result, null, 2)}</pre>
            }
          </div>
        </div>
      )}

      {hasError && (
        <div>
          <div className="text-xs font-medium text-destructive mb-1">Error:</div>
          <div className="text-xs text-destructive bg-background rounded p-2 border border-destructive/20 break-words">
            {toolCall.error}
          </div>
        </div>
      )}
    </div>
  )
}

export default MessageBubble