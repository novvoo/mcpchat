// MCP Server Health Monitoring Service

import { ServerStatus, MCPHealthCheck, MCPEventListener, MCPEvent } from '@/types/mcp'
import { getMCPManager } from './mcp-manager'

/**
 * Health monitoring service for MCP servers
 */
export class MCPHealthMonitor {
  private static instance: MCPHealthMonitor
  private healthChecks: Map<string, MCPHealthCheck> = new Map()
  private monitoringInterval: NodeJS.Timeout | null = null
  private readonly CHECK_INTERVAL = 30000 // 30 seconds
  private eventListeners: Set<MCPEventListener> = new Set()

  private constructor() {}

  /**
   * Get singleton instance
   */
  public static getInstance(): MCPHealthMonitor {
    if (!MCPHealthMonitor.instance) {
      MCPHealthMonitor.instance = new MCPHealthMonitor()
    }
    return MCPHealthMonitor.instance
  }

  /**
   * Start health monitoring
   */
  startMonitoring(): void {
    if (this.monitoringInterval) {
      return // Already monitoring
    }

    console.log('Starting MCP health monitoring...')
    
    // Initial health check
    this.performHealthChecks()
    
    // Set up periodic health checks
    this.monitoringInterval = setInterval(() => {
      this.performHealthChecks()
    }, this.CHECK_INTERVAL)
  }

  /**
   * Stop health monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
      this.monitoringInterval = null
      console.log('Stopped MCP health monitoring')
    }
  }

  /**
   * Perform health checks on all servers
   */
  private async performHealthChecks(): Promise<void> {
    try {
      const mcpManager = getMCPManager()
      const serverStatuses = mcpManager.getServerStatus()

      for (const [serverId, status] of Object.entries(serverStatuses)) {
        await this.checkServerHealth(serverId, status)
      }
    } catch (error) {
      console.error('Error performing health checks:', error)
    }
  }

  /**
   * Check health of a specific server
   */
  private async checkServerHealth(serverId: string, status: ServerStatus): Promise<void> {
    const startTime = Date.now()
    
    try {
      let healthStatus: 'healthy' | 'unhealthy' | 'unknown' = 'unknown'
      let error: string | undefined

      switch (status.status) {
        case 'connected':
          // Server is connected, perform additional checks
          const mcpManager = getMCPManager()
          const server = mcpManager.getRegistry().get(serverId)
          
          if (server && server.isConnected()) {
            try {
              // Try to list tools as a health check
              await server.listTools()
              healthStatus = 'healthy'
            } catch (toolError) {
              healthStatus = 'unhealthy'
              error = `Tool listing failed: ${toolError instanceof Error ? toolError.message : 'Unknown error'}`
            }
          } else {
            healthStatus = 'unhealthy'
            error = 'Server not found in registry'
          }
          break

        case 'initializing':
          healthStatus = 'unknown'
          break

        case 'disconnected':
        case 'error':
          healthStatus = 'unhealthy'
          error = status.error || 'Server disconnected'
          break

        default:
          healthStatus = 'unknown'
      }

      const responseTime = Date.now() - startTime
      
      const healthCheck: MCPHealthCheck = {
        serverId,
        status: healthStatus,
        lastCheck: new Date(),
        responseTime,
        error
      }

      // Update health check record
      const previousCheck = this.healthChecks.get(serverId)
      this.healthChecks.set(serverId, healthCheck)

      // Emit health change events
      if (!previousCheck || previousCheck.status !== healthCheck.status) {
        this.emitHealthChangeEvent(serverId, healthCheck, previousCheck)
      }

    } catch (error) {
      const healthCheck: MCPHealthCheck = {
        serverId,
        status: 'unhealthy',
        lastCheck: new Date(),
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Health check failed'
      }

      this.healthChecks.set(serverId, healthCheck)
    }
  }

  /**
   * Emit health change event
   */
  private emitHealthChangeEvent(
    serverId: string, 
    current: MCPHealthCheck, 
    previous?: MCPHealthCheck
  ): void {
    const event: MCPEvent = {
      type: current.status === 'healthy' ? 'server_connected' : 'server_error',
      serverId,
      timestamp: new Date(),
      data: {
        currentHealth: current,
        previousHealth: previous,
        healthChanged: true
      }
    }

    // Notify all listeners
    for (const listener of this.eventListeners) {
      try {
        listener(event)
      } catch (error) {
        console.error('Error in health event listener:', error)
      }
    }
  }

  /**
   * Get health status for a specific server
   */
  getServerHealth(serverId: string): MCPHealthCheck | undefined {
    return this.healthChecks.get(serverId)
  }

  /**
   * Get health status for all servers
   */
  getAllServerHealth(): Record<string, MCPHealthCheck> {
    const health: Record<string, MCPHealthCheck> = {}
    for (const [serverId, check] of this.healthChecks) {
      health[serverId] = check
    }
    return health
  }

  /**
   * Get list of healthy servers
   */
  getHealthyServers(): string[] {
    const healthy: string[] = []
    for (const [serverId, check] of this.healthChecks) {
      if (check.status === 'healthy') {
        healthy.push(serverId)
      }
    }
    return healthy
  }

  /**
   * Get list of unhealthy servers
   */
  getUnhealthyServers(): string[] {
    const unhealthy: string[] = []
    for (const [serverId, check] of this.healthChecks) {
      if (check.status === 'unhealthy') {
        unhealthy.push(serverId)
      }
    }
    return unhealthy
  }

  /**
   * Check if all servers are healthy
   */
  areAllServersHealthy(): boolean {
    for (const check of this.healthChecks.values()) {
      if (check.status !== 'healthy') {
        return false
      }
    }
    return this.healthChecks.size > 0
  }

  /**
   * Get overall health summary
   */
  getHealthSummary(): {
    total: number
    healthy: number
    unhealthy: number
    unknown: number
    overallStatus: 'healthy' | 'degraded' | 'unhealthy'
  } {
    let healthy = 0
    let unhealthy = 0
    let unknown = 0

    for (const check of this.healthChecks.values()) {
      switch (check.status) {
        case 'healthy':
          healthy++
          break
        case 'unhealthy':
          unhealthy++
          break
        case 'unknown':
          unknown++
          break
      }
    }

    const total = this.healthChecks.size
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy'

    if (total === 0) {
      overallStatus = 'unhealthy'
    } else if (healthy === total) {
      overallStatus = 'healthy'
    } else if (unhealthy === total) {
      overallStatus = 'unhealthy'
    } else {
      overallStatus = 'degraded'
    }

    return {
      total,
      healthy,
      unhealthy,
      unknown,
      overallStatus
    }
  }

  /**
   * Add health event listener
   */
  addEventListener(listener: MCPEventListener): void {
    this.eventListeners.add(listener)
  }

  /**
   * Remove health event listener
   */
  removeEventListener(listener: MCPEventListener): void {
    this.eventListeners.delete(listener)
  }

  /**
   * Force health check for a specific server
   */
  async forceHealthCheck(serverId: string): Promise<MCPHealthCheck | undefined> {
    try {
      const mcpManager = getMCPManager()
      const serverStatuses = mcpManager.getServerStatus()
      const status = serverStatuses[serverId]

      if (status) {
        await this.checkServerHealth(serverId, status)
        return this.healthChecks.get(serverId)
      }
    } catch (error) {
      console.error(`Error forcing health check for server ${serverId}:`, error)
    }
    return undefined
  }

  /**
   * Clear health history
   */
  clearHealthHistory(): void {
    this.healthChecks.clear()
  }

  /**
   * Get health check interval
   */
  getCheckInterval(): number {
    return this.CHECK_INTERVAL
  }

  /**
   * Check if monitoring is active
   */
  isMonitoring(): boolean {
    return this.monitoringInterval !== null
  }
}

/**
 * Convenience function to get health monitor instance
 */
export const getMCPHealthMonitor = () => MCPHealthMonitor.getInstance()

/**
 * Convenience function to start health monitoring
 */
export const startMCPHealthMonitoring = () => {
  const monitor = getMCPHealthMonitor()
  monitor.startMonitoring()
  return monitor
}

/**
 * Convenience function to stop health monitoring
 */
export const stopMCPHealthMonitoring = () => {
  const monitor = getMCPHealthMonitor()
  monitor.stopMonitoring()
}