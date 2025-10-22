import { NextRequest, NextResponse } from 'next/server'
import { getSmartRouter } from '@/services/smart-router'
import { getMCPToolsService } from '@/services/mcp-tools'
import { getLLMService } from '@/services/llm-service'
import { ChatMessage } from '@/types'

export async function POST(request: NextRequest) {
  try {
    const { 
      message = "解决8皇后问题", 
      testMode = "smart_router", // 默认使用智能路由模式
      enableTracing = true 
    } = await request.json()

    console.log('=== Debug MCP-LLM Interaction ===')
    console.log('Test parameters:', { message, testMode, enableTracing })

    const results: any = {
      testMode,
      message,
      timestamp: new Date().toISOString(),
      steps: [],
      traces: [],
      llmDecision: null // 记录LLM的决策过程
    }

    // Step 0: Ensure MCP System is initialized
    console.log('Step 0: Ensuring MCP System is initialized...')
    try {
      const smartRouter = getSmartRouter()
      const isConnected = await smartRouter.testMCPConnection()
      
      results.steps.push({
        step: 'mcp_initialization',
        success: isConnected,
        data: { isConnected }
      })
      
      if (isConnected) {
        console.log('✅ MCP System initialized and connected')
      } else {
        console.log('⚠️ MCP System not connected, tools may not be available')
      }
    } catch (error) {
      results.steps.push({
        step: 'mcp_initialization',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      console.log('❌ MCP System initialization failed:', error)
    }

    // Step 1: Test MCP Tools Service
    console.log('Step 1: Testing MCP Tools Service...')
    try {
      const mcpToolsService = getMCPToolsService()
      const availableTools = await mcpToolsService.getAvailableTools()
      
      results.steps.push({
        step: 'mcp_tools',
        success: true,
        data: {
          toolCount: availableTools.length,
          tools: availableTools.map(t => ({
            name: t.name,
            description: t.description
          }))
        }
      })
      console.log(`✅ MCP Tools loaded: ${availableTools.length} tools`)
    } catch (error) {
      results.steps.push({
        step: 'mcp_tools',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      console.log('❌ MCP Tools loading failed:', error)
    }

    // Step 2: Test LLM Service with Tool Definitions
    console.log('Step 2: Testing LLM with tool definitions...')
    try {
      const llmService = getLLMService()
      const mcpToolsService = getMCPToolsService()
      const availableTools = await mcpToolsService.getAvailableTools()

      // Create messages with tool definitions
      const messages: ChatMessage[] = [
        {
          role: 'system',
          content: `You have access to the following MCP tools. Use them when appropriate:

${JSON.stringify(availableTools.map(tool => ({
  name: tool.name,
  description: tool.description,
  parameters: tool.inputSchema
})), null, 2)}

When you need to use a tool, respond with a tool call.`
        },
        {
          role: 'user',
          content: message
        }
      ]

      if (enableTracing) {
        results.traces.push({
          type: 'llm_request',
          timestamp: new Date().toISOString(),
          data: {
            messageCount: messages.length,
            toolCount: availableTools.length,
            userMessage: message
          }
        })
      }

      const startTime = Date.now()
      const llmResponse = await llmService.sendMessage(messages)
      const endTime = Date.now()

      if (enableTracing) {
        results.traces.push({
          type: 'llm_response',
          timestamp: new Date().toISOString(),
          data: {
            responseTime: endTime - startTime,
            hasToolCalls: !!(llmResponse.toolCalls && llmResponse.toolCalls.length > 0),
            toolCallCount: llmResponse.toolCalls?.length || 0,
            response: llmResponse
          }
        })
      }

      results.steps.push({
        step: 'llm_with_tools',
        success: true,
        data: {
          responseTime: endTime - startTime,
          hasToolCalls: !!(llmResponse.toolCalls && llmResponse.toolCalls.length > 0),
          toolCallCount: llmResponse.toolCalls?.length || 0,
          toolCalls: llmResponse.toolCalls?.map(tc => ({
            name: tc.name,
            parametersKeys: Object.keys(tc.parameters || {})
          }))
        }
      })
      console.log('✅ LLM responded with tool calls:', llmResponse.toolCalls?.length || 0)

      // Step 3: Execute tool calls if any
      if (llmResponse.toolCalls && llmResponse.toolCalls.length > 0) {
        console.log('Step 3: Executing tool calls...')
        
        for (const toolCall of llmResponse.toolCalls) {
          try {
            if (enableTracing) {
              results.traces.push({
                type: 'tool_call_start',
                timestamp: new Date().toISOString(),
                data: {
                  toolName: toolCall.name,
                  parameters: toolCall.parameters
                }
              })
            }

            const toolStartTime = Date.now()
            const toolResult = await mcpToolsService.executeTool(
              toolCall.name,
              toolCall.parameters || {},
              { timeout: 30000, retryAttempts: 1, validateInput: true }
            )
            const toolEndTime = Date.now()

            if (enableTracing) {
              results.traces.push({
                type: 'tool_call_end',
                timestamp: new Date().toISOString(),
                data: {
                  toolName: toolCall.name,
                  executionTime: toolEndTime - toolStartTime,
                  success: toolResult.success,
                  result: toolResult.success ? toolResult.result : toolResult.error
                }
              })
            }

            results.steps.push({
              step: `tool_${toolCall.name}`,
              success: toolResult.success,
              data: toolResult.success ? {
                executionTime: toolEndTime - toolStartTime,
                result: toolResult.result
              } : {
                error: toolResult.error?.message || 'Unknown error'
              }
            })

            console.log(`${toolResult.success ? '✅' : '❌'} Tool ${toolCall.name} executed`)
          } catch (error) {
            if (enableTracing) {
              results.traces.push({
                type: 'tool_call_error',
                timestamp: new Date().toISOString(),
                data: {
                  toolName: toolCall.name,
                  error: error instanceof Error ? error.message : 'Unknown error'
                }
              })
            }

            results.steps.push({
              step: `tool_${toolCall.name}`,
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error'
            })
            console.log(`❌ Tool ${toolCall.name} execution failed:`, error)
          }
        }
      }

    } catch (error) {
      results.steps.push({
        step: 'llm_with_tools',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      console.log('❌ LLM with tools failed:', error)
    }

    // Step 4: Test Smart Router (新的智能路由流程)
    if (testMode === 'smart_router' || testMode === 'full_flow') {
      console.log('Step 4: Testing Smart Router with LLM-driven tool selection...')
      try {
        if (enableTracing) {
          results.traces.push({
            type: 'smart_router_start',
            timestamp: new Date().toISOString(),
            data: { message }
          })
        }

        const smartRouter = getSmartRouter()
        const routerStartTime = Date.now()
        const routerResponse = await smartRouter.processMessage(message)
        const routerEndTime = Date.now()

        if (enableTracing) {
          results.traces.push({
            type: 'smart_router_end',
            timestamp: new Date().toISOString(),
            data: {
              executionTime: routerEndTime - routerStartTime,
              source: routerResponse.source,
              response: routerResponse.response,
              reasoning: routerResponse.reasoning
            }
          })
        }

        // 记录LLM的决策
        results.llmDecision = {
          source: routerResponse.source,
          usedTools: routerResponse.toolResults && routerResponse.toolResults.length > 0,
          toolCount: routerResponse.toolResults?.length || 0,
          toolCalls: routerResponse.toolCalls?.map(tc => ({
            name: tc.name,
            parameters: tc.parameters
          })),
          reasoning: routerResponse.reasoning
        }

        results.steps.push({
          step: 'smart_router',
          success: true,
          data: {
            executionTime: routerEndTime - routerStartTime,
            source: routerResponse.source,
            hasToolResults: !!(routerResponse.toolResults && routerResponse.toolResults.length > 0),
            toolResultCount: routerResponse.toolResults?.length || 0,
            conversationId: routerResponse.conversationId,
            finalResponse: routerResponse.response,
            reasoning: routerResponse.reasoning
          }
        })
        console.log('✅ Smart Router completed:', routerResponse.source)
        console.log('   Reasoning:', routerResponse.reasoning)
        console.log('   Response preview:', routerResponse.response.substring(0, 200))
      } catch (error) {
        results.steps.push({
          step: 'smart_router',
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
        console.log('❌ Smart Router failed:', error)
      }
    }

    // Step 5: 测试不同类型的输入
    if (testMode === 'test_cases') {
      console.log('Step 5: Testing multiple input cases...')
      
      const testCases = [
        { input: "解决8皇后问题", expectedBehavior: "should_use_tool" },
        { input: "什么是N皇后问题？", expectedBehavior: "should_not_use_tool" },
        { input: "帮我解这个数独", expectedBehavior: "should_use_tool" },
        { input: "数独游戏的规则是什么？", expectedBehavior: "should_not_use_tool" },
        { input: "你好", expectedBehavior: "should_not_use_tool" }
      ]

      const testResults = []
      const smartRouter = getSmartRouter()

      for (const testCase of testCases) {
        try {
          console.log(`\nTesting: "${testCase.input}"`)
          const startTime = Date.now()
          const response = await smartRouter.processMessage(testCase.input)
          const endTime = Date.now()

          const usedTools = response.toolResults && response.toolResults.length > 0
          const behaviorMatch = 
            (testCase.expectedBehavior === "should_use_tool" && usedTools) ||
            (testCase.expectedBehavior === "should_not_use_tool" && !usedTools)

          testResults.push({
            input: testCase.input,
            expectedBehavior: testCase.expectedBehavior,
            actualBehavior: usedTools ? "used_tool" : "direct_llm",
            behaviorMatch,
            source: response.source,
            executionTime: endTime - startTime,
            toolsUsed: response.toolCalls?.map(tc => tc.name) || [],
            responsePreview: response.response.substring(0, 100)
          })

          console.log(`  ✓ Source: ${response.source}`)
          console.log(`  ✓ Used tools: ${usedTools ? 'Yes' : 'No'}`)
          console.log(`  ✓ Behavior match: ${behaviorMatch ? 'Yes' : 'No'}`)
        } catch (error) {
          testResults.push({
            input: testCase.input,
            expectedBehavior: testCase.expectedBehavior,
            error: error instanceof Error ? error.message : 'Unknown error',
            behaviorMatch: false
          })
          console.log(`  ✗ Error: ${error}`)
        }
      }

      results.steps.push({
        step: 'test_cases',
        success: true,
        data: {
          totalCases: testCases.length,
          passedCases: testResults.filter(r => r.behaviorMatch).length,
          testResults
        }
      })
    }

    // Summary
    const successfulSteps = results.steps.filter((s: any) => s.success).length
    const totalSteps = results.steps.length

    results.summary = {
      totalSteps,
      successfulSteps,
      failedSteps: totalSteps - successfulSteps,
      overallSuccess: successfulSteps === totalSteps,
      traceCount: results.traces.length
    }

    console.log('\n=== MCP-LLM Debug Summary ===')
    console.log(`${successfulSteps}/${totalSteps} steps successful`)
    console.log(`${results.traces.length} trace events recorded`)

    return NextResponse.json({
      success: true,
      results
    })

  } catch (error) {
    console.error('Debug MCP-LLM error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}