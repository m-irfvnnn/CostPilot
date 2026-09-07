import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { AcquisitionCapture } from '@/components/acquisition-capture'
import './globals.css'

export const metadata: Metadata = {
  title: 'CostPilot — AI Workflow Cost Intelligence',
  description: 'Understand and control AI agents, workflow runs, model usage, budgets, forecasts, alerts, and optimization opportunities.',
  generator: 'v0.app',
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#f8fafc',
  userScalable: true,
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="bg-background">
      <body className="antialiased">
        <AcquisitionCapture />
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
