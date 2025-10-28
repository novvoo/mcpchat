'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/badge'
import AdminNavigation from '@/components/AdminNavigation'
import { 
  Cog, 
  MessageSquare, 
  Activity, 
  Zap, 
  Network, 
  Bug,
  ArrowRight,
  Settings,
  TestTube
} from 'lucide-react'

export default function DebugPage() {
  const debugTools = [
    {
      title: 'MCP 初始化调试',
      description: '详细调试MCP服务器初始化过程，查看连接状态和错误信息',
      href: '/admin/debug-mcp',
      icon: <Cog className="h-6 w-6" />,
      category: 'MCP',
      status: 'stable'
    },
    {
      title: 'LLM 服务调试',
      description: '测试LLM服务连接、响应时间和工具集成功能',
      href: '/admin/debug-llm',
      icon: <MessageSquare className="h-6 w-6" />,
      category: 'LLM',
      status: 'stable'
    },
    {
      title: 'MCP-LLM 交互调试',
      description: '调试MCP工具与LLM的完整交互流程，包含流量追踪',
      href: '/admin/debug-mcp-llm',
      icon: <Activity className="h-6 w-6" />,
      category: 'Integration',
      status: 'new'
    },
    {
      title: 'MCP 连接测试',
      description: '直接测试HTTP MCP服务器的连接和通信协议',
      href: '/admin/test-mcp-connection',
      icon: <TestTube className="h-6 w-6" />,
      category: 'MCP',
      status: 'stable'
    },
    {
      title: '智能路由测试',
      description: '测试完整的MCP工具智能识别和路由功能流程',
      href: '/admin/test-smart-routing',
      icon: <Zap className="h-6 w-6" />,
      category: 'Integration',
      status: 'stable'
    }
  ]

  const categories = ['All', 'MCP', 'LLM', 'Integration']
  const [selectedCategory, setSelectedCategory] = useState('All')

  const filteredTools = debugTools.filter(tool => 
    selectedCategory === 'All' || tool.category === selectedCategory
  )

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return 'bg-green-100 text-green-800'
      case 'stable': return 'bg-blue-100 text-blue-800'
      case 'experimental': return 'bg-yellow-100 text-yellow-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <AdminNavigation title="调试工具中心" />
      
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold flex items-center justify-center gap-2">
          <Bug className="h-8 w-8" />
          调试工具中心
        </h1>
        <p className="text-muted-foreground">
          全面的MCP和LLM系统调试工具集合
        </p>
      </div>

      {/* 分类筛选 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            工具分类
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {categories.map(category => (
              <Button
                key={category}
                variant={selectedCategory === category ? "primary" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(category)}
              >
                {category}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 工具网格 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTools.map((tool, index) => (
          <Card key={index} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    {tool.icon}
                  </div>
                  <div>
                    <CardTitle className="text-lg">{tool.title}</CardTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">
                        {tool.category}
                      </Badge>
                      <Badge className={`text-xs ${getStatusColor(tool.status)}`}>
                        {tool.status}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <CardDescription className="text-sm">
                {tool.description}
              </CardDescription>
              <Link href={tool.href}>
                <Button className="w-full" variant="outline">
                  打开工具
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 使用说明 */}
      <Card>
        <CardHeader>
          <CardTitle>使用说明</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <h4 className="font-medium text-green-600">🟢 MCP 工具</h4>
              <p className="text-sm text-muted-foreground">
                用于调试MCP服务器连接、初始化和工具加载问题
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium text-blue-600">🔵 LLM 工具</h4>
              <p className="text-sm text-muted-foreground">
                用于测试LLM服务连接、响应质量和性能指标
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium text-purple-600">🟣 集成工具</h4>
              <p className="text-sm text-muted-foreground">
                用于调试MCP与LLM的完整交互流程和智能路由
              </p>
            </div>
          </div>
          
          <div className="border-t pt-4">
            <h4 className="font-medium mb-2">调试建议流程:</h4>
            <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
              <li>首先使用 "MCP 初始化调试" 确保MCP服务器正常连接</li>
              <li>然后使用 "LLM 服务调试" 验证LLM服务可用性</li>
              <li>最后使用 "MCP-LLM 交互调试" 测试完整的集成流程</li>
              <li>如有问题，查看浏览器控制台和服务器日志获取详细信息</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

