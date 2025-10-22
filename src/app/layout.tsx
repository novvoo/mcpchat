import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ThemeProvider } from '@/components/ThemeProvider';
import { initializeErrorReporter } from '@/utils/error-reporter';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MCP Chat Client",
  description: "A Next.js chat interface for MCP (Model Context Protocol) servers",
};

// Initialize error reporting
if (typeof window !== 'undefined') {
  initializeErrorReporter({
    enableConsoleLogging: process.env.NODE_ENV === 'development',
    enableRemoteReporting: false, // Enable in production with proper endpoint
    enableUserFeedback: false
  });
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased h-full bg-background text-foreground`}
      >
        <ThemeProvider defaultTheme="system" storageKey="mcpchat-theme">
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </ThemeProvider>
      </body>
    </html>
  );
}
