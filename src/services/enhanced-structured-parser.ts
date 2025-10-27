// Enhanced Structured Question Parser - 集成 LangChain 的增强版结构化解析器

import { getLLMService } from './llm-service'
import { getLangChainTextProcessor, StructuredQuestion } from './langchain-text-processor'

export interface EnhancedParseResult {
  success: boolean
  structured_question?: StructuredQuestion
  routed_response?: string
  processing_time?: number
  confidence_score?: number
  error?: string
}

/**
 * 增强版结构化问题解析器
 * 结合传统 LLM 解析和 LangChain 高级文本处理
 */
export class EnhancedStructuredQuestionParser {
  private static instance: EnhancedStructuredQuestionParser
  private initialized = false

  private constructor() { }

  public static getInstance(): EnhancedStructuredQuestionParser {
    if (!EnhancedStructuredQuestionParser.instance) {
      EnhancedStructuredQuestionParser.instance = new EnhancedStructuredQuestionParser()
    }
    return EnhancedStructuredQuestionParser.instance
  }

  /**
   * 初始化解析器
   */
  async initialize(): Promise<void> {
    if (this.initialized) return

    try {
      // 初始化 LangChain 处理器
      const langchainProcessor = getLangChainTextProcessor()
      await langchainProcessor.initialize()

      this.initialized = true
      console.log('Enhanced structured parser initialized')
    } catch (error) {
      console.error('Failed to initialize enhanced parser:', error)
      throw error
    }
  }

  /**
   * 增强版问题解析
   */
  async parseQuestion(question: string): Promise<EnhancedParseResult> {
    const startTime = Date.now()

    if (!this.initialized) {
      await this.initialize()
    }

    try {
      // 1. 使用传统方法进行基础结构化解析
      const baseResult = await this.performBaseStructuredParsing(question)

      if (!baseResult.success || !baseResult.structured_question) {
        return {
          success: false,
          error: baseResult.error || 'Base parsing failed',
          processing_time: Date.now() - startTime
        }
      }

      // 2. 使用 LangChain 进行增强处理
      const langchainProcessor = getLangChainTextProcessor()
      const enhancedQuestion = await langchainProcessor.enhanceStructuredQuestion(
        baseResult.structured_question,
        question
      )

      // 3. 基于增强数据进行智能路由
      const routedResponse = await this.performEnhancedRouting(enhancedQuestion, question)

      // 4. 计算置信度分数
      const confidenceScore = this.calculateConfidenceScore(enhancedQuestion)

      const processingTime = Date.now() - startTime

      return {
        success: true,
        structured_question: enhancedQuestion,
        routed_response: routedResponse,
        processing_time: processingTime,
        confidence_score: confidenceScore
      }
    } catch (error) {
      console.error('Enhanced parsing failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        processing_time: Date.now() - startTime
      }
    }
  }

  /**
   * 执行基础结构化解析（使用现有的 LLM 服务）
   */
  private async performBaseStructuredParsing(question: string): Promise<{
    success: boolean
    structured_question?: Omit<StructuredQuestion, 'tokenized_result' | 'semantic_analysis'>
    error?: string
  }> {
    try {
      const llmService = getLLMService()

      // LLM 服务总是可用的，如果配置有问题会在调用时抛出错误

      const systemPrompt = `你是一个专业的问题分析专家。请将用户的自然语言问题转换为结构化数据。

请严格按照以下JSON格式返回，不要包含任何其他文字：
{
  "question_type": "问题的高层类型",
  "question_subtype": "问题的子类型", 
  "question_conditions": ["约束条件1", "约束条件2"],
  "question_sentences": ["分词1", "分词2", "分词3"]
}

分类标准：
- 数学类型：涉及数字计算、数学问题
- 代码生成：要求编写代码、算法实现
- 调试帮助：代码错误、调试相关
- 信息查询：询问概念、原理、知识点
- 模型操作：关于AI模型的操作和配置

请对问题进行中文分词，提取关键词汇。`

      const response = await llmService.sendMessage([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: question }
      ])

      if (!response.content) {
        throw new Error('LLM response has no content')
      }

      // 解析 JSON 响应
      const cleanContent = response.content.trim()
      const jsonMatch = cleanContent.match(/\{[\s\S]*\}/)

      if (!jsonMatch) {
        throw new Error('No valid JSON found in response')
      }

      const parsed = JSON.parse(jsonMatch[0])

      return {
        success: true,
        structured_question: {
          question_type: parsed.question_type || '信息查询',
          question_subtype: parsed.question_subtype || '一般查询',
          question_conditions: Array.isArray(parsed.question_conditions) ? parsed.question_conditions : [],
          question_sentences: Array.isArray(parsed.question_sentences) ? parsed.question_sentences : []
        }
      }
    } catch (error) {
      console.error('Base structured parsing failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Parsing failed'
      }
    }
  }

  /**
   * 基于增强数据进行智能路由
   */
  private async performEnhancedRouting(
    structuredQuestion: StructuredQuestion,
    originalQuestion: string
  ): Promise<string> {
    const { question_type, question_subtype, tokenized_result, semantic_analysis } = structuredQuestion

    // 使用 LangChain 分析结果进行更精确的路由
    const intent = tokenized_result?.intent
    const context = tokenized_result?.context
    const entities = tokenized_result?.entities || []

    // 数字实体检测
    const numberEntities = entities.filter(e => e.type === 'number')
    const actionEntities = entities.filter(e => e.type === 'action')

    switch (question_type) {
      case '数学类型':
        return this.handleMathQuestion(numberEntities, actionEntities, originalQuestion, context)

      case '代码生成':
        return this.handleCodeGeneration(intent, context, actionEntities, originalQuestion)

      case '调试帮助':
        return this.handleDebugging(semantic_analysis, context, originalQuestion)

      case '信息查询':
        return this.handleInformationQuery(intent, context, originalQuestion)

      case '模型操作':
        return this.handleModelOperation(actionEntities, context, originalQuestion)

      default:
        return this.handleGenericQuestion(intent, context, originalQuestion)
    }
  }

  /**
   * 处理数学问题
   */
  private handleMathQuestion(
    numberEntities: any[],
    actionEntities: any[],
    question: string,
    context?: any
  ): string {
    if (numberEntities.length >= 4 && (question.includes('24') || question.includes('二十四'))) {
      const numbers = numberEntities.map(e => e.text).slice(0, 4)
      return `24点游戏：用数字 ${numbers.join(', ')} 通过四则运算得到24`
    }

    if (numberEntities.length > 0) {
      return `数学计算问题：涉及数字 ${numberEntities.map(e => e.text).join(', ')}`
    }

    return '数学问题：需要进一步分析具体的数学运算需求'
  }

  /**
   * 处理代码生成
   */
  private handleCodeGeneration(
    intent: any,
    context: any,
    actionEntities: any[],
    question: string
  ): string {
    const languages = ['Python', 'JavaScript', 'Java', 'C++', 'Go', 'Rust']
    const detectedLang = languages.find(lang =>
      question.toLowerCase().includes(lang.toLowerCase())
    )

    const algorithms = ['排序', '搜索', '递归', '动态规划', '贪心']
    const detectedAlgo = algorithms.find(algo => question.includes(algo))

    if (detectedLang && detectedAlgo) {
      return `代码生成：使用 ${detectedLang} 实现${detectedAlgo}算法`
    } else if (detectedLang) {
      return `代码生成：${detectedLang} 编程任务`
    } else if (detectedAlgo) {
      return `算法实现：${detectedAlgo}相关代码`
    }

    return '代码生成：通用编程任务'
  }

  /**
   * 处理调试帮助
   */
  private handleDebugging(
    semanticAnalysis: any,
    context: any,
    question: string
  ): string {
    const urgency = semanticAnalysis?.urgency || 'medium'
    const errorTypes = ['语法错误', '运行时错误', '逻辑错误', '性能问题']
    const detectedError = errorTypes.find(error =>
      question.includes(error) || question.includes(error.replace('错误', ''))
    )

    if (detectedError) {
      return `调试帮助：${detectedError}分析和解决方案（紧急程度：${urgency}）`
    }

    return `调试帮助：代码问题诊断和修复建议（紧急程度：${urgency}）`
  }

  /**
   * 处理信息查询
   */
  private handleInformationQuery(
    intent: any,
    context: any,
    question: string
  ): string {
    const domains = ['机器学习', 'AI', '算法', '数据结构', 'Web开发', '数据库']
    const detectedDomain = domains.find(domain => question.includes(domain))

    if (detectedDomain) {
      return `信息查询：${detectedDomain}相关知识解答`
    }

    const complexity = context?.complexity || 'medium'
    return `信息查询：知识点解答（复杂度：${complexity}）`
  }

  /**
   * 处理模型操作
   */
  private handleModelOperation(
    actionEntities: any[],
    context: any,
    question: string
  ): string {
    const operations = ['配置', '训练', '部署', '优化', '调参']
    const detectedOp = operations.find(op => question.includes(op))

    if (detectedOp) {
      return `模型操作：${detectedOp}相关任务`
    }

    return '模型操作：AI模型管理和配置'
  }

  /**
   * 处理通用问题
   */
  private handleGenericQuestion(
    intent: any,
    context: any,
    question: string
  ): string {
    const primaryIntent = intent?.primary || '未知'
    const domain = context?.domain || '通用'

    return `通用问题处理：${primaryIntent}（领域：${domain}）`
  }

  /**
   * 计算置信度分数
   */
  private calculateConfidenceScore(structuredQuestion: StructuredQuestion): number {
    let score = 0.5 // 基础分数

    // 基于意图置信度
    const intentConfidence = structuredQuestion.tokenized_result?.intent.confidence || 0.5
    score += intentConfidence * 0.3

    // 基于实体识别质量
    const entities = structuredQuestion.tokenized_result?.entities || []
    const avgEntityConfidence = entities.length > 0
      ? entities.reduce((sum, e) => sum + e.confidence, 0) / entities.length
      : 0.5
    score += avgEntityConfidence * 0.2

    // 基于语义清晰度
    const clarity = structuredQuestion.semantic_analysis?.clarity || 0.7
    score += clarity * 0.3

    // 基于分词质量
    const tokenCount = structuredQuestion.question_sentences.length
    const tokenQuality = tokenCount > 0 && tokenCount < 20 ? 0.2 : 0.1
    score += tokenQuality

    return Math.max(0, Math.min(1, score))
  }

  /**
   * 检查服务是否可用
   */
  isAvailable(): boolean {
    return this.initialized
  }

  /**
   * 获取服务状态
   */
  getStatus() {
    const langchainProcessor = getLangChainTextProcessor()
    const llmService = getLLMService()

    return {
      initialized: this.initialized,
      langchainReady: langchainProcessor.isAvailable(),
      llmServiceReady: true, // LLM 服务总是可用的
      langchainStatus: langchainProcessor.getStatus()
    }
  }
}

/**
 * 便捷函数
 */
export const getEnhancedStructuredParser = () => EnhancedStructuredQuestionParser.getInstance()