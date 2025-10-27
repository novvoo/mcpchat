'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import {
  Brain,
  Settings,
  Database,
  TestTube,
  Activity,
  Sparkles,
  ArrowRight,
  RefreshCw
} from 'lucide-react'
import { useMCPStatus } from '@/hooks/useMCPStatus'

interface ServiceStatus {
  name: string
  status: 'healthy' | 'warning' | 'error' | 'unknown'
  details?: string
}

export default function AdminPage() {
  const [services, setServices] = useState<ServiceStatus[]>([])
  const [loading, setLoading] = useState(true)

  // MCP系统状态管理
  const { 
    status: mcpStatus, 
    isLoading: mcpLoading, 
    error: mcpError,
    reinitialize: reinitializeMCP,
    checkStatus: checkMCPStatus
  } = useMCPStatus()

  useEffect(() => {
    checkServicesHealth()
  }, [])

  const checkServicesHealth = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/health')
      const data = await response.json()

      const serviceStatuses: ServiceStatus[] = [
        {
          name: '数据库服务',
          status: data.checks?.database ? 'healthy' : 'error',
          details: data.checks?.database ?
            `连接正常${data.checks.details?.database?.vector_search ? ' (pgvector 已启用)' : ''}` :
            '连接失败'
        },
        {
          name: 'LLM 配置',
          status: data.checks?.llm_config ? 'healthy' : 'warning',
          details: data.checks?.llm_config ?
            `${data.checks.details?.llm_config?.name || 'default'} (${data.checks.details?.llm_config?.provider})` :
            '配置不可用'
        },
        {
          name: 'LLM 服务',
          status: data.checks?.llm_service ? 'healthy' : 'error',
          details: data.checks?.llm_service ?
            `服务已初始化 (${data.checks.details?.llm_service?.timeout}ms 超时)` :
            '服务不可用'
        }
      ]

      setServices(serviceStatuses)
    } catch (error) {
      console.error('Health check failed:', error)
      setServices([
        { name: '健康检查', status: 'error', details: '无法获取服务状态' }
      ])
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-600 bg-green-100'
      case 'warning': return 'text-yellow-600 bg-yellow-100'
      case 'error': return 'text-red-600 bg-red-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return '✅'
      case 'warning': return '⚠️'
      case 'error': return '❌'
      default: return '❓'
    }
  }

  const adminSections = [
    {
      title: '文本处理与解析',
      description: '测试和管理文本处理、结构化解析功能',
      icon: <Brain className="h-6 w-6" />,
      color: 'from-blue-500 to-purple-600',
      items: [

        {
          name: 'LangChain 增强解析',
          description: '测试集成 LangChain 的高级文本处理功能',
          href: '/admin/enhanced-parsing',
          icon: <Sparkles className="h-4 w-4" />,
          badge: 'NEW'
        },
        {
          name: '置信度测试',
          description: '测试解析结果的置信度评分机制',
          href: '/admin/confidence-test',
          icon: <Activity className="h-4 w-4" />
        },
        {
          name: '游戏结果解析',
          description: '测试24点游戏等游戏结果的解析和显示',
          href: '/admin/game-result-test',
          icon: <TestTube className="h-4 w-4" />,
          badge: 'NEW'
        },
        {
          name: '问题模板管理',
          description: '管理和测试样例问题模板，自动生成工具使用示例',
          href: '/admin/problem-templates',
          icon: <Sparkles className="h-4 w-4" />,
          badge: 'NEW'
        },
        {
          name: '混合内容渲染测试',
          description: '测试包含文本和JSON结果的混合内容渲染效果',
          href: '/admin/test-mixed-content',
          icon: <TestTube className="h-4 w-4" />,
          badge: 'NEW'
        }
      ]
    },
    {
      title: '系统配置与管理',
      description: '管理系统配置、数据库和服务状态',
      icon: <Settings className="h-6 w-6" />,
      color: 'from-green-500 to-teal-600',
      items: [
        {
          name: '格式化测试',
          description: '测试文本格式化和显示功能',
          href: '/admin/test-formatting',
          icon: <TestTube className="h-4 w-4" />
        },
        {
          name: '数据库管理',
          description: '查看和管理数据库连接、表结构',
          href: '/admin/database',
          icon: <Database className="h-4 w-4" />
        }
      ]
    }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="container mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4 bg-white/90 backdrop-blur-sm rounded-xl p-6 border border-gray-200 shadow-lg">
            <div>
              <h1 className="text-3xl font-bold" style={{ color: '#111827' }}>管理面板</h1>
              <p className="mt-2" style={{ color: '#4b5563' }}>系统管理、测试和监控中心</p>
            </div>
            <Link
              href="/"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              返回主页
            </Link>
          </div>

          {/* Service Status */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold" style={{ color: '#111827' }}>服务状态</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={checkServicesHealth}
                  disabled={loading}
                  className="px-3 py-1 text-sm border border-gray-200 rounded-md transition-all disabled:opacity-50"
                  style={{ 
                    backgroundColor: '#f3f4f6',
                    color: '#111827'
                  }}
                  onMouseEnter={(e) => {
                    if (!loading) {
                      e.currentTarget.style.backgroundColor = '#e5e7eb'
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#f3f4f6'
                  }}
                >
                  {loading ? '检查中...' : '刷新状态'}
                </button>
                <button
                  onClick={checkMCPStatus}
                  disabled={mcpLoading}
                  className="px-3 py-1 text-sm border border-blue-200 rounded-md transition-all disabled:opacity-50 bg-blue-50 text-blue-700 hover:bg-blue-100"
                  title="刷新MCP状态（从数据库获取）"
                >
                  {mcpLoading ? '检查MCP...' : '刷新MCP'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {services.map((service, index) => (
                <div key={index} className="flex items-center p-3 bg-white border border-gray-200 rounded-lg shadow-sm">
                  <span className="text-lg mr-3">{getStatusIcon(service.status)}</span>
                  <div className="flex-1">
                    <div className="font-medium" style={{ color: '#111827' }}>{service.name}</div>
                    <div className="text-sm" style={{ color: '#4b5563' }}>{service.details}</div>
                  </div>
                  <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(service.status)}`}>
                    {service.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* MCP System Management */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden mb-8">
          <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-6 text-white">
            <div className="flex items-center mb-2">
              <RefreshCw className="h-6 w-6 text-white" />
              <h2 className="text-xl font-semibold ml-3 text-white">MCP 系统管理</h2>
            </div>
            <p className="text-white/90">管理和监控 Model Context Protocol 系统状态</p>
          </div>

          <div className="p-6">
            {/* MCP Status Details */}
            <div className="mb-6">
              <h3 className="text-lg font-medium mb-4" style={{ color: '#111827' }}>系统状态详情</h3>
              
              {mcpStatus && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                  <div className="p-4 bg-gray-50 rounded-lg border">
                    <div className="text-sm text-gray-600">配置状态</div>
                    <div className={`font-semibold ${mcpStatus.configLoaded ? 'text-green-600' : 'text-red-600'}`}>
                      {mcpStatus.configLoaded ? '✅ 已加载' : '❌ 未加载'}
                    </div>
                  </div>
                  
                  <div className="p-4 bg-gray-50 rounded-lg border">
                    <div className="text-sm text-gray-600">服务器连接</div>
                    <div className={`font-semibold ${mcpStatus.serversConnected ? 'text-green-600' : 'text-red-600'}`}>
                      {mcpStatus.details.connectedServers}/{mcpStatus.details.totalServers}
                    </div>
                  </div>
                  
                  <div className="p-4 bg-gray-50 rounded-lg border">
                    <div className="text-sm text-gray-600">工具数量</div>
                    <div className={`font-semibold ${mcpStatus.toolsLoaded ? 'text-green-600' : 'text-red-600'}`}>
                      {mcpStatus.details.totalTools} 个工具
                    </div>
                  </div>
                  
                  <div className="p-4 bg-gray-50 rounded-lg border">
                    <div className="text-sm text-gray-600">关键词映射</div>
                    <div className={`font-semibold ${mcpStatus.keywordsMapped ? 'text-green-600' : 'text-red-600'}`}>
                      {mcpStatus.details.keywordMappings} 个映射
                    </div>
                  </div>
                </div>
              )}

              {mcpError && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg mb-4">
                  <div className="flex items-center">
                    <span className="text-red-600 mr-2">❌</span>
                    <span className="text-red-800 font-medium">MCP系统错误</span>
                  </div>
                  <div className="text-red-700 text-sm mt-1">{mcpError}</div>
                </div>
              )}
            </div>

            {/* MCP Actions */}
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => reinitializeMCP(true)}
                disabled={mcpLoading}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="重新初始化MCP系统"
              >
                <RefreshCw className={`h-4 w-4 ${mcpLoading ? 'animate-spin' : ''}`} />
                {mcpLoading ? '重新初始化中...' : '重新初始化MCP'}
              </button>
              
              <button
                onClick={checkMCPStatus}
                disabled={mcpLoading}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="从数据库刷新MCP状态"
              >
                <Database className="h-4 w-4" />
                {mcpLoading ? '检查中...' : '刷新状态'}
              </button>
              
              <button
                onClick={() => window.open('/api/mcp/status', '_blank')}
                className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                title="查看MCP状态API"
              >
                <Activity className="h-4 w-4" />
                查看API状态
              </button>
            </div>
          </div>
        </div>

        {/* Admin Sections */}
        <div className="space-y-8">
          {adminSections.map((section, sectionIndex) => (
            <div key={sectionIndex} className="bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
              <div className={`bg-gradient-to-r ${section.color} p-6 text-white`}>
                <div className="flex items-center mb-2">
                  <div className="text-white">
                    {section.icon}
                  </div>
                  <h2 className="text-xl font-semibold ml-3 text-white">{section.title}</h2>
                </div>
                <p className="text-white/90">{section.description}</p>
              </div>

              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {section.items.map((item, itemIndex) => (
                    <Link
                      key={itemIndex}
                      href={item.href}
                      className="group p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-md transition-all duration-200"
                      style={{ backgroundColor: '#f9fafb' }}
                    >
                      <div className="flex items-center mb-3">
                        <div className="p-2 rounded-lg group-hover:bg-blue-100 transition-colors shadow-sm" style={{ backgroundColor: '#ffffff', color: '#6b7280' }}>
                          {item.icon}
                        </div>
                        {item.badge && (
                          <span className="ml-2 px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full font-medium">
                            {item.badge}
                          </span>
                        )}
                        <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-blue-600 transition-colors ml-auto" />
                      </div>

                      <h3 className="font-semibold mb-2 group-hover:text-blue-600 transition-colors" style={{ color: '#111827' }}>
                        {item.name}
                      </h3>
                      <p className="text-sm leading-relaxed" style={{ color: '#4b5563' }}>
                        {item.description}
                      </p>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="mt-8 bg-white border border-gray-200 rounded-xl shadow-lg p-6">
          <h2 className="text-lg font-semibold mb-4" style={{ color: '#111827' }}>快速操作</h2>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => window.open('/api/health', '_blank')}
              className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 border border-blue-200 transition-all"
            >
              查看 API 健康状态
            </button>
            <button
              onClick={() => window.open('/api/enhanced-parse', '_blank')}
              className="px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 border border-purple-200 transition-all"
            >
              查看增强解析 API
            </button>

          </div>
        </div>
      </div>
    </div>
  )
}