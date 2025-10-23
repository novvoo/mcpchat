'use client'

import React, { useState, useEffect } from 'react'

interface KeywordStats {
  totalTools: number
  toolsWithKeywords: number
  totalKeywords: number
  mappingPercentage: number
  details: Array<{
    toolName: string
    description: string
    keywordCount: number
    hasKeywords: boolean
  }>
  lastUpdated: string
}

interface KeywordMappingStatusProps {
  className?: string
  showDetails?: boolean
}

export const KeywordMappingStatus: React.FC<KeywordMappingStatusProps> = ({
  className = "",
  showDetails = false
}) => {
  const [stats, setStats] = useState<KeywordStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showDetailedView, setShowDetailedView] = useState(showDetails)

  const fetchStats = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch('/api/tools/keyword-stats')
      const result = await response.json()
      
      if (result.success) {
        setStats(result.data)
      } else {
        setError(result.error || 'Failed to fetch stats')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const refreshKeywords = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/tools/ensure-keywords', { method: 'POST' })
      const result = await response.json()
      
      if (result.success) {
        // 刷新统计数据
        await fetchStats()
      } else {
        setError(result.error || 'Failed to refresh keywords')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    }
  }

  useEffect(() => {
    fetchStats()
  }, [])

  if (loading && !stats) {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-muted rounded-full"></div>
          <div className="h-3 bg-muted rounded w-24"></div>
        </div>
      </div>
    )
  }

  if (error && !stats) {
    return (
      <div className={`text-destructive text-xs ${className}`}>
        <div className="flex items-center gap-1">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>关键词映射加载失败</span>
        </div>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className={`text-muted-foreground text-xs ${className}`}>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-muted rounded-full animate-pulse"></div>
          <span>正在加载关键词映射...</span>
        </div>
      </div>
    )
  }

  const getStatusColor = (percentage: number) => {
    if (percentage >= 90) return 'text-green-600 dark:text-green-400'
    if (percentage >= 70) return 'text-yellow-600 dark:text-yellow-400'
    return 'text-red-600 dark:text-red-400'
  }

  const getStatusIcon = (percentage: number) => {
    if (percentage >= 90) {
      return (
        <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    }
    if (percentage >= 70) {
      return (
        <svg className="w-4 h-4 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
      )
    }
    return (
      <svg className="w-4 h-4 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  }

  return (
    <div className={`space-y-1 ${className}`}>
      {/* Main Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {getStatusIcon(stats.mappingPercentage)}
          <span className={`text-xs font-medium ${getStatusColor(stats.mappingPercentage)}`}>
            关键词映射: {stats.mappingPercentage}%
          </span>
          <span className="text-xs text-muted-foreground">
            ({stats.toolsWithKeywords}/{stats.totalTools})
          </span>
        </div>
        
        <div className="flex items-center gap-1">
          {showDetails && (
            <button
              onClick={() => setShowDetailedView(!showDetailedView)}
              className="p-1 text-muted-foreground hover:text-foreground transition-colors rounded hover:bg-accent"
              title={showDetailedView ? "隐藏详情" : "显示详情"}
            >
              <svg 
                className={`w-3 h-3 transition-transform ${showDetailedView ? 'rotate-180' : ''}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          )}
          
          <button
            onClick={refreshKeywords}
            disabled={loading}
            className="p-1 text-muted-foreground hover:text-foreground transition-colors rounded hover:bg-accent disabled:opacity-50"
            title="刷新关键词映射"
          >
            <svg 
              className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Progress Bar - only show if not 100% or if showDetails is true */}
      {(stats.mappingPercentage < 100 || showDetails) && (
        <div className="w-full bg-muted rounded-full h-1">
          <div 
            className={`h-1 rounded-full transition-all duration-300 ${
              stats.mappingPercentage >= 90 
                ? 'bg-green-600 dark:bg-green-400' 
                : stats.mappingPercentage >= 70 
                  ? 'bg-yellow-600 dark:bg-yellow-400' 
                  : 'bg-red-600 dark:bg-red-400'
            }`}
            style={{ width: `${stats.mappingPercentage}%` }}
          />
        </div>
      )}

      {/* Detailed View */}
      {showDetailedView && (
        <div className="space-y-2 pt-2 border-t border-border">
          <div className="text-xs text-muted-foreground">
            总计 {stats.totalKeywords} 个关键词映射 • 更新于 {new Date(stats.lastUpdated).toLocaleTimeString()}
          </div>
          
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {stats.details.map((tool, index) => (
              <div key={index} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    tool.hasKeywords ? 'bg-green-500' : 'bg-red-500'
                  }`} />
                  <span className="font-mono text-xs truncate">{tool.toolName}</span>
                </div>
                <span className={`text-xs ${
                  tool.hasKeywords ? 'text-muted-foreground' : 'text-red-500'
                }`}>
                  {tool.keywordCount} 个关键词
                </span>
              </div>
            ))}
          </div>
          
          {stats.toolsWithKeywords < stats.totalTools && (
            <div className="text-xs text-muted-foreground pt-1 border-t border-border">
              {stats.totalTools - stats.toolsWithKeywords} 个工具缺少关键词映射
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="text-xs text-destructive bg-destructive/10 rounded p-2">
          {error}
        </div>
      )}
    </div>
  )
}

export default KeywordMappingStatus