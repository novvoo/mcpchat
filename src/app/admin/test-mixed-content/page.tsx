'use client'

import React, { useState } from 'react'
import { MessageList } from '@/components/MessageList'
import { AdminNavigation } from '@/components/AdminNavigation'
import { Message } from '@/types'

export default function TestMixedContentPage() {
  const [messages] = useState<Message[]>([
    {
      id: '1',
      role: 'user',
      content: '请解决8皇后问题',
      timestamp: new Date()
    },
    {
      id: '2',
      role: 'assistant',
      content: `我来为您解决8皇后问题。这是一个经典的回溯算法问题，需要在8×8的棋盘上放置8个皇后，使得它们互不攻击。

✅ **solve_n_queens 执行成功**

{"success": true, "solution": [0, 4, 7, 5, 2, 6, 1, 3], "error": null}

这个解决方案表示：
- 第1行皇后在第1列
- 第2行皇后在第5列  
- 第3行皇后在第8列
- 第4行皇后在第6列
- 第5行皇后在第3列
- 第6行皇后在第7列
- 第7行皇后在第2列
- 第8行皇后在第4列

每个皇后都不会攻击到其他皇后，满足N皇后问题的约束条件。`,
      timestamp: new Date()
    },
    {
      id: '3',
      role: 'user',
      content: '请计算24点游戏：1, 3, 4, 6',
      timestamp: new Date()
    },
    {
      id: '4',
      role: 'assistant',
      content: `我来帮您解决这个24点游戏问题。需要用1, 3, 4, 6这四个数字通过加减乘除运算得到24。

让我尝试不同的组合...

{"success": true, "expression": "(6 - 4) * (3 + 1) * 3", "error": null}

找到解决方案了！计算过程：
1. 6 - 4 = 2
2. 3 + 1 = 4  
3. 2 * 4 = 8
4. 8 * 3 = 24

所以表达式 (6 - 4) * (3 + 1) * 3 = 24 就是答案。`,
      timestamp: new Date()
    },
    {
      id: '5',
      role: 'user',
      content: '请计算一个复杂的数学表达式',
      timestamp: new Date()
    },
    {
      id: '6',
      role: 'assistant',
      content: `我来计算一个复杂的数学表达式：(2^3 + 5) * (10 - 3) / 2

{"success": true, "result": 45.5, "formula": "(2^3 + 5) * (10 - 3) / 2", "steps": ["2^3 = 8", "8 + 5 = 13", "10 - 3 = 7", "13 * 7 = 91", "91 / 2 = 45.5"], "error": null}

计算完成！最终结果是 45.5。`,
      timestamp: new Date()
    }
  ])

  return (
    <div className="container mx-auto p-6">
      <AdminNavigation title="混合内容渲染测试" />

      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">混合内容渲染测试</h1>
        <p className="text-muted-foreground">
          测试包含文本和JSON结果的混合内容渲染效果，包括N皇后、24点游戏、数学计算等
        </p>
      </div>

      <div className="border rounded-lg h-[600px] bg-background">
        <MessageList
          messages={messages}
          showTimestamps={true}
          showAvatars={true}
          autoScroll={true}
        />
      </div>
    </div>
  )
}