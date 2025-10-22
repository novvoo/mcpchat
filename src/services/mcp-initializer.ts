// MCP Initializer - 负责MCP系统的完整初始化流程

import { getMCPManager } from './mcp-manager'
import { getMCPIntentRecognizer } from './mcp-intent-recognizer'
import { getMCPToolsService } from './mcp-tools'
import { getConfigLoader } from './config'
import { Tool } from '@/types'

/**
 * MCP初始化状态
 */
export interface MCPInitializationStatus {
  configLoaded: boolean
  serversConnected: boolean
  toolsLoaded: boolean
  keywordsMapped: boolean
  ready: boolean
  error?: string
  details: {
    totalServers: number
    connectedServers: number
    totalTools: number
    keywordMappings: number
  }
}

/**
 * MCP系统初始化器
 * 
 * 按照完整流程初始化MCP系统：
 * 1. 加载mcp.json配置
 * 2. 连接MCP服务器
 * 3. 获取工具信息
 * 4. 动态初始化工具关键词映射
 */
export class MCPInitializer {
  private static instance: MCPInitializer
  private initializationStatus: MCPInitializationStatus = {
    configLoaded: false,
    serversConnected: false,
    toolsLoaded: false,
    keywordsMapped: false,
    ready: false,
    details: {
      totalServers: 0,
      connectedServers: 0,
      totalTools: 0,
      keywordMappings: 0
    }
  }

  private constructor() {}

  public static getInstance(): MCPInitializer {
    if (!MCPInitializer.instance) {
      MCPInitializer.instance = new MCPInitializer()
    }
    return MCPInitializer.instance
  }

  /**
   * 执行完整的MCP初始化流程
   */
  async initialize(): Promise<MCPInitializationStatus> {
    console.log('开始MCP系统初始化...')
    
    try {
      // 重置状态
      this.resetStatus()

      // 步骤1: 加载mcp.json配置
      await this.loadConfiguration()

      // 步骤2: 连接MCP服务器
      await this.connectServers()

      // 步骤3: 获取工具信息
      await this.loadToolsInformation()

      // 步骤4: 动态初始化工具关键词映射
      await this.initializeKeywordMappings()

      // 标记为就绪
      this.initializationStatus.ready = true
      console.log('MCP系统初始化完成')

      return this.getStatus()

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误'
      console.error('MCP系统初始化失败:', errorMessage)
      
      this.initializationStatus.error = errorMessage
      this.initializationStatus.ready = false
      
      return this.getStatus()
    }
  }

  /**
   * 步骤1: 加载mcp.json配置
   */
  private async loadConfiguration(): Promise<void> {
    console.log('步骤1: 加载MCP配置...')
    
    try {
      const configLoader = getConfigLoader()
      await configLoader.loadConfig()
      
      const serverConfigs = configLoader.getAllMCPServerConfigs()
      const enabledServers = configLoader.getEnabledServers()
      
      this.initializationStatus.details.totalServers = Object.keys(serverConfigs).length
      this.initializationStatus.configLoaded = true
      
      console.log(`配置加载完成: ${this.initializationStatus.details.totalServers} 个服务器配置，${enabledServers.length} 个启用`)
    } catch (error) {
      throw new Error(`配置加载失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  /**
   * 步骤2: 连接MCP服务器
   */
  private async connectServers(): Promise<void> {
    console.log('步骤2: 连接MCP服务器...')
    
    try {
      const mcpManager = getMCPManager()
      await mcpManager.initialize()
      
      const serverStatus = mcpManager.getServerStatus()
      const connectedCount = Object.values(serverStatus).filter(status => status.status === 'connected').length
      
      this.initializationStatus.details.connectedServers = connectedCount
      this.initializationStatus.serversConnected = connectedCount > 0
      
      console.log(`服务器连接完成: ${connectedCount}/${this.initializationStatus.details.totalServers} 个服务器已连接`)
      
      // 详细记录每个服务器的状态
      for (const [serverName, status] of Object.entries(serverStatus)) {
        console.log(`服务器 ${serverName}: ${status.status}${status.error ? ` - ${status.error}` : ''}`)
      }
      
      if (connectedCount === 0) {
        const errorDetails = Object.entries(serverStatus)
          .map(([name, status]) => `${name}: ${status.status}${status.error ? ` (${status.error})` : ''}`)
          .join(', ')
        throw new Error(`没有成功连接的MCP服务器。详细状态: ${errorDetails}`)
      }
    } catch (error) {
      console.error('服务器连接详细错误:', error)
      throw new Error(`服务器连接失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  /**
   * 步骤3: 获取工具信息
   */
  private async loadToolsInformation(): Promise<void> {
    console.log('步骤3: 获取工具信息...')
    
    try {
      const mcpToolsService = getMCPToolsService()
      const tools = await mcpToolsService.getAvailableTools()
      
      this.initializationStatus.details.totalTools = tools.length
      this.initializationStatus.toolsLoaded = tools.length > 0
      
      console.log(`工具信息加载完成: ${tools.length} 个可用工具`)
      console.log('可用工具列表:', tools.map(t => t.name).join(', '))
      
      if (tools.length === 0) {
        throw new Error('没有可用的MCP工具')
      }
    } catch (error) {
      throw new Error(`工具信息加载失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  /**
   * 步骤4: 动态初始化工具关键词映射
   */
  private async initializeKeywordMappings(): Promise<void> {
    console.log('步骤4: 初始化工具关键词映射...')
    
    try {
      const intentRecognizer = getMCPIntentRecognizer()
      
      // 更新可用工具列表（这会触发关键词映射的更新）
      await intentRecognizer.updateAvailableTools()
      
      // 获取统计信息
      const stats = intentRecognizer.getStats()
      this.initializationStatus.details.keywordMappings = stats.keywordMappings
      this.initializationStatus.keywordsMapped = stats.keywordMappings > 0
      
      console.log(`关键词映射初始化完成: ${stats.keywordMappings} 个工具映射`)
      
      // 动态扩展关键词映射（基于实际可用的工具）
      await this.expandKeywordMappings()
      
    } catch (error) {
      throw new Error(`关键词映射初始化失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  /**
   * 动态扩展关键词映射
   */
  private async expandKeywordMappings(): Promise<void> {
    try {
      const mcpToolsService = getMCPToolsService()
      const tools = await mcpToolsService.getAvailableTools()
      const intentRecognizer = getMCPIntentRecognizer()
      
      // 为每个工具动态生成关键词
      for (const tool of tools) {
        await this.generateKeywordsForTool(tool, intentRecognizer)
      }
      
      console.log('动态关键词映射扩展完成')
    } catch (error) {
      console.warn('动态关键词映射扩展失败:', error)
    }
  }

  /**
   * 为特定工具生成关键词
   */
  private async generateKeywordsForTool(tool: Tool, intentRecognizer: any): Promise<void> {
    // 基于工具名称和描述生成关键词
    const keywords: string[] = []
    
    // 从工具名称提取关键词
    const nameKeywords = this.extractKeywordsFromName(tool.name)
    keywords.push(...nameKeywords)
    
    // 从工具描述提取关键词
    if (tool.description) {
      const descKeywords = this.extractKeywordsFromDescription(tool.description)
      keywords.push(...descKeywords)
    }
    
    // 添加通用关键词
    const genericKeywords = this.getGenericKeywords(tool.name)
    keywords.push(...genericKeywords)
    
    // 这里可以扩展intentRecognizer来支持动态添加关键词
    // 目前的实现是静态的，可以考虑重构为支持动态添加
    console.log(`为工具 ${tool.name} 生成关键词:`, keywords)
  }

  /**
   * 从工具名称提取关键词
   */
  private extractKeywordsFromName(name: string): string[] {
    const keywords: string[] = []
    
    // 添加原始名称
    keywords.push(name)
    
    // 处理下划线分隔的名称
    if (name.includes('_')) {
      const parts = name.split('_')
      keywords.push(...parts)
      
      // 添加组合词
      if (parts.length >= 2) {
        keywords.push(parts.join(' '))
      }
    }
    
    // 处理驼峰命名
    const camelCaseWords = name.replace(/([A-Z])/g, ' $1').trim().split(' ')
    if (camelCaseWords.length > 1) {
      keywords.push(...camelCaseWords.map(w => w.toLowerCase()))
    }
    
    return keywords.filter(k => k.length > 1) // 过滤掉太短的关键词
  }

  /**
   * 从工具描述提取关键词
   */
  private extractKeywordsFromDescription(description: string): string[] {
    const keywords: string[] = []
    
    // 简单的关键词提取（可以使用更复杂的NLP技术）
    const words = description.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2)
    
    // 过滤常见停用词
    const stopWords = new Set(['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'man', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'boy', 'did', 'its', 'let', 'put', 'say', 'she', 'too', 'use'])
    
    const filteredWords = words.filter(word => !stopWords.has(word))
    keywords.push(...filteredWords.slice(0, 5)) // 取前5个关键词
    
    return keywords
  }

  /**
   * 获取通用关键词
   */
  private getGenericKeywords(toolName: string): string[] {
    const genericMappings: Record<string, string[]> = {
      'solve': ['解决', '求解', '计算', 'solve', 'calculate'],
      'run': ['运行', '执行', 'run', 'execute'],
      'echo': ['回显', '重复', 'echo', 'repeat'],
      'info': ['信息', '详情', 'info', 'information'],
      'install': ['安装', 'install', 'setup'],
      'queens': ['皇后', 'queens', '皇后问题'],
      'sudoku': ['数独', 'sudoku'],
      'graph': ['图', 'graph', '图论'],
      'coloring': ['着色', 'coloring', '染色'],
      'optimization': ['优化', 'optimization', '最优化'],
      'portfolio': ['投资组合', 'portfolio'],
      'statistical': ['统计', 'statistical', '统计学'],
      'facility': ['设施', 'facility', '设施选址'],
      'location': ['位置', 'location', '选址'],
      'minimax': ['极小极大', 'minimax'],
      'game': ['游戏', 'game', '博弈'],
      'decision': ['决策', 'decision'],
      'planning': ['规划', 'planning', '计划'],
      'production': ['生产', 'production'],
      'lp': ['线性规划', 'linear programming', 'lp'],
      'scipy': ['科学计算', 'scipy', '科学']
    }
    
    const keywords: string[] = []
    
    for (const [key, values] of Object.entries(genericMappings)) {
      if (toolName.toLowerCase().includes(key)) {
        keywords.push(...values)
      }
    }
    
    return keywords
  }

  /**
   * 重置初始化状态
   */
  private resetStatus(): void {
    this.initializationStatus = {
      configLoaded: false,
      serversConnected: false,
      toolsLoaded: false,
      keywordsMapped: false,
      ready: false,
      details: {
        totalServers: 0,
        connectedServers: 0,
        totalTools: 0,
        keywordMappings: 0
      }
    }
  }

  /**
   * 获取当前初始化状态
   */
  getStatus(): MCPInitializationStatus {
    return { ...this.initializationStatus }
  }

  /**
   * 检查系统是否就绪
   */
  isReady(): boolean {
    return this.initializationStatus.ready
  }

  /**
   * 获取详细的系统信息
   */
  async getSystemInfo(): Promise<{
    status: MCPInitializationStatus
    servers: Record<string, any>
    tools: Tool[]
    capabilities: string[]
  }> {
    const mcpManager = getMCPManager()
    const mcpToolsService = getMCPToolsService()
    
    const servers = mcpManager.getServerStatus()
    const tools = await mcpToolsService.getAvailableTools()
    
    const capabilities = []
    if (this.initializationStatus.configLoaded) capabilities.push('配置加载')
    if (this.initializationStatus.serversConnected) capabilities.push('服务器连接')
    if (this.initializationStatus.toolsLoaded) capabilities.push('工具加载')
    if (this.initializationStatus.keywordsMapped) capabilities.push('关键词映射')
    if (this.initializationStatus.ready) capabilities.push('系统就绪')
    
    return {
      status: this.getStatus(),
      servers,
      tools,
      capabilities
    }
  }

  /**
   * 重新初始化系统
   */
  async reinitialize(): Promise<MCPInitializationStatus> {
    console.log('重新初始化MCP系统...')
    return this.initialize()
  }
}

/**
 * 便捷函数
 */
export const getMCPInitializer = () => MCPInitializer.getInstance()

/**
 * 快速初始化MCP系统
 */
export const initializeMCPSystem = async (): Promise<MCPInitializationStatus> => {
  const initializer = getMCPInitializer()
  return initializer.initialize()
}

/**
 * 检查MCP系统是否就绪
 */
export const isMCPSystemReady = (): boolean => {
  const initializer = getMCPInitializer()
  return initializer.isReady()
}