// useMCPStatus Hook - 管理MCP系统状态

import { useState, useEffect, useCallback, useRef } from 'react'
import { mcpApi } from '@/services/api-client'

// 全局状态管理器
class MCPStatusManager {
  private static instance: MCPStatusManager
  private status: MCPStatus | null = null
  private isLoading = false
  private error: string | null = null
  private listeners: Set<(status: MCPStatus | null, isLoading: boolean, error: string | null) => void> = new Set()
  private checkInterval: NodeJS.Timeout | null = null
  private lastCheckTime = 0
  private readonly MIN_CHECK_INTERVAL = 5000 // 最小5秒间隔
  private isInitialized = false

  static getInstance(): MCPStatusManager {
    if (!MCPStatusManager.instance) {
      MCPStatusManager.instance = new MCPStatusManager()
    }
    return MCPStatusManager.instance
  }

  addListener(callback: (status: MCPStatus | null, isLoading: boolean, error: string | null) => void) {
    this.listeners.add(callback)
    // 立即通知当前状态
    callback(this.status, this.isLoading, this.error)
    
    // 如果这是第一个监听器，开始自动检查
    if (this.listeners.size === 1 && !this.isInitialized) {
      this.startAutoCheck()
      this.isInitialized = true
    }
    
    return () => {
      this.listeners.delete(callback)
      // 如果没有监听器了，停止自动检查
      if (this.listeners.size === 0) {
        this.stopAutoCheck()
        this.isInitialized = false
      }
    }
  }

  private notifyListeners() {
    this.listeners.forEach(callback => {
      callback(this.status, this.isLoading, this.error)
    })
  }

  private startAutoCheck() {
    if (this.checkInterval) {
      console.log('MCPStatusManager: 自动检查已在运行，跳过启动')
      return
    }
    
    console.log('MCPStatusManager: 启动自动检查')
    
    // 初始延迟后开始检查
    setTimeout(() => {
      console.log('MCPStatusManager: 执行初始状态检查')
      this.checkStatus()
    }, 5000) // 增加初始延迟到5秒
    
    // 设置定期检查 - 使用更长的间隔
    const interval = this.status?.ready ? 60000 : 30000 // 就绪后60秒，未就绪时30秒
    console.log(`MCPStatusManager: 设置定期检查间隔 ${interval}ms`)
    
    this.checkInterval = setInterval(() => {
      console.log('MCPStatusManager: 执行定期状态检查')
      this.checkStatus()
    }, interval)
  }

  private stopAutoCheck() {
    if (this.checkInterval) {
      console.log('MCPStatusManager: 停止自动检查')
      clearInterval(this.checkInterval)
      this.checkInterval = null
    }
  }

  async checkStatus(force = false): Promise<void> {
    const now = Date.now()
    
    // 防止频繁检查
    if (!force && now - this.lastCheckTime < this.MIN_CHECK_INTERVAL) {
      return
    }
    
    if (this.isLoading && !force) return
    
    this.lastCheckTime = now
    this.isLoading = true
    this.error = null
    this.notifyListeners()

    try {
      const response = await mcpApi.getStatus()
      
      if (response.success && response.data) {
        const apiData = response.data
        const newStatus: MCPStatus = {
          ready: apiData.ready || false,
          configLoaded: apiData.configLoaded || false,
          serversConnected: apiData.serversConnected || false,
          toolsLoaded: apiData.toolsLoaded || false,
          keywordsMapped: apiData.keywordsMapped || false,
          error: apiData.error,
          details: {
            totalServers: apiData.details?.totalServers || 0,
            connectedServers: apiData.details?.connectedServers || 0,
            totalTools: apiData.details?.totalTools || 0,
            keywordMappings: apiData.details?.keywordMappings || 0
          },
          systemInfo: apiData.systemInfo
        }
        
        const wasReady = this.status?.ready
        this.status = newStatus
        
        // 如果状态发生变化，调整检查间隔
        if (wasReady !== newStatus.ready && this.checkInterval) {
          const newInterval = newStatus.ready ? 60000 : 30000 // 更长的间隔
          console.log(`MCPStatusManager: 状态变化，调整检查间隔为 ${newInterval}ms`)
          clearInterval(this.checkInterval)
          this.checkInterval = setInterval(() => {
            console.log('MCPStatusManager: 执行调整后的定期检查')
            this.checkStatus()
          }, newInterval)
        }
      } else {
        throw new Error(response.error?.message || 'Failed to get MCP status')
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      this.error = errorMessage
      console.error('Failed to check MCP status:', errorMessage)
    } finally {
      this.isLoading = false
      this.notifyListeners()
    }
  }

  async reinitialize(force = false): Promise<void> {
    this.isLoading = true
    this.error = null
    this.notifyListeners()

    try {
      const response = await mcpApi.reinitialize(force)
      
      if (response.success && response.data) {
        const apiData = response.data
        this.status = {
          ready: apiData.ready || false,
          configLoaded: apiData.configLoaded || false,
          serversConnected: apiData.serversConnected || false,
          toolsLoaded: apiData.toolsLoaded || false,
          keywordsMapped: apiData.keywordsMapped || false,
          error: apiData.error,
          details: {
            totalServers: apiData.details?.totalServers || 0,
            connectedServers: apiData.details?.connectedServers || 0,
            totalTools: apiData.details?.totalTools || 0,
            keywordMappings: apiData.details?.keywordMappings || 0
          },
          systemInfo: apiData.systemInfo
        }
      } else {
        throw new Error(response.error?.message || 'Failed to reinitialize MCP system')
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      this.error = errorMessage
      console.error('Failed to reinitialize MCP system:', errorMessage)
    } finally {
      this.isLoading = false
      this.notifyListeners()
    }
  }

  getCurrentStatus() {
    return {
      status: this.status,
      isLoading: this.isLoading,
      error: this.error
    }
  }
}

export interface MCPStatus {
  ready: boolean
  configLoaded: boolean
  serversConnected: boolean
  toolsLoaded: boolean
  keywordsMapped: boolean
  error?: string
  details: {
    totalServers: number
    connectedServers: number
    totalTools: number
    keywordMappings: number
  }
  systemInfo?: {
    servers: Record<string, any>
    toolCount: number
    capabilities: string[]
  }
}

export interface UseMCPStatusReturn {
  status: MCPStatus | null
  isLoading: boolean
  error: string | null
  checkStatus: () => Promise<void>
  reinitialize: (force?: boolean) => Promise<void>
  isReady: boolean
}

/**
 * Custom hook for managing MCP system status
 * 使用全局状态管理器，避免重复的API调用
 */
export const useMCPStatus = (options: {
  onStatusChange?: (status: MCPStatus) => void
  onInitializationComplete?: () => void
} = {}): UseMCPStatusReturn => {
  const { onStatusChange, onInitializationComplete } = options
  
  const [status, setStatus] = useState<MCPStatus | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const manager = MCPStatusManager.getInstance()
  const previousReadyRef = useRef<boolean | undefined>(undefined)

  useEffect(() => {
    const unsubscribe = manager.addListener((newStatus, newIsLoading, newError) => {
      setStatus(newStatus)
      setIsLoading(newIsLoading)
      setError(newError)
      
      if (newStatus) {
        onStatusChange?.(newStatus)
        
        // 检查是否刚刚变为就绪状态
        if (previousReadyRef.current === false && newStatus.ready) {
          onInitializationComplete?.()
        }
        previousReadyRef.current = newStatus.ready
      }
    })

    return unsubscribe
  }, [onStatusChange, onInitializationComplete])

  const checkStatus = useCallback(async () => {
    await manager.checkStatus(true) // 强制检查
  }, [manager])

  const reinitialize = useCallback(async (force = false) => {
    await manager.reinitialize(force)
  }, [manager])

  return {
    status,
    isLoading,
    error,
    checkStatus,
    reinitialize,
    isReady: status?.ready || false
  }
}

export default useMCPStatus