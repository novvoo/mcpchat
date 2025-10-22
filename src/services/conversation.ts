// Conversation Management Service - Handles chat context and message history

import { Message, ConversationContext, ChatMessage } from '@/types'
import { DEFAULT_CONFIG } from '@/types/constants'

/**
 * Conversation manager for handling chat context and message history
 */
export class ConversationManager {
  private static instance: ConversationManager
  private conversations: Map<string, ConversationContext> = new Map()
  private currentConversationId: string | null = null

  private constructor() {}

  /**
   * Get singleton instance
   */
  public static getInstance(): ConversationManager {
    if (!ConversationManager.instance) {
      ConversationManager.instance = new ConversationManager()
    }
    return ConversationManager.instance
  }

  /**
   * Create a new conversation
   */
  createConversation(id?: string): string {
    const conversationId = id || this.generateConversationId()
    
    const conversation: ConversationContext = {
      id: conversationId,
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date()
    }

    this.conversations.set(conversationId, conversation)
    this.currentConversationId = conversationId

    console.log(`Created new conversation: ${conversationId}`)
    return conversationId
  }

  /**
   * Get conversation by ID
   */
  getConversation(id: string): ConversationContext | undefined {
    return this.conversations.get(id)
  }

  /**
   * Get current conversation
   */
  getCurrentConversation(): ConversationContext | undefined {
    if (!this.currentConversationId) {
      return undefined
    }
    return this.conversations.get(this.currentConversationId)
  }

  /**
   * Set current conversation
   */
  setCurrentConversation(id: string): boolean {
    if (this.conversations.has(id)) {
      this.currentConversationId = id
      return true
    }
    return false
  }

  /**
   * Add message to conversation
   */
  addMessage(conversationId: string, message: Message): void {
    const conversation = this.conversations.get(conversationId)
    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`)
    }

    // Check message limit
    if (conversation.messages.length >= DEFAULT_CONFIG.MAX_CONVERSATION_MESSAGES) {
      // Remove oldest messages to make room
      const messagesToRemove = conversation.messages.length - DEFAULT_CONFIG.MAX_CONVERSATION_MESSAGES + 1
      conversation.messages.splice(0, messagesToRemove)
    }

    conversation.messages.push(message)
    conversation.updatedAt = new Date()
  }

  /**
   * Add message to current conversation
   */
  addMessageToCurrent(message: Message): void {
    if (!this.currentConversationId) {
      // Create new conversation if none exists
      this.createConversation()
    }
    
    if (this.currentConversationId) {
      this.addMessage(this.currentConversationId, message)
    }
  }

  /**
   * Get messages from conversation
   */
  getMessages(conversationId: string): Message[] {
    const conversation = this.conversations.get(conversationId)
    return conversation ? [...conversation.messages] : []
  }

  /**
   * Get messages from current conversation
   */
  getCurrentMessages(): Message[] {
    if (!this.currentConversationId) {
      return []
    }
    return this.getMessages(this.currentConversationId)
  }

  /**
   * Convert messages to ChatMessage format for LLM API
   */
  getMessagesForLLM(conversationId: string, includeSystem: boolean = true): ChatMessage[] {
    const messages = this.getMessages(conversationId)
    
    const chatMessages: ChatMessage[] = messages
      .filter(msg => includeSystem || msg.role !== 'system')
      .map(msg => ({
        role: msg.role,
        content: msg.content,
        tool_calls: msg.toolCalls
      }))

    return chatMessages
  }

  /**
   * Get current messages for LLM API
   */
  getCurrentMessagesForLLM(includeSystem: boolean = true): ChatMessage[] {
    if (!this.currentConversationId) {
      return []
    }
    return this.getMessagesForLLM(this.currentConversationId, includeSystem)
  }

  /**
   * Clear conversation messages
   */
  clearConversation(conversationId: string): void {
    const conversation = this.conversations.get(conversationId)
    if (conversation) {
      conversation.messages = []
      conversation.updatedAt = new Date()
    }
  }

  /**
   * Clear current conversation
   */
  clearCurrentConversation(): void {
    if (this.currentConversationId) {
      this.clearConversation(this.currentConversationId)
    }
  }

  /**
   * Delete conversation
   */
  deleteConversation(conversationId: string): boolean {
    const deleted = this.conversations.delete(conversationId)
    
    if (deleted && this.currentConversationId === conversationId) {
      this.currentConversationId = null
    }
    
    return deleted
  }

  /**
   * Get all conversation IDs
   */
  getConversationIds(): string[] {
    return Array.from(this.conversations.keys())
  }

  /**
   * Get conversation summaries
   */
  getConversationSummaries(): Array<{
    id: string
    messageCount: number
    createdAt: Date
    updatedAt: Date
    lastMessage?: string
  }> {
    const summaries = []
    
    for (const [id, conversation] of this.conversations) {
      const lastMessage = conversation.messages.length > 0 
        ? conversation.messages[conversation.messages.length - 1].content.substring(0, 100)
        : undefined

      summaries.push({
        id,
        messageCount: conversation.messages.length,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
        lastMessage
      })
    }

    // Sort by most recently updated
    summaries.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    
    return summaries
  }

  /**
   * Generate unique conversation ID
   */
  private generateConversationId(): string {
    return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Generate unique message ID
   */
  generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Create user message
   */
  createUserMessage(content: string): Message {
    return {
      id: this.generateMessageId(),
      role: 'user',
      content,
      timestamp: new Date()
    }
  }

  /**
   * Create assistant message
   */
  createAssistantMessage(content: string, toolCalls?: any[]): Message {
    return {
      id: this.generateMessageId(),
      role: 'assistant',
      content,
      timestamp: new Date(),
      toolCalls
    }
  }

  /**
   * Create system message
   */
  createSystemMessage(content: string): Message {
    return {
      id: this.generateMessageId(),
      role: 'system',
      content,
      timestamp: new Date()
    }
  }

  /**
   * Get conversation statistics
   */
  getStats(): {
    totalConversations: number
    totalMessages: number
    averageMessagesPerConversation: number
    oldestConversation?: Date
    newestConversation?: Date
  } {
    const totalConversations = this.conversations.size
    let totalMessages = 0
    let oldestDate: Date | undefined
    let newestDate: Date | undefined

    for (const conversation of this.conversations.values()) {
      totalMessages += conversation.messages.length
      
      if (!oldestDate || conversation.createdAt < oldestDate) {
        oldestDate = conversation.createdAt
      }
      
      if (!newestDate || conversation.createdAt > newestDate) {
        newestDate = conversation.createdAt
      }
    }

    return {
      totalConversations,
      totalMessages,
      averageMessagesPerConversation: totalConversations > 0 ? totalMessages / totalConversations : 0,
      oldestConversation: oldestDate,
      newestConversation: newestDate
    }
  }

  /**
   * Export conversation data
   */
  exportConversation(conversationId: string): ConversationContext | null {
    const conversation = this.conversations.get(conversationId)
    return conversation ? { ...conversation, messages: [...conversation.messages] } : null
  }

  /**
   * Import conversation data
   */
  importConversation(data: ConversationContext): void {
    this.conversations.set(data.id, {
      ...data,
      messages: [...data.messages]
    })
  }

  /**
   * Clean up old conversations (keep only recent ones)
   */
  cleanup(maxConversations: number = 50): number {
    if (this.conversations.size <= maxConversations) {
      return 0
    }

    const summaries = this.getConversationSummaries()
    const toDelete = summaries.slice(maxConversations)
    
    let deletedCount = 0
    for (const summary of toDelete) {
      if (this.deleteConversation(summary.id)) {
        deletedCount++
      }
    }

    console.log(`Cleaned up ${deletedCount} old conversations`)
    return deletedCount
  }
}

/**
 * Convenience function to get conversation manager instance
 */
export const getConversationManager = () => ConversationManager.getInstance()

/**
 * Convenience function to create a new conversation
 */
export const createNewConversation = (id?: string): string => {
  const manager = getConversationManager()
  return manager.createConversation(id)
}

/**
 * Convenience function to add message to current conversation
 */
export const addMessageToCurrentConversation = (message: Message): void => {
  const manager = getConversationManager()
  manager.addMessageToCurrent(message)
}