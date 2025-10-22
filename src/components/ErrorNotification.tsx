'use client'

// Error Notification Component - Display error messages with actions

import React, { useEffect, useState } from 'react'
import { ERROR_CODES } from '@/types/constants'

export interface ErrorNotificationProps {
  error: string | null
  errorCode?: string
  onDismiss?: () => void
  onRetry?: () => void
  autoHide?: boolean
  autoHideDelay?: number
  className?: string
  position?: 'top' | 'bottom'
  variant?: 'error' | 'warning' | 'info'
}

/**
 * Error notification component with retry and dismiss actions
 */
export const ErrorNotification: React.FC<ErrorNotificationProps> = ({
  error,
  errorCode,
  onDismiss,
  onRetry,
  autoHide = false,
  autoHideDelay = 5000,
  className = '',
  position = 'top',
  variant = 'error'
}) => {
  const [isVisible, setIsVisible] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)

  useEffect(() => {
    if (error) {
      setIsVisible(true)
      setIsAnimating(true)

      if (autoHide) {
        const timer = setTimeout(() => {
          handleDismiss()
        }, autoHideDelay)

        return () => clearTimeout(timer)
      }
    } else {
      setIsVisible(false)
      setIsAnimating(false)
    }
  }, [error, autoHide, autoHideDelay])

  const handleDismiss = () => {
    setIsAnimating(false)
    setTimeout(() => {
      setIsVisible(false)
      onDismiss?.()
    }, 150) // Animation duration
  }

  const handleRetry = () => {
    onRetry?.()
    handleDismiss()
  }

  const getErrorIcon = () => {
    switch (variant) {
      case 'warning':
        return (
          <svg className="w-5 h-5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        )
      case 'info':
        return (
          <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
      default:
        return (
          <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
    }
  }

  const getVariantStyles = () => {
    switch (variant) {
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800'
      case 'info':
        return 'bg-blue-50 border-blue-200 text-blue-800'
      default:
        return 'bg-red-50 border-red-200 text-red-800'
    }
  }

  const getButtonStyles = () => {
    switch (variant) {
      case 'warning':
        return 'text-yellow-600 hover:text-yellow-800'
      case 'info':
        return 'text-blue-600 hover:text-blue-800'
      default:
        return 'text-red-600 hover:text-red-800'
    }
  }

  const getRetryable = () => {
    if (!errorCode) return true
    
    // Define which errors are retryable
    const retryableErrors = [
      ERROR_CODES.NETWORK_ERROR,
      ERROR_CODES.TIMEOUT_ERROR,
      ERROR_CODES.CONNECTION_FAILED,
      ERROR_CODES.LLM_RATE_LIMIT_ERROR,
      ERROR_CODES.MCP_CONNECTION_ERROR,
      ERROR_CODES.INTERNAL_SERVER_ERROR
    ]
    
    return retryableErrors.includes(errorCode as any)
  }

  const getErrorTitle = () => {
    if (!errorCode) return 'Error'
    
    switch (errorCode) {
      case ERROR_CODES.NETWORK_ERROR:
        return 'Network Error'
      case ERROR_CODES.TIMEOUT_ERROR:
        return 'Request Timeout'
      case ERROR_CODES.LLM_AUTHENTICATION_ERROR:
        return 'Authentication Error'
      case ERROR_CODES.LLM_RATE_LIMIT_ERROR:
        return 'Rate Limit Exceeded'
      case ERROR_CODES.MCP_CONNECTION_ERROR:
        return 'MCP Connection Error'
      case ERROR_CODES.MCP_TOOL_NOT_FOUND:
        return 'Tool Not Found'
      case ERROR_CODES.MCP_TOOL_EXECUTION_ERROR:
        return 'Tool Execution Error'
      default:
        return 'Error'
    }
  }

  if (!isVisible || !error) {
    return null
  }

  const positionClasses = position === 'top' 
    ? 'top-4' 
    : 'bottom-4'

  const animationClasses = isAnimating
    ? 'translate-y-0 opacity-100'
    : position === 'top'
      ? '-translate-y-full opacity-0'
      : 'translate-y-full opacity-0'

  return (
    <div className={`fixed left-4 right-4 z-50 ${positionClasses} transition-all duration-150 ease-in-out ${animationClasses}`}>
      <div className={`max-w-md mx-auto rounded-lg border p-4 shadow-lg ${getVariantStyles()} ${className}`}>
        <div className="flex items-start">
          <div className="flex-shrink-0">
            {getErrorIcon()}
          </div>
          
          <div className="ml-3 flex-1">
            <h3 className="text-sm font-medium">
              {getErrorTitle()}
            </h3>
            <p className="mt-1 text-sm opacity-90">
              {error}
            </p>
          </div>

          <div className="ml-4 flex-shrink-0 flex">
            {onRetry && getRetryable() && (
              <button
                onClick={handleRetry}
                className={`text-sm font-medium ${getButtonStyles()} hover:underline mr-3 transition-colors`}
              >
                Retry
              </button>
            )}
            
            <button
              onClick={handleDismiss}
              className={`text-sm ${getButtonStyles()} hover:opacity-75 transition-opacity`}
            >
              <span className="sr-only">Dismiss</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ErrorNotification