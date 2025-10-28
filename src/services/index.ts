// Services index - Re-export all services for convenient importing

// Configuration services
export * from './config'
export * from './config-client'
export * from './config-validator'

// MCP services
export * from './mcp-manager'
export * from './mcp-health'
export * from './mcp-tools'

// LLM services
export * from './llm-service'
export * from './conversation'

// Tool services
export * from './tool-orchestrator'
export * from './tool-detector'

// Router services
export * from './smart-router'
export * from './enhanced-smart-router'
export * from './intelligent-router-service'

// API client services
export * from './api-client'

// Convenience exports for commonly used instances
export { getConfigLoader, loadAppConfig } from './config'
export { getClientConfigLoader, loadClientAppConfig } from './config-client'
export { getMCPManager } from './mcp-manager'
export { getMCPHealthMonitor, startMCPHealthMonitoring, stopMCPHealthMonitoring } from './mcp-health'
export { getMCPToolsService, executeMCPTool } from './mcp-tools'
export { getLLMService, getClientLLMService, initializeLLMService } from './llm-service'
export { getConversationManager, createNewConversation, addMessageToCurrentConversation } from './conversation'
export { getToolOrchestrator, processMessageWithTools } from './tool-orchestrator'
export { getToolDetector, analyzeMessageForTools, shouldSuggestTools } from './tool-detector'
export { getSmartRouter, processMessageSmart } from './smart-router'
export { getEnhancedSmartRouter } from './enhanced-smart-router'
export { getIntelligentRouterService } from './intelligent-router-service'
export { apiClient, chatApi, mcpApi, loadingStateManager, ApiClient, LoadingStateManager } from './api-client'