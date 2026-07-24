'use client'

import React, { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAppStore } from '@/store/useAppStore'

export const AuthGuard = ({ children }: { children: React.ReactNode }) => {
  const { currentUser } = useAppStore()
  const router = useRouter()
  const pathname = usePathname()
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEffect(() => {
    if (!isMounted) return

    const isAuthPage = pathname === '/login'

    if (!currentUser && !isAuthPage) {
      router.push('/login')
    } else if (currentUser && isAuthPage) {
      router.push('/')
    }
  }, [currentUser, isMounted, pathname, router])

  if (!isMounted) return null

  // If we are redirecting, we can optionally show nothing to prevent flash of content
  if (!currentUser && pathname !== '/login') return null
  if (currentUser && pathname === '/login') return null

  return <>{children}</>
}
