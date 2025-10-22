// useSessionPersistence Hook - Manage conversation persistence during session

import { useState, useEffect, useCallback } from 'react'
import { Message } from '@/types'

export interface SessionData {
  conversationId?: string
  messages: Message[]
  timestamp: number
}

export interface UseSessionPersistenceOptions {
  storageKey?: string
  maxAge?: number // Maximum age in milliseconds
  autoSave?: boolean
}

export interface UseSessionPersistenceReturn {
  sessionData: SessionData | null
  saveSession: (data: SessionData) => void
  loadSession: () => SessionData | null
  clearSession: () => void
  isSessionValid: (data: SessionData) => boolean
}

/**
 * Custom hook for managing conversation persistence during browser session
 */
export const useSessionPersistence = (
  options: UseSessionPersistenceOptions = {}
): UseSessionPersistenceReturn => {
  const {
    storageKey = 'mcpchat-session',
    maxAge = 24 * 60 * 60 * 1000, // 24 hours default
    autoSave = true
  } = options

  const [sessionData, setSessionData] = useState<SessionData | null>(null)

  /**
   * Check if session data is valid (not expired)
   */
  const isSessionValid = useCallback((data: SessionData): boolean => {
    const now = Date.now()
    return (now - data.timestamp) < maxAge
  }, [maxAge])

  /**
   * Load session data from sessionStorage
   */
  const loadSession = useCallback((): SessionData | null => {
    try {
      if (typeof window === 'undefined') return null
      
      const stored = sessionStorage.getItem(storageKey)
      if (!stored) return null

      const data: SessionData = JSON.parse(stored)
      
      // Validate session age
      if (!isSessionValid(data)) {
        sessionStorage.removeItem(storageKey)
        return null
      }

      // Parse message timestamps back to Date objects
      const messages = data.messages.map(msg => ({
        ...msg,
        timestamp: new Date(msg.timestamp)
      }))

      const sessionData = { ...data, messages }
      setSessionData(sessionData)
      return sessionData

    } catch (error) {
      console.warn('Failed to load session data:', error)
      sessionStorage.removeItem(storageKey)
      return null
    }
  }, [storageKey, isSessionValid])

  /**
   * Save session data to sessionStorage
   */
  const saveSession = useCallback((data: SessionData) => {
    try {
      if (typeof window === 'undefined') return
      
      const dataToStore = {
        ...data,
        timestamp: Date.now()
      }

      sessionStorage.setItem(storageKey, JSON.stringify(dataToStore))
      setSessionData(dataToStore)

    } catch (error) {
      console.warn('Failed to save session data:', error)
    }
  }, [storageKey])

  /**
   * Clear session data
   */
  const clearSession = useCallback(() => {
    try {
      if (typeof window === 'undefined') return
      
      sessionStorage.removeItem(storageKey)
      setSessionData(null)

    } catch (error) {
      console.warn('Failed to clear session data:', error)
    }
  }, [storageKey])

  // Load session data on mount
  useEffect(() => {
    loadSession()
  }, [loadSession])

  // Auto-save session data when it changes
  useEffect(() => {
    if (autoSave && sessionData) {
      const timeoutId = setTimeout(() => {
        saveSession(sessionData)
      }, 1000) // Debounce saves

      return () => clearTimeout(timeoutId)
    }
  }, [sessionData, autoSave, saveSession])

  return {
    sessionData,
    saveSession,
    loadSession,
    clearSession,
    isSessionValid
  }
}

export default useSessionPersistence