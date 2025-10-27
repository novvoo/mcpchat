'use client'

// Game Result Test Page - Test the GameResultParser component

import React, { useState } from 'react'
import { GameResultParser } from '@/components/GameResultParser'
import { AdminNavigation } from '@/components/AdminNavigation'

const GameResultTestPage: React.FC = () => {
  const [testContent, setTestContent] = useState(`输出已经格式化为json，但到前端要提取下如何从 9,32,15,27 从简单的加减乘除运算得到 24,每个数都用一次🤖Assistant✅ **solve_24_point_game 执行成功**  {   "content": [     {       "type": "text",       "text": "{\n  \"success\": true,\n  \"expression\": \"9 * (32 / (27 - 15))\",\n  \"error\": null\n}"     }   ] }`)

  const sampleResults = [
    {
      title: "成功案例 - 9,32,15,27",
      content: `🤖Assistant✅ **solve_24_point_game 执行成功**  {   "content": [     {       "type": "text",       "text": "{\n  \"success\": true,\n  \"expression\": \"9 * (32 / (27 - 15))\",\n  \"error\": null\n}"     }   ] }`
    },
    {
      title: "成功案例 - 简单格式",
      content: `{
  "success": true,
  "expression": "(1 + 2 + 3) * 4",
  "error": null
}`
    },
    {
      title: "失败案例",
      content: `{
  "success": false,
  "expression": null,
  "error": "无法找到使用 1, 1, 1, 1 得到 24 的解决方案"
}`
    },
    {
      title: "复杂表达式",
      content: `使用数字 3, 8, 8, 3 计算24点游戏
{
  "success": true,
  "expression": "8 / (3 - 8/3)",
  "error": null
}`
    }
  ]

  return (
    <div className="min-h-screen bg-background">
      <AdminNavigation />
      
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-foreground mb-8">
            24点游戏结果解析测试
          </h1>

          {/* Custom Test */}
          <div className="bg-card border border-border rounded-lg p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4">自定义测试</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  测试内容 (包含JSON结果):
                </label>
                <textarea
                  value={testContent}
                  onChange={(e) => setTestContent(e.target.value)}
                  className="w-full h-32 p-3 border border-border rounded-lg bg-background text-foreground font-mono text-sm"
                  placeholder="输入包含24点游戏结果的文本..."
                />
              </div>
              
              <div>
                <h3 className="text-lg font-medium mb-2">解析结果:</h3>
                <div className="border border-border rounded-lg p-4 bg-muted/50">
                  <GameResultParser content={testContent} />
                </div>
              </div>
            </div>
          </div>

          {/* Sample Results */}
          <div className="space-y-6">
            <h2 className="text-xl font-semibold">示例结果</h2>
            
            {sampleResults.map((sample, index) => (
              <div key={index} className="bg-card border border-border rounded-lg p-6">
                <h3 className="text-lg font-medium mb-4">{sample.title}</h3>
                
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-medium mb-2 text-muted-foreground">
                      原始内容:
                    </h4>
                    <pre className="text-xs bg-muted p-3 rounded border overflow-x-auto">
                      {sample.content}
                    </pre>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium mb-2 text-muted-foreground">
                      解析结果:
                    </h4>
                    <div className="border border-border rounded-lg p-3 bg-background">
                      <GameResultParser content={sample.content} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Usage Instructions */}
          <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-6 mt-8">
            <h2 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-4">
              使用说明
            </h2>
            <div className="text-sm text-blue-800 dark:text-blue-200 space-y-2">
              <p>• GameResultParser 组件会自动检测消息中的24点游戏结果</p>
              <p>• 支持解析包含 success、expression、error 字段的JSON格式</p>
              <p>• 会自动提取数字并美化显示计算表达式</p>
              <p>• 在聊天界面中，当AI返回24点游戏结果时会自动显示格式化的结果卡片</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default GameResultTestPage