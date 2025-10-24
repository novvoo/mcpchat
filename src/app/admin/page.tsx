'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import {
  Settings,
  Bug,
  TestTube,
  Network,
  MessageSquare,
  Database,
  Zap,
  Brain,
  Route,
  Monitor,
  Server
} from 'lucide-react'
import ClientTime from '@/components/ClientTime'
import ClientEnv from '@/components/ClientEnv'
import { KeywordMappingStatus } from '@/components/KeywordMappingStatus'

interface DebugLink {
  title: string
  description: string
  href: string
  icon: React.ReactNode
  category: 'debug' | 'test' | 'config' | 'monitor'
  status?: 'active' | 'beta' | 'experimental'
}

export default function AdminPage() {
  const debugLinks: DebugLink[] = [
    // 调试页面
    {
      title: 'Debug 调试',
      description: '基础调试界面，查看系统状态和日志',
      href: '/admin/debug',
      icon: <Bug className="h-5 w-5" />,
      category: 'debug',
      status: 'active'
    },
    {
      title: 'Debug LLM',
      description: '大语言模型调试，测试LLM服务连接和响应',
      href: '/admin/debug-llm',
      icon: <Brain className="h-5 w-5" />,
      category: 'debug',
      status: 'active'
    },
    {
      title: 'Debug MCP',
      description: 'MCP协议调试，测试MCP服务器连接',
      href: '/admin/debug-mcp',
      icon: <Network className="h-5 w-5" />,
      category: 'debug',
      status: 'active'
    },
    {
      title: 'Debug MCP-LLM',
      description: 'MCP与LLM集成调试，测试完整的工具调用流程',
      href: '/admin/debug-mcp-llm',
      icon: <Zap className="h-5 w-5" />,
      category: 'debug',
      status: 'active'
    },

    // 测试页面
    {
      title: 'Test HTTP MCP',
      description: '测试HTTP MCP服务器连接和通信',
      href: '/admin/test-http-mcp',
      icon: <TestTube className="h-5 w-5" />,
      category: 'test',
      status: 'active'
    },
    {
      title: 'Test MCP Connection',
      description: '从config/mcp.json配置测试MCP服务器连接',
      href: '/admin/test-mcp-connection',
      icon: <Network className="h-5 w-5" />,
      category: 'test',
      status: 'active'
    },
    {
      title: 'Test Smart Routing',
      description: '测试完整的智能路由功能，包括意图识别、工具选择和执行',
      href: '/admin/test-smart-routing',
      icon: <Route className="h-5 w-5" />,
      category: 'test',
      status: 'active'
    },
    {
      title: 'Test MCP Formatting',
      description: '测试MCP工具响应的格式化效果，对比原始和格式化后的显示',
      href: '/admin/test-formatting',
      icon: <MessageSquare className="h-5 w-5" />,
      category: 'test',
      status: 'beta'
    },
    {
      title: 'Dynamic Patterns',
      description: '动态模式学习管理，基于PostgreSQL/pgvector的智能关键词生成',
      href: '/admin/dynamic-patterns',
      icon: <Brain className="h-5 w-5" />,
      category: 'config',
      status: 'experimental'
    },

    // 监控页面
    {
      title: 'System Monitor',
      description: '系统监控面板，查看性能指标和状态',
      href: '/monitor',
      icon: <Monitor className="h-5 w-5" />,
      category: 'monitor',
      status: 'experimental'
    },

    // 工具页面
    {
      title: 'URL 连接测试',
      description: '测试任意URL的连接性和响应时间',
      href: '/admin/test-url',
      icon: <Network className="h-5 w-5" />,
      category: 'test',
      status: 'active'
    },
    {
      title: '颜色系统测试',
      description: '查看和测试项目中的颜色变量',
      href: '/admin/color-test',
      icon: <Settings className="h-5 w-5" />,
      category: 'config',
      status: 'active'
    },
    {
      title: '样例问题管理',
      description: '管理系统中的样例问题数据，包括8皇后、数独等',
      href: '/admin/sample-problems',
      icon: <Database className="h-5 w-5" />,
      category: 'config',
      status: 'active'
    },
    {
      title: '样例问题测试',
      description: '测试样例问题API和前端组件',
      href: '/test-sample-problems',
      icon: <TestTube className="h-5 w-5" />,
      category: 'test',
    },
    {
      title: 'MCP样例问题测试',
      description: '测试从MCP服务器动态获取样例问题',
      href: '/admin/test-mcp-problems',
      icon: <Server className="h-5 w-5" />,
      category: 'test',
      status: 'active'
    },
    {
      title: '置信度测试',
      description: '测试和验证意图识别系统的置信度准确性',
      href: '/admin/confidence-test',
      icon: <Brain className="h-5 w-5" />,
      category: 'test',
      status: 'beta'
    }
  ]

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'debug': return 'bg-red-100 text-red-800'
      case 'test': return 'bg-blue-100 text-blue-800'
      case 'config': return 'bg-green-100 text-green-800'
      case 'monitor': return 'bg-purple-100 text-purple-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800'
      case 'beta': return 'bg-yellow-100 text-yellow-800'
      case 'experimental': return 'bg-orange-100 text-orange-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const groupedLinks = debugLinks.reduce((acc, link) => {
    if (!acc[link.category]) {
      acc[link.category] = []
    }
    acc[link.category].push(link)
    return acc
  }, {} as Record<string, DebugLink[]>)

  const categoryTitles = {
    debug: '调试工具',
    test: '测试工具',
    config: '配置管理',
    monitor: '监控面板'
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2 mb-4">
          <Settings className="h-8 w-8 text-blue-600" />
          <h1 className="text-3xl font-bold">管理面板</h1>
        </div>
        <p className="text-muted-foreground">
          集中管理所有调试、测试和监控工具
        </p>
      </div>

      {/* 快速统计 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {Object.entries(groupedLinks).map(([category, links]) => (
          <Card key={category}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {categoryTitles[category as keyof typeof categoryTitles]}
                  </p>
                  <p className="text-2xl font-bold">{links.length}</p>
                </div>
                <Badge className={getCategoryColor(category)}>
                  {category}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 工具链接 */}
      {Object.entries(groupedLinks).map(([category, links]) => (
        <Card key={category}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {category === 'debug' && <Bug className="h-5 w-5" />}
              {category === 'test' && <TestTube className="h-5 w-5" />}
              {category === 'config' && <Settings className="h-5 w-5" />}
              {category === 'monitor' && <Monitor className="h-5 w-5" />}
              {categoryTitles[category as keyof typeof categoryTitles]}
            </CardTitle>
            <CardDescription>
              {category === 'debug' && '用于调试和故障排除的工具'}
              {category === 'test' && '用于测试各种功能和连接的工具'}
              {category === 'config' && '用于配置管理的工具'}
              {category === 'monitor' && '用于监控系统状态的工具'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {links.map((link) => (
                <Link key={link.href} href={link.href}>
                  <Card className="h-full hover:shadow-md transition-shadow cursor-pointer">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          {link.icon}
                          <h3 className="font-semibold">{link.title}</h3>
                        </div>
                        {link.status && (
                          <Badge
                            variant="secondary"
                            className={getStatusColor(link.status)}
                          >
                            {link.status}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {link.description}
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}

      {/* 关键词映射状态 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            关键词映射状态
          </CardTitle>
          <CardDescription>
            MCP工具的关键词映射覆盖情况，影响意图识别的准确性
          </CardDescription>
        </CardHeader>
        <CardContent>
          <KeywordMappingStatus showDetails={true} />
        </CardContent>
      </Card>

      {/* 系统信息 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            系统信息
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="font-medium text-muted-foreground">环境</p>
              <p><ClientEnv /></p>
            </div>
            <div>
              <p className="font-medium text-muted-foreground">版本</p>
              <p>v1.0.0</p>
            </div>
            <div>
              <p className="font-medium text-muted-foreground">当前时间</p>
              <p><ClientTime format="zh-CN" /></p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 快速操作 */}
      <Card>
        <CardHeader>
          <CardTitle>快速操作</CardTitle>
          <CardDescription>
            常用的管理操作
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Link href="/">
              <Button variant="outline">
                <MessageSquare className="h-4 w-4 mr-2" />
                返回聊天
              </Button>
            </Link>
            <Link href="/admin/test-mcp-connection">
              <Button variant="outline">
                <Network className="h-4 w-4 mr-2" />
                快速测试MCP
              </Button>
            </Link>
            <Link href="/admin/debug">
              <Button variant="outline">
                <Bug className="h-4 w-4 mr-2" />
                系统调试
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}