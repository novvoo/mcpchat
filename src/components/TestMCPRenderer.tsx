'use client'

import React from 'react'
import { MCPResultRenderer } from './MCPResultRenderer'

// 测试组件，用于验证MCPResultRenderer是否正常工作
export const TestMCPRenderer: React.FC = () => {
  const testResults = [
    {
      name: "简单字符串",
      result: "这是一个简单的字符串结果"
    },
    {
      name: "24点游戏结果",
      result: {
        success: true,
        expression: "(3 + 3) * (8 - 8/8)",
        numbers: [3, 3, 8, 8]
      }
    },
    {
      name: "文件操作结果",
      result: {
        path: "/home/user/test.txt",
        content: "文件内容示例",
        success: true
      }
    },
    {
      name: "列表结果",
      result: {
        items: ["项目1", "项目2", "项目3", "项目4", "项目5"]
      }
    },
    {
      name: "复杂对象",
      result: {
        status: "success",
        data: {
          id: 123,
          name: "测试对象",
          nested: {
            value: "嵌套值"
          }
        },
        timestamp: "2024-01-01T00:00:00Z"
      }
    }
  ]

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">MCP结果渲染器测试</h1>
      
      {testResults.map((test, index) => (
        <div key={index} className="border border-gray-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-3 text-gray-800">
            {test.name}
          </h3>
          <MCPResultRenderer 
            result={test.result}
            toolName={`test_tool_${index}`}
          />
        </div>
      ))}
    </div>
  )
}

export default TestMCPRenderer