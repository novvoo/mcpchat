'use client'

// EmptyState Component - Display when no messages are present

import React from 'react'

interface EmptyStateProps {
  title?: string
  subtitle?: string
  icon?: string
  suggestions?: string[]
  onSuggestionClick?: (suggestion: string) => void
  className?: string
}

/**
 * EmptyState component for displaying when chat is empty
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  title = "No messages yet",
  subtitle = "Start a conversation!",
  icon = "💬",
  suggestions = [],
  onSuggestionClick,
  className = ""
}) => {
  return (
    <div className={`flex items-center justify-center h-full ${className}`}>
      <div className="text-center max-w-sm sm:max-w-md mx-auto p-4 sm:p-6 animate-fade-in">
        <div className="text-4xl sm:text-5xl md:text-6xl mb-3 sm:mb-4">{icon}</div>
        <h3 className="text-base sm:text-lg font-medium text-foreground mb-2">{title}</h3>
        <p className="text-sm sm:text-base text-muted-foreground mb-4 sm:mb-6">{subtitle}</p>
        
        {suggestions.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs sm:text-sm font-medium text-foreground mb-3">Try asking:</p>
            <div className="space-y-2">
              {suggestions.map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => onSuggestionClick?.(suggestion)}
                  className="block w-full text-left px-3 sm:px-4 py-2 text-xs sm:text-sm text-primary bg-accent hover:bg-accent/80 rounded-lg transition-all duration-200 border border-border hover:border-primary/50 hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Chat-specific empty state with MCP tool suggestions
 */
export const ChatEmptyState: React.FC<{
  onSuggestionClick?: (suggestion: string) => void
}> = ({ onSuggestionClick }) => {
  const suggestions = [
    "Solve the 8 queens problem",
    "Help me with a sudoku puzzle",
    "Optimize my investment portfolio",
    "Solve a graph coloring problem",
    "Run an example computation"
  ]

  return (
    <EmptyState
      title="Welcome to MCP Chat!"
      subtitle="I can help you solve problems using powerful computational tools."
      icon="🤖"
      suggestions={suggestions}
      onSuggestionClick={onSuggestionClick}
    />
  )
}

/**
 * Error state component
 */
export const ErrorState: React.FC<{
  title?: string
  message?: string
  onRetry?: () => void
  className?: string
}> = ({
  title = "Something went wrong",
  message = "Please try again later.",
  onRetry,
  className = ""
}) => {
  return (
    <div className={`flex items-center justify-center h-full ${className}`}>
      <div className="text-center max-w-sm sm:max-w-md mx-auto p-4 sm:p-6 animate-fade-in">
        <div className="text-4xl sm:text-5xl md:text-6xl mb-3 sm:mb-4">⚠️</div>
        <h3 className="text-base sm:text-lg font-medium text-foreground mb-2">{title}</h3>
        <p className="text-sm sm:text-base text-muted-foreground mb-4 sm:mb-6 break-words">{message}</p>
        
        {onRetry && (
          <button
            onClick={onRetry}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-all duration-200 hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Try Again
          </button>
        )}
      </div>
    </div>
  )
}

export default EmptyState