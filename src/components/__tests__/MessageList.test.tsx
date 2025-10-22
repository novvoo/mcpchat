import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { MessageList, MessageListHandle } from '../MessageList'
import { Message, ToolCall } from '@/types'

// Mock the child components
jest.mock('../EmptyState', () => ({
  ChatEmptyState: () => <div data-testid="empty-state">No messages yet</div>
}))

jest.mock('../LoadingMessage', () => ({
  LoadingMessage: () => <div data-testid="loading-message">Loading...</div>
}))

jest.mock('../LoadingIndicator', () => ({
  MessageLoadingIndicator: () => <div data-testid="message-loading">Loading message...</div>,
  ToolExecutionIndicator: () => <div data-testid="tool-execution">Executing tool...</div>
}))

describe('MessageList', () => {
  const mockMessages: Message[] = [
    {
      id: '1',
      role: 'user',
      content: 'Hello, how are you?',
      timestamp: new Date('2023-01-01T10:00:00Z')
    },
    {
      id: '2',
      role: 'assistant',
      content: 'I am doing well, thank you!',
      timestamp: new Date('2023-01-01T10:01:00Z')
    },
    {
      id: '3',
      role: 'system',
      content: 'System message',
      timestamp: new Date('2023-01-01T10:02:00Z')
    }
  ]

  const mockToolCalls: ToolCall[] = [
    {
      id: 'tool1',
      name: 'test_tool',
      parameters: { param1: 'value1' },
      result: 'Tool executed successfully'
    },
    {
      id: 'tool2',
      name: 'error_tool',
      parameters: { param2: 'value2' },
      error: 'Tool execution failed'
    }
  ]

  const mockOnMessageClick = jest.fn()
  const mockOnToolCallClick = jest.fn()

  beforeEach(() => {
    mockOnMessageClick.mockClear()
    mockOnToolCallClick.mockClear()
  })

  it('renders empty state when no messages', () => {
    render(<MessageList messages={[]} />)
    
    expect(screen.getByTestId('empty-state')).toBeInTheDocument()
  })

  it('renders messages correctly', () => {
    render(<MessageList messages={mockMessages} />)
    
    expect(screen.getByText('Hello, how are you?')).toBeInTheDocument()
    expect(screen.getByText('I am doing well, thank you!')).toBeInTheDocument()
    expect(screen.getByText('System message')).toBeInTheDocument()
  })

  it('displays correct role names', () => {
    render(<MessageList messages={mockMessages} />)
    
    expect(screen.getByText('You')).toBeInTheDocument()
    expect(screen.getByText('Assistant')).toBeInTheDocument()
    expect(screen.getByText('System')).toBeInTheDocument()
  })

  it('shows avatars when showAvatars is true', () => {
    render(<MessageList messages={mockMessages} showAvatars={true} />)
    
    // Check for avatar emojis
    expect(screen.getByText('👤')).toBeInTheDocument() // User avatar
    expect(screen.getByText('🤖')).toBeInTheDocument() // Assistant avatar
    expect(screen.getByText('⚙️')).toBeInTheDocument() // System avatar
  })

  it('hides avatars when showAvatars is false', () => {
    render(<MessageList messages={mockMessages} showAvatars={false} />)
    
    // Avatars should not be present
    expect(screen.queryByText('👤')).not.toBeInTheDocument()
    expect(screen.queryByText('🤖')).not.toBeInTheDocument()
    expect(screen.queryByText('⚙️')).not.toBeInTheDocument()
  })

  it('shows timestamps when showTimestamps is true', () => {
    render(<MessageList messages={mockMessages} showTimestamps={true} />)
    
    // Should show relative timestamps
    expect(screen.getByText(/ago/)).toBeInTheDocument()
  })

  it('hides timestamps when showTimestamps is false', () => {
    render(<MessageList messages={mockMessages} showTimestamps={false} />)
    
    // Should not show timestamps
    expect(screen.queryByText(/ago/)).not.toBeInTheDocument()
  })

  it('shows loading message when isLoading is true', () => {
    render(<MessageList messages={mockMessages} isLoading={true} />)
    
    expect(screen.getByTestId('loading-message')).toBeInTheDocument()
  })

  it('calls onMessageClick when message is clicked', () => {
    render(<MessageList messages={mockMessages} onMessageClick={mockOnMessageClick} />)
    
    const messageElement = screen.getByText('Hello, how are you?').closest('div[id^="message-"]')
    fireEvent.click(messageElement!)
    
    expect(mockOnMessageClick).toHaveBeenCalledWith(mockMessages[0])
  })

  it('renders tool calls correctly', () => {
    const messageWithTools: Message = {
      id: '4',
      role: 'assistant',
      content: 'I executed some tools',
      timestamp: new Date(),
      toolCalls: mockToolCalls
    }

    render(<MessageList messages={[messageWithTools]} />)
    
    expect(screen.getByText('🔧 test_tool')).toBeInTheDocument()
    expect(screen.getByText('🔧 error_tool')).toBeInTheDocument()
    expect(screen.getByText('✅ Success')).toBeInTheDocument()
    expect(screen.getByText('❌ Error')).toBeInTheDocument()
  })

  it('shows tool call parameters', () => {
    const messageWithTools: Message = {
      id: '4',
      role: 'assistant',
      content: 'I executed some tools',
      timestamp: new Date(),
      toolCalls: mockToolCalls
    }

    render(<MessageList messages={[messageWithTools]} />)
    
    expect(screen.getByText('Parameters:')).toBeInTheDocument()
    expect(screen.getByText(/"param1": "value1"/)).toBeInTheDocument()
  })

  it('shows tool call results', () => {
    const messageWithTools: Message = {
      id: '4',
      role: 'assistant',
      content: 'I executed some tools',
      timestamp: new Date(),
      toolCalls: mockToolCalls
    }

    render(<MessageList messages={[messageWithTools]} />)
    
    expect(screen.getByText('Result:')).toBeInTheDocument()
    expect(screen.getByText('Tool executed successfully')).toBeInTheDocument()
  })

  it('shows tool call errors', () => {
    const messageWithTools: Message = {
      id: '4',
      role: 'assistant',
      content: 'I executed some tools',
      timestamp: new Date(),
      toolCalls: mockToolCalls
    }

    render(<MessageList messages={[messageWithTools]} />)
    
    expect(screen.getByText('Error:')).toBeInTheDocument()
    expect(screen.getByText('Tool execution failed')).toBeInTheDocument()
  })

  it('calls onToolCallClick when tool call is clicked', () => {
    const messageWithTools: Message = {
      id: '4',
      role: 'assistant',
      content: 'I executed some tools',
      timestamp: new Date(),
      toolCalls: mockToolCalls
    }

    render(<MessageList messages={[messageWithTools]} onToolCallClick={mockOnToolCallClick} />)
    
    const toolCallElement = screen.getByText('🔧 test_tool').closest('div')
    fireEvent.click(toolCallElement!)
    
    expect(mockOnToolCallClick).toHaveBeenCalledWith(mockToolCalls[0])
  })

  it('formats timestamps correctly', () => {
    const now = new Date()
    const oneMinuteAgo = new Date(now.getTime() - 60000)
    const oneHourAgo = new Date(now.getTime() - 3600000)
    const oneDayAgo = new Date(now.getTime() - 86400000)

    const messagesWithDifferentTimes: Message[] = [
      {
        id: '1',
        role: 'user',
        content: 'Just now',
        timestamp: now
      },
      {
        id: '2',
        role: 'user',
        content: 'One minute ago',
        timestamp: oneMinuteAgo
      },
      {
        id: '3',
        role: 'user',
        content: 'One hour ago',
        timestamp: oneHourAgo
      },
      {
        id: '4',
        role: 'user',
        content: 'One day ago',
        timestamp: oneDayAgo
      }
    ]

    render(<MessageList messages={messagesWithDifferentTimes} showTimestamps={true} />)
    
    expect(screen.getByText('Just now')).toBeInTheDocument()
    expect(screen.getByText('1m ago')).toBeInTheDocument()
    expect(screen.getByText('1h ago')).toBeInTheDocument()
    expect(screen.getByText('1d ago')).toBeInTheDocument()
  })

  it('applies correct styling for user messages', () => {
    render(<MessageList messages={[mockMessages[0]]} />)
    
    const userMessage = screen.getByText('Hello, how are you?')
    const messageContainer = userMessage.closest('div')
    
    expect(messageContainer).toHaveClass('bg-primary', 'text-primary-foreground')
  })

  it('applies correct styling for system messages', () => {
    render(<MessageList messages={[mockMessages[2]]} />)
    
    const systemMessageContainer = screen.getByText('System message').closest('div[class*="bg-secondary"]')
    expect(systemMessageContainer).toBeInTheDocument()
  })

  it('exposes imperative methods via ref', () => {
    const ref = React.createRef<MessageListHandle>()
    render(<MessageList ref={ref} messages={mockMessages} />)
    
    expect(ref.current).toBeDefined()
    expect(typeof ref.current?.scrollToBottom).toBe('function')
    expect(typeof ref.current?.scrollToTop).toBe('function')
    expect(typeof ref.current?.scrollToMessage).toBe('function')
  })

  it('handles empty tool calls array', () => {
    const messageWithEmptyTools: Message = {
      id: '4',
      role: 'assistant',
      content: 'No tools executed',
      timestamp: new Date(),
      toolCalls: []
    }

    render(<MessageList messages={[messageWithEmptyTools]} />)
    
    expect(screen.getByText('No tools executed')).toBeInTheDocument()
    expect(screen.queryByText('🔧')).not.toBeInTheDocument()
  })

  it('handles tool calls with complex result objects', () => {
    const complexToolCall: ToolCall = {
      id: 'complex',
      name: 'complex_tool',
      parameters: { input: 'test' },
      result: { status: 'success', data: { items: [1, 2, 3] } }
    }

    const messageWithComplexTool: Message = {
      id: '5',
      role: 'assistant',
      content: 'Complex tool result',
      timestamp: new Date(),
      toolCalls: [complexToolCall]
    }

    render(<MessageList messages={[messageWithComplexTool]} />)
    
    expect(screen.getByText('🔧 complex_tool')).toBeInTheDocument()
    expect(screen.getByText(/"status": "success"/)).toBeInTheDocument()
  })
})