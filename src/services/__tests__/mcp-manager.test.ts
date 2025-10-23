import { MCPServer, MCPRegistry, MCPManager } from '../mcp-manager'
import { MCPServerConfig } from '@/types'

// Mock child_process
const mockSpawn = jest.fn()
jest.mock('child_process', () => ({
  spawn: mockSpawn
}))

// Mock fs to provide test configuration from actual mcp.json
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  readFileSync: jest.fn((path: string) => {
    if (path.includes('mcp.json')) {
      // Return the actual config/mcp.json content for tests
      return JSON.stringify({
        "mcpServers": {
          "gurddy-http": {
            "name": "gurddy-http",
            "transport": "http",
            "url": "https://gurddy-mcp.fly.dev/mcp/http",
            "env": {
              "Content-Type": "application/json",
              "Accept": "text/event-stream"
            },
            "disabled": false,
            "timeout": 30000,
            "retryAttempts": 3,
            "retryDelay": 1000,
            "autoApprove": [
              "run_example",
              "info",
              "solve_n_queens",
              "solve_sudoku"
            ]
          }
        }
      })
    }
    return jest.requireActual('fs').readFileSync(path)
  }),
  existsSync: jest.fn((path: string) => {
    if (path.includes('mcp.json')) {
      return true
    }
    return jest.requireActual('fs').existsSync(path)
  })
}))

describe('MCPServer', () => {
  let server: MCPServer
  let mockProcess: any

  const mockConfig: MCPServerConfig = {
    name: 'gurddy-http',
    transport: 'http',
    url: 'https://gurddy-mcp.fly.dev/mcp/http',
    env: {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream'
    },
    disabled: false,
    timeout: 30000,
    retryAttempts: 3,
    retryDelay: 1000,
    autoApprove: ['run_example', 'info', 'solve_n_queens', 'solve_sudoku']
  }

  beforeEach(() => {
    mockProcess = {
      on: jest.fn(),
      kill: jest.fn(),
      killed: false
    }
    mockSpawn.mockReturnValue(mockProcess)
    server = new MCPServer(mockConfig)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('initialize', () => {
    it('initializes server successfully', async () => {
      // Mock successful process start
      setTimeout(() => {
        // Don't call error callback to simulate success
      }, 0)

      await server.initialize()

      const status = server.getStatus()
      expect(status.status).toBe('connected')
      expect(status.name).toBe('gurddy-http')
    })

    it('handles process start errors', async () => {
      // Mock process error
      setTimeout(() => {
        const errorCallback = mockProcess.on.mock.calls.find((call: any) => call[0] === 'error')[1]
        errorCallback(new Error('Process failed to start'))
      }, 0)

      await expect(server.initialize()).rejects.toThrow('Process failed to start')
      
      const status = server.getStatus()
      expect(status.status).toBe('error')
    })
  })

  describe('listTools', () => {
    beforeEach(async () => {
      // Initialize server first
      setTimeout(() => {
        // Don't trigger error to simulate success
      }, 0)
      await server.initialize()
    })

    it('returns available tools for gurddy server', async () => {
      const tools = await server.listTools()
      
      expect(tools.length).toBeGreaterThan(0)
      expect(tools.some(tool => tool.name === 'run_example')).toBe(true)
      expect(tools.some(tool => tool.name === 'solve_n_queens')).toBe(true)
    })

    it('throws error when server is not connected', async () => {
      const disconnectedServer = new MCPServer(mockConfig)
      
      await expect(disconnectedServer.listTools()).rejects.toThrow('Server gurddy-http is not connected')
    })
  })

  describe('callTool', () => {
    beforeEach(async () => {
      setTimeout(() => {
        // Don't trigger error to simulate success
      }, 0)
      await server.initialize()
    })

    it('executes tool successfully', async () => {
      const result = await server.callTool('run_example', { example_type: 'test' })
      
      expect(result.content).toBeDefined()
      expect(result.content[0].type).toBe('text')
    })

    it('throws error for non-existent tool', async () => {
      await expect(server.callTool('non_existent_tool', {})).rejects.toThrow('Tool non_existent_tool not found')
    })

    it('throws error when server is not connected', async () => {
      const disconnectedServer = new MCPServer(mockConfig)
      
      await expect(disconnectedServer.callTool('run_example', {})).rejects.toThrow('Server gurddy-http is not connected')
    })
  })

  describe('getStatus', () => {
    it('returns current server status', () => {
      const status = server.getStatus()
      
      expect(status.name).toBe('gurddy-http')
      expect(status.status).toBe('disconnected')
      expect(status.lastPing).toBeUndefined()
      expect(status.error).toBeUndefined()
    })
  })

  describe('isConnected', () => {
    it('returns false when disconnected', () => {
      expect(server.isConnected()).toBe(false)
    })

    it('returns true when connected', async () => {
      setTimeout(() => {
        // Don't trigger error to simulate success
      }, 0)
      await server.initialize()
      
      expect(server.isConnected()).toBe(true)
    })
  })
})

describe('MCPManager', () => {
  let manager: MCPManager

  beforeEach(() => {
    manager = MCPManager.getInstance()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('initialize', () => {
    it('initializes with configuration from config/mcp.json', async () => {
      setTimeout(() => {
        // Don't trigger error to simulate success
      }, 0)

      await manager.initialize()
      
      const status = manager.getServerStatus()
      expect(status['gurddy-http']).toBeDefined()
    })
  })

  describe('listTools', () => {
    it('returns tools from all connected servers', async () => {
      setTimeout(() => {
        // Don't trigger error to simulate success
      }, 0)
      await manager.initialize()
      
      const tools = await manager.listTools()
      expect(Array.isArray(tools)).toBe(true)
    })
  })

  describe('executeTool', () => {
    it('executes tool on appropriate server', async () => {
      setTimeout(() => {
        // Don't trigger error to simulate success
      }, 0)
      await manager.initialize()
      
      const result = await manager.executeTool('run_example', { example_type: 'test' })
      expect(result).toBeDefined()
      expect(result.content).toBeDefined()
    })

    it('throws error for non-existent tool', async () => {
      setTimeout(() => {
        // Don't trigger error to simulate success
      }, 0)
      await manager.initialize()
      
      await expect(manager.executeTool('non_existent_tool', {})).rejects.toThrow('Tool non_existent_tool not found')
    })
  })
})