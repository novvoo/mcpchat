'use client'

import { useState, useEffect } from 'react'
import { AdminNavigation } from '@/components/AdminNavigation'
import {
  Settings,
  Brain,
  Plug,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Plus,
  Edit3,
  Trash2,
  Eye,
  EyeOff,
  Server,
  Zap,
  Shield,
  Activity
} from 'lucide-react'

interface LLMConfig {
  id?: number
  name: string
  provider: string
  model: string
  api_key: string
  base_url?: string
  temperature?: number
  max_tokens?: number
  timeout?: number
  is_active: boolean
}

interface MCPConfig {
  id?: number
  name: string
  command: string
  args: string[]
  env?: Record<string, string>
  disabled: boolean
  auto_approve: string[]
}

export default function SystemSettingsPage() {
  const [llmConfigs, setLlmConfigs] = useState<LLMConfig[]>([])
  const [mcpConfigs, setMcpConfigs] = useState<MCPConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  // 编辑状态
  const [editingLLM, setEditingLLM] = useState<LLMConfig | null>(null)
  const [editingMCP, setEditingMCP] = useState<MCPConfig | null>(null)

  useEffect(() => {
    loadConfigs()
  }, [])

  const loadConfigs = async () => {
    setLoading(true)
    try {
      // 加载LLM配置
      const llmResponse = await fetch('/api/admin/llm-config')
      if (llmResponse.ok) {
        const llmData = await llmResponse.json()
        setLlmConfigs(llmData.configs || [])
      }

      // 加载MCP配置
      const mcpResponse = await fetch('/api/admin/mcp-config')
      if (mcpResponse.ok) {
        const mcpData = await mcpResponse.json()
        setMcpConfigs(mcpData.configs || [])
      }
    } catch (error) {
      console.error('Failed to load configs:', error)
      setMessage({ type: 'error', text: '加载配置失败' })
    } finally {
      setLoading(false)
    }
  }

  const saveLLMConfig = async (config: LLMConfig) => {
    setSaving(true)
    try {
      const response = await fetch('/api/admin/llm-config', {
        method: config.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      })

      if (response.ok) {
        setMessage({ type: 'success', text: 'LLM配置保存成功' })
        setEditingLLM(null)
        loadConfigs()
      } else {
        throw new Error('保存失败')
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'LLM配置保存失败' })
    } finally {
      setSaving(false)
    }
  }

  const saveMCPConfig = async (config: MCPConfig) => {
    setSaving(true)
    try {
      const response = await fetch('/api/admin/mcp-config', {
        method: config.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      })

      if (response.ok) {
        setMessage({ type: 'success', text: 'MCP配置保存成功' })
        setEditingMCP(null)
        loadConfigs()
      } else {
        throw new Error('保存失败')
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'MCP配置保存失败' })
    } finally {
      setSaving(false)
    }
  }

  const deleteConfig = async (type: 'llm' | 'mcp', id: number) => {
    if (!confirm('确定要删除这个配置吗？')) return

    try {
      const response = await fetch(`/api/admin/${type}-config/${id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        setMessage({ type: 'success', text: '配置删除成功' })
        loadConfigs()
      } else {
        throw new Error('删除失败')
      }
    } catch (error) {
      setMessage({ type: 'error', text: '配置删除失败' })
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
        <div className="container mx-auto p-4 lg:p-6">
          <AdminNavigation title="系统设置" />
          <div className="flex flex-col items-center justify-center h-64">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
              <div className="absolute inset-0 w-16 h-16 border-4 border-transparent border-r-purple-400 rounded-full animate-spin" style={{ animationDirection: 'reverse' }}></div>
            </div>
            <div className="mt-6 text-center">
              <p className="text-lg font-medium text-gray-800">加载配置中</p>
              <p className="text-sm text-gray-600 mt-1">正在获取系统配置信息...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <div className="container mx-auto p-4 lg:p-6 max-w-7xl">
        <AdminNavigation title="系统设置" />

        {/* Header */}
        <div className="mb-8">
          <div className="bg-white/90 backdrop-blur-xl rounded-2xl p-6 lg:p-8 border border-white/30 shadow-xl shadow-blue-500/10">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-6">
              <div className="flex items-center mb-4 lg:mb-0">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl blur opacity-20"></div>
                  <div className="relative bg-gradient-to-r from-blue-600 to-purple-600 p-3 rounded-xl">
                    <Settings className="h-8 w-8 text-white" />
                  </div>
                </div>
                <div className="ml-4">
                  <h1 className="text-2xl lg:text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                    系统设置
                  </h1>
                  <p className="text-gray-600 mt-1 text-sm lg:text-base font-medium">
                    在线配置LLM和MCP服务，实时管理系统连接
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
                  <Activity className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium text-green-700">
                    {llmConfigs.filter(c => c.is_active).length} LLM活跃
                  </span>
                </div>
                <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
                  <Server className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-700">
                    {mcpConfigs.filter(c => !c.disabled).length} MCP启用
                  </span>
                </div>
              </div>
            </div>

            {message && (
              <div className={`p-4 rounded-xl border backdrop-blur-sm transition-all duration-300 ${message.type === 'success'
                  ? 'bg-green-50/80 border-green-200 text-green-800 shadow-green-500/10'
                  : 'bg-red-50/80 border-red-200 text-red-800 shadow-red-500/10'
                } shadow-lg`}>
                <div className="flex items-center">
                  {message.type === 'success' ? (
                    <CheckCircle className="h-5 w-5 mr-3 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="h-5 w-5 mr-3 flex-shrink-0" />
                  )}
                  <span className="font-medium">{message.text}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* LLM Configuration Section */}
        <div className="bg-white/90 backdrop-blur-xl border border-white/30 rounded-2xl shadow-xl shadow-blue-500/10 overflow-hidden mb-8">
          <div className="bg-gradient-to-r from-blue-500 via-blue-600 to-purple-600 p-6 lg:p-8 text-white relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-purple-600/20 backdrop-blur-sm"></div>
            <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center mb-4 lg:mb-0">
                <div className="relative">
                  <div className="absolute inset-0 bg-white/20 rounded-xl blur"></div>
                  <div className="relative bg-white/10 p-3 rounded-xl border border-white/20">
                    <Brain className="h-6 w-6 text-white" />
                  </div>
                </div>
                <div className="ml-4">
                  <h2 className="text-xl lg:text-2xl font-bold">LLM 配置管理</h2>
                  <p className="text-white/90 text-sm lg:text-base mt-1">管理大语言模型的连接配置</p>
                </div>
              </div>
              <button
                onClick={() => setEditingLLM({
                  name: '',
                  provider: 'openai',
                  model: 'gpt-3.5-turbo',
                  api_key: '',
                  base_url: '',
                  temperature: 0.7,
                  max_tokens: 2000,
                  timeout: 30000,
                  is_active: false
                })}
                className="flex items-center gap-2 px-4 py-2.5 bg-white/20 text-white rounded-xl hover:bg-white/30 transition-all duration-200 backdrop-blur-sm border border-white/20 hover:scale-105"
              >
                <Plus className="h-4 w-4" />
                <span className="font-medium">添加新配置</span>
              </button>
            </div>
          </div>

          <div className="p-6 lg:p-8">
            {llmConfigs.length === 0 ? (
              <div className="text-center py-12">
                <div className="relative inline-block">
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-purple-400 rounded-full blur opacity-20"></div>
                  <div className="relative bg-gradient-to-r from-blue-100 to-purple-100 p-6 rounded-full">
                    <Brain className="h-12 w-12 text-blue-500" />
                  </div>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mt-4">暂无LLM配置</h3>
                <p className="text-gray-700 mt-2">点击上方按钮添加您的第一个LLM配置</p>
              </div>
            ) : (
              <div className="grid gap-4 lg:gap-6">
                {llmConfigs.map((config) => (
                  <div key={config.id} className="group bg-white border border-gray-300 rounded-xl p-4 lg:p-6 hover:shadow-lg hover:shadow-blue-500/10 transition-all duration-300 hover:border-blue-400 shadow-sm">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex-1 mb-4 lg:mb-0">
                        <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-2">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg flex items-center justify-center">
                              <Brain className="h-5 w-5 text-white" />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900">{config.name}</h3>
                          </div>
                          <div className="flex items-center gap-2">
                            {config.is_active && (
                              <span className="flex items-center gap-1.5 px-3 py-1.5 bg-green-100 text-green-800 text-xs font-semibold rounded-full border border-green-200">
                                <Zap className="h-3 w-3" />
                                活跃
                              </span>
                            )}
                            <span className="px-3 py-1.5 bg-blue-100 text-blue-800 text-xs font-medium rounded-full border border-blue-200">
                              {config.provider}
                            </span>
                          </div>
                        </div>
                        <div className="text-sm text-gray-700 flex flex-wrap items-center gap-4">
                          <span className="flex items-center gap-1 font-medium text-gray-800">
                            <Server className="h-4 w-4 text-blue-600" />
                            {config.model}
                          </span>
                          {config.base_url && (
                            <span className="flex items-center gap-1 text-gray-700">
                              <Shield className="h-4 w-4 text-green-600" />
                              自定义端点
                            </span>
                          )}
                          <span className="text-xs text-gray-600 bg-blue-50 px-2 py-1 rounded border border-blue-200">
                            温度: {config.temperature} | 令牌: {config.max_tokens}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setEditingLLM(config)}
                          className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors border border-blue-200 hover:border-blue-300"
                        >
                          <Edit3 className="h-4 w-4" />
                          编辑
                        </button>
                        <button
                          onClick={() => config.id && deleteConfig('llm', config.id)}
                          className="flex items-center gap-2 px-4 py-2 text-sm bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors border border-red-200 hover:border-red-300"
                        >
                          <Trash2 className="h-4 w-4" />
                          删除
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* MCP Configuration Section */}
        <div className="bg-white/90 backdrop-blur-xl border border-white/30 rounded-2xl shadow-xl shadow-green-500/10 overflow-hidden mb-8">
          <div className="bg-gradient-to-r from-green-500 via-emerald-600 to-teal-600 p-6 lg:p-8 text-white relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-green-600/20 to-teal-600/20 backdrop-blur-sm"></div>
            <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center mb-4 lg:mb-0">
                <div className="relative">
                  <div className="absolute inset-0 bg-white/20 rounded-xl blur"></div>
                  <div className="relative bg-white/10 p-3 rounded-xl border border-white/20">
                    <Plug className="h-6 w-6 text-white" />
                  </div>
                </div>
                <div className="ml-4">
                  <h2 className="text-xl lg:text-2xl font-bold">MCP 配置管理</h2>
                  <p className="text-white/90 text-sm lg:text-base mt-1">管理Model Context Protocol服务器配置</p>
                </div>
              </div>
              <button
                onClick={() => setEditingMCP({
                  name: '',
                  command: 'uvx',
                  args: [],
                  env: {},
                  disabled: false,
                  auto_approve: []
                })}
                className="flex items-center gap-2 px-4 py-2.5 bg-white/20 text-white rounded-xl hover:bg-white/30 transition-all duration-200 backdrop-blur-sm border border-white/20 hover:scale-105"
              >
                <Plus className="h-4 w-4" />
                <span className="font-medium">添加新配置</span>
              </button>
            </div>
          </div>

          <div className="p-6 lg:p-8">
            {mcpConfigs.length === 0 ? (
              <div className="text-center py-12">
                <div className="relative inline-block">
                  <div className="absolute inset-0 bg-gradient-to-r from-green-400 to-teal-400 rounded-full blur opacity-20"></div>
                  <div className="relative bg-gradient-to-r from-green-100 to-teal-100 p-6 rounded-full">
                    <Plug className="h-12 w-12 text-green-500" />
                  </div>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mt-4">暂无MCP配置</h3>
                <p className="text-gray-700 mt-2">点击上方按钮添加您的第一个MCP服务器配置</p>
              </div>
            ) : (
              <div className="grid gap-4 lg:gap-6">
                {mcpConfigs.map((config) => (
                  <div key={config.id} className="group bg-white border border-gray-300 rounded-xl p-4 lg:p-6 hover:shadow-lg hover:shadow-green-500/10 transition-all duration-300 hover:border-green-400 shadow-sm">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex-1 mb-4 lg:mb-0">
                        <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-2">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-teal-500 rounded-lg flex items-center justify-center">
                              <Plug className="h-5 w-5 text-white" />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900">{config.name}</h3>
                          </div>
                          <div className="flex items-center gap-2">
                            {!config.disabled ? (
                              <span className="flex items-center gap-1.5 px-3 py-1.5 bg-green-100 text-green-800 text-xs font-semibold rounded-full border border-green-200">
                                <Eye className="h-3 w-3" />
                                启用
                              </span>
                            ) : (
                              <span className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-600 text-xs font-semibold rounded-full border border-gray-200">
                                <EyeOff className="h-3 w-3" />
                                禁用
                              </span>
                            )}
                            {config.auto_approve.length > 0 && (
                              <span className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 text-blue-800 text-xs font-medium rounded-full border border-blue-200">
                                <Shield className="h-3 w-3" />
                                自动批准
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-sm text-gray-700 flex flex-wrap items-center gap-4">
                          <span className="flex items-center gap-1 font-mono bg-slate-100 px-2 py-1 rounded text-slate-800 font-medium border border-slate-200">
                            <Server className="h-4 w-4 text-green-600" />
                            {config.command} {config.args.join(' ')}
                          </span>
                          {Object.keys(config.env || {}).length > 0 && (
                            <span className="text-xs text-gray-600 bg-green-50 px-2 py-1 rounded border border-green-200">
                              环境变量: {Object.keys(config.env || {}).length}个
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setEditingMCP(config)}
                          className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors border border-blue-200 hover:border-blue-300"
                        >
                          <Edit3 className="h-4 w-4" />
                          编辑
                        </button>
                        <button
                          onClick={() => config.id && deleteConfig('mcp', config.id)}
                          className="flex items-center gap-2 px-4 py-2 text-sm bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors border border-red-200 hover:border-red-300"
                        >
                          <Trash2 className="h-4 w-4" />
                          删除
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* LLM Edit Modal */}
        {editingLLM && (
          <LLMConfigModal
            config={editingLLM}
            onSave={saveLLMConfig}
            onCancel={() => setEditingLLM(null)}
            saving={saving}
          />
        )}

        {/* MCP Edit Modal */}
        {editingMCP && (
          <MCPConfigModal
            config={editingMCP}
            onSave={saveMCPConfig}
            onCancel={() => setEditingMCP(null)}
            saving={saving}
          />
        )}
      </div>
    </div>
  )
}

// LLM配置编辑模态框
function LLMConfigModal({
  config,
  onSave,
  onCancel,
  saving
}: {
  config: LLMConfig
  onSave: (config: LLMConfig) => void
  onCancel: () => void
  saving: boolean
}) {
  const [formData, setFormData] = useState(config)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(formData)
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 lg:p-8 w-full max-w-3xl max-h-[90vh] overflow-y-auto border border-gray-200 shadow-2xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl flex items-center justify-center">
            <Brain className="h-5 w-5 text-white" />
          </div>
          <h3 className="text-xl lg:text-2xl font-bold text-gray-900">
            {config.id ? '编辑LLM配置' : '添加LLM配置'}
          </h3>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-900">
                配置名称 *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white transition-all duration-200"
                placeholder="例: GPT-4 生产环境"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-900">
                提供商 *
              </label>
              <select
                value={formData.provider}
                onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white transition-all duration-200"
                required
              >
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
                <option value="azure">Azure OpenAI</option>
                <option value="ollama">Ollama</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-900">
              模型 *
            </label>
            <input
              type="text"
              value={formData.model}
              onChange={(e) => setFormData({ ...formData, model: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white transition-all duration-200"
              placeholder="例: gpt-4-turbo-preview"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-900">
              API密钥 *
            </label>
            <input
              type="password"
              value={formData.api_key}
              onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white transition-all duration-200"
              placeholder="sk-..."
              required
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-900">
              基础URL（可选）
            </label>
            <input
              type="url"
              value={formData.base_url || ''}
              onChange={(e) => setFormData({ ...formData, base_url: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white transition-all duration-200"
              placeholder="https://api.openai.com/v1"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-900">
                温度
              </label>
              <input
                type="number"
                min="0"
                max="2"
                step="0.1"
                value={formData.temperature || 0.7}
                onChange={(e) => setFormData({ ...formData, temperature: parseFloat(e.target.value) })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white transition-all duration-200"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-900">
                最大令牌数
              </label>
              <input
                type="number"
                min="1"
                value={formData.max_tokens || 2000}
                onChange={(e) => setFormData({ ...formData, max_tokens: parseInt(e.target.value) })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white transition-all duration-200"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-900">
                超时(ms)
              </label>
              <input
                type="number"
                min="1000"
                value={formData.timeout || 30000}
                onChange={(e) => setFormData({ ...formData, timeout: parseInt(e.target.value) })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white transition-all duration-200"
              />
            </div>
          </div>

          <div className="flex items-center p-4 bg-blue-50 rounded-xl border border-blue-200">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="is_active" className="ml-3 flex items-center gap-2 text-sm font-medium text-gray-900">
              <Zap className="h-4 w-4 text-blue-600" />
              设为活跃配置
            </label>
          </div>

          <div className="flex flex-col lg:flex-row justify-end gap-3 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onCancel}
              className="px-6 py-3 text-gray-900 bg-gray-200 rounded-xl hover:bg-gray-300 transition-all duration-200 font-medium"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 transition-all duration-200 flex items-center gap-2 font-medium shadow-lg shadow-blue-500/25"
            >
              {saving && <RefreshCw className="h-4 w-4 animate-spin" />}
              {saving ? '保存中...' : '保存配置'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// MCP配置编辑模态框
function MCPConfigModal({
  config,
  onSave,
  onCancel,
  saving
}: {
  config: MCPConfig
  onSave: (config: MCPConfig) => void
  onCancel: () => void
  saving: boolean
}) {
  const [formData, setFormData] = useState({
    ...config,
    argsText: config.args.join(' '),
    envText: JSON.stringify(config.env || {}, null, 2),
    autoApproveText: config.auto_approve.join(', ')
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const processedConfig: MCPConfig = {
        ...formData,
        args: formData.argsText.split(' ').filter(arg => arg.trim()),
        env: formData.envText ? JSON.parse(formData.envText) : {},
        auto_approve: formData.autoApproveText.split(',').map(s => s.trim()).filter(s => s)
      }

      onSave(processedConfig)
    } catch (error) {
      alert('配置格式错误，请检查JSON格式')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 lg:p-8 w-full max-w-3xl max-h-[90vh] overflow-y-auto border border-gray-200 shadow-2xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-teal-500 rounded-xl flex items-center justify-center">
            <Plug className="h-5 w-5 text-white" />
          </div>
          <h3 className="text-xl lg:text-2xl font-bold text-gray-900">
            {config.id ? '编辑MCP配置' : '添加MCP配置'}
          </h3>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-900">
              配置名称 *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white transition-all duration-200"
              placeholder="例: 文件系统工具"
              required
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-900">
                命令 *
              </label>
              <input
                type="text"
                value={formData.command}
                onChange={(e) => setFormData({ ...formData, command: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white transition-all duration-200"
                placeholder="uvx"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-900">
                参数（空格分隔）
              </label>
              <input
                type="text"
                value={formData.argsText}
                onChange={(e) => setFormData({ ...formData, argsText: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white transition-all duration-200"
                placeholder="package@latest --option"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-900">
              环境变量（JSON格式）
            </label>
            <textarea
              value={formData.envText}
              onChange={(e) => setFormData({ ...formData, envText: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white transition-all duration-200 font-mono text-sm"
              rows={4}
              placeholder='{"FASTMCP_LOG_LEVEL": "ERROR", "API_KEY": "your-key"}'
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-900">
              自动批准工具（逗号分隔）
            </label>
            <input
              type="text"
              value={formData.autoApproveText}
              onChange={(e) => setFormData({ ...formData, autoApproveText: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white transition-all duration-200"
              placeholder="read_file, list_directory, search_files"
            />
            <p className="text-xs text-gray-700 mt-1 font-medium">
              列出无需用户确认即可自动执行的工具名称
            </p>
          </div>

          <div className="flex items-center p-4 bg-red-50 rounded-xl border border-red-200">
            <input
              type="checkbox"
              id="disabled"
              checked={formData.disabled}
              onChange={(e) => setFormData({ ...formData, disabled: e.target.checked })}
              className="h-5 w-5 text-red-600 focus:ring-red-500 border-gray-300 rounded"
            />
            <label htmlFor="disabled" className="ml-3 flex items-center gap-2 text-sm font-medium text-gray-900">
              <EyeOff className="h-4 w-4 text-red-600" />
              禁用此配置
            </label>
          </div>

          <div className="flex flex-col lg:flex-row justify-end gap-3 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onCancel}
              className="px-6 py-3 text-gray-900 bg-gray-200 rounded-xl hover:bg-gray-300 transition-all duration-200 font-medium"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-3 bg-gradient-to-r from-green-600 to-teal-600 text-white rounded-xl hover:from-green-700 hover:to-teal-700 disabled:opacity-50 transition-all duration-200 flex items-center gap-2 font-medium shadow-lg shadow-green-500/25"
            >
              {saving && <RefreshCw className="h-4 w-4 animate-spin" />}
              {saving ? '保存中...' : '保存配置'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}