'use client'

// LoadingMessage Component - Display loading state for assistant responses

import React from 'react'

interface LoadingMessageProps {
  message?: string
  showAvatar?: boolean
  className?: string
}

/**
 * LoadingMessage component for showing assistant thinking state
 */
export const LoadingMessage: React.FC<LoadingMessageProps> = ({
  message = "Thinking...",
  showAvatar = true,
  className = ""
}) => {
  return (
    <div className={`flex gap-2 sm:gap-3 p-3 sm:p-4 animate-fade-in ${className}`}>
      {showAvatar && (
        <div className="flex-shrink-0 w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-sm sm:text-lg">
          🤖
        </div>
      )}
      
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-xs sm:text-sm text-foreground">Assistant</span>
        </div>
        
        <div className="bg-accent rounded-2xl px-3 sm:px-4 py-2 sm:py-3 inline-block">
          <div className="flex items-center gap-2 sm:gap-3">
            <TypingIndicator />
            <span className="text-xs sm:text-sm text-muted-foreground">{message}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Enhanced typing indicator with multiple animation styles
 */
const TypingIndicator: React.FC<{ variant?: 'dots' | 'pulse' | 'wave' }> = ({ 
  variant = 'dots' 
}) => {
  switch (variant) {
    case 'pulse':
      return (
        <div className="flex space-x-1">
          <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-muted-foreground rounded-full animate-pulse"></div>
          <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-muted-foreground rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
          <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-muted-foreground rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
        </div>
      )
    
    case 'wave':
      return (
        <div className="flex space-x-1 items-end">
          <div className="w-0.5 sm:w-1 bg-muted-foreground rounded-full animate-bounce" style={{ height: '6px', animationDelay: '0ms' }}></div>
          <div className="w-0.5 sm:w-1 bg-muted-foreground rounded-full animate-bounce" style={{ height: '10px', animationDelay: '150ms' }}></div>
          <div className="w-0.5 sm:w-1 bg-muted-foreground rounded-full animate-bounce" style={{ height: '6px', animationDelay: '300ms' }}></div>
        </div>
      )
    
    default: // dots
      return (
        <div className="flex space-x-1">
          <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
          <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
          <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
        </div>
      )
  }
}

/**
 * Tool execution loading component
 */
export const ToolExecutionLoading: React.FC<{
  toolName: string
  showAvatar?: boolean
}> = ({ toolName, showAvatar = true }) => {
  return (
    <div className="flex gap-2 sm:gap-3 p-3 sm:p-4 animate-fade-in">
      {showAvatar && (
        <div className="flex-shrink-0 w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm sm:text-lg">
          🔧
        </div>
      )}
      
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-xs sm:text-sm text-foreground">Tool Execution</span>
        </div>
        
        <div className="bg-accent border border-border rounded-lg px-2 sm:px-3 py-2 inline-block">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="animate-spin w-3 h-3 sm:w-4 sm:h-4 border-2 border-primary border-t-transparent rounded-full"></div>
            <span className="text-xs sm:text-sm text-foreground">Executing {toolName}...</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LoadingMessage