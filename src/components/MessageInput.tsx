'use client'

// MessageInput Component - Text input for chat messages

import React, { useState, useRef, useEffect, KeyboardEvent, FormEvent } from 'react'
import { MessageInputProps } from '@/types'
import { LoadingIndicator } from './LoadingIndicator'

/**
 * MessageInput component for chat message input
 */
export const MessageInput: React.FC<MessageInputProps> = ({
  onSubmit,
  disabled = false,
  placeholder = "Type your message...",
  maxLength = 10000,
  autoFocus = false,
  showCharCount = false,
  multiline = true,
  className = ""
}) => {
  const [message, setMessage] = useState('')
  const [isComposing, setIsComposing] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-focus on mount if requested
  useEffect(() => {
    if (autoFocus) {
      if (multiline && textareaRef.current) {
        textareaRef.current.focus()
      } else if (!multiline && inputRef.current) {
        inputRef.current.focus()
      }
    }
  }, [autoFocus, multiline])

  // Auto-resize textarea
  useEffect(() => {
    if (multiline && textareaRef.current) {
      const textarea = textareaRef.current
      textarea.style.height = 'auto'
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`
    }
  }, [message, multiline])

  /**
   * Handle form submission
   */
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    submitMessage()
  }

  /**
   * Submit the message
   */
  const submitMessage = () => {
    const trimmedMessage = message.trim()
    
    if (!trimmedMessage || disabled || isComposing) {
      return
    }

    if (trimmedMessage.length > maxLength) {
      return
    }

    onSubmit(trimmedMessage)
    setMessage('')
    
    // Reset textarea height
    if (multiline && textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  /**
   * Handle keyboard events
   */
  const handleKeyDown = (e: KeyboardEvent) => {
    // Don't handle shortcuts during IME composition
    if (isComposing) {
      return
    }

    // Enter to submit (Shift+Enter for new line in multiline mode)
    if (e.key === 'Enter') {
      if (multiline && e.shiftKey) {
        // Allow new line
        return
      } else if (!multiline || !e.shiftKey) {
        e.preventDefault()
        submitMessage()
      }
    }

    // Escape to clear
    if (e.key === 'Escape') {
      setMessage('')
      if (multiline && textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
    }
  }

  /**
   * Handle input change
   */
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    const value = e.target.value
    
    // Enforce max length
    if (value.length <= maxLength) {
      setMessage(value)
    }
  }

  /**
   * Handle composition events (for IME input)
   */
  const handleCompositionStart = () => {
    setIsComposing(true)
  }

  const handleCompositionEnd = () => {
    setIsComposing(false)
  }

  /**
   * Check if message is valid
   */
  const isMessageValid = () => {
    const trimmed = message.trim()
    return trimmed.length > 0 && trimmed.length <= maxLength
  }

  /**
   * Get character count info
   */
  const getCharCountInfo = () => {
    const count = message.length
    const isNearLimit = count > maxLength * 0.8
    const isOverLimit = count > maxLength
    
    return {
      count,
      max: maxLength,
      isNearLimit,
      isOverLimit,
      remaining: maxLength - count
    }
  }

  const charInfo = getCharCountInfo()

  return (
    <div className={`w-full ${className}`}>
      <form onSubmit={handleSubmit} className="w-full">
        <div className="flex items-end gap-2 sm:gap-3 p-2 sm:p-3 border-2 border-border rounded-xl bg-input transition-all duration-200 focus-within:border-ring focus-within:shadow-lg focus-within:shadow-ring/20 hover:shadow-md hover:border-ring/50">
          {multiline ? (
            <textarea
              ref={textareaRef}
              value={message}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onCompositionStart={handleCompositionStart}
              onCompositionEnd={handleCompositionEnd}
              placeholder={placeholder}
              disabled={disabled}
              className={`flex-1 border-none outline-none text-sm sm:text-base leading-6 font-inherit bg-transparent resize-none placeholder-muted-foreground text-foreground ${
                disabled ? 'opacity-60 cursor-not-allowed' : ''
              } ${charInfo.isOverLimit ? 'text-destructive' : ''}`}
              rows={1}
              style={{
                minHeight: '36px',
                maxHeight: '160px',
                overflow: 'auto'
              }}
            />
          ) : (
            <input
              ref={inputRef}
              type="text"
              value={message}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onCompositionStart={handleCompositionStart}
              onCompositionEnd={handleCompositionEnd}
              placeholder={placeholder}
              disabled={disabled}
              className={`flex-1 border-none outline-none text-sm sm:text-base leading-6 font-inherit bg-transparent placeholder-muted-foreground text-foreground ${
                disabled ? 'opacity-60 cursor-not-allowed' : ''
              } ${charInfo.isOverLimit ? 'text-destructive' : ''}`}
              style={{ minHeight: '36px' }}
            />
          )}
          
          <button
            type="submit"
            disabled={disabled || !isMessageValid() || isComposing}
            className={`flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 border-none rounded-lg transition-all duration-200 flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
              disabled || !isMessageValid() || isComposing
                ? 'bg-muted text-muted-foreground cursor-not-allowed'
                : 'bg-primary text-primary-foreground cursor-pointer hover:bg-primary/90 hover:scale-105 active:scale-95'
            }`}
            title={disabled ? "Processing..." : "Send message (Enter)"}
            aria-label={disabled ? "Processing message" : "Send message"}
          >
            {disabled ? (
              <LoadingIndicator variant="spinner" size="sm" color="gray" />
            ) : (
              <SendIcon />
            )}
          </button>
        </div>

        {showCharCount && (
          <div className={`text-xs text-right mt-1 px-1 transition-colors ${
            charInfo.isNearLimit ? 'text-yellow-500' : charInfo.isOverLimit ? 'text-destructive' : 'text-muted-foreground'
          }`}>
            {charInfo.count}/{charInfo.max}
            {charInfo.isOverLimit && (
              <span className="font-medium"> - Message too long</span>
            )}
          </div>
        )}
      </form>
    </div>
  )
}

/**
 * Send icon component
 */
const SendIcon: React.FC = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="22" y1="2" x2="11" y2="13"></line>
    <polygon points="22,2 15,22 11,13 2,9"></polygon>
  </svg>
)

export default MessageInput