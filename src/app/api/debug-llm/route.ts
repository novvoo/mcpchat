import { NextRequest, NextResponse } from 'next/server'
import { getLLMService } from '@/services/llm-service'
import { ChatMessage } from '@/types'

export async function POST(request: NextRequest) {
  try {
    const { 
      message = "Hello, this is a test message", 
      includeTools = false,
      testType = "basic" 
    } = await request.json()

    console.log('=== Debug LLM Service ===')
    console.log('Test parameters:', { message, includeTools, testType })

    const llmService = getLLMService()
    
    // Initialize the LLM service first
    await llmService.initialize()
    
    const results: any = {
      testType,
      timestamp: new Date().toISOString(),
      steps: []
    }

    // Step 1: Test basic LLM configuration
    console.log('Step 1: Testing LLM configuration...')
    try {
      const config = llmService.getConfig()
      results.steps.push({
        step: 'config',
        success: true,
        data: {
          baseUrl: config.baseUrl,
          hasApiKey: !!config.headers.Authorization,
          headers: Object.keys(config.headers),
          timeout: config.timeout
        }
      })
      console.log('✅ LLM configuration loaded')
    } catch (error) {
      results.steps.push({
        step: 'config',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      console.log('❌ LLM configuration failed:', error)
    }

    // Step 2: Test basic message sending
    console.log('Step 2: Testing basic message sending...')
    const testMessages: ChatMessage[] = [
      {
        role: 'user',
        content: message
      }
    ]

    if (includeTools) {
      // Add system message with tool definitions
      testMessages.unshift({
        role: 'system',
        content: `You have access to the following tools. Use them when appropriate:

[
  {
    "name": "test_tool",
    "description": "A test tool for debugging",
    "parameters": {
      "type": "object",
      "properties": {
        "input": {
          "type": "string",
          "description": "Test input"
        }
      },
      "required": ["input"]
    }
  }
]

When you need to use a tool, respond with a tool call.`
      })
    }

    try {
      const startTime = Date.now()
      const response = await llmService.sendMessage(testMessages)
      const endTime = Date.now()

      results.steps.push({
        step: 'message',
        success: true,
        data: {
          responseTime: endTime - startTime,
          responseLength: response.content?.length || 0,
          hasToolCalls: !!(response.toolCalls && response.toolCalls.length > 0),
          toolCallCount: response.toolCalls?.length || 0,
          response: {
            content: response.content,
            toolCalls: response.toolCalls
          }
        }
      })
      console.log('✅ Message sent successfully')
      console.log('Response time:', endTime - startTime, 'ms')
      console.log('Response length:', response.content?.length || 0)
      console.log('Tool calls:', response.toolCalls?.length || 0)
    } catch (error) {
      results.steps.push({
        step: 'message',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      })
      console.log('❌ Message sending failed:', error)
    }

    // Step 3: Test different message types
    if (testType === 'comprehensive') {
      console.log('Step 3: Testing different message types...')
      
      const testCases = [
        {
          name: 'simple_question',
          messages: [{ role: 'user' as const, content: 'What is 2+2?' }]
        },
        {
          name: 'complex_reasoning',
          messages: [{ role: 'user' as const, content: 'Explain the concept of recursion in programming with an example.' }]
        },
        {
          name: 'tool_request',
          messages: [
            { role: 'system' as const, content: 'You have access to a calculator tool. Use it when needed.' },
            { role: 'user' as const, content: 'Calculate 15 * 23 + 7' }
          ]
        }
      ]

      for (const testCase of testCases) {
        try {
          const startTime = Date.now()
          const response = await llmService.sendMessage(testCase.messages)
          const endTime = Date.now()

          results.steps.push({
            step: `test_${testCase.name}`,
            success: true,
            data: {
              testName: testCase.name,
              responseTime: endTime - startTime,
              responseLength: response.content?.length || 0,
              hasToolCalls: !!(response.toolCalls && response.toolCalls.length > 0)
            }
          })
          console.log(`✅ Test case ${testCase.name} completed`)
        } catch (error) {
          results.steps.push({
            step: `test_${testCase.name}`,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          })
          console.log(`❌ Test case ${testCase.name} failed:`, error)
        }
      }
    }

    // Summary
    const successfulSteps = results.steps.filter((s: any) => s.success).length
    const totalSteps = results.steps.length

    results.summary = {
      totalSteps,
      successfulSteps,
      failedSteps: totalSteps - successfulSteps,
      overallSuccess: successfulSteps === totalSteps
    }

    console.log('\n=== LLM Debug Summary ===')
    console.log(`${successfulSteps}/${totalSteps} steps successful`)

    return NextResponse.json({
      success: true,
      results
    })

  } catch (error) {
    console.error('Debug LLM error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}