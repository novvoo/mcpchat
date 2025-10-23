// 动态配置服务 - 基于PostgreSQL的配置管理系统
// 替代硬编码配置，实现运行时配置更新和智能学习

import { getDatabaseService } from './database'
import { MCPServerConfig } from '@/types'

export interface SystemConfig {
  key: string
  value: any
  type: 'string' | 'number' | 'boolean' | 'object' | 'array'
  description?: string
  isActive: boolean
}

export interface ToolMapping {
  id: number
  patternText: string
  patternType: 'exact' | 'regex' | 'semantic' | 'keyword'
  toolName: string
  confidence: number
  successRate: number
  usageCount: number
  contextTags: string[]
  parameterHints: Record<string, any>
}

export interface ParameterMapping {
  id: number
  toolName: string
  userInputPattern: string
  parameterName: string
  parameterValue: any
  mappingType: 'direct' | 'transform' | 'computed'
  transformFunction?: string
  confidence: number
  successCount: number
  failureCount: number
}

export interface SampleProblemTemplate {
  id: number
  templateName: string
  toolName: string
  category: string
  difficulty: string
  titleTemplate: string
  descriptionTemplate: string
  parameterGenerators: Record<string, any>
  keywordsTemplate: string[]
  generationRules: Record<string, any>
}

/**
 * 动态配置服务 - 完全基于数据库的配置管理
 */
export class DynamicConfigService {
  private static instance: DynamicConfigService
  private configCache: Map<string, any> = new Map()
  private cacheExpiry: Map<string, number> = new Map()
  private readonly CACHE_TTL = 5 * 60 * 1000 // 5分钟缓存

  private constructor() {}

  public static getInstance(): DynamicConfigService {
    if (!DynamicConfigService.instance) {
      DynamicConfigService.instance = new DynamicConfigService()
    }
    return DynamicConfigService.instance
  }

  /**
   * 获取系统配置值
   */
  async getSystemConfig<T = any>(key: string, defaultValue?: T): Promise<T> {
    const cacheKey = `config:${key}`
    
    // 检查缓存
    if (this.configCache.has(cacheKey) && this.isCacheValid(cacheKey)) {
      return this.configCache.get(cacheKey)
    }

    const dbService = getDatabaseService()
    const client = await dbService.getClient()

    if (!client) {
      return defaultValue as T
    }

    try {
      const result = await client.query(
        'SELECT config_value, config_type FROM system_config WHERE config_key = $1 AND is_active = true',
        [key]
      )

      if (result.rows.length === 0) {
        return defaultValue as T
      }

      const { config_value, config_type } = result.rows[0]
      let value: any

      // 根据类型解析值
      switch (config_type) {
        case 'string':
          value = JSON.parse(config_value)
          break
        case 'number':
          value = parseFloat(config_value)
          break
        case 'boolean':
          value = config_value === 'true'
          break
        case 'object':
        case 'array':
          value = JSON.parse(config_value)
          break
        default:
          value = config_value
      }

      // 更新缓存
      this.configCache.set(cacheKey, value)
      this.cacheExpiry.set(cacheKey, Date.now() + this.CACHE_TTL)

      return value
    } catch (error) {
      console.error(`获取系统配置失败 ${key}:`, error)
      return defaultValue as T
    } finally {
      client.release()
    }
  }

  /**
   * 设置系统配置值
   */
  async setSystemConfig(key: string, value: any, type?: string, description?: string): Promise<void> {
    const dbService = getDatabaseService()
    const client = await dbService.getClient()

    if (!client) {
      throw new Error('数据库连接失败')
    }

    try {
      // 自动推断类型
      if (!type) {
        if (typeof value === 'string') type = 'string'
        else if (typeof value === 'number') type = 'number'
        else if (typeof value === 'boolean') type = 'boolean'
        else if (Array.isArray(value)) type = 'array'
        else type = 'object'
      }

      // 序列化值
      let serializedValue: string
      if (type === 'string') {
        serializedValue = JSON.stringify(value)
      } else if (type === 'number' || type === 'boolean') {
        serializedValue = String(value)
      } else {
        serializedValue = JSON.stringify(value)
      }

      await client.query(`
        INSERT INTO system_config (config_key, config_value, config_type, description)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (config_key) DO UPDATE SET
          config_value = EXCLUDED.config_value,
          config_type = EXCLUDED.config_type,
          description = COALESCE(EXCLUDED.description, system_config.description),
          updated_at = CURRENT_TIMESTAMP
      `, [key, serializedValue, type, description])

      // 清除缓存
      this.configCache.delete(`config:${key}`)
      this.cacheExpiry.delete(`config:${key}`)

      console.log(`系统配置已更新: ${key} = ${serializedValue}`)
    } catch (error) {
      console.error(`设置系统配置失败 ${key}:`, error)
      throw error
    } finally {
      client.release()
    }
  }

  /**
   * 获取所有MCP服务器配置
   */
  async getMCPServerConfigs(): Promise<Record<string, MCPServerConfig>> {
    const cacheKey = 'mcp:servers'
    
    if (this.configCache.has(cacheKey) && this.isCacheValid(cacheKey)) {
      return this.configCache.get(cacheKey)
    }

    const dbService = getDatabaseService()
    const client = await dbService.getClient()

    if (!client) {
      return {}
    }

    try {
      const result = await client.query(`
        SELECT * FROM mcp_server_configs 
        WHERE disabled = false 
        ORDER BY priority DESC, server_name
      `)

      const configs: Record<string, MCPServerConfig> = {}
      
      for (const row of result.rows) {
        configs[row.server_name] = {
          name: row.server_name,
          transport: row.transport,
          command: row.command,
          args: row.args,
          env: row.env,
          url: row.url,
          timeout: row.timeout,
          retryAttempts: row.retry_attempts,
          retryDelay: row.retry_delay,
          autoApprove: row.auto_approve,
          disabled: row.disabled
        }
      }

      // 更新缓存
      this.configCache.set(cacheKey, configs)
      this.cacheExpiry.set(cacheKey, Date.now() + this.CACHE_TTL)

      return configs
    } catch (error) {
      console.error('获取MCP服务器配置失败:', error)
      return {}
    } finally {
      client.release()
    }
  }

  /**
   * 更新MCP服务器配置
   */
  async updateMCPServerConfig(serverName: string, config: Partial<MCPServerConfig>): Promise<void> {
    const dbService = getDatabaseService()
    const client = await dbService.getClient()

    if (!client) {
      throw new Error('数据库连接失败')
    }

    try {
      const updateFields: string[] = []
      const values: any[] = []
      let paramIndex = 1

      // 构建动态更新语句
      const fieldMappings = {
        transport: 'transport',
        command: 'command',
        args: 'args',
        env: 'env',
        url: 'url',
        timeout: 'timeout',
        retryAttempts: 'retry_attempts',
        retryDelay: 'retry_delay',
        autoApprove: 'auto_approve',
        disabled: 'disabled'
      }

      for (const [configKey, dbField] of Object.entries(fieldMappings)) {
        if (config[configKey as keyof MCPServerConfig] !== undefined) {
          updateFields.push(`${dbField} = $${paramIndex}`)
          values.push(config[configKey as keyof MCPServerConfig])
          paramIndex++
        }
      }

      if (updateFields.length === 0) {
        return // 没有需要更新的字段
      }

      updateFields.push('updated_at = CURRENT_TIMESTAMP')
      values.push(serverName)

      const sql = `
        UPDATE mcp_server_configs 
        SET ${updateFields.join(', ')}
        WHERE server_name = $${paramIndex}
      `

      await client.query(sql, values)

      // 清除缓存
      this.configCache.delete('mcp:servers')
      this.cacheExpiry.delete('mcp:servers')

      console.log(`MCP服务器配置已更新: ${serverName}`)
    } catch (error) {
      console.error(`更新MCP服务器配置失败 ${serverName}:`, error)
      throw error
    } finally {
      client.release()
    }
  }

  /**
   * 智能工具选择 - 基于学习的工具映射
   */
  async findBestToolForInput(userInput: string, context?: Record<string, any>): Promise<ToolMapping[]> {
    const dbService = getDatabaseService()
    const client = await dbService.getClient()

    if (!client) {
      return []
    }

    try {
      // 多种匹配策略
      const results = await Promise.all([
        // 1. 精确匹配
        this.findExactMatches(client, userInput),
        // 2. 正则表达式匹配
        this.findRegexMatches(client, userInput),
        // 3. 关键词匹配
        this.findKeywordMatches(client, userInput),
        // 4. 语义匹配（如果有向量搜索）
        this.findSemanticMatches(client, userInput)
      ])

      // 合并和排序结果
      const allMatches = results.flat()
      const uniqueMatches = this.deduplicateMatches(allMatches)
      
      // 根据置信度、成功率和使用频率排序
      return uniqueMatches.sort((a, b) => {
        const scoreA = a.confidence * a.successRate * Math.log(a.usageCount + 1)
        const scoreB = b.confidence * b.successRate * Math.log(b.usageCount + 1)
        return scoreB - scoreA
      }).slice(0, 5) // 返回前5个最佳匹配

    } catch (error) {
      console.error('智能工具选择失败:', error)
      return []
    } finally {
      client.release()
    }
  }

  /**
   * 学习用户选择 - 更新工具映射的成功率
   */
  async learnFromUserChoice(userInput: string, selectedTool: string, success: boolean): Promise<void> {
    const dbService = getDatabaseService()
    const client = await dbService.getClient()

    if (!client) {
      return
    }

    try {
      // 更新现有映射的统计信息
      await client.query(`
        UPDATE intelligent_tool_mappings 
        SET 
          usage_count = usage_count + 1,
          success_rate = CASE 
            WHEN $3 THEN (success_rate * usage_count + 1.0) / (usage_count + 1)
            ELSE (success_rate * usage_count) / (usage_count + 1)
          END,
          last_used = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        WHERE tool_name = $2 AND (
          pattern_type = 'exact' AND pattern_text = $1
          OR pattern_type = 'regex' AND $1 ~ pattern_text
          OR pattern_type = 'keyword' AND $1 ILIKE '%' || pattern_text || '%'
        )
      `, [userInput, selectedTool, success])

      // 如果没有匹配的映射，创建新的学习记录
      const existingCount = await client.query(`
        SELECT COUNT(*) as count FROM intelligent_tool_mappings 
        WHERE tool_name = $1 AND pattern_text = $2
      `, [selectedTool, userInput])

      if (parseInt(existingCount.rows[0].count) === 0) {
        await client.query(`
          INSERT INTO intelligent_tool_mappings (
            pattern_text, pattern_type, tool_name, confidence, success_rate, usage_count, last_used
          ) VALUES ($1, 'exact', $2, $3, $4, 1, CURRENT_TIMESTAMP)
        `, [userInput, selectedTool, success ? 0.8 : 0.3, success ? 1.0 : 0.0])
      }

      console.log(`学习记录已更新: ${userInput} -> ${selectedTool} (成功: ${success})`)
    } catch (error) {
      console.error('学习用户选择失败:', error)
    } finally {
      client.release()
    }
  }

  /**
   * 获取动态参数映射
   */
  async getParameterMappings(toolName: string, userInput: string): Promise<Record<string, any>> {
    const dbService = getDatabaseService()
    const client = await dbService.getClient()

    if (!client) {
      return {}
    }

    try {
      const result = await client.query(`
        SELECT parameter_name, parameter_value, mapping_type, transform_function
        FROM dynamic_parameter_mappings 
        WHERE tool_name = $1 AND is_active = true
        AND (
          user_input_pattern = $2 
          OR $2 ~ user_input_pattern
          OR $2 ILIKE '%' || user_input_pattern || '%'
        )
        ORDER BY confidence DESC, success_count DESC
      `, [toolName, userInput])

      const parameters: Record<string, any> = {}

      for (const row of result.rows) {
        const { parameter_name, parameter_value, mapping_type, transform_function } = row

        if (mapping_type === 'direct') {
          parameters[parameter_name] = parameter_value
        } else if (mapping_type === 'transform' && transform_function) {
          try {
            // 安全执行转换函数
            const transformFunc = new Function('input', 'value', transform_function)
            parameters[parameter_name] = transformFunc(userInput, parameter_value)
          } catch (error) {
            console.warn(`参数转换函数执行失败: ${parameter_name}`, error)
            parameters[parameter_name] = parameter_value
          }
        } else if (mapping_type === 'computed') {
          // 计算型参数，基于用户输入动态计算
          parameters[parameter_name] = this.computeParameterValue(parameter_name, userInput, parameter_value)
        }
      }

      return parameters
    } catch (error) {
      console.error('获取参数映射失败:', error)
      return {}
    } finally {
      client.release()
    }
  }

  /**
   * 动态生成样例问题
   */
  async generateSampleProblems(toolName?: string, category?: string, limit: number = 10): Promise<any[]> {
    const dbService = getDatabaseService()
    const client = await dbService.getClient()

    if (!client) {
      return []
    }

    try {
      let whereClause = 'WHERE is_active = true'
      const params: any[] = []
      let paramIndex = 1

      if (toolName) {
        whereClause += ` AND tool_name = $${paramIndex}`
        params.push(toolName)
        paramIndex++
      }

      if (category) {
        whereClause += ` AND category = $${paramIndex}`
        params.push(category)
        paramIndex++
      }

      const result = await client.query(`
        SELECT * FROM sample_problem_templates 
        ${whereClause}
        ORDER BY priority DESC, RANDOM()
        LIMIT $${paramIndex}
      `, [...params, limit])

      const problems = []

      for (const template of result.rows) {
        const problem = await this.generateProblemFromTemplate(template)
        if (problem) {
          problems.push(problem)
        }
      }

      return problems
    } catch (error) {
      console.error('动态生成样例问题失败:', error)
      return []
    } finally {
      client.release()
    }
  }

  /**
   * 记录工具性能指标
   */
  async recordToolPerformance(
    toolName: string,
    serverName: string,
    executionTime: number,
    success: boolean,
    errorType?: string,
    errorMessage?: string,
    additionalMetrics?: Record<string, any>
  ): Promise<void> {
    const dbService = getDatabaseService()
    const client = await dbService.getClient()

    if (!client) {
      return
    }

    try {
      await client.query(`
        INSERT INTO tool_performance_metrics (
          tool_name, server_name, execution_time, success, error_type, error_message,
          input_size, output_size, memory_usage, cpu_usage, context_info
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [
        toolName,
        serverName,
        executionTime,
        success,
        errorType,
        errorMessage,
        additionalMetrics?.inputSize || null,
        additionalMetrics?.outputSize || null,
        additionalMetrics?.memoryUsage || null,
        additionalMetrics?.cpuUsage || null,
        JSON.stringify(additionalMetrics || {})
      ])
    } catch (error) {
      console.error('记录工具性能指标失败:', error)
    } finally {
      client.release()
    }
  }

  /**
   * 获取工具性能统计
   */
  async getToolPerformanceStats(toolName?: string, days: number = 7): Promise<any> {
    const dbService = getDatabaseService()
    const client = await dbService.getClient()

    if (!client) {
      return null
    }

    try {
      let whereClause = `WHERE created_at >= NOW() - INTERVAL '${days} days'`
      const params: any[] = []

      if (toolName) {
        whereClause += ' AND tool_name = $1'
        params.push(toolName)
      }

      const result = await client.query(`
        SELECT 
          tool_name,
          COUNT(*) as total_executions,
          AVG(execution_time) as avg_execution_time,
          MIN(execution_time) as min_execution_time,
          MAX(execution_time) as max_execution_time,
          SUM(CASE WHEN success THEN 1 ELSE 0 END)::FLOAT / COUNT(*) as success_rate,
          COUNT(DISTINCT server_name) as server_count
        FROM tool_performance_metrics 
        ${whereClause}
        GROUP BY tool_name
        ORDER BY total_executions DESC
      `, params)

      return result.rows
    } catch (error) {
      console.error('获取工具性能统计失败:', error)
      return null
    } finally {
      client.release()
    }
  }

  // 私有辅助方法

  private isCacheValid(key: string): boolean {
    const expiry = this.cacheExpiry.get(key)
    return expiry ? Date.now() < expiry : false
  }

  private async findExactMatches(client: any, userInput: string): Promise<ToolMapping[]> {
    const result = await client.query(`
      SELECT * FROM intelligent_tool_mappings 
      WHERE pattern_type = 'exact' AND pattern_text = $1 AND is_active = true
      ORDER BY confidence DESC, success_rate DESC
    `, [userInput])

    return result.rows.map(this.mapRowToToolMapping)
  }

  private async findRegexMatches(client: any, userInput: string): Promise<ToolMapping[]> {
    const result = await client.query(`
      SELECT * FROM intelligent_tool_mappings 
      WHERE pattern_type = 'regex' AND $1 ~ pattern_text AND is_active = true
      ORDER BY confidence DESC, success_rate DESC
    `, [userInput])

    return result.rows.map(this.mapRowToToolMapping)
  }

  private async findKeywordMatches(client: any, userInput: string): Promise<ToolMapping[]> {
    const result = await client.query(`
      SELECT * FROM intelligent_tool_mappings 
      WHERE pattern_type = 'keyword' AND $1 ILIKE '%' || pattern_text || '%' AND is_active = true
      ORDER BY confidence DESC, success_rate DESC
    `, [userInput])

    return result.rows.map(this.mapRowToToolMapping)
  }

  private async findSemanticMatches(client: any, userInput: string): Promise<ToolMapping[]> {
    // 如果有向量搜索功能，在这里实现语义匹配
    // 暂时返回空数组
    return []
  }

  private deduplicateMatches(matches: ToolMapping[]): ToolMapping[] {
    const seen = new Set<string>()
    return matches.filter(match => {
      const key = `${match.toolName}:${match.patternText}`
      if (seen.has(key)) {
        return false
      }
      seen.add(key)
      return true
    })
  }

  private mapRowToToolMapping(row: any): ToolMapping {
    return {
      id: row.id,
      patternText: row.pattern_text,
      patternType: row.pattern_type,
      toolName: row.tool_name,
      confidence: row.confidence,
      successRate: row.success_rate,
      usageCount: row.usage_count,
      contextTags: row.context_tags || [],
      parameterHints: row.parameter_hints || {}
    }
  }

  private async generateProblemFromTemplate(template: any): Promise<any> {
    try {
      // 生成参数
      const parameters = this.generateParameters(template.parameter_generators)
      
      // 替换模板变量
      const title = this.replaceTemplateVariables(template.title_template, parameters)
      const description = this.replaceTemplateVariables(template.description_template, parameters)

      return {
        id: `generated-${template.id}-${Date.now()}`,
        category: template.category,
        title,
        description,
        problem_type: template.tool_name,
        difficulty: template.difficulty,
        parameters,
        keywords: template.keywords_template,
        tool_name: template.tool_name,
        created_at: new Date().toISOString()
      }
    } catch (error) {
      console.error('从模板生成问题失败:', error)
      return null
    }
  }

  private generateParameters(generators: Record<string, any>): Record<string, any> {
    const parameters: Record<string, any> = {}

    for (const [key, generator] of Object.entries(generators)) {
      if (generator.type === 'range') {
        parameters[key] = Math.floor(Math.random() * (generator.max - generator.min + 1)) + generator.min
      } else if (generator.type === 'enum') {
        parameters[key] = generator.values[Math.floor(Math.random() * generator.values.length)]
      } else {
        parameters[key] = generator.default
      }
    }

    return parameters
  }

  private replaceTemplateVariables(template: string, variables: Record<string, any>): string {
    let result = template
    for (const [key, value] of Object.entries(variables)) {
      result = result.replace(new RegExp(`{{${key}}}`, 'g'), String(value))
    }
    return result
  }

  private computeParameterValue(parameterName: string, userInput: string, config: any): any {
    // 基于参数名称和用户输入计算参数值
    switch (parameterName) {
      case 'n':
        // 从用户输入中提取数字
        const match = userInput.match(/(\d+)/);
        return match ? parseInt(match[1]) : config.default || 8
      default:
        return config.default
    }
  }
}

/**
 * 便利函数
 */
export const getDynamicConfigService = () => DynamicConfigService.getInstance()