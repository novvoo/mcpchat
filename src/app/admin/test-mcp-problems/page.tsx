'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import AdminNavigation from '@/components/AdminNavigation'
import { Loader2, CheckCircle, XCircle, Database, Server, RefreshCw } from 'lucide-react'

interface SampleProblem {
  id: string
  category: string
  title: string
  title_en?: string
  description: string
  problem_type: string
  difficulty: string
  parameters: Record<string, any>
  keywords: string[]
  tool_name: string
  created_at: string
}

export default function TestMCPProblemsPage() {
  const [loading, setLoading] = useState(false)
  const [mcpProblems, setMcpProblems] = useState<SampleProblem[]>([])
  const [recommendedProblems, setRecommendedProblems] = useState<SampleProblem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [mcpSource, setMcpSource] = useState<string>('')
  const [recommendedSource, setRecommendedSource] = useState<string>('')

  useEffect(() => {
    loadProblems()
  }, [])

  const loadProblems = async () => {
    setLoading(true)
    setError(null)

    try {
      // 加载直接从MCP生成的问题
      const mcpResponse = await fetch('/api/sample-problems-mcp?action=generate')
      const mcpResult = await mcpResponse.json()

      if (mcpResult.success) {
        setMcpProblems(mcpResult.data)
        setMcpSource(mcpResult.source)
      }

      // 加载推荐问题（MCP优先，数据库备用）
      const recommendedResponse = await fetch('/api/sample-problems?action=recommended&limit=8')
      const recommendedResult = await recommendedResponse.json()

      if (recommendedResult.success) {
        setRecommendedProblems(recommendedResult.data)
        setRecommendedSource(recommendedResult.source)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载样例问题失败')
    } finally {
      setLoading(false)
    }
  }

  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'mcp':
        return <Server className="h-4 w-4" />
      case 'database':
        return <Database className="h-4 w-4" />
      default:
        return <Server className="h-4 w-4" />
    }
  }

  const getSourceColor = (source: string) => {
    switch (source) {
      case 'mcp':
        return 'default'
      case 'database':
        return 'secondary'
      default:
        return 'outline'
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <AdminNavigation title="MCP样例问题测试" />
      
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">MCP样例问题测试</h1>
        <p className="text-muted-foreground">
          测试从MCP服务器动态获取样例问题的功能
        </p>
      </div>

      {/* 控制面板 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            测试控制
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Button
            onClick={loadProblems}
            disabled={loading}
            className="flex items-center gap-2"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            重新加载样例问题
          </Button>
        </CardContent>
      </Card>

      {/* 错误显示 */}
      {error && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* 直接从MCP生成的问题 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            直接从MCP服务器生成的样例问题
            <Badge variant={getSourceColor(mcpSource)} className="ml-2">
              {getSourceIcon(mcpSource)}
              <span className="ml-1">{mcpSource === 'mcp' ? 'MCP服务器' : '数据源'}</span>
            </Badge>
          </CardTitle>
          <CardDescription>
            直接从连接的MCP服务器工具生成的样例问题
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <span>加载中...</span>
            </div>
          ) : mcpProblems.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {mcpProblems.map((problem, index) => (
                <Card key={index} className="border-l-4 border-l-blue-500">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-medium">{problem.title}</h4>
                      <Badge variant="outline" className="text-xs">
                        {problem.tool_name}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      {problem.description}
                    </p>
                    <div className="flex flex-wrap gap-1 mb-2">
                      <Badge variant="secondary" className="text-xs">
                        {problem.category}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {problem.difficulty}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {problem.keywords.slice(0, 3).map((keyword, i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {keyword}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center p-8 text-muted-foreground">
              <Server className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>没有从MCP服务器获取到样例问题</p>
              <p className="text-sm">请确保MCP服务器已连接并提供工具</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 推荐问题（MCP优先，数据库备用） */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5" />
            推荐样例问题（智能选择）
            <Badge variant={getSourceColor(recommendedSource)} className="ml-2">
              {getSourceIcon(recommendedSource)}
              <span className="ml-1">
                {recommendedSource === 'mcp' ? 'MCP服务器' : 
                 recommendedSource === 'database' ? '数据库备用' : 
                 'MCP优先'}
              </span>
            </Badge>
          </CardTitle>
          <CardDescription>
            优先从MCP服务器获取，如果失败则从数据库获取备用数据
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <span>加载中...</span>
            </div>
          ) : recommendedProblems.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {recommendedProblems.map((problem, index) => (
                <Card key={index} className={`border-l-4 ${
                  problem.id.startsWith('mcp-') ? 'border-l-green-500' : 'border-l-orange-500'
                }`}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-medium">{problem.title}</h4>
                      <Badge variant="outline" className="text-xs">
                        {problem.tool_name}
                      </Badge>
                      <Badge variant={problem.id.startsWith('mcp-') ? 'default' : 'secondary'} className="text-xs">
                        {problem.id.startsWith('mcp-') ? 'MCP' : 'DB'}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      {problem.description}
                    </p>
                    <div className="flex flex-wrap gap-1 mb-2">
                      <Badge variant="secondary" className="text-xs">
                        {problem.category}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {problem.difficulty}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {problem.keywords.slice(0, 3).map((keyword, i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {keyword}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center p-8 text-muted-foreground">
              <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>没有获取到推荐的样例问题</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 数据源说明 */}
      <Card>
        <CardHeader>
          <CardTitle>数据源说明</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-start gap-3 p-4 border rounded-lg">
              <Server className="h-6 w-6 text-blue-500 mt-1" />
              <div>
                <h4 className="font-medium mb-1">MCP服务器（优先）</h4>
                <p className="text-sm text-muted-foreground">
                  从连接的MCP服务器动态获取工具信息，实时生成样例问题。
                  这确保了样例问题与实际可用的工具保持同步。
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3 p-4 border rounded-lg">
              <Database className="h-6 w-6 text-orange-500 mt-1" />
              <div>
                <h4 className="font-medium mb-1">数据库（备用）</h4>
                <p className="text-sm text-muted-foreground">
                  当MCP服务器不可用时，从数据库中获取预定义的样例问题。
                  这确保了系统的可用性和稳定性。
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}