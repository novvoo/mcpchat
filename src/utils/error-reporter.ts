// Global Error Reporter - Centralized error logging and reporting

export interface ErrorReport {
  error: Error
  context?: string
  userId?: string
  sessionId?: string
  timestamp: Date
  userAgent?: string
  url?: string
  additionalData?: Record<string, any>
}

export interface ErrorReporterConfig {
  enableConsoleLogging?: boolean
  enableRemoteReporting?: boolean
  remoteEndpoint?: string
  maxReportsPerSession?: number
  enableUserFeedback?: boolean
}

/**
 * Global error reporter for handling and logging application errors
 */
export class ErrorReporter {
  private static instance: ErrorReporter
  private config: Required<ErrorReporterConfig>
  private reportCount = 0
  private sessionId: string

  private constructor(config: ErrorReporterConfig = {}) {
    this.config = {
      enableConsoleLogging: config.enableConsoleLogging ?? true,
      enableRemoteReporting: config.enableRemoteReporting ?? false,
      remoteEndpoint: config.remoteEndpoint ?? '',
      maxReportsPerSession: config.maxReportsPerSession ?? 50,
      enableUserFeedback: config.enableUserFeedback ?? false
    }
    
    this.sessionId = this.generateSessionId()
    this.setupGlobalErrorHandlers()
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: ErrorReporterConfig): ErrorReporter {
    if (!ErrorReporter.instance) {
      ErrorReporter.instance = new ErrorReporter(config)
    }
    return ErrorReporter.instance
  }

  /**
   * Report an error
   */
  reportError(error: Error, context?: string, additionalData?: Record<string, any>): void {
    if (this.reportCount >= this.config.maxReportsPerSession) {
      console.warn('Max error reports per session reached, skipping report')
      return
    }

    const report: ErrorReport = {
      error,
      context,
      sessionId: this.sessionId,
      timestamp: new Date(),
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : undefined,
      url: typeof window !== 'undefined' ? window.location.href : undefined,
      additionalData
    }

    this.reportCount++

    // Console logging
    if (this.config.enableConsoleLogging) {
      this.logToConsole(report)
    }

    // Remote reporting
    if (this.config.enableRemoteReporting && this.config.remoteEndpoint) {
      this.sendToRemote(report).catch(err => {
        console.error('Failed to send error report to remote endpoint:', err)
      })
    }

    // User feedback (could trigger a modal or notification)
    if (this.config.enableUserFeedback) {
      this.requestUserFeedback(report)
    }
  }

  /**
   * Report API errors with additional context
   */
  reportApiError(
    error: Error, 
    endpoint: string, 
    method: string, 
    statusCode?: number,
    responseData?: any
  ): void {
    this.reportError(error, `API Error: ${method} ${endpoint}`, {
      endpoint,
      method,
      statusCode,
      responseData: responseData ? JSON.stringify(responseData).substring(0, 1000) : undefined
    })
  }

  /**
   * Report React component errors
   */
  reportComponentError(error: Error, componentName: string, props?: any): void {
    this.reportError(error, `Component Error: ${componentName}`, {
      componentName,
      props: props ? JSON.stringify(props).substring(0, 500) : undefined
    })
  }

  /**
   * Report MCP-specific errors
   */
  reportMCPError(
    error: Error, 
    toolName?: string, 
    serverId?: string, 
    operation?: string
  ): void {
    this.reportError(error, `MCP Error: ${operation || 'Unknown'}`, {
      toolName,
      serverId,
      operation
    })
  }

  /**
   * Set up global error handlers
   */
  private setupGlobalErrorHandlers(): void {
    if (typeof window === 'undefined') return

    // Handle unhandled JavaScript errors
    window.addEventListener('error', (event) => {
      this.reportError(
        new Error(event.message),
        'Global Error Handler',
        {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno
        }
      )
    })

    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      const error = event.reason instanceof Error 
        ? event.reason 
        : new Error(String(event.reason))
      
      this.reportError(error, 'Unhandled Promise Rejection')
    })
  }

  /**
   * Log error to console with formatting
   */
  private logToConsole(report: ErrorReport): void {
    const { error, context, timestamp, additionalData } = report

    console.group(`🚨 Error Report - ${timestamp.toISOString()}`)
    
    if (context) {
      console.log(`📍 Context: ${context}`)
    }
    
    console.error('❌ Error:', error)
    
    if (error.stack) {
      console.log('📚 Stack Trace:', error.stack)
    }
    
    if (additionalData && Object.keys(additionalData).length > 0) {
      console.log('📊 Additional Data:', additionalData)
    }
    
    console.log(`🔗 Session ID: ${report.sessionId}`)
    console.groupEnd()
  }

  /**
   * Send error report to remote endpoint
   */
  private async sendToRemote(report: ErrorReport): Promise<void> {
    try {
      const payload = {
        message: report.error.message,
        stack: report.error.stack,
        context: report.context,
        sessionId: report.sessionId,
        timestamp: report.timestamp.toISOString(),
        userAgent: report.userAgent,
        url: report.url,
        additionalData: report.additionalData
      }

      await fetch(this.config.remoteEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })
    } catch (error) {
      // Silently fail to avoid infinite error loops
      console.warn('Failed to send error report to remote endpoint')
    }
  }

  /**
   * Request user feedback for the error
   */
  private requestUserFeedback(report: ErrorReport): void {
    // This could trigger a modal or notification asking the user
    // to provide additional context about what they were doing
    // when the error occurred. For now, we'll just log it.
    console.log('User feedback requested for error:', report.error.message)
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
  }

  /**
   * Get error statistics
   */
  getStats(): {
    reportCount: number
    sessionId: string
    maxReports: number
  } {
    return {
      reportCount: this.reportCount,
      sessionId: this.sessionId,
      maxReports: this.config.maxReportsPerSession
    }
  }

  /**
   * Clear error count (useful for testing)
   */
  clearStats(): void {
    this.reportCount = 0
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ErrorReporterConfig>): void {
    this.config = { ...this.config, ...config }
  }
}

// Convenience functions
export const reportError = (error: Error, context?: string, additionalData?: Record<string, any>) => {
  ErrorReporter.getInstance().reportError(error, context, additionalData)
}

export const reportApiError = (
  error: Error, 
  endpoint: string, 
  method: string, 
  statusCode?: number,
  responseData?: any
) => {
  ErrorReporter.getInstance().reportApiError(error, endpoint, method, statusCode, responseData)
}

export const reportComponentError = (error: Error, componentName: string, props?: any) => {
  ErrorReporter.getInstance().reportComponentError(error, componentName, props)
}

export const reportMCPError = (
  error: Error, 
  toolName?: string, 
  serverId?: string, 
  operation?: string
) => {
  ErrorReporter.getInstance().reportMCPError(error, toolName, serverId, operation)
}

// Initialize with default config
export const initializeErrorReporter = (config?: ErrorReporterConfig) => {
  return ErrorReporter.getInstance(config)
}