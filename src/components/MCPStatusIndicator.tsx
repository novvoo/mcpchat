// MCP Status Indicator - 显示MCP系统状态的组件

'use client'

import React from 'react'
import { useMCPStatus } from '@/hooks/useMCPStatus'

interface MCPStatusIndicatorProps {
  showDetails?: boolean
  className?: string
  onStatusClick?: () => void
}

/**
 * MCP状态指示器组件
 * 显示MCP系统的当前状态，支持自动刷新
 */
export const MCPStatusIndicator: React.FC<MCPStatusIndicatorProps> = ({
  showDetails = false,
  className = '',
  onStatusClick
}) => {
  const { status, isLoading, error, isReady } = useMCPStatus()

  // 获取状态颜色
  const getStatusColor = () => {
    if (isLoading) return 'text-yellow-600'
    if (error) return 'text-red-600'
    if (isReady) return 'text-green-600'
    return 'text-gray-600'
  }

  // 获取状态图标
  const getStatusIcon = () => {
    if (isLoading) return '⏳'
    if (error) return '❌'
    if (isReady) return '✅'
    return '⚪'
  }

  // 获取状态文本
  const getStatusText = () => {
    if (isLoading) return 'MCP检查中...'
    if (error) return `MCP错误: ${error}`
    if (isReady) return 'MCP就绪'
    
    if (status) {
      // 根据初始化进度显示状态
      if (!status.configLoaded) return 'MCP初始化中: 加载配置...'
      if (!status.serversConnected) return 'MCP初始化中: 连接服务器...'
      if (!status.toolsLoaded) return 'MCP初始化中: 加载工具...'
      if (!status.keywordsMapped) return 'MCP初始化中: 映射关键词...'
    }
    
    return 'MCP状态未知'
  }

  const handleClick = () => {
    if (onStatusClick) {
      onStatusClick()
    }
  }

  return (
    <div 
      className={`flex items-center space-x-2 ${className} ${onStatusClick ? 'cursor-pointer hover:opacity-80' : ''}`}
      onClick={handleClick}
      title={getStatusText()}
    >
      <span className="text-lg">{getStatusIcon()}</span>
      <span className={`text-sm font-medium ${getStatusColor()}`}>
        {getStatusText()}
      </span>
      
      {showDetails && status && (
        <div className="ml-4 text-xs text-gray-500">
          <span>
            服务器: {status.details.connectedServers}/{status.details.totalServers} | 
            工具: {status.details.totalTools} | 
            映射: {status.details.keywordMappings}
          </span>
        </div>
      )}
    </div>
  )
}

/**
 * 简化的MCP状态徽章
 */
export const MCPStatusBadge: React.FC<{
  className?: string
  onClick?: () => void
}> = ({ className = '', onClick }) => {
  const { isReady, isLoading, error } = useMCPStatus()

  const getBadgeStyle = () => {
    if (isLoading) return 'bg-yellow-100 text-yellow-800 border-yellow-200'
    if (error) return 'bg-red-100 text-red-800 border-red-200'
    if (isReady) return 'bg-green-100 text-green-800 border-green-200'
    return 'bg-gray-100 text-gray-800 border-gray-200'
  }

  const getBadgeText = () => {
    if (isLoading) return '初始化中'
    if (error) return 'MCP错误'
    if (isReady) return 'MCP就绪'
    return 'MCP未知'
  }

  return (
    <span 
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getBadgeStyle()} ${className} ${onClick ? 'cursor-pointer hover:opacity-80' : ''}`}
      onClick={onClick}
      title={isReady ? 'MCP系统已就绪' : isLoading ? 'MCP系统正在初始化...' : error ? `MCP错误: ${error}` : 'MCP状态未知'}
    >
      {getBadgeText()}
    </span>
  )
}

export default MCPStatusIndicator