// Tool Call Detection Service - Analyzes messages to suggest tool usage

import { Tool } from '@/types'
import { getMCPToolsService } from './mcp-tools'
import { getToolMetadataService, ToolKeywordMapping } from './tool-metadata-service'

/**
 * Tool detection patterns and scoring (deprecated - now using database)
 */
interface ToolPattern {
  keywords: string[]
  phrases: string[]
  weight: number
  toolNames: string[]
}

/**
 * Tool suggestion with confidence score
 */
export interface ToolSuggestion {
  toolName: string
  confidence: number
  reason: string
  suggestedParameters?: Record<string, any>
}

/**
 * Tool call detector for analyzing user messages
 */
export class ToolCallDetector {
  private static instance: ToolCallDetector
  private patterns: ToolPattern[] = []
  private availableTools: Tool[] = []

  private constructor() {
    this.initializePatterns()
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): ToolCallDetector {
    if (!ToolCallDetector.instance) {
      ToolCallDetector.instance = new ToolCallDetector()
    }
    return ToolCallDetector.instance
  }

  /**
   * Initialize detection patterns
   */
  private initializePatterns(): void {
    this.patterns = [
      {
        keywords: ['queens', 'n-queens', 'chess', 'board'],
        phrases: ['n queens problem', 'queens puzzle', 'place queens'],
        weight: 0.9,
        toolNames: ['solve_n_queens']
      },
      {
        keywords: ['sudoku', 'puzzle', '9x9', 'grid'],
        phrases: ['sudoku puzzle', 'solve sudoku', 'sudoku grid'],
        weight: 0.9,
        toolNames: ['solve_sudoku']
      },
      {
        keywords: ['graph', 'coloring', 'color', 'vertices', 'edges'],
        phrases: ['graph coloring', 'color graph', 'vertex coloring'],
        weight: 0.8,
        toolNames: ['solve_graph_coloring']
      },
      {
        keywords: ['map', 'coloring', 'regions', 'countries'],
        phrases: ['map coloring', 'color map', 'region coloring'],
        weight: 0.8,
        toolNames: ['solve_map_coloring']
      },
      {
        keywords: ['optimization', 'linear', 'programming', 'minimize', 'maximize'],
        phrases: ['linear programming', 'optimization problem', 'minimize cost'],
        weight: 0.7,
        toolNames: ['solve_lp']
      },
      {
        keywords: ['production', 'planning', 'schedule', 'manufacturing'],
        phrases: ['production planning', 'manufacturing schedule', 'production optimization'],
        weight: 0.7,
        toolNames: ['solve_production_planning']
      },
      {
        keywords: ['minimax', 'game', 'strategy', 'decision'],
        phrases: ['minimax algorithm', 'game theory', 'decision tree'],
        weight: 0.8,
        toolNames: ['solve_minimax_game', 'solve_minimax_decision']
      },
      {
        keywords: ['24', 'point', 'game', 'numbers', 'arithmetic'],
        phrases: ['24 point game', '24 game', 'make 24'],
        weight: 0.9,
        toolNames: ['solve_24_point_game']
      },
      {
        keywords: ['chicken', 'rabbit', 'legs', 'heads', 'animals', '鸡兔', '鸡兔同笼', '鸡兔问题', '头', '腿', '只鸡', '只兔', '个头', '条腿', '同笼'],
        phrases: ['chicken rabbit problem', 'chickens and rabbits', 'legs and heads', '鸡兔同笼', '鸡兔问题', '头腿问题'],
        weight: 0.9,
        toolNames: ['solve_chicken_rabbit_problem']
      },
      {
        keywords: ['portfolio', 'optimization', 'investment', 'risk', 'return'],
        phrases: ['portfolio optimization', 'investment portfolio', 'risk return'],
        weight: 0.8,
        toolNames: ['solve_scipy_portfolio_optimization']
      },
      {
        keywords: ['statistical', 'fitting', 'regression', 'curve', 'data'],
        phrases: ['statistical fitting', 'curve fitting', 'data fitting'],
        weight: 0.7,
        toolNames: ['solve_scipy_statistical_fitting']
      },
      {
        keywords: ['facility', 'location', 'placement', 'optimal'],
        phrases: ['facility location', 'optimal placement', 'location optimization'],
        weight: 0.8,
        toolNames: ['solve_scipy_facility_location']
      },
      {
        keywords: ['example', 'demo', 'test', 'run'],
        phrases: ['run example', 'show example', 'test run'],
        weight: 0.5,
        toolNames: ['run_example']
      }
    ]
  }

  /**
   * Analyze message and suggest tools using semantic understanding
   */
  async analyzeMessage(message: string): Promise<ToolSuggestion[]> {
    try {
      // Update available tools
      await this.updateAvailableTools()

      // Try semantic analysis first
      const semanticSuggestions = await this.analyzeMessageWithSemantics(message)
      if (semanticSuggestions.length > 0) {
        return semanticSuggestions
      }

      // Fallback to database-driven suggestions
      const toolMetadataService = getToolMetadataService()
      await toolMetadataService.initialize()
      await toolMetadataService.ensureKeywordMappingsExist()

      const toolMappings = await toolMetadataService.getToolSuggestions(message)
      const suggestions: ToolSuggestion[] = []

      for (const mapping of toolMappings) {
        const tool = this.availableTools.find(t => t.name === mapping.toolName)
        if (tool && mapping.confidence > 0.1) {
          suggestions.push({
            toolName: mapping.toolName,
            confidence: mapping.confidence,
            reason: this.generateReasonFromKeywords(mapping.keywords, mapping.confidence),
            suggestedParameters: await this.suggestParametersFromDatabase(mapping.toolName, message)
          })
        }
      }

      // Final fallback to hardcoded patterns
      if (suggestions.length === 0) {
        console.log('No semantic or database suggestions found, falling back to hardcoded patterns')
        return this.analyzeMessageWithPatterns(message)
      }

      const uniqueSuggestions = this.deduplicateSuggestions(suggestions)
      return uniqueSuggestions.sort((a, b) => b.confidence - a.confidence)

    } catch (error) {
      console.error('Error analyzing message for tool suggestions:', error)
      return this.analyzeMessageWithPatterns(message)
    }
  }

  /**
   * Calculate pattern matching score
   */
  private calculatePatternScore(message: string, pattern: ToolPattern): number {
    let score = 0
    let matches = 0

    // Check keywords
    for (const keyword of pattern.keywords) {
      if (message.includes(keyword)) {
        score += 0.3
        matches++
      }
    }

    // Check phrases (higher weight)
    for (const phrase of pattern.phrases) {
      if (message.includes(phrase)) {
        score += 0.6
        matches++
      }
    }

    // Apply pattern weight and normalize
    if (matches > 0) {
      score = Math.min(score * pattern.weight, 1.0)
    }

    return score
  }

  /**
   * Generate reason for suggestion from database keywords
   */
  private generateReasonFromKeywords(keywords: string[], confidence: number): string {
    const confidencePercent = Math.round(confidence * 100)
    const displayKeywords = keywords.slice(0, 3)

    return `${confidencePercent}% confidence based on keywords: ${displayKeywords.join(', ')}`
  }

  /**
   * Generate reason for suggestion (legacy pattern-based)
   */
  private generateReason(pattern: ToolPattern, score: number): string {
    const confidence = Math.round(score * 100)
    const matchedItems = pattern.keywords.concat(pattern.phrases).slice(0, 3)

    return `${confidence}% confidence based on keywords: ${matchedItems.join(', ')}`
  }

  /**
   * Suggest parameters using database mappings
   */
  private async suggestParametersFromDatabase(toolName: string, message: string): Promise<Record<string, any> | undefined> {
    try {
      const toolMetadataService = getToolMetadataService()

      // Try to get parameter mapping from database
      const words = message.toLowerCase().split(/\s+/)
      for (const word of words) {
        const mapping = await toolMetadataService.getParameterMapping(toolName, word)
        if (mapping) {
          return { [mapping]: word }
        }
      }

      // Fallback to legacy parameter suggestion
      return this.suggestParameters(toolName, message)
    } catch (error) {
      console.error('Error suggesting parameters from database:', error)
      return this.suggestParameters(toolName, message)
    }
  }

  /**
   * Suggest parameters for specific tools (legacy method)
   */
  private suggestParameters(toolName: string, message: string): Record<string, any> | undefined {
    const messageLower = message.toLowerCase()

    switch (toolName) {
      case 'solve_n_queens':
        // Try to extract board size
        const nMatch = message.match(/(\d+)[\s-]*queens?/i) || message.match(/(\d+)x(\d+)/i)
        if (nMatch) {
          return { n: parseInt(nMatch[1]) }
        }
        return { n: 8 } // Default

      case 'solve_24_point_game':
        // Try to extract numbers
        const numbers = message.match(/\d+/g)
        if (numbers && numbers.length >= 4) {
          return { numbers: numbers.slice(0, 4).map(n => parseInt(n)) }
        }
        break

      case 'solve_chicken_rabbit_problem':
        // Try to extract heads and legs with various formats (English and Chinese)
        const headsMatch = message.match(/(?:total_)?heads?\s*[:\s]*(\d+)/i) || 
                          message.match(/(\d+)\s*(?:total_)?heads?/i) ||
                          message.match(/(?:总共|共有|一共)?(?:个)?头\s*[:\s]*(\d+)/i) ||
                          message.match(/(\d+)\s*(?:个)?头/i)
        const legsMatch = message.match(/(?:total_)?legs?\s*[:\s]*(\d+)/i) || 
                         message.match(/(\d+)\s*(?:total_)?legs?/i) ||
                         message.match(/(?:总共|共有|一共)?(?:条)?腿\s*[:\s]*(\d+)/i) ||
                         message.match(/(\d+)\s*(?:条)?腿/i)
        if (headsMatch && legsMatch) {
          return {
            total_heads: parseInt(headsMatch[1]),
            total_legs: parseInt(legsMatch[1])
          }
        }
        break

      case 'run_example':
        // Try to extract example type
        const exampleTypes = ['optimization', 'graph', 'puzzle', 'game']
        for (const type of exampleTypes) {
          if (messageLower.includes(type)) {
            return { example_type: type }
          }
        }
        return { example_type: 'general' }
    }

    return undefined
  }

  /**
   * Remove duplicate suggestions
   */
  private deduplicateSuggestions(suggestions: ToolSuggestion[]): ToolSuggestion[] {
    const seen = new Set<string>()
    const unique: ToolSuggestion[] = []

    for (const suggestion of suggestions) {
      if (!seen.has(suggestion.toolName)) {
        seen.add(suggestion.toolName)
        unique.push(suggestion)
      } else {
        // If we've seen this tool, keep the one with higher confidence
        const existingIndex = unique.findIndex(s => s.toolName === suggestion.toolName)
        if (existingIndex >= 0 && suggestion.confidence > unique[existingIndex].confidence) {
          unique[existingIndex] = suggestion
        }
      }
    }

    return unique
  }

  /**
   * Update available tools from MCP
   */
  private async updateAvailableTools(): Promise<void> {
    try {
      const mcpToolsService = getMCPToolsService()
      this.availableTools = await mcpToolsService.getAvailableTools()
    } catch (error) {
      console.warn('Failed to update available tools:', error)
      // Continue with existing tools
    }
  }

  /**
   * Check if message likely needs tools
   */
  async shouldSuggestTools(message: string): Promise<boolean> {
    const suggestions = await this.analyzeMessage(message)
    return suggestions.length > 0 && suggestions[0].confidence > 0.5
  }

  /**
   * Get best tool suggestion
   */
  async getBestSuggestion(message: string): Promise<ToolSuggestion | null> {
    const suggestions = await this.analyzeMessage(message)
    return suggestions.length > 0 ? suggestions[0] : null
  }

  /**
   * Add custom pattern
   */
  addPattern(pattern: ToolPattern): void {
    this.patterns.push(pattern)
  }

  /**
   * Get all patterns
   */
  getPatterns(): ToolPattern[] {
    return [...this.patterns]
  }

  /**
   * Clear patterns and reinitialize
   */
  resetPatterns(): void {
    this.patterns = []
    this.initializePatterns()
  }

  /**
   * Analyze message using semantic understanding with dedicated semantic matcher
   */
  private async analyzeMessageWithSemantics(message: string): Promise<ToolSuggestion[]> {
    try {
      const { getSemanticToolMatcher } = await import('./semantic-tool-matcher')
      const semanticMatcher = getSemanticToolMatcher()
      
      // Initialize semantic matcher if needed
      await semanticMatcher.initialize()
      
      // Get semantic matches
      const semanticMatches = await semanticMatcher.matchTools(message)
      
      // Convert semantic matches to tool suggestions
      const suggestions: ToolSuggestion[] = semanticMatches.map(match => ({
        toolName: match.toolName,
        confidence: match.confidence,
        reason: `${match.matchType.toUpperCase()} 匹配: ${match.reasoning}`,
        suggestedParameters: match.suggestedParameters
      }))

      console.log(`Semantic analysis found ${suggestions.length} tool suggestions`)
      return suggestions

    } catch (error) {
      console.warn('Semantic analysis failed:', error)
      return []
    }
  }

  /**
   * Parse LLM tool suggestions response
   */
  private parseLLMToolSuggestions(content: string): ToolSuggestion[] {
    try {
      const suggestions = JSON.parse(content)
      if (Array.isArray(suggestions)) {
        return suggestions.filter(s => 
          s.toolName && 
          typeof s.confidence === 'number' && 
          s.confidence >= 0 && 
          s.confidence <= 1 &&
          s.reason
        )
      }
    } catch (error) {
      console.warn('Failed to parse LLM tool suggestions:', error)
    }
    return []
  }

  /**
   * Fallback method using hardcoded patterns (legacy)
   */
  private async analyzeMessageWithPatterns(message: string): Promise<ToolSuggestion[]> {
    const messageLower = message.toLowerCase()
    const suggestions: ToolSuggestion[] = []

    // Check each pattern
    for (const pattern of this.patterns) {
      const score = this.calculatePatternScore(messageLower, pattern)

      if (score > 0.3) { // Minimum confidence threshold
        for (const toolName of pattern.toolNames) {
          // Check if tool is available
          const tool = this.availableTools.find(t => t.name === toolName)
          if (tool) {
            suggestions.push({
              toolName,
              confidence: score,
              reason: this.generateReason(pattern, score),
              suggestedParameters: this.suggestParameters(toolName, message)
            })
          }
        }
      }
    }

    // Sort by confidence and remove duplicates
    const uniqueSuggestions = this.deduplicateSuggestions(suggestions)
    return uniqueSuggestions.sort((a, b) => b.confidence - a.confidence)
  }
}

/**
 * Convenience function to get tool detector instance
 */
export const getToolDetector = () => ToolCallDetector.getInstance()

/**
 * Convenience function to analyze message for tool suggestions
 */
export const analyzeMessageForTools = async (message: string): Promise<ToolSuggestion[]> => {
  const detector = getToolDetector()
  return detector.analyzeMessage(message)
}

/**
 * Convenience function to check if tools should be suggested
 */
export const shouldSuggestTools = async (message: string): Promise<boolean> => {
  const detector = getToolDetector()
  return detector.shouldSuggestTools(message)
}