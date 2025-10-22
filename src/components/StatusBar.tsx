'use client'

// Status Bar Component - Shows system status, connection info, and progress

import React, { useState, useEffect } from 'react'
import { ConnectionStatus, ConnectionStatusData } from './ConnectionStatus'
import { LoadingIndicator } from './LoadingIndicator'
import { getMCPHealthMonitor } from '@/services/mcp-health'
import { MCPHealthCheck } from '@/types/mcp'

export interface StatusBarProps {
  isProcessing?: boolean
  processingMessage?: string
  showConnectionStatus?: boolean
  showMCPStatus?: boolean
  showSystemInfo?: boolean
  className?: string
  position?: 'top' | 'bottom'
  variant?: 'compact' | 'detailed'
}

export interface SystemInfo {
  messageCount: number
  sessionDuration: number
  lastActivity: Date | null
}

/**
 * Status bar component showing system status and connection information
 */
export const StatusBar: React.FC<StatusBarProps> = ({
  isProcessing = false,
  processingMessage = 'Processing...',
  showConnectionStatus = true,
  showMCPStatus = true,
  showSystemInfo = false,
  className = '',
  position = 'bottom',
  variant = 'compact'
}) => {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatusData | null>(null)
  const [mcpHealth, setMCPHealth] = useState<Record<string, MCPHealthCheck>>({})
  const [systemInfo, setSystemInfo] = useState<SystemInfo>({
    messageCount: 0,
    sessionDuration: 0,
    lastActivity: null
  })
  const [isExpanded, setIsExpanded] = useState(false)

  // Monitor MCP health
  useEffect(() => {
    if (!showMCPStatus) return

    const healthMonitor = getMCPHealthMonitor()
    
    const updateHealth = () => {
      setMCPHealth(healthMonitor.getAllServerHealth())
    }

    // Initial update
    updateHealth()

    // Set up periodic updates
    const interval = setInterval(updateHealth, 10000) // Every 10 seconds

    return () => clearInterval(interval)
  }, [showMCPStatus])

  // Update system info
  useEffect(() => {
    if (!showSystemInfo) return

    const updateSystemInfo = () => {
      const sessionStart = sessionStorage.getItem('mcpchat-session-start')
      const startTime = sessionStart ? new Date(sessionStart) : new Date()
      
      if (!sessionStart) {
        sessionStorage.setItem('mcpchat-session-start', startTime.toISOString())
      }

      setSystemInfo({
        messageCount: parseInt(sessionStorage.getItem('mcpchat-message-count') || '0'),
        sessionDuration: Date.now() - startTime.getTime(),
        lastActivity: new Date()
      })
    }

    updateSystemInfo()
    const interval = setInterval(updateSystemInfo, 30000) // Every 30 seconds

    return () => clearInterval(interval)
  }, [showSystemInfo])

  const getOverallMCPStatus = (): 'healthy' | 'degraded' | 'offline' => {
    const healthValues = Object.values(mcpHealth)
    if (healthValues.length === 0) return 'offline'
    
    const healthyCount = healthValues.filter(h => h.status === 'healthy').length
    const totalCount = healthValues.length
    
    if (healthyCount === totalCount) return 'healthy'
    if (healthyCount > 0) return 'degraded'
    return 'offline'
  }

  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    
    if (hours > 0) return `${hours}h ${minutes % 60}m`
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`
    return `${seconds}s`
  }

  const getMCPStatusIcon = (status: 'healthy' | 'degraded' | 'offline') => {
    switch (status) {
      case 'healthy':
        return <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
      case 'degraded':
        return <div className="w-2 h-2 bg-yellow-500 rounded-full" />
      case 'offline':
        return <div className="w-2 h-2 bg-red-500 rounded-full" />
    }
  }

  const positionClasses = position === 'top' 
    ? 'top-0 border-b' 
    : 'bottom-0 border-t'

  return (
    <div className={`fixed left-0 right-0 z-40 bg-white ${positionClasses} border-gray-200 ${className}`}>
      <div className="px-4 py-2">
        {variant === 'compact' ? (
          // Compact view
          <div className="flex items-center justify-between text-xs text-gray-600">
            <div className="flex items-center space-x-4">
              {/* Processing indicator */}
              {isProcessing && (
                <div className="flex items-center space-x-2">
                  <LoadingIndicator variant="dots" size="sm" color="blue" />
                  <span>{processingMessage}</span>
                </div>
              )}

              {/* Connection status */}
              {showConnectionStatus && (
                <ConnectionStatus 
                  showDetails={false}
                  onStatusChange={setConnectionStatus}
                />
              )}

              {/* MCP status */}
              {showMCPStatus && (
                <div className="flex items-center space-x-1">
                  {getMCPStatusIcon(getOverallMCPStatus())}
                  <span>MCP</span>
                </div>
              )}
            </div>

            <div className="flex items-center space-x-4">
              {/* System info */}
              {showSystemInfo && (
                <div className="flex items-center space-x-3">
                  <span>{systemInfo.messageCount} msgs</span>
                  <span>{formatDuration(systemInfo.sessionDuration)}</span>
                </div>
              )}

              {/* Expand button */}
              {variant === 'compact' && (
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg 
                    className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        ) : (
          // Detailed view
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                {isProcessing && (
                  <div className="flex items-center space-x-2">
                    <LoadingIndicator variant="bars" size="sm" color="blue" />
                    <span className="text-sm font-medium">{processingMessage}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              {/* Connection details */}
              {showConnectionStatus && connectionStatus && (
                <div className="space-y-1">
                  <h4 className="font-medium text-gray-700">Connection</h4>
                  <div className="space-y-1 text-gray-600">
                    <div>LLM: {connectionStatus.llm.status}</div>
                    <div>MCP: {connectionStatus.mcp.status}</div>
                    {connectionStatus.mcp.toolCount && (
                      <div>{connectionStatus.mcp.toolCount} tools available</div>
                    )}
                  </div>
                </div>
              )}

              {/* MCP health details */}
              {showMCPStatus && Object.keys(mcpHealth).length > 0 && (
                <div className="space-y-1">
                  <h4 className="font-medium text-gray-700">MCP Servers</h4>
                  <div className="space-y-1 text-gray-600">
                    {Object.entries(mcpHealth).map(([serverId, health]) => (
                      <div key={serverId} className="flex items-center space-x-2">
                        {getMCPStatusIcon(health.status === 'healthy' ? 'healthy' : 
                                         health.status === 'unhealthy' ? 'offline' : 'degraded')}
                        <span>{serverId}</span>
                        {health.responseTime && (
                          <span className="text-gray-400">({health.responseTime}ms)</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* System information */}
              {showSystemInfo && (
                <div className="space-y-1">
                  <h4 className="font-medium text-gray-700">Session</h4>
                  <div className="space-y-1 text-gray-600">
                    <div>Messages: {systemInfo.messageCount}</div>
                    <div>Duration: {formatDuration(systemInfo.sessionDuration)}</div>
                    {systemInfo.lastActivity && (
                      <div>Last: {systemInfo.lastActivity.toLocaleTimeString()}</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Expanded details for compact mode */}
        {variant === 'compact' && isExpanded && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
              {showConnectionStatus && connectionStatus && (
                <div className="space-y-1">
                  <h4 className="font-medium text-gray-700">Services</h4>
                  <div className="space-y-1 text-gray-600">
                    <div className="flex justify-between">
                      <span>LLM:</span>
                      <span className={connectionStatus.llm.status === 'connected' ? 'text-green-600' : 'text-red-600'}>
                        {connectionStatus.llm.status}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>MCP:</span>
                      <span className={connectionStatus.mcp.status === 'connected' ? 'text-green-600' : 'text-red-600'}>
                        {connectionStatus.mcp.status}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {showMCPStatus && (
                <div className="space-y-1">
                  <h4 className="font-medium text-gray-700">Tools</h4>
                  <div className="text-gray-600">
                    {connectionStatus?.mcp.toolCount || 0} available
                  </div>
                </div>
              )}

              {showSystemInfo && (
                <div className="space-y-1">
                  <h4 className="font-medium text-gray-700">Performance</h4>
                  <div className="space-y-1 text-gray-600">
                    <div>Uptime: {formatDuration(systemInfo.sessionDuration)}</div>
                    <div>Messages: {systemInfo.messageCount}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default StatusBar