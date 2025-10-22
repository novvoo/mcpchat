import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MessageInput } from '../MessageInput'

// Mock the LoadingIndicator component
jest.mock('../LoadingIndicator', () => ({
  LoadingIndicator: ({ variant, size, color }: any) => (
    <div data-testid="loading-indicator" data-variant={variant} data-size={size} data-color={color}>
      Loading...
    </div>
  )
}))

describe('MessageInput', () => {
  const mockOnSubmit = jest.fn()

  beforeEach(() => {
    mockOnSubmit.mockClear()
  })

  it('renders with default props', () => {
    render(<MessageInput onSubmit={mockOnSubmit} />)

    const textarea = screen.getByRole('textbox')
    const submitButton = screen.getByRole('button', { name: /send message/i })

    expect(textarea).toBeInTheDocument()
    expect(textarea).toHaveAttribute('placeholder', 'Type your message...')
    expect(submitButton).toBeInTheDocument()
    expect(submitButton).toBeDisabled()
  })

  it('renders with custom placeholder', () => {
    render(<MessageInput onSubmit={mockOnSubmit} placeholder="Custom placeholder" />)

    const textarea = screen.getByRole('textbox')
    expect(textarea).toHaveAttribute('placeholder', 'Custom placeholder')
  })

  it('enables submit button when message is entered', async () => {
    const user = userEvent.setup()
    render(<MessageInput onSubmit={mockOnSubmit} />)

    const textarea = screen.getByRole('textbox')
    const submitButton = screen.getByRole('button', { name: /send message/i })

    expect(submitButton).toBeDisabled()

    await user.type(textarea, 'Hello world')

    expect(submitButton).not.toBeDisabled()
  })

  it('submits message on form submit', async () => {
    const user = userEvent.setup()
    render(<MessageInput onSubmit={mockOnSubmit} />)

    const textarea = screen.getByRole('textbox')
    const submitButton = screen.getByRole('button', { name: /send message/i })

    await user.type(textarea, 'Test message')
    await user.click(submitButton)

    expect(mockOnSubmit).toHaveBeenCalledWith('Test message')
    expect(textarea).toHaveValue('')
  })

  it('submits message on Enter key press', async () => {
    const user = userEvent.setup()
    render(<MessageInput onSubmit={mockOnSubmit} />)

    const textarea = screen.getByRole('textbox')

    await user.type(textarea, 'Test message')
    await user.keyboard('{Enter}')

    expect(mockOnSubmit).toHaveBeenCalledWith('Test message')
    expect(textarea).toHaveValue('')
  })

  it('allows new line with Shift+Enter in multiline mode', async () => {
    const user = userEvent.setup()
    render(<MessageInput onSubmit={mockOnSubmit} multiline={true} />)

    const textarea = screen.getByRole('textbox')

    await user.type(textarea, 'Line 1')
    await user.keyboard('{Shift>}{Enter}{/Shift}')
    await user.type(textarea, 'Line 2')

    expect(textarea).toHaveValue('Line 1\nLine 2')
    expect(mockOnSubmit).not.toHaveBeenCalled()
  })

  it('clears message on Escape key press', async () => {
    const user = userEvent.setup()
    render(<MessageInput onSubmit={mockOnSubmit} />)

    const textarea = screen.getByRole('textbox')

    await user.type(textarea, 'Test message')
    expect(textarea).toHaveValue('Test message')

    await user.keyboard('{Escape}')
    expect(textarea).toHaveValue('')
  })

  it('respects maxLength prop', async () => {
    const user = userEvent.setup()
    render(<MessageInput onSubmit={mockOnSubmit} maxLength={10} />)

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement

    await user.type(textarea, 'This is a very long message that exceeds the limit')

    expect(textarea.value.length).toBeLessThanOrEqual(10)
  })

  it('shows character count when showCharCount is true', () => {
    render(<MessageInput onSubmit={mockOnSubmit} showCharCount={true} maxLength={100} />)

    expect(screen.getByText('0/100')).toBeInTheDocument()
  })

  it('updates character count as user types', async () => {
    const user = userEvent.setup()
    render(<MessageInput onSubmit={mockOnSubmit} showCharCount={true} maxLength={100} />)

    const textarea = screen.getByRole('textbox')

    await user.type(textarea, 'Hello')

    expect(screen.getByText('5/100')).toBeInTheDocument()
  })

  it('shows warning when near character limit', async () => {
    const user = userEvent.setup()
    render(<MessageInput onSubmit={mockOnSubmit} showCharCount={true} maxLength={10} />)

    const textarea = screen.getByRole('textbox')

    await user.type(textarea, 'Hello wor')

    const charCount = screen.getByText('9/10')
    expect(charCount).toHaveClass('text-yellow-500')
  })

  it('shows error when over character limit', async () => {
    const user = userEvent.setup()
    render(<MessageInput onSubmit={mockOnSubmit} showCharCount={true} maxLength={5} />)

    const textarea = screen.getByRole('textbox')

    await user.type(textarea, 'Hello world')

    expect(screen.getByText('5/5')).toBeInTheDocument()
    expect(screen.getByText('- Message too long')).toBeInTheDocument()
  })

  it('disables input when disabled prop is true', () => {
    render(<MessageInput onSubmit={mockOnSubmit} disabled={true} />)

    const textarea = screen.getByRole('textbox')
    const submitButton = screen.getByRole('button')

    expect(textarea).toBeDisabled()
    expect(submitButton).toBeDisabled()
  })

  it('shows loading indicator when disabled', () => {
    render(<MessageInput onSubmit={mockOnSubmit} disabled={true} />)

    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument()
  })

  it('does not submit empty or whitespace-only messages', async () => {
    const user = userEvent.setup()
    render(<MessageInput onSubmit={mockOnSubmit} />)

    const textarea = screen.getByRole('textbox')
    const submitButton = screen.getByRole('button', { name: /send message/i })

    // Try submitting empty message
    await user.click(submitButton)
    expect(mockOnSubmit).not.toHaveBeenCalled()

    // Try submitting whitespace-only message
    await user.type(textarea, '   ')
    await user.click(submitButton)
    expect(mockOnSubmit).not.toHaveBeenCalled()
  })

  it('trims whitespace from submitted messages', async () => {
    const user = userEvent.setup()
    render(<MessageInput onSubmit={mockOnSubmit} />)

    const textarea = screen.getByRole('textbox')
    const submitButton = screen.getByRole('button', { name: /send message/i })

    await user.type(textarea, '  Hello world  ')
    await user.click(submitButton)

    expect(mockOnSubmit).toHaveBeenCalledWith('Hello world')
  })

  it('auto-focuses when autoFocus is true', () => {
    render(<MessageInput onSubmit={mockOnSubmit} autoFocus={true} />)

    const textarea = screen.getByRole('textbox')
    expect(textarea).toHaveFocus()
  })

  it('renders as input when multiline is false', () => {
    render(<MessageInput onSubmit={mockOnSubmit} multiline={false} />)

    const input = screen.getByRole('textbox')
    expect(input.tagName).toBe('INPUT')
  })

  it('handles composition events correctly', async () => {
    const user = userEvent.setup()
    render(<MessageInput onSubmit={mockOnSubmit} />)

    const textarea = screen.getByRole('textbox')

    // Start composition
    fireEvent.compositionStart(textarea)

    await user.type(textarea, 'Test')
    await user.keyboard('{Enter}')

    // Should not submit during composition
    expect(mockOnSubmit).not.toHaveBeenCalled()

    // End composition
    fireEvent.compositionEnd(textarea)

    await user.keyboard('{Enter}')

    // Should submit after composition ends
    expect(mockOnSubmit).toHaveBeenCalledWith('Test')
  })
})