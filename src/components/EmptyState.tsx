'use client'

// EmptyState Component - Display when no messages are present

import React, { useState, useEffect } from 'react'

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

interface SampleProblem {
  id: string
  title: string
  title_en?: string
  description: string
  difficulty: string
  tool_name: string
}

/**
 * Chat-specific empty state with MCP tool suggestions
 */
export const ChatEmptyState: React.FC<{
  onSuggestionClick?: (suggestion: string) => void
}> = ({ onSuggestionClick }) => {
  const [suggestions, setSuggestions] = useState<string[]>([
    "Solve the 8 queens problem",
    "Help me with a sudoku puzzle", 
    "Optimize my investment portfolio",
    "Solve a graph coloring problem",
    "Run an example computation"
  ])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadSampleProblems = async () => {
      try {
        const response = await fetch('/api/sample-problems?action=recommended&limit=5')
        const result = await response.json()
        
        if (result.success && result.data.length > 0) {
          const problemSuggestions = result.data.map((problem: SampleProblem) => {
            // 根据难度和语言选择合适的标题
            const title = problem.title_en || problem.title
            const difficultyPrefix = problem.difficulty === 'easy' ? '' : 
                                   problem.difficulty === 'medium' ? 'Medium: ' : 
                                   'Hard: '
            return `${difficultyPrefix}${title}`
          })
          setSuggestions(problemSuggestions)
        }
      } catch (error) {
        console.error('Failed to load sample problems:', error)
        // 保持默认建议
      } finally {
        setLoading(false)
      }
    }

    loadSampleProblems()
  }, [])

  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center max-w-sm sm:max-w-md mx-auto p-4 sm:p-6 animate-fade-in">
        <div className="text-4xl sm:text-5xl md:text-6xl mb-3 sm:mb-4">🤖</div>
        <h3 className="text-base sm:text-lg font-medium text-foreground mb-2">Welcome to MCP Chat!</h3>
        <p className="text-sm sm:text-base text-muted-foreground mb-4 sm:mb-6">I can help you solve problems using powerful computational tools.</p>

        {loading ? (
          <div className="space-y-2 mb-6">
            <p className="text-xs sm:text-sm font-medium text-foreground mb-3">Loading suggestions...</p>
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="block w-full px-3 sm:px-4 py-2 bg-accent/50 rounded-lg animate-pulse"
                >
                  <div className="h-4 bg-accent rounded w-3/4"></div>
                </div>
              ))}
            </div>
          </div>
        ) : suggestions.length > 0 && (
          <div className="space-y-2 mb-6">
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

        {/* Admin Panel Link */}
        <div className="pt-4 border-t border-border">
          <a
            href="/admin"
            className="inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm text-muted-foreground hover:text-foreground bg-background hover:bg-accent rounded-lg transition-all duration-200 border border-border hover:border-primary/50 hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            管理面板
          </a>
        </div>
      </div>
    </div>
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