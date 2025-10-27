'use client'

// GameResultParser Component - Parse and display game results from MCP tools

import React from 'react'

interface GameResult {
  success: boolean
  expression?: string
  error?: string | null
  numbers?: number[]
  target?: number
}

interface GameResultParserProps {
  content: string
  className?: string
}

/**
 * Parse 24-point game result from JSON string
 */
const parse24PointResult = (content: string): GameResult | null => {
  try {
    // Try to extract JSON from the content
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null
    
    const result = JSON.parse(jsonMatch[0])
    
    // Validate it's a 24-point game result
    if (typeof result.success === 'boolean' && 
        (result.expression || result.error)) {
      return result
    }
    
    return null
  } catch (error) {
    return null
  }
}

/**
 * Extract numbers from context or expression
 */
const extractNumbers = (content: string, expression?: string): number[] => {
  // Try to find numbers in the original content
  const numberMatches = content.match(/\b\d+\b/g)
  if (numberMatches && numberMatches.length >= 4) {
    return numberMatches.slice(0, 4).map(Number)
  }
  
  // Try to extract from expression
  if (expression) {
    const exprNumbers = expression.match(/\b\d+\b/g)
    if (exprNumbers) {
      return exprNumbers.map(Number)
    }
  }
  
  return []
}

/**
 * GameResultParser component for displaying game results
 */
export const GameResultParser: React.FC<GameResultParserProps> = ({
  content,
  className = ""
}) => {
  const gameResult = parse24PointResult(content)
  
  if (!gameResult) {
    return null
  }
  
  const numbers = extractNumbers(content, gameResult.expression)
  
  return (
    <div className={`bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mt-3 ${className}`}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-2xl">🎯</span>
        <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100">
          24点游戏结果
        </h3>
      </div>
      
      {numbers.length > 0 && (
        <div className="mb-3">
          <p className="text-sm text-blue-700 dark:text-blue-300 mb-2">
            使用数字: {numbers.join(', ')}
          </p>
        </div>
      )}
      
      {gameResult.success ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-green-500 text-xl">✅</span>
            <span className="text-green-700 dark:text-green-300 font-medium">
              找到解决方案！
            </span>
          </div>
          
          {gameResult.expression && (
            <div className="bg-white dark:bg-gray-800 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                计算表达式:
              </p>
              <div className="font-mono text-lg text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-950/30 px-3 py-2 rounded border">
                {gameResult.expression} = 24
              </div>
            </div>
          )}
          
          <div className="text-xs text-blue-600 dark:text-blue-400">
            💡 每个数字都使用了一次，通过基本的加减乘除运算得到24
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
          
          {gameResult.error && (
            <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-3">
              <p className="text-sm text-red-700 dark:text-red-300">
                {gameResult.error}
              </p>
            </div>
          )}
          
          <div className="text-xs text-blue-600 dark:text-blue-400">
            💡 尝试其他数字组合，或检查输入的数字是否正确
          </div>
        </div>
      )}
    </div>
  )
}

export default GameResultParser