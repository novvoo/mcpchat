// API端点用于测试意图识别和工具建议

import { NextRequest, NextResponse } from 'next/server'
import { getLangChainTextProcessor } from '@/services/langchain-text-processor'

export async function POST(request: NextRequest) {
  try {
    const { message, userInput } = await request.json()

    // Support both 'message' and 'userInput' parameters
    const inputMessage = message || userInput

    if (!inputMessage) {
      return NextResponse.json({ error: 'Message or userInput is required' }, { status: 400 })
    }

    console.log(`Testing intent recognition for: "${inputMessage}"`)

    // 使用工具元数据服务进行智能匹配
    const { getToolMetadataService } = await import('@/services/tool-metadata-service')
    const metadataService = getToolMetadataService()
    await metadataService.initialize()

    const toolSuggestions = await metadataService.getToolSuggestions(inputMessage)
    const topSuggestion = toolSuggestions.length > 0 ? toolSuggestions[0] : null

    let langchainResult = null
    try {
      // 尝试使用LangChain进行额外分析
      const processor = getLangChainTextProcessor()
      await processor.initialize()

      const status = processor.getStatus()
      const tokenizedResult = await processor.tokenizeText(inputMessage)
      const semanticAnalysis = await processor.analyzeSemantics(inputMessage)

      langchainResult = {
        processor_status: status,
        tokenized_result: tokenizedResult,
        semantic_analysis: semanticAnalysis
      }
    } catch (langchainError) {
      console.log('LangChain processing failed, using tool metadata service only:', langchainError)
    }

    // 基于工具元数据服务的结果判断意图
    let needsMCP = false
    let confidence = 0.2
    let reasoning = '未找到匹配的工具'
    let suggestedTool = null

    if (topSuggestion && topSuggestion.confidence > 0.3) {
      needsMCP = true
      confidence = topSuggestion.confidence
      suggestedTool = topSuggestion.toolName
      reasoning = `工具元数据服务推荐: ${topSuggestion.toolName} (置信度: ${(topSuggestion.confidence * 100).toFixed(1)}%)`

      if (topSuggestion.keywords && topSuggestion.keywords.length > 0) {
        reasoning += `, 匹配关键词: ${topSuggestion.keywords.join(', ')}`
      }
    } else {
      // 使用简单的fallback分析
      const fallbackAnalysis = simpleFallbackAnalysis(inputMessage)
      needsMCP = fallbackAnalysis.needsMCP
      confidence = fallbackAnalysis.confidence
      suggestedTool = fallbackAnalysis.suggestedTool
      reasoning = fallbackAnalysis.reasoning
    }

    // 返回前端期望的格式
    return NextResponse.json({
      success: true,
      intent: {
        needsMCP,
        suggestedTool,
        confidence,
        reasoning
      },
      // 保留详细信息用于调试
      details: {
        toolSuggestions,
        topSuggestion,
        langchainResult,
        timestamp: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('Intent recognition test failed:', error)
    return NextResponse.json(
      {
        error: 'Intent recognition failed',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'LangChain Intent Recognition Test API',
    usage: 'POST with { "message": "your test message" }',
    examples: [
      '如何从 8、8、4、13 从简单的加减乘除运算得到 24',
      '请帮我解决这个数独问题',
      '8皇后问题怎么解决',
      '什么是24点游戏？',
      '给我一个Python代码示例'
    ]
  })
}

/**
 * 简单的fallback分析，当LangChain不可用时使用
 */
function simpleFallbackAnalysis(message: string) {
  const lowerMessage = message.toLowerCase()

  // 24点游戏检测
  if (lowerMessage.includes('24') && /\d+.*\d+.*\d+.*\d+/.test(message)) {
    return {
      needsMCP: true,
      suggestedTool: 'solve_24_point_game',
      confidence: 0.8,
      reasoning: '检测到24点游戏关键词和数字'
    }
  }

  // N皇后问题检测
  if (lowerMessage.includes('皇后') || lowerMessage.includes('queen')) {
    return {
      needsMCP: true,
      suggestedTool: 'solve_n_queens',
      confidence: 0.8,
      reasoning: '检测到N皇后问题关键词'
    }
  }

  // 数独检测
  if (lowerMessage.includes('数独') || lowerMessage.includes('sudoku')) {
    return {
      needsMCP: true,
      suggestedTool: 'solve_sudoku',
      confidence: 0.8,
      reasoning: '检测到数独关键词'
    }
  }

  // 示例代码检测
  if (lowerMessage.includes('示例') || lowerMessage.includes('example') || lowerMessage.includes('运行')) {
    return {
      needsMCP: true,
      suggestedTool: 'run_example',
      confidence: 0.7,
      reasoning: '检测到示例或运行关键词'
    }
  }

  // 问题求解类型
  if (lowerMessage.includes('解决') || lowerMessage.includes('solve') || lowerMessage.includes('计算')) {
    return {
      needsMCP: true,
      suggestedTool: null,
      confidence: 0.6,
      reasoning: '检测到问题求解关键词'
    }
  }

  // 信息查询类型
  if (lowerMessage.includes('什么') || lowerMessage.includes('how') || lowerMessage.includes('为什么')) {
    return {
      needsMCP: false,
      suggestedTool: null,
      confidence: 0.8,
      reasoning: '检测到信息查询，建议使用LLM'
    }
  }

  // 默认情况
  return {
    needsMCP: false,
    suggestedTool: null,
    confidence: 0.3,
    reasoning: '无明确意图，建议使用LLM'
  }
}

/**
 * 基于LangChain分析结果判断是否需要MCP工具
 */
function analyzeForMCPTools(tokenizedResult: any, originalMessage: string) {
  const { entities, intent, context } = tokenizedResult || {}
  const domain = context?.domain || ''
  const primaryIntent = intent?.primary || ''
  const numberEntities = entities?.filter((e: any) => e.type === 'number') || []

  // 优先进行关键词检测，不依赖domain分类

  // N皇后问题检测 - 优先级最高
  if (originalMessage.includes('皇后') || originalMessage.includes('queen')) {
    const nValue = numberEntities.find((e: any) => {
      const num = parseInt(e.text)
      return num >= 4 && num <= 20
    })
    return {
      needed: true,
      suggestedTool: 'solve_n_queens',
      confidence: 0.9,
      parameters: nValue ? { n: parseInt(nValue.text) } : { n: 8 },
      reasoning: 'LangChain检测到N皇后问题关键词'
    }
  }

  // 24点游戏检测
  if (originalMessage.includes('24') || originalMessage.includes('二十四')) {
    if (numberEntities.length >= 4) {
      const numbers = numberEntities.map((e: any) => parseInt(e.text)).filter((n: number) => !isNaN(n)).slice(0, 4)
      if (numbers.length === 4) {
        return {
          needed: true,
          suggestedTool: 'solve_24_point_game',
          confidence: 0.9,
          parameters: { numbers },
          reasoning: 'LangChain检测到24点游戏，包含4个数字'
        }
      }
    }
    return {
      needed: true,
      suggestedTool: 'solve_24_point_game',
      confidence: 0.8,
      parameters: {},
      reasoning: 'LangChain检测到24点游戏关键词'
    }
  }

  // 数独检测
  if (originalMessage.includes('数独') || originalMessage.includes('sudoku')) {
    return {
      needed: true,
      suggestedTool: 'solve_sudoku',
      confidence: 0.85,
      parameters: {},
      reasoning: 'LangChain检测到数独问题'
    }
  }

  // 示例代码检测
  if (originalMessage.includes('示例') || originalMessage.includes('例子') || originalMessage.includes('example')) {
    return {
      needed: true,
      suggestedTool: 'run_example',
      confidence: 0.8,
      parameters: { example_name: 'basic' },
      reasoning: 'LangChain检测到代码示例请求'
    }
  }

  // 系统信息查询
  if (originalMessage.includes('系统信息') || originalMessage.includes('info') || originalMessage.includes('状态')) {
    return {
      needed: true,
      suggestedTool: 'info',
      confidence: 0.8,
      parameters: {},
      reasoning: 'LangChain检测到系统信息查询'
    }
  }

  // 基于domain和intent的分析
  if (domain === '数学' || primaryIntent.includes('计算') || primaryIntent.includes('数学')) {
    return {
      needed: true,
      suggestedTool: null,
      confidence: 0.7,
      reasoning: 'LangChain识别为数学问题，建议使用MCP工具'
    }
  }

  if (domain === '编程' || primaryIntent.includes('代码') || primaryIntent.includes('编程')) {
    return {
      needed: true,
      suggestedTool: 'run_example',
      confidence: 0.6,
      parameters: { example_name: 'basic' },
      reasoning: 'LangChain识别为编程问题，建议使用MCP工具'
    }
  }

  // 问题求解类型检测
  if (originalMessage.includes('解决') || originalMessage.includes('solve')) {
    return {
      needed: true,
      suggestedTool: null,
      confidence: 0.7,
      reasoning: 'LangChain检测到问题求解关键词，建议使用MCP工具'
    }
  }

  // 信息查询类型
  if (originalMessage.includes('什么') || originalMessage.includes('how') || originalMessage.includes('为什么')) {
    return {
      needed: false,
      confidence: 0.8,
      reasoning: 'LangChain检测到信息查询，建议使用LLM'
    }
  }

  // 默认情况：不需要MCP工具
  return {
    needed: false,
    confidence: 0.3,
    reasoning: 'LangChain分析未发现明确的工具使用意图'
  }
}