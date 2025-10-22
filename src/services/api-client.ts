// API Client utilities for frontend-backend communication

import { 
  ChatRequest, 
  ChatApiResponse, 
  MCPExecuteRequest, 
  MCPExecuteResponse, 
  MCPToolsResponse,
  ErrorResponse 
} from '@/types'
import { 
  HTTP_STATUS, 
  ERROR_CODES, 
  DEFAULT_CONFIG, 
  API_ENDPOINTS 
} from '@/types/constants'

// API response wrapper
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: ErrorResponse['error']
  meta?: Record<string, any>
}

// API client configuration
export interface ApiClientConfig {
  baseUrl?: string
  timeout?: number
  retryAttempts?: number
  retryDelay?: number
  headers?: Record<string, string>
}

// Request options
export interface RequestOptions {
  timeout?: number
  retryAttempts?: number
  signal?: AbortSignal
  headers?: Record<string, string>
}

// API client error class
export class ApiClientError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = HTTP_STATUS.INTERNAL_SERVER_ERROR,
    public details?: any
  ) {
    super(message)
    this.name = 'ApiClientError'
  }
}

// Network error class
export class NetworkError extends ApiClientError {
  constructor(message: string, details?: any) {
    super(message, ERROR_CODES.NETWORK_ERROR, HTTP_STATUS.SERVICE_UNAVAILABLE, details)
    this.name = 'NetworkError'
  }
}

// Timeout error class
export class TimeoutError extends ApiClientError {
  constructor(message: string = 'Request timeout') {
    super(message, ERROR_CODES.TIMEOUT_ERROR, HTTP_STATUS.SERVICE_UNAVAILABLE)
    this.name = 'TimeoutError'
  }
}

/**
 * Sleep utility for retry delays
 */
const sleep = (ms: number): Promise<void> => 
  new Promise(resolve => setTimeout(resolve, ms))

/**
 * Check if error is retryable
 */
const isRetryableError = (error: any): boolean => {
  if (error instanceof NetworkError) return true
  if (error instanceof TimeoutError) return true
  if (error instanceof ApiClientError) {
    return error.statusCode >= 500 || error.statusCode === 429
  }
  return false
}

/**
 * API Client class for handling HTTP requests with retry logic and error handling
 */
export class ApiClient {
  private config: Required<ApiClientConfig>

  constructor(config: ApiClientConfig = {}) {
    this.config = {
      baseUrl: config.baseUrl || '',
      timeout: config.timeout || DEFAULT_CONFIG.REQUEST_TIMEOUT,
      retryAttempts: config.retryAttempts || DEFAULT_CONFIG.RETRY_ATTEMPTS,
      retryDelay: config.retryDelay || DEFAULT_CONFIG.RETRY_DELAY,
      headers: {
        'Content-Type': 'application/json',
        ...config.headers
      }
    }
  }

  /**
   * Update client configuration
   */
  updateConfig(config: Partial<ApiClientConfig>): void {
    this.config = { ...this.config, ...config }
  }

  /**
   * Make HTTP request with retry logic
   */
  private async makeRequest<T>(
    url: string,
    options: RequestInit & { timeout?: number; retryAttempts?: number } = {}
  ): Promise<ApiResponse<T>> {
    const {
      timeout = this.config.timeout,
      retryAttempts = this.config.retryAttempts,
      signal,
      headers = {},
      ...fetchOptions
    } = options

    const requestHeaders = {
      ...this.config.headers,
      ...headers
    }

    let lastError: Error | null = null
    
    for (let attempt = 0; attempt <= retryAttempts; attempt++) {
      try {
        // Create timeout controller
        const timeoutController = new AbortController()
        const timeoutId = setTimeout(() => timeoutController.abort(), timeout)

        // Combine signals
        const combinedSignal = signal ? 
          this.combineAbortSignals([signal, timeoutController.signal]) :
          timeoutController.signal

        const response = await fetch(`${this.config.baseUrl}${url}`, {
          ...fetchOptions,
          headers: requestHeaders,
          signal: combinedSignal
        })

        clearTimeout(timeoutId)

        // Parse response
        let responseData: any
        try {
          responseData = await response.json()
        } catch (parseError) {
          responseData = { success: false, error: { code: 'PARSE_ERROR', message: 'Failed to parse response' } }
        }

        // Handle HTTP errors
        if (!response.ok) {
          const error = new ApiClientError(
            responseData.error?.message || `HTTP ${response.status}`,
            responseData.error?.code || ERROR_CODES.UNKNOWN_ERROR,
            response.status,
            responseData.error?.details
          )

          // Don't retry client errors (4xx) except 429
          if (response.status >= 400 && response.status < 500 && response.status !== 429) {
            throw error
          }

          lastError = error
          
          if (attempt < retryAttempts && isRetryableError(error)) {
            await sleep(this.config.retryDelay * Math.pow(2, attempt)) // Exponential backoff
            continue
          }
          
          throw error
        }

        return responseData as ApiResponse<T>

      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          if (signal?.aborted) {
            throw error // Request was cancelled by user
          } else {
            throw new TimeoutError()
          }
        }

        if (error instanceof TypeError && error.message.includes('fetch')) {
          lastError = new NetworkError('Network request failed', error.message)
        } else if (error instanceof ApiClientError) {
          lastError = error
        } else {
          lastError = new ApiClientError(
            error instanceof Error ? error.message : 'Unknown error',
            ERROR_CODES.UNKNOWN_ERROR
          )
        }

        // Retry if error is retryable and we have attempts left
        if (attempt < retryAttempts && isRetryableError(lastError)) {
          await sleep(this.config.retryDelay * Math.pow(2, attempt))
          continue
        }

        throw lastError
      }
    }

    throw lastError || new ApiClientError('Max retry attempts exceeded', ERROR_CODES.UNKNOWN_ERROR)
  }

  /**
   * Combine multiple AbortSignals
   */
  private combineAbortSignals(signals: AbortSignal[]): AbortSignal {
    const controller = new AbortController()
    
    for (const signal of signals) {
      if (signal.aborted) {
        controller.abort()
        break
      }
      signal.addEventListener('abort', () => controller.abort())
    }
    
    return controller.signal
  }

  /**
   * GET request
   */
  async get<T>(url: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(url, {
      method: 'GET',
      ...options
    })
  }

  /**
   * POST request
   */
  async post<T>(url: string, data?: any, options: RequestOptions = {}): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(url, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
      ...options
    })
  }

  /**
   * PUT request
   */
  async put<T>(url: string, data?: any, options: RequestOptions = {}): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(url, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
      ...options
    })
  }

  /**
   * DELETE request
   */
  async delete<T>(url: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(url, {
      method: 'DELETE',
      ...options
    })
  }
}

// Default API client instance
export const apiClient = new ApiClient()

/**
 * Chat API client methods
 */
export const chatApi = {
  /**
   * Send chat message
   */
  async sendMessage(
    request: ChatRequest & { apiKey?: string; enableTools?: boolean },
    options: RequestOptions = {}
  ): Promise<ApiResponse<ChatApiResponse>> {
    return apiClient.post<ChatApiResponse>(API_ENDPOINTS.CHAT, request, options)
  },

  /**
   * Get chat service status
   */
  async getStatus(testConnection = false, options: RequestOptions = {}): Promise<ApiResponse<any>> {
    const url = testConnection ? `${API_ENDPOINTS.CHAT}?test=true` : API_ENDPOINTS.CHAT
    return apiClient.get(url, options)
  }
}

/**
 * MCP API client methods
 */
export const mcpApi = {
  /**
   * Get available MCP tools
   */
  async getTools(options: RequestOptions = {}): Promise<ApiResponse<MCPToolsResponse>> {
    return apiClient.get<MCPToolsResponse>(API_ENDPOINTS.MCP_TOOLS, options)
  },

  /**
   * Execute MCP tool
   */
  async executeTool(
    request: MCPExecuteRequest & { timeout?: number; retryAttempts?: number },
    options: RequestOptions = {}
  ): Promise<ApiResponse<MCPExecuteResponse>> {
    return apiClient.post<MCPExecuteResponse>(API_ENDPOINTS.MCP_EXECUTE, request, options)
  },

  /**
   * Get tool execution history
   */
  async getExecutionHistory(
    limit = 10, 
    includeStats = false, 
    options: RequestOptions = {}
  ): Promise<ApiResponse<any>> {
    const url = `${API_ENDPOINTS.MCP_EXECUTE}?limit=${limit}&stats=${includeStats}`
    return apiClient.get(url, options)
  }
}

/**
 * Loading state manager for API requests
 */
export class LoadingStateManager {
  private loadingStates = new Map<string, boolean>()
  private listeners = new Set<(states: Record<string, boolean>) => void>()

  /**
   * Set loading state for a key
   */
  setLoading(key: string, loading: boolean): void {
    this.loadingStates.set(key, loading)
    this.notifyListeners()
  }

  /**
   * Get loading state for a key
   */
  isLoading(key: string): boolean {
    return this.loadingStates.get(key) || false
  }

  /**
   * Get all loading states
   */
  getAllStates(): Record<string, boolean> {
    return Object.fromEntries(this.loadingStates)
  }

  /**
   * Subscribe to loading state changes
   */
  subscribe(listener: (states: Record<string, boolean>) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /**
   * Notify all listeners
   */
  private notifyListeners(): void {
    const states = this.getAllStates()
    this.listeners.forEach(listener => listener(states))
  }

  /**
   * Clear all loading states
   */
  clear(): void {
    this.loadingStates.clear()
    this.notifyListeners()
  }
}

// Default loading state manager
export const loadingStateManager = new LoadingStateManager()