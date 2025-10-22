'use client'

// ChatInterface Component - Main chat interface combining input and message list

import React, { useRef, useCallback, useEffect } from 'react'
import { ChatInterfaceProps, Message, ToolCall } from '@/types'
import { MessageInput } from './MessageInput'
import { MessageList, MessageListHandle } from './MessageList'
import { ErrorState } from './EmptyState'
import { ErrorNotification } from './ErrorNotification'
import { ConnectionStatus } from './ConnectionStatus'
import { LoadingIndicator } from './LoadingIndicator'
import { StatusBar } from './StatusBar'
import { useChat } from '@/hooks/useChat'
import { useErrorHandler } from '@/hooks/useErrorHandler'

/**
 * Main ChatInterface component
 */
export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  messages: initialMessages = [],
  onSendMessage,
  isLoading: externalLoading = false,
  disabled = false,
  showTimestamps = false,
  showAvatars = true,
  autoScroll = true,
  placeholder = "Type your message...",
  maxMessageLength = 10000,
  className = "",
  onMessageClick,
  onToolCallClick,
  onError,
  apiKey,
  conversationId: initialConversationId
}) => {
  const messageListRef = useRef<MessageListHandle>(null)

  // Enhanced error handling
  const {
    error: handlerError,
    errorCode,
    handleError,
    clearError,
    retry: retryError,
    canRetry,
    executeWithErrorHandling
  } = useErrorHandler({
    maxRetries: 3,
    autoRetry: false,
    onError: (errorState) => {
      onError?.(errorState.error || 'Unknown error')
    }
  })

  // Use the useChat hook for state management and API integration
  const {
    messages,
    isLoading: chatLoading,
    error: chatError,
    sendMessage,
    clearMessages,
    retryLastMessage,
    setError,
    conversationId
  } = useChat({
    initialMessages,
    apiKey,
    conversationId: initialConversationId,
    onError: (error) => {
      handleError(new Error(error))
    },
    onMessageSent: (message) => {
      // Scroll to bottom when user sends a message
      setTimeout(() => {
        messageListRef.current?.scrollToBottom()
      }, 100)
    },
    onResponseReceived: (message) => {
      // Scroll to bottom when response is received
      setTimeout(() => {
        messageListRef.current?.scrollToBottom()
      }, 100)
    }
  })

  // Combine errors from different sources
  const displayError = handlerError || chatError

  // Determine loading state (external or internal)
  const isLoadingState = externalLoading || chatLoading
  const inputDisabled = disabled || isLoadingState

  /**
   * Handle message submission with enhanced error handling
   */
  const handleSendMessage = useCallback(async (content: string) => {
    await executeWithErrorHandling(async () => {
      // Call the onSendMessage prop if provided, otherwise use the hook's sendMessage
      if (onSendMessage) {
        await onSendMessage(content)
      } else {
        await sendMessage(content)
      }
    })
  }, [onSendMessage, sendMessage, executeWithErrorHandling])

  /**
   * Handle message click
   */
  const handleMessageClick = useCallback((message: Message) => {
    onMessageClick?.(message)
  }, [onMessageClick])

  /**
   * Handle tool call click
   */
  const handleToolCallClick = useCallback((toolCall: ToolCall) => {
    onToolCallClick?.(toolCall)
  }, [onToolCallClick])

  /**
   * Clear conversation and errors
   */
  const clearConversation = useCallback(() => {
    clearMessages()
    clearError()
    setError(null)
  }, [clearMessages, clearError, setError])

  /**
   * Handle retry action
   */
  const handleRetry = useCallback(async () => {
    if (canRetry) {
      await retryError()
    } else {
      await retryLastMessage()
    }
  }, [canRetry, retryError, retryLastMessage])

  /**
   * Handle suggestion click from empty state
   */
  const handleSuggestionClick = useCallback((suggestion: string) => {
    handleSendMessage(suggestion)
  }, [handleSendMessage])

  // Show error state if there's a critical error
  if (displayError && messages.length === 0) {
    return (
      <div className={`flex flex-col h-full ${className}`}>
        <ErrorState
          title="Connection Error"
          message={displayError}
          onRetry={handleRetry}
        />
      </div>
    )
  }

  return (
    <div className={`flex flex-col h-full bg-white ${className}`}>
      {/* Header */}
      <div className="flex-shrink-0 border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div>
              <h1 className="text-lg font-semibold text-gray-900">MCP Chat</h1>
              <p className="text-sm text-gray-500">
                {messages.length === 0 
                  ? "Start a conversation with AI tools" 
                  : `${messages.length} message${messages.length !== 1 ? 's' : ''}`
                }
              </p>
            </div>
            
            {/* Connection Status */}
            <ConnectionStatus 
              showDetails={true}
              className="ml-3"
            />
          </div>
          
          {messages.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => messageListRef.current?.scrollToTop()}
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                title="Scroll to top"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                </svg>
              </button>
              
              <button
                onClick={clearConversation}
                className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                title="Clear conversation"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 min-h-0">
        <MessageList
          ref={messageListRef}
          messages={messages}
          isLoading={isLoadingState}
          showTimestamps={showTimestamps}
          showAvatars={showAvatars}
          autoScroll={autoScroll}
          onMessageClick={handleMessageClick}
          onToolCallClick={handleToolCallClick}
        />
      </div>

      {/* Enhanced Error Notification */}
      <ErrorNotification
        error={displayError}
        errorCode={errorCode || undefined}
        onDismiss={() => {
          clearError()
          setError(null)
        }}
        onRetry={canRetry ? handleRetry : undefined}
        position="top"
        autoHide={false}
      />

      {/* Input */}
      <div className="flex-shrink-0 border-t border-gray-200 p-4">
        <MessageInput
          onSubmit={handleSendMessage}
          disabled={inputDisabled}
          placeholder={placeholder}
          maxLength={maxMessageLength}
          autoFocus={messages.length === 0}
          showCharCount={maxMessageLength < 1000}
          multiline={true}
        />
      </div>

      {/* Status Bar */}
      <StatusBar
        isProcessing={isLoadingState}
        processingMessage={isLoadingState ? "AI is thinking..." : undefined}
        showConnectionStatus={true}
        showMCPStatus={true}
        showSystemInfo={false}
        position="bottom"
        variant="compact"
      />
    </div>
  )
}

export default ChatInterface