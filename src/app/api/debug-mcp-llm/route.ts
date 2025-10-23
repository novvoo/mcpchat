import { NextRequest, NextResponse } from 'next/server'
import { getSmartRouter } from '@/services/smart-router'
import { getMCPToolsService } from '@/services/mcp-tools'
import { getLLMService } from '@/services/llm-service'
import { ChatMessage } from '@/types'

// 辅助函数：获取流程描述
function getFlowDescription(source: string): string {
  switch (source) {
    case 'mcp':
      return 'Smart Router → MCP Tool (直接执行)'
    case 'hybrid':
      return 'Smart Router → LLM → MCP Tools (LLM选择工具)'
    case 'llm':
      return 'Smart Router → LLM (纯LLM响应)'
    default:
      return 'Unknown flow'
  }
}

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

    // Step 2: Test Smart Router (正确的智能路由流程) - 优先执行
    if (testMode === 'smart_router' || testMode === 'full_flow') {
      console.log('Step 2: Testing Smart Router - Router First, then LLM...')
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
        const routerResponse = await smartRouter.processMessage(message, undefined, {
          enableMCPFirst: true,
          enableLLMFallback: true,
          mcpConfidenceThreshold: 0.7
        })
        const routerEndTime = Date.now()

        if (enableTracing) {
          results.traces.push({
            type: 'smart_router_end',
            timestamp: new Date().toISOString(),
            data: {
              executionTime: routerEndTime - routerStartTime,
              source: routerResponse.source,
              response: routerResponse.response,
              reasoning: routerResponse.reasoning,
              confidence: routerResponse.confidence
            }
          })
        }

        // 记录路由决策过程
        results.routingDecision = {
          source: routerResponse.source,
          confidence: routerResponse.confidence,
          usedMCPDirectly: routerResponse.source === 'mcp',
          usedLLMWithTools: routerResponse.source === 'hybrid',
          usedLLMOnly: routerResponse.source === 'llm',
          toolCount: routerResponse.toolResults?.length || 0,
          toolCalls: routerResponse.toolCalls?.map(tc => ({
            name: tc.name,
            parameters: tc.parameters
          })),
          reasoning: routerResponse.reasoning
        }

        results.steps.push({
          step: 'smart_router_flow',
          success: true,
          data: {
            executionTime: routerEndTime - routerStartTime,
            source: routerResponse.source,
            confidence: routerResponse.confidence,
            hasToolResults: !!(routerResponse.toolResults && routerResponse.toolResults.length > 0),
            toolResultCount: routerResponse.toolResults?.length || 0,
            conversationId: routerResponse.conversationId,
            finalResponse: routerResponse.response,
            reasoning: routerResponse.reasoning,
            flowDescription: getFlowDescription(routerResponse.source)
          }
        })

        console.log('✅ Smart Router completed with flow:', getFlowDescription(routerResponse.source))
        console.log('   Source:', routerResponse.source)
        console.log('   Confidence:', routerResponse.confidence)
        console.log('   Reasoning:', routerResponse.reasoning)
        console.log('   Response preview:', routerResponse.response.substring(0, 200))
      } catch (error) {
        results.steps.push({
          step: 'smart_router_flow',
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
        console.log('❌ Smart Router failed:', error)
      }
    }

    // Step 3: Test LLM Service with Tool Definitions (仅在 full_flow 模式下执行，用于对比)
    if (testMode === 'full_flow') {
      console.log('Step 3: Testing LLM with tool definitions (for comparison)...')
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
          step: 'llm_with_tools_comparison',
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

        // Execute tool calls if any
        if (llmResponse.toolCalls && llmResponse.toolCalls.length > 0) {
          console.log('Step 3b: Executing tool calls from LLM...')

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
                step: `tool_${toolCall.name}_comparison`,
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
                step: `tool_${toolCall.name}_comparison`,
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
              })
              console.log(`❌ Tool ${toolCall.name} execution failed:`, error)
            }
          }
        }

      } catch (error) {
        results.steps.push({
          step: 'llm_with_tools_comparison',
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
        console.log('❌ LLM with tools failed:', error)
      }
    }



    // Step 4: 测试不同类型的输入
    if (testMode === 'test_cases') {
      console.log('Step 4: Testing multiple input cases...')

      const testCases = [
        { input: "解决8皇后问题", expectedFlow: "mcp", expectedBehavior: "should_use_mcp_directly" },
        { input: "什么是N皇后问题？", expectedFlow: "llm", expectedBehavior: "should_use_llm_only" },
        { input: "帮我解这个数独", expectedFlow: "mcp", expectedBehavior: "should_use_mcp_directly" },
        { input: "数独游戏的规则是什么？", expectedFlow: "llm", expectedBehavior: "should_use_llm_only" },
        { input: "你好", expectedFlow: "llm", expectedBehavior: "should_use_llm_only" },
        { input: "运行一个示例", expectedFlow: "mcp", expectedBehavior: "should_use_mcp_directly" }
      ]

      const testResults = []
      const smartRouter = getSmartRouter()

      for (const testCase of testCases) {
        try {
          console.log(`\nTesting: "${testCase.input}"`)
          const startTime = Date.now()
          const response = await smartRouter.processMessage(testCase.input)
          const endTime = Date.now()

          const flowMatch = response.source === testCase.expectedFlow
          const behaviorMatch =
            (testCase.expectedBehavior === "should_use_mcp_directly" && response.source === 'mcp') ||
            (testCase.expectedBehavior === "should_use_llm_only" && response.source === 'llm') ||
            (testCase.expectedBehavior === "should_use_hybrid" && response.source === 'hybrid')

          testResults.push({
            input: testCase.input,
            expectedFlow: testCase.expectedFlow,
            expectedBehavior: testCase.expectedBehavior,
            actualFlow: response.source,
            actualBehavior: response.source,
            flowMatch,
            behaviorMatch,
            confidence: response.confidence,
            executionTime: endTime - startTime,
            toolsUsed: response.toolCalls?.map(tc => tc.name) || [],
            responsePreview: response.response.substring(0, 100),
            flowDescription: getFlowDescription(response.source)
          })

          console.log(`  ✓ Expected flow: ${testCase.expectedFlow}, Actual: ${response.source}`)
          console.log(`  ✓ Flow match: ${flowMatch ? 'Yes' : 'No'}`)
          console.log(`  ✓ Confidence: ${response.confidence || 'N/A'}`)
          console.log(`  ✓ Flow: ${getFlowDescription(response.source)}`)
        } catch (error) {
          testResults.push({
            input: testCase.input,
            expectedFlow: testCase.expectedFlow,
            expectedBehavior: testCase.expectedBehavior,
            error: error instanceof Error ? error.message : 'Unknown error',
            flowMatch: false,
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
          passedCases: testResults.filter(r => r.flowMatch && r.behaviorMatch).length,
          flowMatches: testResults.filter(r => r.flowMatch).length,
          behaviorMatches: testResults.filter(r => r.behaviorMatch).length,
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