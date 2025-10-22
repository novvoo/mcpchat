import { NextRequest } from 'next/server'
import { POST, GET } from '../mcp/execute/route'

// Mock the services
jest.mock('@/services/mcp-tools', () => ({
  getMCPToolsService: jest.fn(() => ({
    isToolAvailable: jest.fn(),
    getAvailableTools: jest.fn(),
    executeTool: jest.fn(),
    getExecutionHistory: jest.fn(),
    getExecutionStats: jest.fn()
  }))
}))

jest.mock('@/types/validation', () => ({
  validateMCPExecuteRequest: jest.fn()
}))

const { getMCPToolsService } = require('@/services/mcp-tools')
const { validateMCPExecuteRequest } = require('@/types/validation')

type MockExecutionHistoryItem = {
  id: string;
  toolName: string;
  parameters: any;
  result: string;
  timestamp: Date;
  executionTime: number;
}

describe('/api/mcp/execute', () => {
  let mockMCPService: any

  beforeEach(() => {
    mockMCPService = getMCPToolsService()
    jest.clearAllMocks()
    
    // Set up default mock implementations
    mockMCPService.getAvailableTools.mockResolvedValue([])
    mockMCPService.getExecutionHistory.mockReturnValue([])
    mockMCPService.getExecutionStats.mockReturnValue({})
  })

  describe('POST', () => {
    it('executes tool successfully', async () => {
      validateMCPExecuteRequest.mockReturnValue({ isValid: true })
      mockMCPService.isToolAvailable.mockResolvedValue(true)
      mockMCPService.executeTool.mockResolvedValue({
        success: true,
        result: 'Tool executed successfully',
        executionTime: 1500,
        context: { server: 'gurddy' }
      })

      const request = new NextRequest('http://localhost:3000/api/mcp/execute', {
        method: 'POST',
        body: JSON.stringify({
          toolName: 'run_example',
          parameters: { example_type: 'test' }
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.result).toBe('Tool executed successfully')
      expect(data.meta.executionTime).toBe(1500)
      expect(data.meta.context).toEqual({ server: 'gurddy' })
      expect(mockMCPService.executeTool).toHaveBeenCalledWith(
        'run_example',
        { example_type: 'test' },
        {
          timeout: 30000,
          retryAttempts: 1,
          validateInput: true
        }
      )
    })

    it('executes tool with custom timeout and retry attempts', async () => {
      validateMCPExecuteRequest.mockReturnValue({ isValid: true })
      mockMCPService.isToolAvailable.mockResolvedValue(true)
      mockMCPService.executeTool.mockResolvedValue({
        success: true,
        result: 'Tool executed',
        executionTime: 2000
      })

      const request = new NextRequest('http://localhost:3000/api/mcp/execute', {
        method: 'POST',
        body: JSON.stringify({
          toolName: 'solve_n_queens',
          parameters: { n: 8 },
          timeout: 60000,
          retryAttempts: 3
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(mockMCPService.executeTool).toHaveBeenCalledWith(
        'solve_n_queens',
        { n: 8 },
        {
          timeout: 60000,
          retryAttempts: 3,
          validateInput: true
        }
      )
    })

    it('returns validation error for invalid request', async () => {
      validateMCPExecuteRequest.mockReturnValue({
        isValid: false,
        errors: ['toolName is required', 'parameters must be an object']
      })

      const request = new NextRequest('http://localhost:3000/api/mcp/execute', {
        method: 'POST',
        body: JSON.stringify({
          invalidField: 'value'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('INVALID_PARAMETERS')
      expect(data.error.details).toEqual(['toolName is required', 'parameters must be an object'])
    })

    it('returns error when tool is not available', async () => {
      validateMCPExecuteRequest.mockReturnValue({ isValid: true })
      mockMCPService.isToolAvailable.mockResolvedValue(false)
      mockMCPService.getAvailableTools.mockResolvedValue([
        { name: 'run_example' },
        { name: 'solve_n_queens' }
      ])

      const request = new NextRequest('http://localhost:3000/api/mcp/execute', {
        method: 'POST',
        body: JSON.stringify({
          toolName: 'non_existent_tool',
          parameters: {}
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('MCP_TOOL_NOT_FOUND')
      expect(data.error.message).toBe("Tool 'non_existent_tool' is not available or not auto-approved")
      expect(data.error.details.availableTools).toEqual(['run_example', 'solve_n_queens'])
    })

    it('handles tool execution failure', async () => {
      validateMCPExecuteRequest.mockReturnValue({ isValid: true })
      mockMCPService.isToolAvailable.mockResolvedValue(true)
      mockMCPService.executeTool.mockResolvedValue({
        success: false,
        result: null,
        error: { message: 'Tool execution failed' }
      })

      const request = new NextRequest('http://localhost:3000/api/mcp/execute', {
        method: 'POST',
        body: JSON.stringify({
          toolName: 'failing_tool',
          parameters: {}
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.data.result).toBeNull()
      expect(data.data.error).toBe('Tool execution failed')
      expect(data.error.code).toBe('MCP_TOOL_EXECUTION_ERROR')
    })

    it('handles timeout errors', async () => {
      validateMCPExecuteRequest.mockReturnValue({ isValid: true })
      mockMCPService.isToolAvailable.mockResolvedValue(true)
      mockMCPService.executeTool.mockRejectedValue(new Error('Tool execution timeout'))

      const request = new NextRequest('http://localhost:3000/api/mcp/execute', {
        method: 'POST',
        body: JSON.stringify({
          toolName: 'slow_tool',
          parameters: {}
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(503)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('TIMEOUT_ERROR')
      expect(data.error.message).toBe('Tool execution timeout')
    })

    it('handles connection errors', async () => {
      validateMCPExecuteRequest.mockReturnValue({ isValid: true })
      mockMCPService.isToolAvailable.mockResolvedValue(true)
      mockMCPService.executeTool.mockRejectedValue(new Error('MCP server connection failed'))

      const request = new NextRequest('http://localhost:3000/api/mcp/execute', {
        method: 'POST',
        body: JSON.stringify({
          toolName: 'test_tool',
          parameters: {}
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(503)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('MCP_CONNECTION_ERROR')
      expect(data.error.message).toBe('MCP server connection error')
    })

    it('handles tool not found errors', async () => {
      validateMCPExecuteRequest.mockReturnValue({ isValid: true })
      mockMCPService.isToolAvailable.mockResolvedValue(true)
      mockMCPService.executeTool.mockRejectedValue(new Error('Tool not found on server'))

      const request = new NextRequest('http://localhost:3000/api/mcp/execute', {
        method: 'POST',
        body: JSON.stringify({
          toolName: 'missing_tool',
          parameters: {}
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('MCP_TOOL_NOT_FOUND')
      expect(data.error.message).toBe('MCP tool not found or unavailable')
    })

    it('handles generic errors', async () => {
      validateMCPExecuteRequest.mockReturnValue({ isValid: true })
      mockMCPService.isToolAvailable.mockResolvedValue(true)
      mockMCPService.executeTool.mockRejectedValue(new Error('Unexpected error'))

      const request = new NextRequest('http://localhost:3000/api/mcp/execute', {
        method: 'POST',
        body: JSON.stringify({
          toolName: 'test_tool',
          parameters: {}
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('MCP_TOOL_EXECUTION_ERROR')
      expect(data.error.message).toBe('Unexpected error')
    })
  })

  describe('GET', () => {
    it('returns execution history', async () => {
      const mockHistory = [
        {
          id: '1',
          toolName: 'run_example',
          parameters: { example_type: 'test' },
          result: 'Success',
          timestamp: new Date(),
          executionTime: 1000
        },
        {
          id: '2',
          toolName: 'solve_n_queens',
          parameters: { n: 8 },
          result: 'Solution found',
          timestamp: new Date(),
          executionTime: 2000
        }
      ]

      mockMCPService.getExecutionHistory.mockReturnValue(mockHistory)

      const request = new NextRequest('http://localhost:3000/api/mcp/execute')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.history).toEqual(mockHistory)
      expect(data.meta.historyCount).toBe(2)
      expect(mockMCPService.getExecutionHistory).toHaveBeenCalledWith(10)
    })

    it('returns execution history with custom limit', async () => {
      const mockHistory = [
        {
          id: '1',
          toolName: 'run_example',
          parameters: {},
          result: 'Success',
          timestamp: new Date(),
          executionTime: 1000
        }
      ]

      mockMCPService.getExecutionHistory.mockReturnValue(mockHistory)

      const request = new NextRequest('http://localhost:3000/api/mcp/execute?limit=5')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.history).toEqual(mockHistory)
      expect(mockMCPService.getExecutionHistory).toHaveBeenCalledWith(5)
    })

    it('includes statistics when requested', async () => {
      const mockHistory: MockExecutionHistoryItem[] = []
      const mockStats = {
        totalExecutions: 100,
        successRate: 95.5,
        averageExecutionTime: 1500,
        mostUsedTool: 'run_example',
        errorRate: 4.5
      }

      mockMCPService.getExecutionHistory.mockReturnValue(mockHistory)
      mockMCPService.getExecutionStats.mockReturnValue(mockStats)

      const request = new NextRequest('http://localhost:3000/api/mcp/execute?stats=true')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.history).toEqual(mockHistory)
      expect(data.data.statistics).toEqual(mockStats)
      expect(mockMCPService.getExecutionStats).toHaveBeenCalled()
    })

    it('handles errors when retrieving history', async () => {
      mockMCPService.getExecutionHistory.mockImplementation(() => {
        throw new Error('Database error')
      })

      const request = new NextRequest('http://localhost:3000/api/mcp/execute')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('INTERNAL_SERVER_ERROR')
      expect(data.error.message).toBe('Failed to retrieve execution history')
    })

    it('parses limit parameter correctly', async () => {
      mockMCPService.getExecutionHistory.mockReturnValue([] as MockExecutionHistoryItem[])

      const request = new NextRequest('http://localhost:3000/api/mcp/execute?limit=abc')

      const response = await GET(request)
      await response.json()

      // Should use default limit (10) when parsing fails
      expect(mockMCPService.getExecutionHistory).toHaveBeenCalledWith(10)
    })

    it('handles stats parameter correctly', async () => {
      mockMCPService.getExecutionHistory.mockReturnValue([] as MockExecutionHistoryItem[])
      mockMCPService.getExecutionStats.mockReturnValue({})

      const request = new NextRequest('http://localhost:3000/api/mcp/execute?stats=false')

      const response = await GET(request)
      const data = await response.json()

      expect(data.data.statistics).toBeUndefined()
      expect(mockMCPService.getExecutionStats).not.toHaveBeenCalled()
    })
  })
})