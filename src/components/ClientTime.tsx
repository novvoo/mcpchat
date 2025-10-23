'use client'

import { useState, useEffect } from 'react'

interface ClientTimeProps {
  format?: 'zh-CN' | 'en-US'
  className?: string
}

export default function ClientTime({ format = 'zh-CN', className }: ClientTimeProps) {
  const [time, setTime] = useState<string>('')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    setTime(new Date().toLocaleString(format))
  }, [format])

  // 避免hydration错误，在客户端挂载前不显示时间
  if (!mounted) {
    return <span className={className}>加载中...</span>
  }

  return <span className={className}>{time}</span>
}