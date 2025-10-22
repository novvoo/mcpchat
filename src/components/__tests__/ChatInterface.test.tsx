import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChatInterface } from '../ChatInterface'
import { Message } from '@/types'

// Mock all the child components and hooks
jest.mock('../MessageInput', () => ({
  MessageInput: ({ onSubmit, disabled, placeholder }: any) => (
    <div data-testid="message-input">
      <input
        data-testid="input-field"
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => {}}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && e.currentTarget.value.trim()) {
            onSubmit(e.currentTarget.value.trim())
            e.currentTarget.value = ''
          }
        }}
      />
      <button
        data-testid="submit-button"
        disabled={disabled}
        onClick={() => {
          const input = document.querySelector('[data-testid="input-field"]') as HTMLInputElement
          if (input?.value.trim()) {
            onSubmit(input.value.trim())
            input.value = ''
          }
        }}
      >
        Send
      </button>
    </div>
  )
}))

jest.mock('../MessageList', () => ({
  MessageList: React.forwardRef(({ messages, isLoading, onMessageClick, onToolCallClick }: any, ref: any) => (
    <div data-testid="message-list">
      {messages.map((msg: Message) => (
        <div
          key={msg.id}
          data-testid={`message-${msg.id}`}
          onClick={() => onMessageClick?.(msg)}
        >
          <span data-testid="message-role">{msg.role}</span>
          <span data-testid="message-content">{msg.content}</span>
          {msg.toolCalls?.map((tool, idx) => (
            <div
              key={idx}
              data-testid={`tool-call-${tool.id}`}
              onClick={(e) => {
                e.stopPropagation()
                onToolCallClick?.(tool)
              }}
            >
              {tool.name}
            </div>
          ))}
        </div>
      ))}
      {isLoading && <div data-testid="loading">Loading...</div>}
    </div>
  ))
}))

jest.mock('../EmptyState', () => ({
  ErrorState: ({ title, message, onRetry }: any) => (
    <div data-testid="error-state">
      <h2>{title}</h2>
      <p>{message}</p>
      {onRetry && <button onClick={onRetry}>Retry</button>}
    </div>
  )
}))

jest.mock('../ErrorNotification', () => ({
  ErrorNotification: ({ error, onDismiss, onRetry }: any) => (
    error ? (
      <div data-testid="error-notification">
        <span>{error}</span>
        {onDismiss && <button onClick={onDismiss}>Dismiss</button>}
        {onRetry && <button onClick={onRetry}>Retry</button>}
      </div>
    ) : null
  )
}))

jest.mock('../ConnectionStatus', () => ({
  ConnectionStatus: ({ showDetails }: any) => (
    <div data-testid="connection-status">
      {showDetails ? 'Connected' : 'Status'}
    </div>
  )
}))

jest.mock('../StatusBar', () => ({
  StatusBar: ({ isProcessing, processingMessage }: any) => (
    <div data-testid="status-bar">
      {isProcessing && <span>{processingMessage}</span>}
    </div>
  )
}))

jest.mock('@/hooks/useChat', () => ({
  useChat: jest.fn(() => ({
    messages: [],
    isLoading: false,
    error: null,
    sendMessage: jest.fn(),
    clearMessages: jest.fn(),
    retryLastMessage: jest.fn(),
    setError: jest.fn(),
    conversationId: 'test-conversation'
  }))
}))

jest.mock('@/hooks/useErrorHandler', () => ({
  useErrorHandler: jest.fn(() => ({
    error: null,
    errorCode: null,
    handleError: jest.fn(),
    clearError: jest.fn(),
    retry: jest.fn(),
    canRetry: false,
    executeWithErrorHandling: jest.fn((fn) => fn())
  }))
}))

const { useChat } = require('@/hooks/useChat')
const { useErrorHandler } = require('@/hooks/useErrorHandler')

describe('ChatInterface', () => {
  const mockMessages: Message[] = [
    {
      id: '1',
      role: 'user',
      content: 'Hello',
      timestamp: new Date()
    },
    {
      id: '2',
      role: 'assistant',
      content: 'Hi there!',
      timestamp: new Date()
    }
  ]

  const mockSendMessage = jest.fn()
  const mockClearMessages = jest.fn()
  const mockRetryLastMessage = jest.fn()
  const mockSetError = jest.fn()
  const mockHandleError = jest.fn()
  const mockClearError = jest.fn()
  const mockExecuteWithErrorHandling = jest.fn((fn) => fn())

  beforeEach(() => {
    jest.clearAllMocks()
    
    useChat.mockReturnValue({
      messages: [],
      isLoading: false,
      error: null,
      sendMessage: mockSendMessage,
      clearMessages: mockClearMessages,
      retryLastMessage: mockRetryLastMessage,
      setError: mockSetError,
      conversationId: 'test-conversation'
    })

    useErrorHandler.mockReturnValue({
      error: null,
      errorCode: null,
      handleError: mockHandleError,
      clearError: mockClearError,
      retry: jest.fn(),
      canRetry: false,
      executeWithErrorHandling: mockExecuteWithErrorHandling
    })
  })

  it('renders with default props', () => {
    render(<ChatInterface />)
    
    expect(screen.getByText('MCP Chat')).toBeInTheDocument()
    expect(screen.getByText('Start a conversation with AI tools')).toBeInTheDocument()
    expect(screen.getByTestId('message-input')).toBeInTheDocument()
    expect(screen.getByTestId('message-list')).toBeInTheDocument()
    expect(screen.getByTestId('connection-status')).toBeInTheDocument()
    expect(screen.getByTestId('status-bar')).toBeInTheDocument()
  })

  it('displays messages from useChat hook', () => {
    useChat.mockReturnValue({
      messages: mockMessages,
      isLoading: false,
      error: null,
      sendMessage: mockSendMessage,
      clearMessages: mockClearMessages,
      retryLastMessage: mockRetryLastMessage,
      setError: mockSetError,
      conversationId: 'test-conversation'
    })

    render(<ChatInterface />)
    
    expect(screen.getByTestId('message-1')).toBeInTheDocument()
    expect(screen.getByTestId('message-2')).toBeInTheDocument()
    expect(screen.getByText('Hello')).toBeInTheDocument()
    expect(screen.getByText('Hi there!')).toBeInTheDocument()
  })

  it('shows message count in header', () => {
    useChat.mockReturnValue({
      messages: mockMessages,
      isLoading: false,
      error: null,
      sendMessage: mockSendMessage,
      clearMessages: mockClearMessages,
      retryLastMessage: mockRetryLastMessage,
      setError: mockSetError,
      conversationId: 'test-conversation'
    })

    render(<ChatInterface />)
    
    expect(screen.getByText('2 messages')).toBeInTheDocument()
  })

  it('handles message submission via useChat hook', async () => {
    const user = userEvent.setup()
    render(<ChatInterface />)
    
    const input = screen.getByTestId('input-field')
    const submitButton = screen.getByTestId('submit-button')
    
    await user.type(input, 'Test message')
    await user.click(submitButton)
    
    expect(mockExecuteWithErrorHandling).toHaveBeenCalled()
    expect(mockSendMessage).toHaveBeenCalledWith('Test message')
  })

  it('handles message submission via onSendMessage prop', async () => {
    const mockOnSendMessage = jest.fn()
    const user = userEvent.setup()
    
    render(<ChatInterface onSendMessage={mockOnSendMessage} />)
    
    const input = screen.getByTestId('input-field')
    const submitButton = screen.getByTestId('submit-button')
    
    await user.type(input, 'Test message')
    await user.click(submitButton)
    
    expect(mockExecuteWithErrorHandling).toHaveBeenCalled()
    expect(mockOnSendMessage).toHaveBeenCalledWith('Test message')
  })

  it('disables input when loading', () => {
    useChat.mockReturnValue({
      messages: [],
      isLoading: true,
      error: null,
      sendMessage: mockSendMessage,
      clearMessages: mockClearMessages,
      retryLastMessage: mockRetryLastMessage,
      setError: mockSetError,
      conversationId: 'test-conversation'
    })

    render(<ChatInterface />)
    
    const input = screen.getByTestId('input-field')
    const submitButton = screen.getByTestId('submit-button')
    
    expect(input).toBeDisabled()
    expect(submitButton).toBeDisabled()
  })

  it('disables input when disabled prop is true', () => {
    render(<ChatInterface disabled={true} />)
    
    const input = screen.getByTestId('input-field')
    const submitButton = screen.getByTestId('submit-button')
    
    expect(input).toBeDisabled()
    expect(submitButton).toBeDisabled()
  })

  it('shows loading state in status bar', () => {
    useChat.mockReturnValue({
      messages: [],
      isLoading: true,
      error: null,
      sendMessage: mockSendMessage,
      clearMessages: mockClearMessages,
      retryLastMessage: mockRetryLastMessage,
      setError: mockSetError,
      conversationId: 'test-conversation'
    })

    render(<ChatInterface />)
    
    expect(screen.getByText('AI is thinking...')).toBeInTheDocument()
  })

  it('handles message click events', () => {
    const mockOnMessageClick = jest.fn()
    
    useChat.mockReturnValue({
      messages: mockMessages,
      isLoading: false,
      error: null,
      sendMessage: mockSendMessage,
      clearMessages: mockClearMessages,
      retryLastMessage: mockRetryLastMessage,
      setError: mockSetError,
      conversationId: 'test-conversation'
    })

    render(<ChatInterface onMessageClick={mockOnMessageClick} />)
    
    const message = screen.getByTestId('message-1')
    fireEvent.click(message)
    
    expect(mockOnMessageClick).toHaveBeenCalledWith(mockMessages[0])
  })

  it('handles tool call click events', () => {
    const mockOnToolCallClick = jest.fn()
    const messageWithTool: Message = {
      id: '3',
      role: 'assistant',
      content: 'Tool executed',
      timestamp: new Date(),
      toolCalls: [{
        id: 'tool1',
        name: 'test_tool',
        parameters: {}
      }]
    }
    
    useChat.mockReturnValue({
      messages: [messageWithTool],
      isLoading: false,
      error: null,
      sendMessage: mockSendMessage,
      clearMessages: mockClearMessages,
      retryLastMessage: mockRetryLastMessage,
      setError: mockSetError,
      conversationId: 'test-conversation'
    })

    render(<ChatInterface onToolCallClick={mockOnToolCallClick} />)
    
    const toolCall = screen.getByTestId('tool-call-tool1')
    fireEvent.click(toolCall)
    
    expect(mockOnToolCallClick).toHaveBeenCalledWith(messageWithTool.toolCalls![0])
  })

  it('shows clear conversation button when messages exist', () => {
    useChat.mockReturnValue({
      messages: mockMessages,
      isLoading: false,
      error: null,
      sendMessage: mockSendMessage,
      clearMessages: mockClearMessages,
      retryLastMessage: mockRetryLastMessage,
      setError: mockSetError,
      conversationId: 'test-conversation'
    })

    render(<ChatInterface />)
    
    const clearButton = screen.getByTitle('Clear conversation')
    expect(clearButton).toBeInTheDocument()
  })

  it('clears conversation when clear button is clicked', () => {
    useChat.mockReturnValue({
      messages: mockMessages,
      isLoading: false,
      error: null,
      sendMessage: mockSendMessage,
      clearMessages: mockClearMessages,
      retryLastMessage: mockRetryLastMessage,
      setError: mockSetError,
      conversationId: 'test-conversation'
    })

    render(<ChatInterface />)
    
    const clearButton = screen.getByTitle('Clear conversation')
    fireEvent.click(clearButton)
    
    expect(mockClearMessages).toHaveBeenCalled()
    expect(mockClearError).toHaveBeenCalled()
    expect(mockSetError).toHaveBeenCalledWith(null)
  })

  it('displays error notification when there is an error', () => {
    useErrorHandler.mockReturnValue({
      error: 'Test error',
      errorCode: 'TEST_ERROR',
      handleError: mockHandleError,
      clearError: mockClearError,
      retry: jest.fn(),
      canRetry: true,
      executeWithErrorHandling: mockExecuteWithErrorHandling
    })

    render(<ChatInterface />)
    
    expect(screen.getByTestId('error-notification')).toBeInTheDocument()
    expect(screen.getByText('Test error')).toBeInTheDocument()
  })

  it('shows error state when there is an error and no messages', () => {
    useErrorHandler.mockReturnValue({
      error: 'Connection failed',
      errorCode: 'CONNECTION_ERROR',
      handleError: mockHandleError,
      clearError: mockClearError,
      retry: jest.fn(),
      canRetry: true,
      executeWithErrorHandling: mockExecuteWithErrorHandling
    })

    render(<ChatInterface />)
    
    expect(screen.getByTestId('error-state')).toBeInTheDocument()
    expect(screen.getByText('Connection Error')).toBeInTheDocument()
    expect(screen.getByText('Connection failed')).toBeInTheDocument()
  })

  it('passes custom placeholder to MessageInput', () => {
    render(<ChatInterface placeholder="Custom placeholder" />)
    
    const input = screen.getByTestId('input-field')
    expect(input).toHaveAttribute('placeholder', 'Custom placeholder')
  })

  it('handles error callback prop', async () => {
    const mockOnError = jest.fn()
    
    useErrorHandler.mockReturnValue({
      error: null,
      errorCode: null,
      handleError: mockHandleError,
      clearError: mockClearError,
      retry: jest.fn(),
      canRetry: false,
      executeWithErrorHandling: mockExecuteWithErrorHandling
    })

    render(<ChatInterface onError={mockOnError} />)
    
    // The error handler should be configured to call onError
    expect(useErrorHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        onError: expect.any(Function)
      })
    )
  })

  it('shows scroll to top button when messages exist', () => {
    useChat.mockReturnValue({
      messages: mockMessages,
      isLoading: false,
      error: null,
      sendMessage: mockSendMessage,
      clearMessages: mockClearMessages,
      retryLastMessage: mockRetryLastMessage,
      setError: mockSetError,
      conversationId: 'test-conversation'
    })

    render(<ChatInterface />)
    
    const scrollButton = screen.getByTitle('Scroll to top')
    expect(scrollButton).toBeInTheDocument()
  })

  it('applies custom className', () => {
    const { container } = render(<ChatInterface className="custom-class" />)
    
    expect(container.firstChild).toHaveClass('custom-class')
  })
})