// Error Handler Hook - Centralized error handling and user feedback

import { useState, useCallback, useRef } from 'react'
import { ApiClientError, NetworkError, TimeoutError } from '@/services/api-client'
import { ERROR_CODES } from '@/types/constants'

export interface ErrorState {
  error: string | null
  errorCode: string | null
  isRetryable: boolean
  retryCount: number
  lastError: Date | null
}

export interface ErrorHandlerOptions {
  maxRetries?: number
  retryDelay?: number
  autoRetry?: boolean
  onError?: (error: ErrorState) => void
  onRetry?: (retryCount: number) => void
  onMaxRetriesReached?: (error: ErrorState) => void
}

export interface UseErrorHandlerReturn {
  error: string | null
  errorCode: string | null
  isRetryable: boolean
  retryCount: number
  hasError: boolean
  setError: (error: string | null, errorCode?: string) => void
  handleError: (error: unknown) => void
  clearError: () => void
  retry: () => Promise<void>
  canRetry: boolean
  setRetryAction: (action: () => Promise<void>) => void
  executeWithErrorHandling: (action: () => Promise<void>) => Promise<void>
}

/**
 * Custom hook for centralized error handling with retry logic
 */
export const useErrorHandler = (options: ErrorHandlerOptions = {}): UseErrorHandlerReturn => {
  const {
    maxRetries = 3,
    retryDelay = 1000,
    autoRetry = false,
    onError,
    onRetry,
    onMaxRetriesReached
  } = options

  const [errorState, setErrorState] = useState<ErrorState>({
    error: null,
    errorCode: null,
    isRetryable: false,
    retryCount: 0,
    lastError: null
  })

  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastActionRef = useRef<(() => Promise<void>) | null>(null)

  /**
   * Determine if an error is retryable
   */
  const isErrorRetryable = useCallback((error: unknown, errorCode?: string): boolean => {
    if (errorCode) {
      const retryableErrorCodes = [
        ERROR_CODES.NETWORK_ERROR,
        ERROR_CODES.TIMEOUT_ERROR,
        ERROR_CODES.CONNECTION_FAILED,
        ERROR_CODES.LLM_RATE_LIMIT_ERROR,
        ERROR_CODES.MCP_CONNECTION_ERROR,
        ERROR_CODES.INTERNAL_SERVER_ERROR
      ]
      return retryableErrorCodes.includes(errorCode as any)
    }

    if (error instanceof NetworkError || error instanceof TimeoutError) {
      return true
    }

    if (error instanceof ApiClientError) {
      return error.statusCode >= 500 || error.statusCode === 429
    }

    return false
  }, [])

  /**
   * Extract error information from various error types
   */
  const extractErrorInfo = useCallback((error: unknown): { message: string; code: string } => {
    if (error instanceof ApiClientError) {
      return {
        message: error.message,
        code: error.code
      }
    }

    if (error instanceof Error) {
      // Try to infer error code from message
      const message = error.message.toLowerCase()
      
      if (message.includes('network') || message.includes('fetch')) {
        return {
          message: 'Network error: Please check your connection',
          code: ERROR_CODES.NETWORK_ERROR
        }
      }
      
      if (message.includes('timeout')) {
        return {
          message: 'Request timeout: Please try again',
          code: ERROR_CODES.TIMEOUT_ERROR
        }
      }
      
      if (message.includes('401') || message.includes('unauthorized')) {
        return {
          message: 'Authentication failed: Please check your credentials',
          code: ERROR_CODES.LLM_AUTHENTICATION_ERROR
        }
      }
      
      if (message.includes('429') || message.includes('rate limit')) {
        return {
          message: 'Rate limit exceeded: Please wait before trying again',
          code: ERROR_CODES.LLM_RATE_LIMIT_ERROR
        }
      }

      return {
        message: error.message,
        code: ERROR_CODES.UNKNOWN_ERROR
      }
    }

    return {
      message: 'An unexpected error occurred',
      code: ERROR_CODES.UNKNOWN_ERROR
    }
  }, [])

  /**
   * Set error state manually
   */
  const setError = useCallback((error: string | null, errorCode?: string) => {
    if (error === null) {
      setErrorState({
        error: null,
        errorCode: null,
        isRetryable: false,
        retryCount: 0,
        lastError: null
      })
      return
    }

    const newErrorState: ErrorState = {
      error,
      errorCode: errorCode || ERROR_CODES.UNKNOWN_ERROR,
      isRetryable: isErrorRetryable(null, errorCode),
      retryCount: 0,
      lastError: new Date()
    }

    setErrorState(newErrorState)
    onError?.(newErrorState)
  }, [isErrorRetryable, onError])

  /**
   * Handle error with automatic classification and retry logic
   */
  const handleError = useCallback((error: unknown) => {
    const { message, code } = extractErrorInfo(error)
    const isRetryable = isErrorRetryable(error, code)

    const newErrorState: ErrorState = {
      error: message,
      errorCode: code,
      isRetryable,
      retryCount: errorState.retryCount,
      lastError: new Date()
    }

    setErrorState(newErrorState)
    onError?.(newErrorState)

    // Auto-retry if enabled and error is retryable
    if (autoRetry && isRetryable && newErrorState.retryCount < maxRetries) {
      retryTimeoutRef.current = setTimeout(() => {
        retry()
      }, retryDelay * Math.pow(2, newErrorState.retryCount)) // Exponential backoff
    }
  }, [errorState.retryCount, extractErrorInfo, isErrorRetryable, onError, autoRetry, maxRetries, retryDelay])

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current)
      retryTimeoutRef.current = null
    }

    setErrorState({
      error: null,
      errorCode: null,
      isRetryable: false,
      retryCount: 0,
      lastError: null
    })
  }, [])

  /**
   * Retry the last failed action
   */
  const retry = useCallback(async () => {
    if (!errorState.isRetryable || errorState.retryCount >= maxRetries) {
      if (errorState.retryCount >= maxRetries) {
        onMaxRetriesReached?.(errorState)
      }
      return
    }

    const newRetryCount = errorState.retryCount + 1
    
    setErrorState(prev => ({
      ...prev,
      retryCount: newRetryCount
    }))

    onRetry?.(newRetryCount)

    // Execute the last action if available
    if (lastActionRef.current) {
      try {
        await lastActionRef.current()
        clearError()
      } catch (error) {
        handleError(error)
      }
    }
  }, [errorState, maxRetries, onMaxRetriesReached, onRetry, clearError, handleError])

  /**
   * Set the action to retry
   */
  const setRetryAction = useCallback((action: () => Promise<void>) => {
    lastActionRef.current = action
  }, [])

  /**
   * Execute an action with error handling
   */
  const executeWithErrorHandling = useCallback(async (action: () => Promise<void>) => {
    lastActionRef.current = action
    clearError()
    
    try {
      await action()
    } catch (error) {
      handleError(error)
    }
  }, [clearError, handleError])

  const canRetry = errorState.isRetryable && errorState.retryCount < maxRetries

  return {
    error: errorState.error,
    errorCode: errorState.errorCode,
    isRetryable: errorState.isRetryable,
    retryCount: errorState.retryCount,
    hasError: errorState.error !== null,
    setError,
    handleError,
    clearError,
    retry,
    canRetry,
    setRetryAction,
    executeWithErrorHandling
  }
}

export default useErrorHandler