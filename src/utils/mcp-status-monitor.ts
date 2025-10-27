// MCP Status Monitor - 全局MCP状态监听器

import React from 'react'

/**
 * 全局MCP状态监听器
 * 用于监听MCP系统的初始化完成事件并触发状态刷新
 */

type MCPStatusListener = (status: 'initializing' | 'ready' | 'error', details?: any) => void

class MCPStatusMonitor {
  private listeners: Set<MCPStatusListener> = new Set()
  private currentStatus: 'initializing' | 'ready' | 'error' = 'initializing'
  private statusDetails: any = null

  /**
   * 添加状态监听器
   */
  addListener(listener: MCPStatusListener) {
    this.listeners.add(listener)
    
    // 立即通知当前状态
    listener(this.currentStatus, this.statusDetails)
    
    return () => {
      this.listeners.delete(listener)
    }
  }

  /**
   * 移除状态监听器
   */
  removeListener(listener: MCPStatusListener) {
    this.listeners.delete(listener)
  }

  /**
   * 更新MCP状态
   */
  updateStatus(status: 'initializing' | 'ready' | 'error', details?: any) {
    const previousStatus = this.currentStatus
    this.currentStatus = status
    this.statusDetails = details

    // 如果状态发生变化，通知所有监听器
    if (previousStatus !== status) {
      console.log(`MCP状态变更: ${previousStatus} -> ${status}`, details)
      
      this.listeners.forEach(listener => {
        try {
          listener(status, details)
        } catch (error) {
          console.warn('MCP状态监听器执行失败:', error)
        }
      })
    }
  }

  /**
   * 获取当前状态
   */
  getCurrentStatus() {
    return {
      status: this.currentStatus,
      details: this.statusDetails
    }
  }

  /**
   * 触发状态刷新事件
   */
  triggerRefresh() {
    console.log('触发MCP状态刷新事件')
    this.listeners.forEach(listener => {
      try {
        listener('ready', { ...this.statusDetails, refreshTriggered: true })
      } catch (error) {
        console.warn('MCP状态刷新监听器执行失败:', error)
      }
    })
  }
}

// 创建全局实例
export const mcpStatusMonitor = new MCPStatusMonitor()

// 在window对象上暴露监听器，方便调试和外部调用
if (typeof window !== 'undefined') {
  (window as any).mcpStatusMonitor = mcpStatusMonitor
}

/**
 * React Hook for using MCP status monitor
 */
export const useMCPStatusMonitor = () => {
  const [status, setStatus] = React.useState<{
    status: 'initializing' | 'ready' | 'error'
    details: any
  }>(() => mcpStatusMonitor.getCurrentStatus())

  React.useEffect(() => {
    const unsubscribe = mcpStatusMonitor.addListener((newStatus, details) => {
      setStatus({ status: newStatus, details })
    })

    return unsubscribe
  }, [])

  return {
    ...status,
    triggerRefresh: () => mcpStatusMonitor.triggerRefresh()
  }
}

export default mcpStatusMonitor