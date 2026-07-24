'use client'

import React, { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react'

interface WebSocketContextType {
  socket: WebSocket | null
  isConnected: boolean
  sendMessage: (type: string, payload: any, targetUserId?: string) => void
  subscribe: (type: string, callback: (payload: any) => void) => () => void
}

const WebSocketContext = createContext<WebSocketContextType>({
  socket: null,
  isConnected: false,
  sendMessage: () => {},
  subscribe: () => () => {}
})

export const useWebSocket = () => useContext(WebSocketContext)

export const WebSocketProvider = ({ children }: { children: ReactNode }) => {
  const [socket, setSocket] = useState<WebSocket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const listenersRef = useRef<Map<string, Set<(payload: any) => void>>>(new Map())

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) return

    // Replace with your FastAPI backend WS URL directly since Next.js proxy doesn't handle WS well in standalone mode
    const wsUrl = 'ws://localhost:8000/api/ws'
    const ws = new WebSocket(`${wsUrl}?token=${token}`)

    ws.onopen = () => setIsConnected(true)
    ws.onclose = () => setIsConnected(false)
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        const eventType = data.type
        const payload = data.payload

        if (eventType && listenersRef.current.has(eventType)) {
          listenersRef.current.get(eventType)?.forEach(callback => callback(payload))
        }
      } catch (err) {
        console.error("WebSocket parse error:", err)
      }
    }

    setSocket(ws)

    return () => {
      ws.close()
    }
  }, [])

  const sendMessage = (type: string, payload: any = {}, targetUserId?: string) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type,
        target_user_id: targetUserId,
        payload
      }))
    }
  }

  const subscribe = (type: string, callback: (payload: any) => void) => {
    if (!listenersRef.current.has(type)) {
      listenersRef.current.set(type, new Set())
    }
    listenersRef.current.get(type)?.add(callback)

    // Return unsubscribe function
    return () => {
      listenersRef.current.get(type)?.delete(callback)
    }
  }

  return (
    <WebSocketContext.Provider value={{ socket, isConnected, sendMessage, subscribe }}>
      {children}
    </WebSocketContext.Provider>
  )
}
