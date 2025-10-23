'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Home } from 'lucide-react'

interface AdminNavigationProps {
  title?: string
  showBackToAdmin?: boolean
  showBackToHome?: boolean
}

export default function AdminNavigation({ 
  title, 
  showBackToAdmin = true, 
  showBackToHome = true 
}: AdminNavigationProps) {
  return (
    <div className="flex items-center justify-between mb-6 p-4 bg-accent rounded-lg border border-border">
      <div className="flex items-center gap-4">
        {showBackToAdmin && (
          <Link href="/admin">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              返回管理面板
            </Button>
          </Link>
        )}
        {showBackToHome && (
          <Link href="/">
            <Button variant="outline" size="sm">
              <Home className="h-4 w-4 mr-2" />
              返回首页
            </Button>
          </Link>
        )}
      </div>
      {title && (
        <div className="text-sm text-muted-foreground">
          当前页面: {title}
        </div>
      )}
    </div>
  )
}