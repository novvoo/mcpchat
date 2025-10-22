'use client'

import { SimpleChatInterface } from '@/components'
import { ErrorBoundary } from '@/components/ErrorBoundary'

export default function Home() {
  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        console.error('Application error:', error, errorInfo)
        // In production, you might want to send this to an error reporting service
      }}
    >
      <main className="h-screen flex flex-col bg-background text-foreground">
        <SimpleChatInterface
          placeholder="Ask me anything or try: 'Solve the 8 queens problem'"
          showTimestamps={false}
          showAvatars={true}
          className="h-full"
        />
      </main>
    </ErrorBoundary>
  )
}
