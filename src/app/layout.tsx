import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { WebSocketProvider } from '@/contexts/WebSocketContext'

import { AuthGuard } from '@/components/AuthGuard'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Skype Web Clone',
  description: 'A modern Skype clone built with Next.js and WebRTC',
  icons: {
    icon: '/logo.png',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        <WebSocketProvider>
          <AuthGuard>
            {children}
          </AuthGuard>
        </WebSocketProvider>
      </body>
    </html>
  )
}
