'use client'

import { useState, useEffect } from 'react'

export default function ClientEnv() {
  const [env, setEnv] = useState<string>('loading...')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    setEnv(process.env.NODE_ENV || 'development')
  }, [])

  // 避免hydration错误
  if (!mounted) {
    return <span>loading...</span>
  }

  return <span>{env}</span>
}