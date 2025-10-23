'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import AdminNavigation from '@/components/AdminNavigation'

export default function ColorTestPage() {
  const colorOptions = [
    { name: 'bg-background', class: 'bg-background', description: '主背景色' },
    { name: 'bg-muted', class: 'bg-muted', description: '静音背景色' },
    { name: 'bg-accent', class: 'bg-accent', description: '强调背景色' },
    { name: 'bg-secondary', class: 'bg-secondary', description: '次要背景色' },
    { name: 'bg-gray-50', class: 'bg-gray-50', description: '浅灰色背景' },
    { name: 'bg-gray-100', class: 'bg-gray-100', description: '更深的浅灰色' },
    { name: 'bg-gray-200', class: 'bg-gray-200', description: '中等灰色' },
  ]

  const textColors = [
    { name: 'text-foreground', class: 'text-foreground', description: '主文字色' },
    { name: 'text-muted-foreground', class: 'text-muted-foreground', description: '静音文字色' },
    { name: 'text-gray-600', class: 'text-gray-600', description: '灰色文字' },
    { name: 'text-gray-700', class: 'text-gray-700', description: '深灰色文字' },
    { name: 'text-gray-900', class: 'text-gray-900', description: '最深灰色文字' },
  ]

  return (
    <div className="container mx-auto p-6 space-y-6">
      <AdminNavigation title="颜色测试" />
      
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">颜色系统测试</h1>
        <p className="text-muted-foreground">
          查看和测试项目中的颜色变量
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>背景颜色</CardTitle>
          <CardDescription>
            不同的背景颜色选项
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {colorOptions.map((color) => (
              <div key={color.name} className="space-y-2">
                <div className={`${color.class} border border-border rounded-lg p-4 h-20 flex items-center justify-center`}>
                  <span className="text-foreground font-medium">{color.name}</span>
                </div>
                <div className="text-sm">
                  <p className="font-medium">{color.name}</p>
                  <p className="text-muted-foreground">{color.description}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>文字颜色</CardTitle>
          <CardDescription>
            不同的文字颜色选项
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {textColors.map((color) => (
              <div key={color.name} className="flex items-center justify-between p-4 border border-border rounded-lg">
                <div>
                  <p className={`${color.class} text-lg font-medium`}>
                    这是 {color.name} 的示例文字
                  </p>
                  <p className="text-sm text-muted-foreground">{color.description}</p>
                </div>
                <code className="text-sm bg-muted px-2 py-1 rounded">{color.name}</code>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>组合示例</CardTitle>
          <CardDescription>
            不同背景色的组合效果
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="bg-muted p-4 rounded-lg border border-border">
              <h3 className="font-medium text-foreground mb-2">bg-muted 背景</h3>
              <p className="text-muted-foreground">这是一个使用 muted 背景色的示例</p>
            </div>
            
            <div className="bg-accent p-4 rounded-lg border border-border">
              <h3 className="font-medium text-accent-foreground mb-2">bg-accent 背景</h3>
              <p className="text-accent-foreground/80">这是一个使用 accent 背景色的示例</p>
            </div>
            
            <div className="bg-secondary p-4 rounded-lg border border-border">
              <h3 className="font-medium text-secondary-foreground mb-2">bg-secondary 背景</h3>
              <p className="text-secondary-foreground/80">这是一个使用 secondary 背景色的示例</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}