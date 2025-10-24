'use client'

// 动态配置管理页面 - 测试和管理基于PostgreSQL的配置系统

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'

interface SystemStatus {
  systemConfig: {
    llmUrl: string
    toolThreshold: number
    mcpServerCount: number
    enabledServers: number
  }
  routingStats: any
  problemStats: any
  timestamp: string
}

interface ConfigItem {
  key: string
  value: any
  type: string
  description?: string
}

export default function DynamicConfigPage() {
  const [status, setStatus] = useState<SystemStatus | null>(null)
  const [configs, setConfigs] = useState<Record<string, any>>({})
  const [mcpServers, setMcpServers] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(false)
  const [testResults, setTestResults] = useState<any>(null)
  const [activeTab, setActiveTab] = useState('status')

  // 加载系统状态
  const loadStatus = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/dynamic-config?action=status')
      const result = await response.json()
      if (result.success) {
        setStatus(result.data)
      }
    } catch (error) {
      console.error('加载状态失败:', error)
    } finally {
      setLoading(false)
    }
  }

  // 加载系统配置
  const loadConfigs = async () => {
    try {
      const response = await fetch('/api/dynamic-config?action=system-config')
      const result = await response.json()
      if (result.success) {
        setConfigs(result.data)
      }
    } catch (error) {
      console.error('加载配置失败:', error)
    }
  }

  // 加载MCP服务器配置
  const loadMcpServers = async () => {
    try {
      const response = await fetch('/api/dynamic-config?action=mcp-servers')
      const result = await response.json()
      if (result.success) {
        setMcpServers(result.data.servers)
      }
    } catch (error) {
      console.error('加载MCP服务器失败:', error)
    }
  }

  // 测试智能路由
  const testIntelligentRouting = async () => {
    const testInput = '解决8皇后问题'
    setLoading(true)
    try {
      const response = await fetch('/api/dynamic-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'test-intelligent-routing',
          data: {
            userInput: testInput,
            context: {
              sessionId: 'test-session',
              conversationHistory: []
            }
          }
        })
      })
      const result = await response.json()
      if (result.success) {
        setTestResults(result.data)
      }
    } catch (error) {
      console.error('测试智能路由失败:', error)
    } finally {
      setLoading(false)
    }
  }

  // 生成样例问题
  const generateSampleProblems = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/dynamic-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate-sample-problems',
          data: {
            options: {
              count: 5,
              personalized: false
            }
          }
        })
      })
      const result = await response.json()
      if (result.success) {
        setTestResults(result.data)
      }
    } catch (error) {
      console.error('生成样例问题失败:', error)
    } finally {
      setLoading(false)
    }
  }

  // 更新配置
  const updateConfig = async (key: string, value: any, type: string) => {
    try {
      const response = await fetch('/api/dynamic-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update-system-config',
          data: { key, value, type }
        })
      })
      const result = await response.json()
      if (result.success) {
        await loadConfigs()
        alert('配置更新成功')
      } else {
        alert('配置更新失败: ' + result.error)
      }
    } catch (error) {
      console.error('更新配置失败:', error)
      alert('配置更新失败')
    }
  }

  useEffect(() => {
    loadStatus()
    loadConfigs()
    loadMcpServers()
  }, [])

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">动态配置管理系统</h1>
      
      {/* 标签页导航 */}
      <div className="flex space-x-4 mb-6 border-b">
        {[
          { id: 'status', label: '系统状态' },
          { id: 'config', label: '系统配置' },
          { id: 'mcp', label: 'MCP服务器' },
          { id: 'test', label: '功能测试' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 font-medium ${
              activeTab === tab.id
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 系统状态 */}
      {activeTab === 'status' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-semibold">系统状态</h2>
            <Button onClick={loadStatus} disabled={loading}>
              {loading ? '刷新中...' : '刷新状态'}
            </Button>
          </div>

          {status && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-lg shadow">
                <h3 className="font-medium text-gray-500">LLM服务</h3>
                <p className="text-2xl font-bold text-green-600">
                  {status.systemConfig.llmUrl ? '已配置' : '未配置'}
                </p>
                <p className="text-sm text-gray-600">{status.systemConfig.llmUrl}</p>
              </div>

              <div className="bg-white p-4 rounded-lg shadow">
                <h3 className="font-medium text-gray-500">工具选择阈值</h3>
                <p className="text-2xl font-bold text-blue-600">
                  {status.systemConfig.toolThreshold}
                </p>
                <p className="text-sm text-gray-600">置信度阈值</p>
              </div>

              <div className="bg-white p-4 rounded-lg shadow">
                <h3 className="font-medium text-gray-500">MCP服务器</h3>
                <p className="text-2xl font-bold text-purple-600">
                  {status.systemConfig.enabledServers}/{status.systemConfig.mcpServerCount}
                </p>
                <p className="text-sm text-gray-600">已启用/总数</p>
              </div>

              <div className="bg-white p-4 rounded-lg shadow">
                <h3 className="font-medium text-gray-500">最后更新</h3>
                <p className="text-lg font-bold text-gray-800">
                  {new Date(status.timestamp).toLocaleTimeString()}
                </p>
                <p className="text-sm text-gray-600">系统时间</p>
              </div>
            </div>
          )}

          {/* 统计信息 */}
          {status?.routingStats && (
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold mb-4">路由统计 (最近7天)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-2">工具性能</h4>
                  {status.routingStats.toolStats?.slice(0, 5).map((tool: any, index: number) => (
                    <div key={index} className="flex justify-between py-1">
                      <span className="text-sm">{tool.tool_name}</span>
                      <span className="text-sm font-medium">
                        {tool.total_executions}次 ({(tool.success_rate * 100).toFixed(1)}%)
                      </span>
                    </div>
                  ))}
                </div>
                <div>
                  <h4 className="font-medium mb-2">用户行为</h4>
                  {status.routingStats.userBehaviorStats?.slice(0, 5).map((behavior: any, index: number) => (
                    <div key={index} className="flex justify-between py-1">
                      <span className="text-sm">{behavior.selected_tool}</span>
                      <span className="text-sm font-medium">
                        满意度: {behavior.avg_satisfaction?.toFixed(1) || 'N/A'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 系统配置 */}
      {activeTab === 'config' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-semibold">系统配置</h2>
            <Button onClick={loadConfigs}>刷新配置</Button>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="space-y-4">
              {Object.entries(configs).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between py-2 border-b">
                  <div>
                    <span className="font-medium">{key}</span>
                    <p className="text-sm text-gray-600">当前值: {JSON.stringify(value)}</p>
                  </div>
                  <Button
                    onClick={() => {
                      const newValue = prompt(`输入新值 (${key}):`, JSON.stringify(value))
                      if (newValue !== null) {
                        try {
                          const parsedValue = JSON.parse(newValue)
                          updateConfig(key, parsedValue, typeof parsedValue)
                        } catch {
                          updateConfig(key, newValue, 'string')
                        }
                      }
                    }}
                    className="text-sm"
                  >
                    编辑
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MCP服务器 */}
      {activeTab === 'mcp' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-semibold">MCP服务器配置</h2>
            <Button onClick={loadMcpServers}>刷新服务器</Button>
          </div>

          <div className="grid gap-4">
            {Object.entries(mcpServers).map(([serverName, config]: [string, any]) => (
              <div key={serverName} className="bg-white p-6 rounded-lg shadow">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-lg font-semibold">{serverName}</h3>
                  <span className={`px-2 py-1 rounded text-sm ${
                    config.disabled ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                  }`}>
                    {config.disabled ? '已禁用' : '已启用'}
                  </span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">传输方式:</span> {config.transport}
                  </div>
                  <div>
                    <span className="font-medium">超时时间:</span> {config.timeout}ms
                  </div>
                  {config.command && (
                    <div className="md:col-span-2">
                      <span className="font-medium">命令:</span> {config.command}
                    </div>
                  )}
                  {config.url && (
                    <div className="md:col-span-2">
                      <span className="font-medium">URL:</span> {config.url}
                    </div>
                  )}
                  {config.autoApprove?.length > 0 && (
                    <div className="md:col-span-2">
                      <span className="font-medium">自动批准工具:</span> {config.autoApprove.join(', ')}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 功能测试 */}
      {activeTab === 'test' && (
        <div className="space-y-6">
          <h2 className="text-2xl font-semibold">功能测试</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold mb-4">智能路由测试</h3>
              <p className="text-gray-600 mb-4">测试智能工具选择和参数映射功能</p>
              <Button onClick={testIntelligentRouting} disabled={loading} className="w-full">
                {loading ? '测试中...' : '测试智能路由'}
              </Button>
            </div>

            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold mb-4">样例问题生成</h3>
              <p className="text-gray-600 mb-4">测试动态样例问题生成功能</p>
              <Button onClick={generateSampleProblems} disabled={loading} className="w-full">
                {loading ? '生成中...' : '生成样例问题'}
              </Button>
            </div>
          </div>

          {/* 测试结果 */}
          {testResults && (
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold mb-4">测试结果</h3>
              <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto max-h-96">
                {JSON.stringify(testResults, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}