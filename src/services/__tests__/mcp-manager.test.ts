import { MCPServer, MCPRegistry, MCPManager } from '../mcp-manager'
import { MCPServerConfig, Tool } from '@/types'
import { ServerStatus } from '@/types/mcp'

// Mock child_process
jest.mock('child_process', () => ({
  spawn: jest.fn()
}))

// Mock the config loader
jest.mock('../config', () => ({
  getConfigLoader: jest.fn(() => ({
    loadConfig: jest.fn(),
    getAllMCPServerConfigs: jest.fn(() => ({
      gurddy: {
        name: 'gurddy',
        command: 'uvx',
        args: ['gurddy-mcp@latest'],
        env: {},
        disabled: false,
        autoApprove: ['run_example', 'solve_n_queens']
      }
    })),
    getEnabledServers: jest.fn(() => ['gurddy'])
  }))
}))

const { spawn } = require('child_process')

describe('MCPServer', () => {
  let server: MCPServer
  let mockProcess: any

  const mockConfig: MCPServerConfig = {
    name: 'test-server',
    command: 'uvx',
    args: ['test-mcp@latest'],
    env: { TEST_ENV: 'test' },
    disabled: false,
    autoApprove: ['test_tool']
  }

  beforeEach(() => {
    mockProcess = {
      on: jest.fn(),
      kill: jest.fn(),
      killed: false
    }
    spawn.mockReturnValue(mockProcess)
    server = new MCPServer(mockConfig)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('initialize', () => {
    it('initializes server successfully', async () => {
      // Mock successful process start
      setTimeout(() => {
        const onCallback = mockProcess.on.mock.calls.find((call: any) => call[0] === 'error')
        // Don't call error callback to simulate success
      }, 0)

      await server.initialize()

      const status = server.getStatus()
      expect(status.status).toBe('connected')
      expect(status.name).toBe('test-server')
      expect(spawn).toHaveBeenCalledWith('uvx', ['test-mcp@latest'], {
        env: expect.objectContaining({ TEST_ENV: 'test' }),
        stdio: ['pipe', 'pipe', 'pipe']
      })
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
      // Create gurddy server specifically
      const gurddy = new MCPServer({
        name: 'gurddy',
        command: 'uvx',
        args: ['gurddy-mcp@latest'],
        env: {},
        disabled: false,
        autoApprove: ['run_example']
      })

      setTimeout(() => {
        // Don't trigger error to simulate success
      }, 0)
      await gurddy.initialize()

      const tools = await gurddy.listTools()
      
      expect(tools.length).toBeGreaterThan(0)
      expect(tools.some(tool => tool.name === 'run_example')).toBe(true)
      expect(tools.some(tool => tool.name === 'solve_n_queens')).toBe(true)
    })

    it('throws error when server is not connected', async () => {
      const disconnectedServer = new MCPServer(mockConfig)
      
      await expect(disconnectedServer.listTools()).rejects.toThrow('Server test-server is not connected')
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
      const result = await server.callTool('test_tool', { param: 'value' })
      
      expect(result.content).toBeDefined()
      expect(result.content[0].type).toBe('text')
    })

    it('throws error for non-existent tool', async () => {
      await expect(server.callTool('non_existent_tool', {})).rejects.toThrow('Tool non_existent_tool not found')
    })

    it('throws error for non-approved tool', async () => {
      // Add a tool that's not in autoApprove list
      const gurddy = new MCPServer({
        name: 'gurddy',
        command: 'uvx',
        args: ['gurddy-mcp@latest'],
        env: {},
        disabled: false,
        autoApprove: [] // Empty auto-approve list
      })

      setTimeout(() => {
        // Don't trigger error to simulate success
      }, 0)
      await gurddy.initialize()

      await expect(gurddy.callTool('run_example', {})).rejects.toThrow('Tool run_example is not auto-approved')
    })

    it('throws error when server is not connected', async () => {
      const disconnectedServer = new MCPServer(mockConfig)
      
      await expect(disconnectedServer.callTool('test_tool', {})).rejects.toThrow('Server test-server is not connected')
    })
  })

  describe('shutdown', () => {
    it('shuts down server gracefully', async () => {
      setTimeout(() => {
        // Don't trigger error to simulate success
      }, 0)
      await server.initialize()

      await server.shutdown()

      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM')
      
      const status = server.getStatus()
      expect(status.status).toBe('disconnected')
    })

    it('force kills process if graceful shutdown fails', async () => {
      setTimeout(() => {
        // Don't trigger error to simulate success
      }, 0)
      await server.initialize()

      // Mock process that doesn't respond to SIGTERM
      mockProcess.killed = false
      
      const shutdownPromise = server.shutdown()
      
      // Simulate timeout
      setTimeout(() => {
        expect(mockProcess.kill).toHaveBeenCalledWith('SIGKILL')
      }, 100)

      await shutdownPromise
    })
  })

  describe('getStatus', () => {
    it('returns current server status', () => {
      const status = server.getStatus()
      
      expect(status.name).toBe('test-server')
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

  describe('getMetrics', () => {
    it('returns server metrics', () => {
      const metrics = server.getMetrics()
      
      expect(metrics.toolCallCount).toBe(0)
      expect(metrics.toolCallSuccessRate).toBe(0)
      expect(metrics.averageExecutionTime).toBe(0)
      expect(metrics.errorCount).toBe(0)
      expect(metrics.lastActivity).toBeInstanceOf(Date)
    })
  })
})

describe('MCPRegistry', () => {
  let registry: MCPRegistry

  const mockConfig: MCPServerConfig = {
    name: 'test-server',
    command: 'uvx',
    args: ['test-mcp@latest'],
    env: {},
    disabled: false,
    autoApprove: ['test_tool']
  }

  beforeEach(() => {
    registry = new MCPRegistry()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('register', () => {
    it('registers a new server successfully', async () => {
      // Mock successful server initialization
      setTimeout(() => {
        // Don't trigger error to simulate success
      }, 0)

      await registry.register('test-server', mockConfig)
      
      expect(registry.servers.has('test-server')).toBe(true)
      expect(registry.list()).toContain('test-server')
    })

    it('throws error when registering duplicate server', async () => {
      setTimeout(() => {
        // Don't trigger error to simulate success
      }, 0)
      await registry.register('test-server', mockConfig)
      
      await expect(registry.register('test-server', mockConfig)).rejects.toThrow('Server test-server is already registered')
    })
  })

  describe('unregister', () => {
    it('unregisters an existing server', async () => {
      setTimeout(() => {
        // Don't trigger error to simulate success
      }, 0)
      await registry.register('test-server', mockConfig)
      
      await registry.unregister('test-server')
      
      expect(registry.servers.has('test-server')).toBe(false)
      expect(registry.list()).not.toContain('test-server')
    })

    it('handles unregistering non-existent server gracefully', async () => {
      await expect(registry.unregister('non-existent')).resolves.not.toThrow()
    })
  })

  describe('get', () => {
    it('returns registered server', async () => {
      setTimeout(() => {
        // Don't trigger error to simulate success
      }, 0)
      await registry.register('test-server', mockConfig)
      
      const server = registry.get('test-server')
      expect(server).toBeDefined()
      expect(server?.getStatus().name).toBe('test-server')
    })

    it('returns undefined for non-existent server', () => {
      const server = registry.get('non-existent')
      expect(server).toBeUndefined()
    })
  })

  describe('getStatus', () => {
    it('returns status of all servers', async () => {
      setTimeout(() => {
        // Don't trigger error to simulate success
      }, 0)
      await registry.register('test-server', mockConfig)
      
      const status = registry.getStatus()
      expect(status['test-server']).toBeDefined()
      expect(status['test-server'].name).toBe('test-server')
    })
  })

  describe('shutdown', () => {
    it('shuts down all servers', async () => {
      setTimeout(() => {
        // Don't trigger error to simulate success
      }, 0)
      await registry.register('test-server', mockConfig)
      
      await registry.shutdown()
      
      expect(registry.servers.size).toBe(0)
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
    it('initializes with configuration', async () => {
      setTimeout(() => {
        // Don't trigger error to simulate success
      }, 0)

      await manager.initialize()
      
      const status = manager.getServerStatus()
      expect(status['gurddy']).toBeDefined()
    })

    it('does not reinitialize if already initialized', async () => {
      setTimeout(() => {
        // Don't trigger error to simulate success
      }, 0)
      await manager.initialize()
      
      // Second call should not throw or cause issues
      await expect(manager.initialize()).resolves.not.toThrow()
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

  describe('getServerStatus', () => {
    it('returns status of all servers', async () => {
      setTimeout(() => {
        // Don't trigger error to simulate success
      }, 0)
      await manager.initialize()
      
      const status = manager.getServerStatus()
      expect(typeof status).toBe('object')
    })
  })

  describe('shutdown', () => {
    it('shuts down all servers', async () => {
      setTimeout(() => {
        // Don't trigger error to simulate success
      }, 0)
      await manager.initialize()
      
      await manager.shutdown()
      
      // Manager should be able to initialize again after shutdown
      await expect(manager.initialize()).resolves.not.toThrow()
    })
  })
})