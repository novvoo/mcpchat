// useChat Hook - Manage chat state and API interactions

import { useState, useCallback, useRef, useEffect } from 'react'
import { Message } from '@/types'
import { chatApi, ApiClientError, NetworkError, TimeoutError } from '@/services/api-client'
import { useSessionPersistence } from './useSessionPersistence'

export interface UseChatOptions {
  initialMessages?: Message[]
  apiKey?: string
  conversationId?: string
  onError?: (error: string) => void
  onMessageSent?: (message: Message) => void
  onResponseReceived?: (message: Message) => void
  enableSessionPersistence?: boolean
  sessionStorageKey?: string
}

export interface UseChatReturn {
  messages: Message[]
  isLoading: boolean
  error: string | null
  sendMessage: (content: string) => Promise<void>
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => Message
  updateMessage: (messageId: string, updates: Partial<Message>) => void
  clearMessages: () => void
  retryLastMessage: () => Promise<void>
  setError: (error: string | null) => void
  conversationId: string | undefined
}

/**
 * Custom hook for managing chat state and interactions
 */
export const useChat = (options: UseChatOptions = {}): UseChatReturn => {
  const {
    initialMessages = [],
    apiKey,
    conversationId: initialConversationId,
    onError,
    onMessageSent,
    onResponseReceived,
    enableSessionPersistence = true,
    sessionStorageKey = 'mcpchat-session'
  } = options

  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [conversationId, setConversationId] = useState<string | undefined>(initialConversationId)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Session persistence
  const { sessionData, saveSession, clearSession } = useSessionPersistence({
    storageKey: sessionStorageKey,
    autoSave: false // We'll manually save to control when
  })

  // Load session data on mount if enabled and no initial messages provided
  useEffect(() => {
    if (enableSessionPersistence && initialMessages.length === 0 && sessionData) {
      setMessages(sessionData.messages)
      if (sessionData.conversationId && !initialConversationId) {
        setConversationId(sessionData.conversationId)
      }
    }
  }, [enableSessionPersistence, initialMessages.length, sessionData, initialConversationId])

  // Save session data when messages or conversationId changes
  useEffect(() => {
    if (enableSessionPersistence && messages.length > 0) {
      saveSession({
        messages,
        conversationId,
        timestamp: Date.now()
      })
    }
  }, [enableSessionPersistence, messages, conversationId, saveSession])

  /**
   * Generate unique message ID
   */
  const generateMessageId = useCallback((): string => {
    return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
  }, [])

  /**
   * Add message to the conversation
   */
  const addMessage = useCallback((message: Omit<Message, 'id' | 'timestamp'>) => {
    const newMessage: Message = {
      ...message,
      id: generateMessageId(),
      timestamp: new Date()
    }
    
    setMessages(prev => [...prev, newMessage])
    return newMessage
  }, [generateMessageId])

  /**
   * Update existing message
   */
  const updateMessage = useCallback((messageId: string, updates: Partial<Message>) => {
    setMessages(prev => prev.map(msg => 
      msg.id === messageId ? { ...msg, ...updates } : msg
    ))
  }, [])

  /**
   * Clear all messages
   */
  const clearMessages = useCallback(() => {
    setMessages([])
    setError(null)
    setConversationId(undefined)
    
    // Clear session data if persistence is enabled
    if (enableSessionPersistence) {
      clearSession()
    }
  }, [enableSessionPersistence, clearSession])

  /**
   * Send message to chat API
   */
  const sendMessage = useCallback(async (content: string) => {
    try {
      setError(null)
      setIsLoading(true)

      // Cancel any ongoing request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }

      // Create new abort controller
      abortControllerRef.current = new AbortController()

      // Add user message immediately
      const userMessage = addMessage({
        role: 'user',
        content
      })

      onMessageSent?.(userMessage)

      // Send to API using the new API client
      const response = await chatApi.sendMessage(
        {
          message: content,
          conversationId,
          apiKey,
          enableTools: true
        },
        {
          signal: abortControllerRef.current.signal
        }
      )
      
      if (response.success && response.data) {
        // Update conversation ID if provided
        if (response.data.conversationId) {
          setConversationId(response.data.conversationId)
        }

        // Add assistant response
        const assistantMessage = addMessage({
          role: 'assistant',
          content: response.data.response,
          toolCalls: response.data.toolCalls
        })

        onResponseReceived?.(assistantMessage)
      } else {
        throw new Error(response.error?.message || 'Failed to get response')
      }

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        // Request was cancelled, don't show error
        return
      }

      let errorMessage: string
      
      // Handle different error types
      if (error instanceof ApiClientError) {
        errorMessage = error.message
        
        // Add specific handling for different error types
        if (error instanceof NetworkError) {
          errorMessage = 'Network error: Please check your connection and try again'
        } else if (error instanceof TimeoutError) {
          errorMessage = 'Request timeout: The server took too long to respond'
        } else if (error.code === 'LLM_AUTHENTICATION_ERROR') {
          errorMessage = 'Authentication failed: Please check your API key'
        } else if (error.code === 'LLM_RATE_LIMIT_ERROR') {
          errorMessage = 'Rate limit exceeded: Please wait a moment before trying again'
        }
      } else {
        errorMessage = error instanceof Error ? error.message : 'Failed to send message'
      }

      setError(errorMessage)
      onError?.(errorMessage)
      
      // Add error message to chat
      addMessage({
        role: 'system',
        content: `Error: ${errorMessage}`
      })
    } finally {
      setIsLoading(false)
      abortControllerRef.current = null
    }
  }, [conversationId, apiKey, addMessage, onError, onMessageSent, onResponseReceived])

  /**
   * Retry the last user message
   */
  const retryLastMessage = useCallback(async () => {
    const lastUserMessage = [...messages].reverse().find(msg => msg.role === 'user')
    if (lastUserMessage) {
      await sendMessage(lastUserMessage.content)
    }
  }, [messages, sendMessage])

  /**
   * Set error state
   */
  const setErrorState = useCallback((error: string | null) => {
    setError(error)
  }, [])

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    addMessage,
    updateMessage,
    clearMessages,
    retryLastMessage,
    setError: setErrorState,
    conversationId
  }
}

export default useChat