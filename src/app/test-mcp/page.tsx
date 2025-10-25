'use client'

import { useState } from 'react'

/**
 * MCP 测试页面
 * 支持 stdio 和 http 两种传输方式
 */
export default function TestMCPPage() {
  const [transport, setTransport] = useState<'stdio' | 'http'>('stdio')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  
  // stdio 配置
  const [command, setCommand] = useState('gurddy-mcp')
  const [args, setArgs] = useState('')
  const [env, setEnv] = useState('')
  
  // http 配置
  const [url, setUrl] = useState('http://localhost:3001')
  
  // 通用配置
  const [method, setMethod] = useState('initialize')
  const [params, setParams] = useState('')

  const handleTest = async () => {
    setLoading(true)
    setResult(null)

    try {
      const requestBody: any = {
        transport,
        method,
        params: params ? JSON.parse(params) : {}
      }

      if (transport === 'stdio') {
        requestBody.command = command
        requestBody.args = args ? args.split(' ').filter(a => a.trim()) : []
        requestBody.env = env ? JSON.parse(env) : {}
      } else {
        requestBody.url = url
      }

      const response = await fetch('/api/test-mcp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      })

      const data = await response.json()
      setResult(data)
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      setLoading(false)
    }
  }

  const testExamples = {
    stdio: {
      command: 'gurddy-mcp',
      args: '',
      env: '{}',
      method: 'initialize',
      params: '{}'
    },
    http: {
      url: 'http://localhost:3001',
      method: 'initialize',
      params: '{}'
    }
  }

  const loadExample = () => {
    if (transport === 'stdio') {
      setCommand(testExamples.stdio.command)
      setArgs(testExamples.stdio.args)
      setEnv(testExamples.stdio.env)
      setMethod(testExamples.stdio.method)
      setParams(testExamples.stdio.params)
    } else {
      setUrl(testExamples.http.url)
      setMethod(testExamples.http.method)
      setParams(testExamples.http.params)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">MCP 测试工具</h1>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">传输方式</h2>
          
          <div className="flex gap-4 mb-6">
            <label className="flex items-center">
              <input
                type="radio"
                value="stdio"
                checked={transport === 'stdio'}
                onChange={(e) => setTransport(e.target.value as 'stdio')}
                className="mr-2"
              />
              stdio (进程通信)
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                value="http"
                checked={transport === 'http'}
                onChange={(e) => setTransport(e.target.value as 'http')}
                className="mr-2"
              />
              http (HTTP 请求)
            </label>
          </div>

          <button
            onClick={loadExample}
            className="mb-4 px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
          >
            加载示例配置
          </button>

          {transport === 'stdio' ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">命令</label>
                <input
                  type="text"
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  className="w-full px-3 py-2 border rounded"
                  placeholder="gurddy-mcp"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">参数 (空格分隔)</label>
                <input
                  type="text"
                  value={args}
                  onChange={(e) => setArgs(e.target.value)}
                  className="w-full px-3 py-2 border rounded"
                  placeholder="--verbose"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">环境变量 (JSON)</label>
                <textarea
                  value={env}
                  onChange={(e) => setEnv(e.target.value)}
                  className="w-full px-3 py-2 border rounded font-mono text-sm"
                  rows={3}
                  placeholder='{"DEBUG": "true"}'
                />
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium mb-2">URL</label>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full px-3 py-2 border rounded"
                placeholder="http://localhost:3001"
              />
            </div>
          )}

          <div className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">MCP 方法</label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="w-full px-3 py-2 border rounded"
              >
                <option value="initialize">initialize</option>
                <option value="tools/list">tools/list</option>
                <option value="tools/call">tools/call</option>
                <option value="ping">ping</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">参数 (JSON)</label>
              <textarea
                value={params}
                onChange={(e) => setParams(e.target.value)}
                className="w-full px-3 py-2 border rounded font-mono text-sm"
                rows={5}
                placeholder='{}'
              />
            </div>
          </div>

          <button
            onClick={handleTest}
            disabled={loading}
            className="mt-6 w-full px-4 py-3 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
          >
            {loading ? '测试中...' : '开始测试'}
          </button>
        </div>

        {result && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">测试结果</h2>
            
            <div className={`mb-4 p-4 rounded ${result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              <div className="font-semibold">
                {result.success ? '✓ 成功' : '✗ 失败'}
              </div>
              {result.error && (
                <div className="mt-2 text-red-700">{result.error}</div>
              )}
            </div>

            <div className="bg-gray-50 rounded p-4 overflow-auto">
              <pre className="text-sm">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
