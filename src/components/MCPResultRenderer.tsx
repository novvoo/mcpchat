'use client'

// MCPResultRenderer Component - Enhanced display for MCP tool results

import React, { useState } from 'react'
import { ChevronDown, ChevronRight, Copy, Check } from 'lucide-react'

interface MCPResultRendererProps {
  result: any
  toolName?: string
  className?: string
}

/**
 * Check if the result is a simple value that should be displayed inline
 */
const isSimpleValue = (value: any): boolean => {
  if (value === null || value === undefined) return true
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return true
  if (Array.isArray(value) && value.length <= 3 && value.every(item => typeof item === 'string' || typeof item === 'number')) return true
  return false
}

/**
 * Format simple values for display
 */
const formatSimpleValue = (value: any): string => {
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'
  if (typeof value === 'string') return value
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'number') return value.toString()
  if (Array.isArray(value)) return value.join(', ')
  return JSON.stringify(value)
}

/**
 * Detect the type of MCP result for specialized rendering
 */
const detectResultType = (result: any, toolName?: string): string => {
  if (!result || typeof result !== 'object') return 'simple'
  
  // N-Queens result
  if (result.success !== undefined && result.solution && Array.isArray(result.solution) && 
      result.solution.every((item: any) => typeof item === 'number')) return 'nqueens'
  
  // Sudoku result
  if (result.success !== undefined && result.solution && Array.isArray(result.solution) && 
      Array.isArray(result.solution[0])) return 'sudoku'
  
  // 24-point game result
  if (result.success !== undefined && result.expression) return '24point'
  
  // File operations
  if (result.path || result.filename) return 'file'
  
  // List/array results
  if (Array.isArray(result) || (result.items && Array.isArray(result.items))) return 'list'
  
  // Search results
  if (result.results || result.matches) return 'search'
  
  // Status/success results
  if (result.success !== undefined || result.status) return 'status'
  
  // Math/calculation results
  if (result.result !== undefined && (result.calculation || result.formula || result.steps)) return 'calculation'
  
  // Algorithm results (general)
  if (result.success !== undefined && (result.algorithm || result.steps || result.iterations)) return 'algorithm'
  
  // Tool-specific detection
  if (toolName) {
    if (toolName.includes('search') || toolName.includes('find')) return 'search'
    if (toolName.includes('file') || toolName.includes('read') || toolName.includes('write')) return 'file'
    if (toolName.includes('list') || toolName.includes('directory')) return 'list'
    if (toolName.includes('queens') || toolName.includes('n_queens')) return 'nqueens'
    if (toolName.includes('solve') || toolName.includes('calculate') || toolName.includes('math')) return 'calculation'
  }
  
  return 'object'
}

/**
 * Render N-Queens results
 */
const renderNQueensResult = (result: any) => {
  const solution = result.solution
  const n = solution ? solution.length : 8
  
  return (
    <div className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-950/30 dark:to-indigo-950/30 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-2xl">♛</span>
        <h4 className="text-lg font-semibold text-purple-900 dark:text-purple-100">
          {n}皇后问题求解结果
        </h4>
      </div>
      
      {result.success ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-green-500 text-xl">✅</span>
            <span className="text-green-700 dark:text-green-300 font-medium">
              找到解决方案！
            </span>
          </div>
          
          {solution && (
            <div className="bg-white dark:bg-gray-800 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                棋盘布局 ({n}×{n}):
              </p>
              <div className={`grid gap-1 max-w-sm mx-auto`} style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
                {Array.from({ length: n * n }, (_, index) => {
                  const row = Math.floor(index / n)
                  const col = index % n
                  const hasQueen = solution[row] === col
                  const isLight = (row + col) % 2 === 0
                  
                  return (
                    <div
                      key={index}
                      className={`
                        w-8 h-8 flex items-center justify-center text-lg font-bold
                        border border-purple-200 dark:border-purple-700
                        ${isLight 
                          ? 'bg-purple-100 dark:bg-purple-900/30' 
                          : 'bg-purple-200 dark:bg-purple-800/30'
                        }
                        ${hasQueen ? 'text-purple-700 dark:text-purple-300' : 'text-transparent'}
                      `}
                    >
                      {hasQueen ? '♛' : ''}
                    </div>
                  )
                })}
              </div>
              
              <div className="mt-3 text-sm text-gray-600 dark:text-gray-400">
                <p className="mb-1">解向量: [{solution.join(', ')}]</p>
                <p className="text-xs">每个数字表示该行皇后所在的列位置</p>
              </div>
            </div>
          )}
          
          <div className="text-xs text-purple-600 dark:text-purple-400">
            💡 每行、每列和每条对角线上都只有一个皇后
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-red-500 text-xl">❌</span>
            <span className="text-red-700 dark:text-red-300 font-medium">
              无法找到解决方案
            </span>
          </div>
          
          {result.error && (
            <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-3">
              <p className="text-sm text-red-700 dark:text-red-300">
                {result.error}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Render sudoku results
 */
const renderSudokuResult = (result: any) => {
  const solution = result.solution
  
  return (
    <div className="bg-gradient-to-r from-green-50 to-teal-50 dark:from-green-950/30 dark:to-teal-950/30 border border-green-200 dark:border-green-800 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-2xl">🧩</span>
        <h4 className="text-lg font-semibold text-green-900 dark:text-green-100">
          数独求解结果
        </h4>
      </div>
      
      {result.success ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-green-500 text-xl">✅</span>
            <span className="text-green-700 dark:text-green-300 font-medium">
              数独已成功求解！
            </span>
          </div>
          
          {solution && (
            <div className="bg-white dark:bg-gray-800 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                解答:
              </p>
              <div className="grid grid-cols-9 gap-1 max-w-xs mx-auto">
                {solution.flat().map((num: number, index: number) => {
                  const row = Math.floor(index / 9)
                  const col = index % 9
                  const isBoxBorder = (row % 3 === 2 && row !== 8) || (col % 3 === 2 && col !== 8)
                  
                  return (
                    <div
                      key={index}
                      className={`
                        w-8 h-8 flex items-center justify-center text-sm font-mono
                        bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-700
                        ${isBoxBorder ? 'border-r-2 border-b-2 border-green-400 dark:border-green-600' : ''}
                        ${row === 8 ? 'border-b-2 border-green-400 dark:border-green-600' : ''}
                        ${col === 8 ? 'border-r-2 border-green-400 dark:border-green-600' : ''}
                      `}
                    >
                      {num}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          
          <div className="text-xs text-green-600 dark:text-green-400">
            💡 每行、每列和每个3×3宫格都包含1-9的数字
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-red-500 text-xl">❌</span>
            <span className="text-red-700 dark:text-red-300 font-medium">
              无法求解此数独
            </span>
          </div>
          
          {result.error && (
            <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-3">
              <p className="text-sm text-red-700 dark:text-red-300">
                {result.error}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Render 24-point game results
 */
const render24PointResult = (result: any) => {
  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-2xl">🎯</span>
        <h4 className="text-lg font-semibold text-blue-900 dark:text-blue-100">
          24点游戏结果
        </h4>
      </div>
      
      {result.success ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-green-500 text-xl">✅</span>
            <span className="text-green-700 dark:text-green-300 font-medium">
              找到解决方案！
            </span>
          </div>
          
          {result.expression && (
            <div className="bg-white dark:bg-gray-800 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                计算表达式:
              </p>
              <div className="font-mono text-lg text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-950/30 px-3 py-2 rounded border">
                {result.expression} = 24
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-red-500 text-xl">❌</span>
            <span className="text-red-700 dark:text-red-300 font-medium">
              无法找到解决方案
            </span>
          </div>
          
          {result.error && (
            <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-3">
              <p className="text-sm text-red-700 dark:text-red-300">
                {result.error}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Render file operation results
 */
const renderFileResult = (result: any) => {
  return (
    <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border border-green-200 dark:border-green-800 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">📁</span>
        <h4 className="text-lg font-semibold text-green-900 dark:text-green-100">
          文件操作结果
        </h4>
      </div>
      
      {result.path && (
        <div className="mb-2">
          <span className="text-sm text-green-700 dark:text-green-300 font-medium">
            路径: 
          </span>
          <code className="ml-2 px-2 py-1 bg-green-100 dark:bg-green-900/30 rounded text-sm">
            {result.path}
          </code>
        </div>
      )}
      
      {result.content && (
        <div className="mt-3">
          <span className="text-sm text-green-700 dark:text-green-300 font-medium">
            内容:
          </span>
          <pre className="mt-2 p-3 bg-white dark:bg-gray-800 border border-green-200 dark:border-green-800 rounded text-sm overflow-x-auto">
            {typeof result.content === 'string' ? result.content : JSON.stringify(result.content, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}

/**
 * Render list results
 */
const renderListResult = (result: any) => {
  const items = Array.isArray(result) ? result : (result.items || result.results || [])
  
  return (
    <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">📋</span>
        <h4 className="text-lg font-semibold text-purple-900 dark:text-purple-100">
          列表结果 ({items.length} 项)
        </h4>
      </div>
      
      <div className="space-y-2 max-h-60 overflow-y-auto">
        {items.slice(0, 10).map((item: any, index: number) => (
          <div key={index} className="flex items-start gap-2 p-2 bg-white dark:bg-gray-800 border border-purple-200 dark:border-purple-800 rounded">
            <span className="text-purple-500 font-mono text-sm mt-0.5">
              {index + 1}.
            </span>
            <div className="flex-1 text-sm">
              {typeof item === 'string' ? item : JSON.stringify(item)}
            </div>
          </div>
        ))}
        {items.length > 10 && (
          <div className="text-center text-sm text-purple-600 dark:text-purple-400 py-2">
            ... 还有 {items.length - 10} 项
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Render calculation results
 */
const renderCalculationResult = (result: any) => {
  return (
    <div className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-2xl">🧮</span>
        <h4 className="text-lg font-semibold text-blue-900 dark:text-blue-100">
          计算结果
        </h4>
      </div>
      
      {result.success ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-green-500 text-xl">✅</span>
            <span className="text-green-700 dark:text-green-300 font-medium">
              计算完成
            </span>
          </div>
          
          {result.result !== undefined && (
            <div className="bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                结果:
              </p>
              <div className="font-mono text-lg text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/30 px-3 py-2 rounded border">
                {result.result}
              </div>
            </div>
          )}
          
          {result.formula && (
            <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
              <p className="text-sm text-blue-700 dark:text-blue-300 mb-1">
                公式: <code className="font-mono">{result.formula}</code>
              </p>
            </div>
          )}
          
          {result.steps && Array.isArray(result.steps) && (
            <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
              <p className="text-sm text-blue-700 dark:text-blue-300 mb-2">计算步骤:</p>
              <ol className="text-sm text-blue-600 dark:text-blue-400 space-y-1">
                {result.steps.map((step: any, index: number) => (
                  <li key={index} className="flex gap-2">
                    <span className="font-mono text-blue-500">{index + 1}.</span>
                    <span>{typeof step === 'string' ? step : JSON.stringify(step)}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-red-500 text-xl">❌</span>
            <span className="text-red-700 dark:text-red-300 font-medium">
              计算失败
            </span>
          </div>
          
          {result.error && (
            <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-3">
              <p className="text-sm text-red-700 dark:text-red-300">
                {result.error}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Render algorithm results
 */
const renderAlgorithmResult = (result: any) => {
  return (
    <div className="bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/30 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-2xl">⚡</span>
        <h4 className="text-lg font-semibold text-orange-900 dark:text-orange-100">
          算法执行结果
        </h4>
      </div>
      
      {result.success ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-green-500 text-xl">✅</span>
            <span className="text-green-700 dark:text-green-300 font-medium">
              算法执行成功
            </span>
          </div>
          
          {result.algorithm && (
            <div className="bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded-lg p-3">
              <p className="text-sm text-orange-700 dark:text-orange-300">
                算法: <span className="font-mono">{result.algorithm}</span>
              </p>
            </div>
          )}
          
          {result.iterations && (
            <div className="text-sm text-orange-600 dark:text-orange-400">
              迭代次数: {result.iterations}
            </div>
          )}
          
          {result.steps && Array.isArray(result.steps) && (
            <div className="bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded-lg p-3">
              <p className="text-sm text-orange-700 dark:text-orange-300 mb-2">执行步骤:</p>
              <div className="text-sm text-orange-600 dark:text-orange-400 space-y-1 max-h-32 overflow-y-auto">
                {result.steps.slice(0, 5).map((step: any, index: number) => (
                  <div key={index} className="flex gap-2">
                    <span className="font-mono text-orange-500">{index + 1}.</span>
                    <span>{typeof step === 'string' ? step : JSON.stringify(step)}</span>
                  </div>
                ))}
                {result.steps.length > 5 && (
                  <div className="text-center text-orange-500 italic">
                    ... 还有 {result.steps.length - 5} 个步骤
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-red-500 text-xl">❌</span>
            <span className="text-red-700 dark:text-red-300 font-medium">
              算法执行失败
            </span>
          </div>
          
          {result.error && (
            <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-3">
              <p className="text-sm text-red-700 dark:text-red-300">
                {result.error}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Render status results
 */
const renderStatusResult = (result: any) => {
  const isSuccess = result.success === true || result.status === 'success' || result.status === 'ok'
  
  return (
    <div className={`border rounded-lg p-4 ${
      isSuccess 
        ? 'bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border-green-200 dark:border-green-800'
        : 'bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-950/30 dark:to-rose-950/30 border-red-200 dark:border-red-800'
    }`}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">{isSuccess ? '✅' : '❌'}</span>
        <h4 className={`text-lg font-semibold ${
          isSuccess 
            ? 'text-green-900 dark:text-green-100'
            : 'text-red-900 dark:text-red-100'
        }`}>
          操作{isSuccess ? '成功' : '失败'}
        </h4>
      </div>
      
      {result.message && (
        <p className={`text-sm ${
          isSuccess 
            ? 'text-green-700 dark:text-green-300'
            : 'text-red-700 dark:text-red-300'
        }`}>
          {result.message}
        </p>
      )}
      
      {result.error && (
        <div className="mt-2 p-2 bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded">
          <p className="text-sm text-red-700 dark:text-red-300">
            错误: {result.error}
          </p>
        </div>
      )}
    </div>
  )
}

/**
 * Collapsible JSON viewer
 */
const CollapsibleJSON: React.FC<{ data: any; title?: string; defaultExpanded?: boolean }> = ({ 
  data, 
  title = "详细数据", 
  defaultExpanded = false 
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const [copied, setCopied] = useState(false)
  
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }
  
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <button
        onClick={(e) => {
          e.stopPropagation()
          setIsExpanded(!isExpanded)
        }}
        className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-gray-500" />
          ) : (
            <ChevronRight className="h-4 w-4 text-gray-500" />
          )}
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {title}
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleCopy()
            }}
            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
            title="复制JSON"
          >
            {copied ? (
              <Check className="h-3 w-3 text-green-500" />
            ) : (
              <Copy className="h-3 w-3 text-gray-500" />
            )}
          </button>
        </div>
      </button>
      
      {isExpanded && (
        <div className="p-3 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
          <pre className="text-xs text-gray-600 dark:text-gray-400 overflow-x-auto whitespace-pre-wrap">
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}

/**
 * Main MCPResultRenderer component
 */
export const MCPResultRenderer: React.FC<MCPResultRendererProps> = ({
  result,
  toolName,
  className = ""
}) => {
  if (result === null || result === undefined) {
    return (
      <div className={`text-sm text-gray-500 dark:text-gray-400 italic ${className}`}>
        无返回结果
      </div>
    )
  }

  // Handle simple values
  if (isSimpleValue(result)) {
    return (
      <div className={`text-sm text-gray-700 dark:text-gray-300 ${className}`}>
        {formatSimpleValue(result)}
      </div>
    )
  }

  // Detect result type and render accordingly
  const resultType = detectResultType(result, toolName)
  
  return (
    <div className={`space-y-3 ${className}`}>
      {/* Specialized renderers */}
      {resultType === 'nqueens' && renderNQueensResult(result)}
      {resultType === 'sudoku' && renderSudokuResult(result)}
      {resultType === '24point' && render24PointResult(result)}
      {resultType === 'calculation' && renderCalculationResult(result)}
      {resultType === 'algorithm' && renderAlgorithmResult(result)}
      {resultType === 'file' && renderFileResult(result)}
      {resultType === 'list' && renderListResult(result)}
      {resultType === 'status' && renderStatusResult(result)}
      
      {/* Generic object renderer */}
      {resultType === 'object' && (
        <div className="bg-gradient-to-r from-gray-50 to-slate-50 dark:from-gray-950/30 dark:to-slate-950/30 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">📊</span>
            <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              工具执行结果
            </h4>
          </div>
          
          {/* Show key-value pairs for objects */}
          {typeof result === 'object' && !Array.isArray(result) && (
            <div className="space-y-2 mb-3">
              {Object.entries(result).slice(0, 5).map(([key, value]) => (
                <div key={key} className="flex items-start gap-2">
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400 min-w-0 flex-shrink-0">
                    {key}:
                  </span>
                  <span className="text-sm text-gray-700 dark:text-gray-300 break-words">
                    {isSimpleValue(value) ? formatSimpleValue(value) : '[复杂对象]'}
                  </span>
                </div>
              ))}
              {Object.keys(result).length > 5 && (
                <div className="text-sm text-gray-500 dark:text-gray-400 italic">
                  ... 还有 {Object.keys(result).length - 5} 个字段
                </div>
              )}
            </div>
          )}
        </div>
      )}
      
      {/* Always show collapsible JSON for complex results */}
      {!isSimpleValue(result) && (
        <CollapsibleJSON 
          data={result} 
          title="查看完整JSON数据"
          defaultExpanded={false}
        />
      )}
    </div>
  )
}

export default MCPResultRenderer