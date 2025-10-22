'use client'

// Loading Indicator Component - Various loading states and spinners

import React from 'react'

export interface LoadingIndicatorProps {
  variant?: 'spinner' | 'dots' | 'pulse' | 'bars' | 'typing'
  size?: 'sm' | 'md' | 'lg'
  color?: 'blue' | 'gray' | 'green' | 'red' | 'yellow'
  message?: string
  className?: string
  fullScreen?: boolean
  overlay?: boolean
}

/**
 * Loading indicator component with multiple variants
 */
export const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({
  variant = 'spinner',
  size = 'md',
  color = 'blue',
  message,
  className = '',
  fullScreen = false,
  overlay = false
}) => {
  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'w-4 h-4'
      case 'lg':
        return 'w-8 h-8'
      default:
        return 'w-6 h-6'
    }
  }

  const getColorClasses = () => {
    switch (color) {
      case 'gray':
        return 'text-muted-foreground'
      case 'green':
        return 'text-green-600'
      case 'red':
        return 'text-destructive'
      case 'yellow':
        return 'text-yellow-600'
      default:
        return 'text-primary'
    }
  }

  const getMessageSize = () => {
    switch (size) {
      case 'sm':
        return 'text-xs'
      case 'lg':
        return 'text-base'
      default:
        return 'text-sm'
    }
  }

  const renderSpinner = () => (
    <svg 
      className={`animate-spin ${getSizeClasses()} ${getColorClasses()}`} 
      fill="none" 
      viewBox="0 0 24 24"
    >
      <circle 
        className="opacity-25" 
        cx="12" 
        cy="12" 
        r="10" 
        stroke="currentColor" 
        strokeWidth="4"
      />
      <path 
        className="opacity-75" 
        fill="currentColor" 
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  )

  const renderDots = () => (
    <div className="flex space-x-1">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className={`${getSizeClasses().replace('w-6 h-6', 'w-2 h-2').replace('w-4 h-4', 'w-1.5 h-1.5').replace('w-8 h-8', 'w-3 h-3')} bg-current rounded-full animate-pulse ${getColorClasses()}`}
          style={{
            animationDelay: `${i * 0.2}s`,
            animationDuration: '1s'
          }}
        />
      ))}
    </div>
  )

  const renderPulse = () => (
    <div className={`${getSizeClasses()} bg-current rounded-full animate-pulse ${getColorClasses()}`} />
  )

  const renderBars = () => (
    <div className="flex space-x-1 items-end">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className={`w-1 bg-current animate-pulse ${getColorClasses()}`}
          style={{
            height: size === 'sm' ? '12px' : size === 'lg' ? '24px' : '16px',
            animationDelay: `${i * 0.15}s`,
            animationDuration: '1.2s'
          }}
        />
      ))}
    </div>
  )

  const renderTyping = () => (
    <div className="flex space-x-1">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className={`${getSizeClasses().replace('w-6 h-6', 'w-2 h-2').replace('w-4 h-4', 'w-1.5 h-1.5').replace('w-8 h-8', 'w-3 h-3')} bg-current rounded-full ${getColorClasses()}`}
          style={{
            animation: `typing 1.4s infinite ease-in-out`,
            animationDelay: `${i * 0.2}s`
          }}
        />
      ))}
      <style jsx>{`
        @keyframes typing {
          0%, 60%, 100% {
            transform: translateY(0);
          }
          30% {
            transform: translateY(-10px);
          }
        }
      `}</style>
    </div>
  )

  const renderIndicator = () => {
    switch (variant) {
      case 'dots':
        return renderDots()
      case 'pulse':
        return renderPulse()
      case 'bars':
        return renderBars()
      case 'typing':
        return renderTyping()
      default:
        return renderSpinner()
    }
  }

  const content = (
    <div className={`flex flex-col items-center justify-center space-y-2 ${className}`}>
      {renderIndicator()}
      {message && (
        <p className={`${getMessageSize()} ${getColorClasses()} text-center font-medium`}>
          {message}
        </p>
      )}
    </div>
  )

  if (fullScreen) {
    return (
      <div className={`fixed inset-0 flex items-center justify-center ${overlay ? 'bg-background/80 backdrop-blur-sm' : 'bg-background'} z-50 animate-fade-in`}>
        {content}
      </div>
    )
  }

  return content
}

/**
 * Specialized loading components for common use cases
 */

export const MessageLoadingIndicator: React.FC<{ className?: string }> = ({ className = '' }) => (
  <LoadingIndicator
    variant="typing"
    size="sm"
    color="gray"
    message="AI is thinking..."
    className={className}
  />
)

export const ToolExecutionIndicator: React.FC<{ toolName?: string; className?: string }> = ({ 
  toolName, 
  className = '' 
}) => (
  <LoadingIndicator
    variant="bars"
    size="sm"
    color="blue"
    message={toolName ? `Executing ${toolName}...` : 'Executing tool...'}
    className={className}
  />
)

export const ConnectionLoadingIndicator: React.FC<{ className?: string }> = ({ className = '' }) => (
  <LoadingIndicator
    variant="pulse"
    size="sm"
    color="yellow"
    message="Connecting..."
    className={className}
  />
)

export const PageLoadingIndicator: React.FC<{ message?: string }> = ({ message = 'Loading...' }) => (
  <LoadingIndicator
    variant="spinner"
    size="lg"
    color="blue"
    message={message}
    fullScreen
    overlay
  />
)

export default LoadingIndicator