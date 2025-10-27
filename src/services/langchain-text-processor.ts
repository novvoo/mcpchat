// LangChain Text Processor - 使用 LangChain 进行高级文本处理和分词识别

import { ChatOpenAI } from '@langchain/openai'
import { PromptTemplate } from '@langchain/core/prompts'
import { StringOutputParser } from '@langchain/core/output_parsers'
import { RunnableSequence } from '@langchain/core/runnables'
import { Document } from '@langchain/core/documents'
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters'

export interface TokenizedResult {
  tokens: string[]
  entities: Array<{
    text: string
    type: 'number' | 'keyword' | 'action' | 'constraint' | 'domain'
    confidence: number
  }>
  intent: {
    primary: string
    secondary?: string
    confidence: number
  }
  context: {
    domain: string
    complexity: 'simple' | 'medium' | 'complex'
    language: 'zh' | 'en' | 'mixed'
  }
  semantic_analysis?: {
    sentiment: 'positive' | 'neutral' | 'negative'
    urgency: 'low' | 'medium' | 'high'
    clarity: number // 0-1
  }
}

export interface StructuredQuestion {
  question_type: string
  question_subtype: string
  question_conditions: string[]
  question_sentences: string[]
  // LangChain 增强字段
  tokenized_result?: TokenizedResult
  semantic_analysis?: {
    sentiment: 'positive' | 'neutral' | 'negative'
    urgency: 'low' | 'medium' | 'high'
    clarity: number // 0-1
  }
}

/**
 * LangChain 文本处理器 - 提供高级分词识别和语义分析
 */
export class LangChainTextProcessor {
  private static instance: LangChainTextProcessor
  private llm: ChatOpenAI | null = null
  private textSplitter: RecursiveCharacterTextSplitter
  private initialized = false

  // 预定义的提示模板
  private tokenizationPrompt = PromptTemplate.fromTemplate(`
你是一个专业的中文文本分析专家。请对以下用户问题进行深度分词识别和语义分析。

用户问题: {question}

请按照以下JSON格式返回分析结果：
{{
  "tokens": ["分词1", "分词2", "..."],
  "entities": [
    {{
      "text": "实体文本",
      "type": "number|keyword|action|constraint|domain",
      "confidence": 0.95
    }}
  ],
  "intent": {{
    "primary": "主要意图",
    "secondary": "次要意图（可选）",
    "confidence": 0.9
  }},
  "context": {{
    "domain": "数学|编程|调试|信息查询|其他",
    "complexity": "simple|medium|complex",
    "language": "zh|en|mixed"
  }}
}}

分析要求：
1. tokens: 进行智能分词，保留有意义的词汇和数字
2. entities: 识别关键实体，包括数字、关键词、动作词、约束条件、领域词汇
3. intent: 分析用户的主要意图和可能的次要意图
4. context: 判断问题的领域、复杂度和语言类型

只返回JSON，不要其他解释。
`)

  private semanticAnalysisPrompt = PromptTemplate.fromTemplate(`
请对以下用户问题进行语义情感分析：

用户问题: {question}

返回JSON格式：
{{
  "sentiment": "positive|neutral|negative",
  "urgency": "low|medium|high", 
  "clarity": 0.85
}}

分析标准：
- sentiment: 问题的情感倾向
- urgency: 问题的紧急程度
- clarity: 问题表达的清晰度 (0-1)

只返回JSON。
`)

  private constructor() {
    // 初始化文本分割器
    this.textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
      separators: ['\n\n', '\n', '。', '！', '？', '；', '，', ' ', '']
    })
  }

  public static getInstance(): LangChainTextProcessor {
    if (!LangChainTextProcessor.instance) {
      LangChainTextProcessor.instance = new LangChainTextProcessor()
    }
    return LangChainTextProcessor.instance
  }

  /**
   * 初始化 LangChain 处理器
   */
  async initialize(): Promise<void> {
    if (this.initialized) return

    try {
      // 从环境变量或配置加载 OpenAI 配置
      const apiKey = process.env.OPENAI_API_KEY
      const baseURL = process.env.OPENAI_BASE_URL 

      if (!apiKey) {
        console.warn('No OpenAI API key found, LangChain processor will use mock responses')
        this.initialized = true
        return
      }

      this.llm = new ChatOpenAI({
        apiKey,
        configuration: {
          baseURL
        },
        model: 'gpt-3.5-turbo',
        temperature: 0.1,
        maxTokens: 2000
      })

      this.initialized = true
      console.log('LangChain text processor initialized successfully')
    } catch (error) {
      console.error('Failed to initialize LangChain processor:', error)
      this.initialized = true // 允许使用 mock 模式
    }
  }

  /**
   * 使用 LangChain 进行高级分词识别
   */
  async tokenizeText(question: string): Promise<TokenizedResult> {
    if (!this.initialized) {
      await this.initialize()
    }

    if (!this.llm) {
      return this.getMockTokenizedResult(question)
    }

    try {
      // 创建处理链
      const chain = RunnableSequence.from([
        this.tokenizationPrompt,
        this.llm,
        new StringOutputParser()
      ])

      const result = await chain.invoke({ question })

      // 解析 JSON 结果
      const parsed = JSON.parse(result.trim())
      return this.validateTokenizedResult(parsed)
    } catch (error) {
      console.warn('LangChain tokenization failed, using fallback:', error)
      return this.getMockTokenizedResult(question)
    }
  }

  /**
   * 语义分析
   */
  async analyzeSemantics(question: string): Promise<TokenizedResult['semantic_analysis']> {
    if (!this.initialized) {
      await this.initialize()
    }

    if (!this.llm) {
      return this.getMockSemanticAnalysis(question)
    }

    try {
      const chain = RunnableSequence.from([
        this.semanticAnalysisPrompt,
        this.llm,
        new StringOutputParser()
      ])

      const result = await chain.invoke({ question })
      const parsed = JSON.parse(result.trim())

      return {
        sentiment: parsed.sentiment || 'neutral',
        urgency: parsed.urgency || 'medium',
        clarity: Math.max(0, Math.min(1, parsed.clarity || 0.7))
      }
    } catch (error) {
      console.warn('Semantic analysis failed, using fallback:', error)
      return this.getMockSemanticAnalysis(question)
    }
  }

  /**
   * 文档分割（用于长文本处理）
   */
  async splitText(text: string): Promise<Document[]> {
    const docs = await this.textSplitter.createDocuments([text])
    return docs
  }

  /**
   * 增强的结构化问题解析
   */
  async enhanceStructuredQuestion(
    baseResult: Omit<StructuredQuestion, 'tokenized_result' | 'semantic_analysis'>,
    originalQuestion: string
  ): Promise<StructuredQuestion> {
    const [tokenizedResult, semanticAnalysis] = await Promise.all([
      this.tokenizeText(originalQuestion),
      this.analyzeSemantics(originalQuestion)
    ])

    return {
      ...baseResult,
      tokenized_result: tokenizedResult,
      semantic_analysis: semanticAnalysis
    }
  }

  /**
   * 验证分词结果
   */
  private validateTokenizedResult(result: any): TokenizedResult {
    return {
      tokens: Array.isArray(result.tokens) ? result.tokens : [],
      entities: Array.isArray(result.entities) ? result.entities.map((e: any) => ({
        text: e.text || '',
        type: ['number', 'keyword', 'action', 'constraint', 'domain'].includes(e.type) ? e.type : 'keyword',
        confidence: Math.max(0, Math.min(1, e.confidence || 0.5))
      })) : [],
      intent: {
        primary: result.intent?.primary || '未知',
        secondary: result.intent?.secondary,
        confidence: Math.max(0, Math.min(1, result.intent?.confidence || 0.5))
      },
      context: {
        domain: result.context?.domain || '其他',
        complexity: ['simple', 'medium', 'complex'].includes(result.context?.complexity)
          ? result.context.complexity : 'medium',
        language: ['zh', 'en', 'mixed'].includes(result.context?.language)
          ? result.context.language : 'zh'
      }
    }
  }

  /**
   * Mock 分词结果（用于 API 不可用时）
   */
  private getMockTokenizedResult(question: string): TokenizedResult {
    // 简单的中文分词逻辑
    const tokens = question.match(/[\u4e00-\u9fa5]+|\d+|[a-zA-Z]+/g) || []

    // 识别数字实体
    const entities: Array<{
      text: string
      type: 'number' | 'keyword' | 'action' | 'constraint' | 'domain'
      confidence: number
    }> = []
    const numbers = question.match(/\d+/g) || []
    numbers.forEach(num => {
      entities.push({
        text: num,
        type: 'number' as const,
        confidence: 0.9
      })
    })

    // 识别关键动作词
    const actionWords = ['解答', '计算', '写', '创建', '调试', '帮忙', '生成']
    actionWords.forEach(word => {
      if (question.includes(word)) {
        entities.push({
          text: word,
          type: 'action' as const,
          confidence: 0.8
        })
      }
    })

    // 简单意图识别 - 增强数独识别
    let primary = '信息查询'

    // 检查是否是数独格式（支持JSON数组和ASCII表格）
    const jsonGridPattern = /\[[\[\d\s,\]]+\]/
    const asciiGridPattern = /\|\|[=\-\|\s\d]+\|\|/
    const hasJsonFormat = jsonGridPattern.test(question)
    const hasAsciiFormat = asciiGridPattern.test(question)
    let isValidSudoku = false

    // 检查JSON数组格式
    if (hasJsonFormat) {
      try {
        const gridMatch = question.match(jsonGridPattern)
        if (gridMatch) {
          const grid = JSON.parse(gridMatch[0])
          if (Array.isArray(grid) && grid.length === 9 &&
            grid.every(row => Array.isArray(row) && row.length === 9)) {
            const allNumbers = grid.flat()
            const validNumbers = allNumbers.every(num => typeof num === 'number' && num >= 0 && num <= 9)
            const hasEmptySpaces = allNumbers.some(num => num === 0)
            isValidSudoku = validNumbers && hasEmptySpaces
          }
        }
      } catch (e) {
        // JSON解析失败
      }
    }

    // 检查ASCII表格格式
    if (!isValidSudoku && hasAsciiFormat) {
      // 检查是否包含数独相关的规则描述
      const hasSudokuRules = question.includes('行满足1-9') ||
        question.includes('列满足1-9') ||
        question.includes('方格满足1-9') ||
        question.includes('不重复')

      // 检查是否有表格结构（多行包含||）
      const tableLines = question.split('\n').filter(line => line.includes('||'))
      const hasTableStructure = tableLines.length >= 9 // 至少9行表格

      if (hasSudokuRules && hasTableStructure) {
        isValidSudoku = true
      }
    }

    if (isValidSudoku || question.includes('数独') || question.includes('sudoku')) {
      primary = '数学计算'
    } else if (question.includes('24') || question.includes('运算')) {
      primary = '数学计算'

    } else if (question.includes('代码') || question.includes('Python') || question.includes('算法')) {
      primary = '代码生成'
    } else if (question.includes('调试') || question.includes('错误')) {
      primary = '调试帮助'
    }

    return {
      tokens,
      entities,
      intent: {
        primary,
        confidence: 0.7
      },
      context: {
        domain: primary === '数学计算' ? '数学' : primary === '代码生成' ? '编程' : '其他',
        complexity: question.length > 50 ? 'complex' : question.length > 20 ? 'medium' : 'simple',
        language: /[\u4e00-\u9fa5]/.test(question) ? 'zh' : 'en'
      }
    }
  }

  /**
   * Mock 语义分析
   */
  private getMockSemanticAnalysis(question: string): TokenizedResult['semantic_analysis'] {
    const hasPositiveWords = /帮忙|请|谢谢|好的/.test(question)
    const hasNegativeWords = /错误|失败|不行|问题/.test(question)
    const hasUrgentWords = /急|快|立即|马上/.test(question)

    return {
      sentiment: hasPositiveWords ? 'positive' : hasNegativeWords ? 'negative' : 'neutral',
      urgency: hasUrgentWords ? 'high' : question.includes('?') || question.includes('？') ? 'medium' : 'low',
      clarity: question.length > 10 && question.length < 100 ? 0.8 : 0.6
    }
  }

  /**
   * 检查服务是否可用
   */
  isAvailable(): boolean {
    return this.initialized
  }

  /**
   * 获取处理器状态
   */
  getStatus() {
    return {
      initialized: this.initialized,
      hasLLM: this.llm !== null,
      textSplitterReady: !!this.textSplitter
    }
  }
}

/**
 * 便捷函数
 */
export const getLangChainTextProcessor = () => LangChainTextProcessor.getInstance() 
