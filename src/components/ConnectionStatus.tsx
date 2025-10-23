'use client'

// Connection Status Component - Display connection status for LLM and MCP services

import React, { useEffect, useState } from 'react'
import { chatApi, mcpApi } from '@/services/api-client'

export interface ConnectionStatusProps {
  showDetails?: boolean
  autoRefresh?: boolean
  refreshInterval?: number
  className?: string
  onStatusChange?: (status: ConnectionStatusData) => void
}

export interface ConnectionStatusData {
  llm: {
    status: 'connected' | 'disconnected' | 'error' | 'checking'
    message?: string
    lastChecked?: Date
  }
  mcp: {
    status: 'connected' | 'disconnected' | 'error' | 'checking'
    message?: string
    toolCount?: number
    lastChecked?: Date
  }
  overall: 'healthy' | 'degraded' | 'offline' | 'checking'
}

/**
 * Connection status indicator component
 */
export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  showDetails = false,
  autoRefresh = true,
  refreshInterval = 30000, // 30 seconds
  className = '',
  onStatusChange
}) => {
  const [status, setStatus] = useState<ConnectionStatusData>({
    llm: { status: 'checking' },
    mcp: { status: 'checking' },
    overall: 'checking'
  })
  const [isExpanded, setIsExpanded] = useState(false)

  const checkLLMStatus = async (): Promise<{ status: ConnectionStatusData['llm']['status'], message?: string }> => {
    try {
      const response = await chatApi.getStatus(true, { timeout: 10000 })
      
      if (response.success && response.data) {
        const connectionStatus = response.data.connectionStatus
        
        if (connectionStatus === 'connected') {
          return { status: 'connected', message: 'LLM service is available' }
        } else if (connectionStatus === 'failed') {
          return { status: 'error', message: 'Failed to connect to LLM service' }
        } else {
          return { status: 'disconnected', message: 'LLM connection status unknown' }
        }
      } else {
        return { status: 'error', message: response.error?.message || 'Failed to check LLM status' }
      }
    } catch (error) {
      return { 
        status: 'error', 
        message: error instanceof Error ? error.message : 'Network error checking LLM status' 
      }
    }
  }

  const checkMCPStatus = async (): Promise<{ status: ConnectionStatusData['mcp']['status'], message?: string, toolCount?: number }> => {
    try {
      const response = await mcpApi.getTools({ timeout: 10000 })
      
      if (response.success && response.data) {
        const toolCount = response.data.tools.length
        return { 
          status: 'connected', 
          message: `MCP tools available (${toolCount} tools)`,
          toolCount 
        }
      } else {
        return { status: 'error', message: response.error?.message || 'Failed to get MCP tools' }
      }
    } catch (error) {
      return { 
        status: 'error', 
        message: error instanceof Error ? error.message : 'Network error checking MCP status' 
      }
    }
  }

  const checkStatus = async () => {
    const now = new Date()
    
    // Check both services concurrently
    const [llmResult, mcpResult] = await Promise.all([
      checkLLMStatus(),
      checkMCPStatus()
    ])

    const newStatus: ConnectionStatusData = {
      llm: {
        ...llmResult,
        lastChecked: now
      },
      mcp: {
        ...mcpResult,
        lastChecked: now
      },
      overall: 'checking'
    }

    // Determine overall status
    if (newStatus.llm.status === 'connected' && newStatus.mcp.status === 'connected') {
      newStatus.overall = 'healthy'
    } else if (newStatus.llm.status === 'connected' || newStatus.mcp.status === 'connected') {
      newStatus.overall = 'degraded'
    } else {
      newStatus.overall = 'offline'
    }

    setStatus(newStatus)
    onStatusChange?.(newStatus)
  }

  useEffect(() => {
    // Initial check
    checkStatus()

    // Set up auto-refresh
    if (autoRefresh) {
      const interval = setInterval(checkStatus, refreshInterval)
      return () => clearInterval(interval)
    }
  }, [autoRefresh, refreshInterval])

  const getStatusIcon = (serviceStatus: string) => {
    switch (serviceStatus) {
      case 'connected':
        return (
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
        )
      case 'disconnected':
        return (
          <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
        )
      case 'error':
        return (
          <div className="w-2 h-2 bg-red-500 rounded-full"></div>
        )
      case 'checking':
        return (
          <div className="w-2 h-2 bg-gray-400 rounded-full animate-spin"></div>
        )
      default:
        return (
          <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
        )
    }
  }

  const getOverallStatusColor = () => {
    switch (status.overall) {
      case 'healthy':
        return 'text-green-600 bg-green-50 border-green-200'
      case 'degraded':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      case 'offline':
        return 'text-red-600 bg-red-50 border-red-200'
      case 'checking':
        return 'text-muted-foreground bg-muted border-border'
      default:
        return 'text-muted-foreground bg-muted border-border'
    }
  }

  const getOverallStatusText = () => {
    switch (status.overall) {
      case 'healthy':
        return 'All services connected'
      case 'degraded':
        return 'Some services unavailable'
      case 'offline':
        return 'Services offline'
      case 'checking':
        return 'Checking connection...'
      default:
        return 'Unknown status'
    }
  }

  return (
    <div className={`${className}`}>
      {/* Compact status indicator */}
      <div 
        className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border cursor-pointer transition-colors ${getOverallStatusColor()}`}
        onClick={() => showDetails && setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center space-x-1 mr-2">
          {getStatusIcon(status.llm.status)}
          {getStatusIcon(status.mcp.status)}
        </div>
        <span>{getOverallStatusText()}</span>
        {showDetails && (
          <svg 
            className={`ml-1 w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </div>

      {/* Detailed status panel */}
      {showDetails && isExpanded && (
        <div className="absolute mt-2 p-3 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-64">
          <div className="space-y-3">
            {/* LLM Status */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {getStatusIcon(status.llm.status)}
                <span className="text-sm font-medium text-gray-700">LLM Service</span>
              </div>
              <span className={`text-xs px-2 py-1 rounded ${
                status.llm.status === 'connected' ? 'bg-green-100 text-green-800' :
                status.llm.status === 'error' ? 'bg-red-100 text-red-800' :
                'bg-yellow-100 text-yellow-800'
              }`}>
                {status.llm.status}
              </span>
            </div>
            {status.llm.message && (
              <p className="text-xs text-gray-600 ml-4">{status.llm.message}</p>
            )}

            {/* MCP Status */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {getStatusIcon(status.mcp.status)}
                <span className="text-sm font-medium text-gray-700">MCP Tools</span>
              </div>
              <span className={`text-xs px-2 py-1 rounded ${
                status.mcp.status === 'connected' ? 'bg-green-100 text-green-800' :
                status.mcp.status === 'error' ? 'bg-red-100 text-red-800' :
                'bg-yellow-100 text-yellow-800'
              }`}>
                {status.mcp.status}
              </span>
            </div>
            {status.mcp.message && (
              <p className="text-xs text-gray-600 ml-4">{status.mcp.message}</p>
            )}

            {/* Last checked */}
            {status.llm.lastChecked && (
              <div className="pt-2 border-t border-gray-100">
                <p className="text-xs text-gray-500">
                  Last checked: {status.llm.lastChecked.toLocaleTimeString()}
                </p>
              </div>
            )}

            {/* Refresh button */}
            <button
              onClick={checkStatus}
              className="w-full text-xs text-blue-600 hover:text-blue-800 font-medium py-1 transition-colors"
            >
              Refresh Status
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default ConnectionStatus