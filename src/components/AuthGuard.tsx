'use client'

import React, { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAppStore } from '@/store/useAppStore'

export const AuthGuard = ({ children }: { children: React.ReactNode }) => {
  const { currentUser, setCurrentUser } = useAppStore()
  const router = useRouter()
  const pathname = usePathname()
  const [isMounted, setIsMounted] = useState(false)
  const [isVerifying, setIsVerifying] = useState(true)

  useEffect(() => {
    setIsMounted(true)

    const verifyUser = async () => {
      try {
        const res = await fetch('/api/users/me')
        if (res.ok) {
          const data = await res.json()
          setCurrentUser(data)
        } else {
          setCurrentUser(null)
        }
      } catch (err) {
        console.error('Failed to fetch user:', err)
        setCurrentUser(null)
      }
      setIsVerifying(false)
    }

    verifyUser()
  }, [setCurrentUser])

  useEffect(() => {
    if (!isMounted || isVerifying) return

    const isAuthPage = pathname === '/login' || pathname === '/register'

    if (!currentUser && !isAuthPage) {
      router.push('/login')
    } else if (currentUser && isAuthPage) {
      router.push('/')
    }
  }, [currentUser, isMounted, isVerifying, pathname, router])

  if (!isMounted || isVerifying) return null

  // Prevent flash of content
  const isAuthPage = pathname === '/login' || pathname === '/register'
  if (!currentUser && !isAuthPage) return null
  if (currentUser && isAuthPage) return null

  return <>{children}</>
}
