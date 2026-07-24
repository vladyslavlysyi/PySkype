'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAppStore } from '@/store/useAppStore'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('password123') // default for easy testing
  const [isRegistering, setIsRegistering] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const setCurrentUser = useAppStore(state => state.setCurrentUser)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !password.trim()) return

    setLoading(true)
    setError('')

    try {
      const endpoint = isRegistering ? '/api/auth/register' : '/api/auth/login'
      let fetchOptions: RequestInit = {}

      if (isRegistering) {
        fetchOptions = {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password, email: `${username}@test.com` })
        }
      } else {
        const formData = new URLSearchParams()
        formData.append('username', username)
        formData.append('password', password)
        
        fetchOptions = {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: formData
        }
      }

      const res = await fetch(endpoint, fetchOptions)

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed')
      }

      // Save to Zustand store
      setCurrentUser({
        id: data.user.id,
        username: data.user.username,
        status: 'ONLINE',
      })
      
      // Save token for future API calls
      localStorage.setItem('token', data.token)

      router.push('/')
    } catch (err: any) {
      setError(err.message || 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-screen items-center justify-center bg-[#f3f2f1] dark:bg-[#201f1e]">
      <div className="p-8 bg-white dark:bg-[#323130] rounded-2xl shadow-xl max-w-md w-full">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-[#0078d4] text-white rounded-full flex items-center justify-center">
             <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8"><path d="M23.993 12.446c-.035-1.127-.247-2.224-.627-3.265-.187-.512-.39-1.02-.622-1.517-.552-1.182-1.23-2.277-2.023-3.268-1.066-1.332-2.35-2.433-3.816-3.267-1.472-.84-3.08-1.378-4.78-1.597-1.745-.224-3.528-.088-5.234.394-1.637.462-3.176 1.184-4.57 2.143-1.458 1.002-2.73 2.257-3.766 3.73-1.01 1.436-1.765 3.056-2.235 4.802-.455 1.69-.597 3.447-.417 5.17.18 1.732.697 3.407 1.53 4.975.818 1.537 1.884 2.912 3.167 4.073 1.258 1.14 2.71 2.052 4.3 2.702 1.564.64 3.228 1.006 4.945 1.085 1.758.08 3.515-.125 5.21-.607 1.637-.466 3.17-1.196 4.554-2.164 1.442-.998 2.705-2.247 3.733-3.712.982-1.4 1.716-2.97 2.176-4.665.443-1.635.586-3.342.475-5.01zm-13.435 6.096c-2.825.04-5.367-1.04-7.143-3.06-1.68-1.91-2.486-4.48-2.26-7.234.198-2.42 1.34-4.663 3.224-6.31 1.847-1.615 4.316-2.432 6.945-2.302 2.723.134 5.253 1.353 7.122 3.433 1.763 1.96 2.553 4.588 2.222 7.4-.306 2.6-1.583 4.965-3.593 6.657-1.897 1.597-4.417 2.37-7.16 2.365z"/></svg>
          </div>
        </div>
        <h2 className="text-2xl font-bold text-center text-gray-900 dark:text-white mb-6">
          {isRegistering ? 'Create Account' : 'Sign In'}
        </h2>
        
        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#0078d4] focus:border-transparent dark:bg-[#484644] dark:text-white"
              placeholder="Enter your username"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#0078d4] focus:border-transparent dark:bg-[#484644] dark:text-white"
              placeholder="Enter password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading || !username.trim()}
            className="w-full py-2.5 bg-[#0078d4] hover:bg-[#005a9e] text-white rounded-lg font-medium transition disabled:opacity-50"
          >
            {loading ? 'Processing...' : (isRegistering ? 'Sign Up' : 'Sign In')}
          </button>
        </form>

        <div className="mt-4 text-center">
          <button onClick={() => setIsRegistering(!isRegistering)} className="text-[#0078d4] text-sm hover:underline">
            {isRegistering ? 'Already have an account? Sign In' : 'Need an account? Sign Up'}
          </button>
        </div>
      </div>
    </div>
  )
}
