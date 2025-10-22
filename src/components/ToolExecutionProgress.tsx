'use client'

// Tool Execution Progress Component - Shows progress for MCP tool execution

import React, { useState, useEffect } from 'react'
import { ToolCall } from '@/types'
import { LoadingIndicator, ToolExecutionIndicator } from './LoadingIndicator'

export interface ToolExecutionStep {
  id: string
  name: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  startTime?: Date
  endTime?: Date
  error?: string
  result?: any
}

export interface ToolExecutionProgressProps {
  toolCalls: ToolCall[]
  onComplete?: (results: ToolCall[]) => void
  onError?: (error: string) => void
  showDetails?: boolean
  className?: string
}

/**
 * Tool execution progress component with step-by-step visualization
 */
export const ToolExecutionProgress: React.FC<ToolExecutionProgressProps> = ({
  toolCalls,
  onComplete,
  onError,
  showDetails = true,
  className = ''
}) => {
  const [steps, setSteps] = useState<ToolExecutionStep[]>([])
  const [currentStep, setCurrentStep] = useState<string | null>(null)
  const [isExpanded, setIsExpanded] = useState(false)

  // Initialize steps from tool calls
  useEffect(() => {
    const initialSteps: ToolExecutionStep[] = toolCalls.map(toolCall => ({
      id: toolCall.id,
      name: toolCall.name,
      status: 'pending'
    }))
    
    setSteps(initialSteps)
    
    // Start executing the first tool
    if (initialSteps.length > 0) {
      setCurrentStep(initialSteps[0].id)
      updateStepStatus(initialSteps[0].id, 'running', { startTime: new Date() })
    }
  }, [toolCalls])

  // Update step status
  const updateStepStatus = (
    stepId: string, 
    status: ToolExecutionStep['status'], 
    updates: Partial<ToolExecutionStep> = {}
  ) => {
    setSteps(prev => prev.map(step => 
      step.id === stepId 
        ? { ...step, status, ...updates }
        : step
    ))
  }

  // Simulate tool execution progress (in real implementation, this would be driven by actual API calls)
  useEffect(() => {
    if (!currentStep) return

    const currentStepData = steps.find(s => s.id === currentStep)
    if (!currentStepData || currentStepData.status !== 'running') return

    // Simulate execution time
    const executionTime = Math.random() * 3000 + 1000 // 1-4 seconds
    
    const timer = setTimeout(() => {
      const toolCall = toolCalls.find(tc => tc.id === currentStep)
      
      if (toolCall?.error) {
        // Handle error
        updateStepStatus(currentStep, 'failed', {
          endTime: new Date(),
          error: toolCall.error
        })
        onError?.(toolCall.error)
      } else {
        // Handle success
        updateStepStatus(currentStep, 'completed', {
          endTime: new Date(),
          result: toolCall?.result
        })
        
        // Move to next step
        const currentIndex = steps.findIndex(s => s.id === currentStep)
        const nextStep = steps[currentIndex + 1]
        
        if (nextStep) {
          setCurrentStep(nextStep.id)
          updateStepStatus(nextStep.id, 'running', { startTime: new Date() })
        } else {
          // All steps completed
          setCurrentStep(null)
          onComplete?.(toolCalls)
        }
      }
    }, executionTime)

    return () => clearTimeout(timer)
  }, [currentStep, steps, toolCalls, onComplete, onError])

  const getStepIcon = (step: ToolExecutionStep) => {
    switch (step.status) {
      case 'pending':
        return (
          <div className="w-4 h-4 border-2 border-gray-300 rounded-full" />
        )
      case 'running':
        return (
          <LoadingIndicator variant="spinner" size="sm" color="blue" />
        )
      case 'completed':
        return (
          <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
            <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )
      case 'failed':
        return (
          <div className="w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
            <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
        )
    }
  }

  const getStepDuration = (step: ToolExecutionStep): string | null => {
    if (!step.startTime) return null
    
    const endTime = step.endTime || new Date()
    const duration = endTime.getTime() - step.startTime.getTime()
    
    if (duration < 1000) return `${duration}ms`
    return `${(duration / 1000).toFixed(1)}s`
  }

  const getOverallProgress = (): number => {
    const completedSteps = steps.filter(s => s.status === 'completed' || s.status === 'failed').length
    return steps.length > 0 ? (completedSteps / steps.length) * 100 : 0
  }

  const isExecuting = steps.some(s => s.status === 'running')
  const hasErrors = steps.some(s => s.status === 'failed')
  const isCompleted = steps.length > 0 && steps.every(s => s.status === 'completed' || s.status === 'failed')

  if (steps.length === 0) return null

  return (
    <div className={`bg-blue-50 border border-blue-200 rounded-lg p-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          {isExecuting ? (
            <ToolExecutionIndicator />
          ) : isCompleted ? (
            hasErrors ? (
              <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
            ) : (
              <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )
          ) : (
            <LoadingIndicator variant="pulse" size="sm" color="blue" />
          )}
          
          <span className="text-sm font-medium text-blue-900">
            {isExecuting ? 'Executing Tools' : 
             isCompleted ? (hasErrors ? 'Execution Failed' : 'Tools Executed') : 
             'Preparing Tools'}
          </span>
          
          <span className="text-xs text-blue-600">
            ({steps.filter(s => s.status === 'completed').length}/{steps.length})
          </span>
        </div>

        {showDetails && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-blue-600 hover:text-blue-800 transition-colors"
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

      {/* Progress bar */}
      <div className="w-full bg-blue-100 rounded-full h-2 mb-3">
        <div 
          className={`h-2 rounded-full transition-all duration-300 ${
            hasErrors ? 'bg-red-500' : 'bg-blue-500'
          }`}
          style={{ width: `${getOverallProgress()}%` }}
        />
      </div>

      {/* Step details */}
      {showDetails && isExpanded && (
        <div className="space-y-2">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center space-x-3 text-sm">
              <div className="flex items-center space-x-2 flex-1">
                {getStepIcon(step)}
                <span className={`font-medium ${
                  step.status === 'failed' ? 'text-red-700' : 
                  step.status === 'completed' ? 'text-green-700' : 
                  step.status === 'running' ? 'text-blue-700' : 
                  'text-gray-600'
                }`}>
                  {step.name}
                </span>
              </div>
              
              <div className="flex items-center space-x-2 text-xs text-gray-500">
                {step.status === 'running' && (
                  <span className="text-blue-600">Running...</span>
                )}
                
                {getStepDuration(step) && (
                  <span>{getStepDuration(step)}</span>
                )}
                
                {step.status === 'failed' && step.error && (
                  <span className="text-red-600 max-w-xs truncate" title={step.error}>
                    {step.error}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Summary for completed execution */}
      {isCompleted && !isExpanded && (
        <div className="text-xs text-blue-700">
          {hasErrors ? (
            <span>Some tools failed to execute</span>
          ) : (
            <span>All tools executed successfully</span>
          )}
        </div>
      )}
    </div>
  )
}

export default ToolExecutionProgress