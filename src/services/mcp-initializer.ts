// MCP Initializer - 负责MCP系统的完整初始化流程

import { getMCPManager } from './mcp-manager'
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
 * 1. 加载config/mcp.json配置
 * 2. 连接MCP服务器
 * 3. 获取工具信息
 * 4. 动态初始化工具关键词映射
 */
export class MCPInitializer {
  private static instance: MCPInitializer
  private initializing: Promise<MCPInitializationStatus> | null = null
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

  private constructor() { }

  public static getInstance(): MCPInitializer {
    if (!MCPInitializer.instance) {
      MCPInitializer.instance = new MCPInitializer()
    }
    return MCPInitializer.instance
  }

  /**
   * 执行完整的MCP初始化流程
   */
  async initialize(force: boolean = false): Promise<MCPInitializationStatus> {
    // 如果已经就绪且不强制重新初始化，直接返回状态
    if (this.initializationStatus.ready && !force) {
      console.log('MCP系统已就绪，跳过初始化')
      return this.getStatus()
    }

    // 如果正在初始化，等待完成
    if (this.initializing) {
      console.log('MCP系统正在初始化中，等待完成...')
      return this.initializing
    }

    // 开始初始化
    console.log(`开始MCP系统初始化... (强制重新初始化: ${force})`)
    this.initializing = this._doInitialize(force)

    try {
      const result = await this.initializing
      return result
    } finally {
      this.initializing = null
    }
  }

  /**
   * 启动后台初始化（非阻塞）
   * 用于在系统启动时延迟初始化MCP
   */
  async initializeInBackground(delay: number = 3000): Promise<void> {
    console.log(`将在 ${delay}ms 后开始后台MCP初始化...`)
    
    setTimeout(async () => {
      try {
        console.log('开始后台MCP初始化...')
        await this.initialize()
        console.log('后台MCP初始化完成')
      } catch (error) {
        console.error('后台MCP初始化失败:', error)
      }
    }, delay)
  }

  /**
   * 内部初始化逻辑
   */
  private async _doInitialize(force: boolean = false): Promise<MCPInitializationStatus> {
    try {
      // 只有在强制重新初始化或状态为空时才重置状态
      if (force || !this.initializationStatus.configLoaded) {
        this.resetStatus()
        
        // 通知状态监听器初始化开始
        try {
          const { mcpStatusMonitor } = await import('../utils/mcp-status-monitor')
          mcpStatusMonitor.updateStatus('initializing', {
            message: '开始MCP系统初始化',
            timestamp: new Date().toISOString()
          })
        } catch (error) {
          console.warn('通知MCP状态监听器失败:', error)
        }
      }

      // 步骤1: 加载config/mcp.json配置
      if (!this.initializationStatus.configLoaded || force) {
        await this.loadConfiguration()
      } else {
        console.log('配置已加载，跳过配置加载步骤')
      }

      // 步骤2: 连接MCP服务器
      if (!this.initializationStatus.serversConnected || force) {
        await this.connectServers()
      } else {
        console.log('服务器已连接，跳过服务器连接步骤')
      }

      // 步骤3: 获取工具信息
      if (!this.initializationStatus.toolsLoaded || force) {
        await this.loadToolsInformation()
      } else {
        console.log('工具信息已加载，跳过工具加载步骤')
      }

      // 步骤4: 动态初始化工具关键词映射
      if (!this.initializationStatus.keywordsMapped || force) {
        await this.initializeKeywordMappings()
      } else {
        console.log('关键词映射已初始化，跳过关键词映射步骤')
      }

      // 标记为就绪
      this.initializationStatus.ready = true
      console.log('MCP系统初始化完成')

      // 通知全局状态监听器
      try {
        const { mcpStatusMonitor } = await import('../utils/mcp-status-monitor')
        mcpStatusMonitor.updateStatus('ready', {
          ...this.initializationStatus,
          timestamp: new Date().toISOString()
        })
      } catch (error) {
        console.warn('通知MCP状态监听器失败:', error)
      }

      return this.getStatus()

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误'
      console.error('MCP系统初始化失败:', errorMessage)

      this.initializationStatus.error = errorMessage
      this.initializationStatus.ready = false

      // 通知状态监听器初始化失败
      try {
        const { mcpStatusMonitor } = await import('../utils/mcp-status-monitor')
        mcpStatusMonitor.updateStatus('error', {
          error: errorMessage,
          timestamp: new Date().toISOString()
        })
      } catch (error) {
        console.warn('通知MCP状态监听器失败:', error)
      }

      return this.getStatus()
    }
  }

  /**
   * 步骤1: 加载config/mcp.json配置
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

      // 同步配置到数据库
      await this.syncConfigToDatabase(serverConfigs)
    } catch (error) {
      throw new Error(`配置加载失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  /**
   * 同步MCP配置到数据库
   */
  private async syncConfigToDatabase(serverConfigs: Record<string, any>): Promise<void> {
    try {
      console.log('同步MCP配置到数据库...')

      const { getDatabaseService } = await import('./database')
      const dbService = getDatabaseService()

      // 确保数据库服务已初始化
      if (!dbService.isInitialized()) {
        console.log('数据库服务未初始化，正在初始化...')
        await dbService.initialize()
      }

      // 检查数据库是否可用
      if (!dbService.isVectorSearchEnabled()) {
        console.log('数据库不可用，跳过MCP配置同步')
        return
      }

      // 确保表存在
      await dbService.query(`
        CREATE TABLE IF NOT EXISTS mcp_servers (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          display_name TEXT,
          transport TEXT NOT NULL,
          url TEXT,
          command TEXT,
          args TEXT,
          env TEXT,
          disabled BOOLEAN DEFAULT FALSE,
          metadata JSONB,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `)

      // 同步每个服务器配置
      for (const [name, config] of Object.entries(serverConfigs)) {
        await dbService.query(`
          INSERT INTO mcp_servers 
          (name, display_name, transport, url, command, args, env, disabled, metadata, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
          ON CONFLICT (name) 
          DO UPDATE SET
            display_name = EXCLUDED.display_name,
            transport = EXCLUDED.transport,
            url = EXCLUDED.url,
            command = EXCLUDED.command,
            args = EXCLUDED.args,
            env = EXCLUDED.env,
            disabled = EXCLUDED.disabled,
            metadata = EXCLUDED.metadata,
            updated_at = CURRENT_TIMESTAMP
        `, [
          name,
          config.name || name,
          config.transport || 'stdio',
          config.url || null,
          config.command || null,
          config.args ? JSON.stringify(config.args) : null,
          config.env ? JSON.stringify(config.env) : null,
          config.disabled || false,
          JSON.stringify(config)
        ])
      }

      console.log(`已同步 ${Object.keys(serverConfigs).length} 个MCP服务器配置到数据库`)
    } catch (error) {
      console.warn('同步MCP配置到数据库失败（不影响系统运行）:', error instanceof Error ? error.message : error)
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

      // 自动索引工具到向量数据库
      await this.indexToolsToVectorStore(tools)
    } catch (error) {
      throw new Error(`工具信息加载失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  /**
   * 索引工具到向量数据库（用于工具匹配）
   */
  private async indexToolsToVectorStore(tools: Tool[]): Promise<void> {
    try {
      console.log('开始索引工具到向量数据库（用于工具匹配）...')

      // 使用 ToolVectorStore 来索引工具
      const { getToolVectorStore } = await import('./tool-vector-store')
      const vectorStore = getToolVectorStore()

      // 触发后台索引（不阻塞初始化流程）
      this.indexToolsInBackground(tools, vectorStore).catch(error => {
        console.warn('工具索引失败（不影响系统运行）:', error)
      })

      console.log('工具向量索引已在后台启动')
    } catch (error) {
      console.warn('无法启动工具索引（不影响系统运行）:', error)
    }
  }

  /**
   * 后台索引工具
   */
  private async indexToolsInBackground(tools: Tool[], vectorStore: any): Promise<void> {
    try {
      await vectorStore.initialize()

      // 获取MCP管理器来确定每个工具的服务器名称
      const mcpManager = getMCPManager()
      const registry = mcpManager.getRegistry()

      for (const tool of tools) {
        try {
          // 确定工具来自哪个服务器
          let serverName = 'unknown'

          for (const [name, server] of registry.servers) {
            if (server.isConnected()) {
              try {
                const serverTools = await server.listTools()
                if (serverTools.some(t => t.name === tool.name)) {
                  serverName = name
                  break
                }
              } catch (error) {
                // Continue checking other servers
              }
            }
          }

          // 索引工具（不生成embedding，只存储基本信息）
          await vectorStore.indexTool(tool, serverName)

          console.log(`工具 ${tool.name} 已索引到向量存储 (服务器: ${serverName})`)
        } catch (toolError) {
          console.warn(`索引工具 ${tool.name} 失败:`, toolError)
        }
      }

      console.log(`完成索引 ${tools.length} 个工具到向量存储`)
    } catch (error) {
      console.error('后台工具索引失败:', error)
      throw error
    }
  }

  /**
   * 步骤4: 动态初始化工具关键词映射
   */
  private async initializeKeywordMappings(): Promise<void> {
    console.log('步骤4: 初始化工具关键词映射...')

    try {
      // 动态扩展关键词映射（基于实际可用的工具）
      await this.expandKeywordMappings()

      // 获取统计信息（从工具元数据服务）
      const { getToolMetadataService } = await import('./tool-metadata-service')
      const metadataService = getToolMetadataService()
      const stats = await metadataService.getLLMKeywordStats()

      this.initializationStatus.details.keywordMappings = stats.totalTools
      this.initializationStatus.keywordsMapped = stats.totalTools > 0

      console.log(`关键词映射初始化完成: ${stats.totalTools} 个工具映射`)

    } catch (error) {
      throw new Error(`关键词映射初始化失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  /**
   * 动态扩展关键词映射 - 使用数据库驱动的方法
   */
  private async expandKeywordMappings(): Promise<void> {
    try {
      console.log('开始动态扩展关键词映射...')

      // 使用 ToolMetadataService 来刷新所有工具的元数据
      const { getToolMetadataService } = await import('./tool-metadata-service')
      const metadataService = getToolMetadataService()

      // 确保服务已初始化
      await metadataService.initialize()

      // 刷新所有工具的元数据（从MCP服务器获取并更新到数据库）
      await metadataService.refreshToolMetadata()

      // 确保关键词映射存在
      await metadataService.ensureKeywordMappingsExist()

      console.log('动态关键词映射扩展完成 - 所有工具元数据已更新到数据库')
    } catch (error) {
      console.warn('动态关键词映射扩展失败，回退到基础方法:', error)

      // 回退到原有的逐个工具处理方法
      await this.expandKeywordMappingsFallback()
    }
  }

  /**
   * 回退的关键词映射扩展方法
   */
  private async expandKeywordMappingsFallback(): Promise<void> {
    try {
      const mcpToolsService = getMCPToolsService()
      const tools = await mcpToolsService.getAvailableTools()

      // 为每个工具动态生成关键词
      for (const tool of tools) {
        await this.generateKeywordsForTool(tool, null)
      }

      console.log('回退关键词映射扩展完成')
    } catch (error) {
      console.warn('回退关键词映射扩展也失败:', error)
    }
  }

  /**
   * 为特定工具生成关键词 - 使用数据库驱动的方法
   */
  private async generateKeywordsForTool(tool: Tool, intentRecognizer: any): Promise<void> {
    try {
      // 使用 ToolMetadataService 来处理工具元数据
      const { getToolMetadataService } = await import('./tool-metadata-service')
      const metadataService = getToolMetadataService()

      // 确保服务已初始化
      await metadataService.initialize()

      // 让 ToolMetadataService 处理这个工具的元数据更新
      // 这会自动提取关键词、参数映射等
      await metadataService.updateToolMetadata(tool)

      console.log(`工具 ${tool.name} 的元数据已更新到数据库`)

    } catch (error) {
      console.warn(`更新工具 ${tool.name} 的元数据失败:`, error)

      // 回退到基础关键词生成
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
      const genericKeywords = await this.getGenericKeywords(tool.name)
      keywords.push(...genericKeywords)

      console.log(`为工具 ${tool.name} 生成基础关键词:`, keywords)
    }
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
   * 获取通用关键词 - 从数据库动态获取
   */
  private async getGenericKeywords(toolName: string): Promise<string[]> {
    try {
      // 尝试从数据库获取关键词映射
      const { getToolMetadataService } = await import('./tool-metadata-service')
      const metadataService = getToolMetadataService()

      // 从数据库查询现有的关键词映射
      const suggestions = await metadataService.getToolSuggestions(toolName)

      if (suggestions.length > 0) {
        // 合并所有匹配工具的关键词
        const allKeywords = suggestions.flatMap(s => s.keywords)
        return [...new Set(allKeywords)] // 去重
      }

      // 如果数据库中没有，回退到基础关键词生成
      return this.generateBasicKeywords(toolName)

    } catch (error) {
      console.warn('从数据库获取关键词失败，使用基础生成:', error)
      return this.generateBasicKeywords(toolName)
    }
  }

  /**
   * 生成基础关键词（回退方案）
   */
  private generateBasicKeywords(toolName: string): string[] {
    const keywords: string[] = []
    const nameLower = toolName.toLowerCase()

    // 基于工具名称的简单模式匹配
    const patterns = [
      { pattern: 'solve', keywords: ['解决', '求解', 'solve'] },
      { pattern: 'run', keywords: ['运行', '执行', 'run'] },
      { pattern: 'echo', keywords: ['回显', 'echo'] },
      { pattern: 'info', keywords: ['信息', 'info'] },
      { pattern: 'install', keywords: ['安装', 'install'] },
      { pattern: 'queens', keywords: ['皇后', 'queens'] },
      { pattern: 'sudoku', keywords: ['数独', 'sudoku'] },
      { pattern: 'optimization', keywords: ['优化', 'optimization'] },
      { pattern: 'game', keywords: ['游戏', 'game'] }
    ]

    for (const { pattern, keywords: patternKeywords } of patterns) {
      if (nameLower.includes(pattern)) {
        keywords.push(...patternKeywords)
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