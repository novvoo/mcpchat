// Loading State Hook - Manage loading states across the application

import { useState, useCallback, useRef } from 'react'

export interface LoadingStateItem {
  id: string
  message?: string
  progress?: number
  startTime: Date
  category?: 'api' | 'tool' | 'ui' | 'system'
}

export interface UseLoadingStateReturn {
  loadingStates: Record<string, LoadingStateItem>
  isLoading: boolean
  isLoadingCategory: (category: string) => boolean
  startLoading: (id: string, message?: string, category?: LoadingStateItem['category']) => void
  updateLoading: (id: string, updates: Partial<LoadingStateItem>) => void
  stopLoading: (id: string) => void
  clearAllLoading: () => void
  getLoadingDuration: (id: string) => number | null
  getLoadingByCategory: (category: string) => LoadingStateItem[]
}

/**
 * Custom hook for managing loading states with categories and progress tracking
 */
export const useLoadingState = (): UseLoadingStateReturn => {
  const [loadingStates, setLoadingStates] = useState<Record<string, LoadingStateItem>>({})
  const timeoutRefs = useRef<Record<string, NodeJS.Timeout>>({})

  /**
   * Start a loading state
   */
  const startLoading = useCallback((
    id: string, 
    message?: string, 
    category: LoadingStateItem['category'] = 'ui'
  ) => {
    setLoadingStates(prev => ({
      ...prev,
      [id]: {
        id,
        message,
        category,
        startTime: new Date(),
        progress: 0
      }
    }))

    // Auto-cleanup after 5 minutes to prevent memory leaks
    timeoutRefs.current[id] = setTimeout(() => {
      stopLoading(id)
    }, 5 * 60 * 1000)
  }, [])

  /**
   * Update a loading state
   */
  const updateLoading = useCallback((id: string, updates: Partial<LoadingStateItem>) => {
    setLoadingStates(prev => {
      if (!prev[id]) return prev
      
      return {
        ...prev,
        [id]: {
          ...prev[id],
          ...updates
        }
      }
    })
  }, [])

  /**
   * Stop a loading state
   */
  const stopLoading = useCallback((id: string) => {
    setLoadingStates(prev => {
      const { [id]: removed, ...rest } = prev
      return rest
    })

    // Clear timeout
    if (timeoutRefs.current[id]) {
      clearTimeout(timeoutRefs.current[id])
      delete timeoutRefs.current[id]
    }
  }, [])

  /**
   * Clear all loading states
   */
  const clearAllLoading = useCallback(() => {
    // Clear all timeouts
    Object.values(timeoutRefs.current).forEach(timeout => clearTimeout(timeout))
    timeoutRefs.current = {}
    
    setLoadingStates({})
  }, [])

  /**
   * Check if any loading state is active
   */
  const isLoading = Object.keys(loadingStates).length > 0

  /**
   * Check if any loading state in a category is active
   */
  const isLoadingCategory = useCallback((category: string) => {
    return Object.values(loadingStates).some(state => state.category === category)
  }, [loadingStates])

  /**
   * Get loading duration for a specific state
   */
  const getLoadingDuration = useCallback((id: string): number | null => {
    const state = loadingStates[id]
    if (!state) return null
    
    return Date.now() - state.startTime.getTime()
  }, [loadingStates])

  /**
   * Get all loading states by category
   */
  const getLoadingByCategory = useCallback((category: string): LoadingStateItem[] => {
    return Object.values(loadingStates).filter(state => state.category === category)
  }, [loadingStates])

  return {
    loadingStates,
    isLoading,
    isLoadingCategory,
    startLoading,
    updateLoading,
    stopLoading,
    clearAllLoading,
    getLoadingDuration,
    getLoadingByCategory
  }
}

/**
 * Hook for managing API loading states specifically
 */
export const useApiLoadingState = () => {
  const {
    loadingStates,
    isLoading,
    startLoading: baseStartLoading,
    updateLoading,
    stopLoading,
    clearAllLoading,
    getLoadingDuration
  } = useLoadingState()

  const startApiLoading = useCallback((
    endpoint: string, 
    method: string = 'GET',
    message?: string
  ) => {
    const id = `api_${method}_${endpoint.replace(/[^a-zA-Z0-9]/g, '_')}`
    baseStartLoading(id, message || `${method} ${endpoint}`, 'api')
    return id
  }, [baseStartLoading])

  const apiLoadingStates = Object.values(loadingStates).filter(state => state.category === 'api')

  return {
    apiLoadingStates,
    isApiLoading: apiLoadingStates.length > 0,
    startApiLoading,
    updateLoading,
    stopLoading,
    clearAllLoading,
    getLoadingDuration
  }
}

/**
 * Hook for managing tool execution loading states
 */
export const useToolLoadingState = () => {
  const {
    loadingStates,
    isLoading,
    startLoading: baseStartLoading,
    updateLoading,
    stopLoading,
    clearAllLoading,
    getLoadingDuration
  } = useLoadingState()

  const startToolLoading = useCallback((
    toolName: string,
    message?: string
  ) => {
    const id = `tool_${toolName.replace(/[^a-zA-Z0-9]/g, '_')}`
    baseStartLoading(id, message || `Executing ${toolName}`, 'tool')
    return id
  }, [baseStartLoading])

  const toolLoadingStates = Object.values(loadingStates).filter(state => state.category === 'tool')

  return {
    toolLoadingStates,
    isToolLoading: toolLoadingStates.length > 0,
    startToolLoading,
    updateLoading,
    stopLoading,
    clearAllLoading,
    getLoadingDuration
  }
}

export default useLoadingState