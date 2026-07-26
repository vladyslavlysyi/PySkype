'use client'

import React, { useEffect, useState } from 'react'
import { Search, UserCircle, MessageSquare, Phone, MoreVertical, CheckCircle2, Clock, XCircle, Moon } from 'lucide-react'
import { useAppStore, User } from '@/store/useAppStore'
import { ProfileModal } from './ProfileModal'
import { useWebSocket } from '@/contexts/WebSocketContext'

export const Sidebar = () => {
  const { currentUser, conversations, setConversations, activeConversation, setActiveConversation, searchQuery, setSearchQuery, searchResults, setSearchResults } = useAppStore()
  const [isSearching, setIsSearching] = useState(false)
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const { isConnected, subscribe } = useWebSocket()

  const fetchConversations = async () => {
    try {
      const res = await fetch('/api/users/conversations', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      })
      const data = await res.json()
      if (Array.isArray(data)) {
        setConversations(data)
      }
    } catch (err) {
      console.error("Failed to fetch conversations", err)
    }
  }

  // Fetch conversations on mount / user change
  useEffect(() => {
    if (!currentUser) return
    fetchConversations()
  }, [currentUser, setConversations])

  // Listen for new messages to refresh conversation list if needed
  useEffect(() => {
    if (!isConnected) return

    const unsub = subscribe('receive_message', (msg: any) => {
      const currentConvs = useAppStore.getState().conversations
      if (!currentConvs.some(c => c.id === msg.conversation_id)) {
        fetchConversations()
      }
    })

    return () => unsub()
  }, [isConnected, subscribe])

  // Mock search debounce
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      setIsSearching(false)
      return
    }

    const timer = setTimeout(async () => {
      setIsSearching(true)
      try {
        const res = await fetch(`/api/users/search?q=${searchQuery}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        })
        const data = await res.json()
        setSearchResults(Array.isArray(data) ? data : [])
      } catch (err) {
        console.error(err)
      } finally {
        setIsSearching(false)
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [searchQuery, setSearchResults])

  const [contextMenuId, setContextMenuId] = useState<string | null>(null)

  const startChat = async (targetUser: User) => {
    try {
      const res = await fetch('/api/chats', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}` // Placeholder
        },
        body: JSON.stringify({ targetUserId: targetUser.id })
      })
      const data = await res.json()
      if (data.conversation) {
        setActiveConversation(data.conversation)
        // Refresh conversations to include the new one
        const convRes = await fetch('/api/users/conversations', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        })
        const convData = await convRes.json()
        if (Array.isArray(convData)) setConversations(convData)
        setSearchQuery('')
      }
    } catch (err) {
      console.error(err)
    }
  }

  const pinChat = async (convId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      const res = await fetch(`/api/chats/${convId}/pin`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      })
      const data = await res.json()
      if (data.status === 'success') {
        // Update local state
        setConversations(conversations.map(c => {
          if (c.id === convId) {
            const myPart = c.participants.find(p => p.user.id === currentUser?.id)
            if (myPart) myPart.is_pinned = data.is_pinned
          }
          return c
        }))
      }
    } catch (err) {
      console.error(err)
    } finally {
      setContextMenuId(null)
    }
  }

  const deleteChat = async (convId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      const res = await fetch(`/api/chats/${convId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      })
      if (res.ok) {
        setConversations(conversations.filter(c => c.id !== convId))
        if (activeConversation?.id === convId) {
          setActiveConversation(null)
        }
      }
    } catch (err) {
      console.error(err)
    } finally {
      setContextMenuId(null)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ONLINE': return <CheckCircle2 className="w-3 h-3 text-green-500 bg-white rounded-full" />
      case 'AWAY': return <Clock className="w-3 h-3 text-yellow-500 bg-white rounded-full" />
      case 'DO_NOT_DISTURB': return <XCircle className="w-3 h-3 text-red-500 bg-white rounded-full" />
      case 'OFFLINE':
      default: return <Moon className="w-3 h-3 text-gray-400 bg-white rounded-full" />
    }
  }

  const [isHeaderMenuOpen, setIsHeaderMenuOpen] = useState(false)

  return (
    <div className={`h-full bg-[#f3f2f1] dark:bg-[#201f1e] border-r border-gray-300 dark:border-gray-800 flex-col flex-shrink-0 ${activeConversation ? 'hidden md:flex' : 'flex'} w-full md:w-80`}>
      {/* Header Profile */}
      <div className="p-4 flex items-center justify-between border-b border-gray-300 dark:border-gray-800 relative">
        <div 
          className="flex items-center gap-3 cursor-pointer hover:bg-gray-200 dark:hover:bg-[#323130] p-1.5 -ml-1.5 rounded-xl transition"
          onClick={() => setIsProfileOpen(true)}
        >
          <div className="relative">
            {currentUser?.avatar_url ? (
              <img src={currentUser.avatar_url} alt="avatar" className="w-10 h-10 rounded-full object-cover" />
            ) : (
              <UserCircle className="w-10 h-10 text-gray-500 dark:text-gray-400" />
            )}
            <div className="absolute bottom-0 right-0">
              {getStatusIcon(currentUser?.status || 'OFFLINE')}
            </div>
          </div>
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-white text-sm">{currentUser?.username || 'Guest'}</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">{currentUser?.status || 'Offline'}</p>
          </div>
        </div>
        
        <div className="relative">
          <button 
            onClick={() => setIsHeaderMenuOpen(!isHeaderMenuOpen)}
            className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition"
          >
            <MoreVertical className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          </button>
          
          {isHeaderMenuOpen && (
            <div className="absolute right-0 top-10 z-50 w-48 bg-white dark:bg-[#201f1e] rounded-md shadow-lg border border-gray-200 dark:border-gray-700 py-1">
              <button 
                onClick={() => {
                  localStorage.removeItem('token')
                  useAppStore.getState().setCurrentUser(null)
                  window.location.href = '/login'
                }}
                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Search Bar */}
      <div className="p-4 pb-2">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-500" />
          <input
            type="text"
            placeholder="People, groups, messages"
            className="w-full bg-white dark:bg-[#323130] text-sm text-gray-900 dark:text-white rounded-full pl-9 pr-4 py-2 border-none outline-none focus:ring-2 focus:ring-[#0078d4] transition shadow-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Conversation List / Search Results */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
        {searchQuery ? (
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase px-2 mb-2">Skype Directory</h3>
            {isSearching ? (
              <p className="text-sm text-gray-500 px-2">Searching...</p>
            ) : (
              searchResults.map(user => (
                <div key={user.id} onClick={() => startChat(user)} className="flex items-center gap-3 p-2 hover:bg-gray-200 dark:hover:bg-[#323130] rounded-lg cursor-pointer transition">
                  <div className="relative flex-shrink-0">
                    {user.avatar_url ? (
                      <img src={user.avatar_url} alt="avatar" className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                      <UserCircle className="w-10 h-10 text-gray-500" />
                    )}
                    <div className="absolute bottom-0 right-0">{getStatusIcon(user.status)}</div>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white">{user.username}</h4>
                    <p className="text-xs text-gray-500">Skype Directory</p>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div onClick={() => setContextMenuId(null)}>
            <h3 className="text-xs font-semibold text-gray-500 uppercase px-2 mb-2">Recent Chats</h3>
            {conversations.length === 0 ? (
              <p className="text-sm text-gray-500 px-2">No recent chats.</p>
            ) : (
              [...conversations].sort((a, b) => {
                const aPinned = a.participants.find(p => p.user.id === currentUser?.id)?.is_pinned
                const bPinned = b.participants.find(p => p.user.id === currentUser?.id)?.is_pinned
                if (aPinned && !bPinned) return -1
                if (!aPinned && bPinned) return 1
                return 0
              }).map(conv => {
                const myPart = conv.participants.find(p => p.user.id === currentUser?.id)
                const isPinned = myPart?.is_pinned
                const partner = conv.participants.find(p => p.user.id !== currentUser?.id)?.user
                const isActive = activeConversation?.id === conv.id
                const isMenuOpen = contextMenuId === conv.id

                return (
                  <div 
                    key={conv.id} 
                    onClick={() => setActiveConversation(conv)}
                    onContextMenu={(e) => { e.preventDefault(); setContextMenuId(conv.id) }}
                    className={`relative flex items-center gap-3 p-2 rounded-lg cursor-pointer transition group ${isActive ? 'bg-[#e1dfdd] dark:bg-[#2b5278]' : 'hover:bg-gray-200 dark:hover:bg-[#323130]'}`}
                  >
                    <div className="relative flex-shrink-0">
                      {partner?.avatar_url ? (
                        <img src={partner.avatar_url} alt="avatar" className="w-10 h-10 rounded-full object-cover" />
                      ) : (
                        <UserCircle className="w-10 h-10 text-gray-500" />
                      )}
                      {partner && <div className="absolute bottom-0 right-0">{getStatusIcon(partner.status)}</div>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline">
                        <div className="flex items-center gap-1">
                          <h4 className="text-sm font-medium text-gray-900 dark:text-white truncate">{conv.type === 'GROUP' ? 'Group Chat' : partner?.username}</h4>
                          {isPinned && <span className="text-[10px] text-[#0078d4]">📌</span>}
                        </div>
                        <span className="text-[10px] text-gray-500">
                          {conv.last_message?.created_at && new Date(conv.last_message.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 truncate mt-0.5">
                        {conv.last_message ? (
                          conv.last_message.content.includes('![') ? '🖼️ Image' :
                          conv.last_message.content.includes('[🎤 Voice Message]') ? '🎤 Voice message' :
                          conv.last_message.content.includes('📎') ? '📎 File attachment' :
                          conv.last_message.content
                        ) : (
                          'Select to view messages...'
                        )}
                      </p>
                    </div>
                    
                    {/* Context Menu Trigger */}
                    <button 
                      onClick={(e) => { e.stopPropagation(); setContextMenuId(isMenuOpen ? null : conv.id) }}
                      className={`p-1 rounded-full hover:bg-gray-300 dark:hover:bg-gray-700 transition ${isMenuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                    >
                      <MoreVertical className="w-4 h-4 text-gray-500" />
                    </button>

                    {/* Context Menu */}
                    {isMenuOpen && (
                      <div className="absolute right-2 top-10 z-10 w-32 bg-white dark:bg-[#201f1e] rounded-md shadow-lg border border-gray-200 dark:border-gray-700 py-1">
                        <button 
                          onClick={(e) => pinChat(conv.id, e)}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#323130]"
                        >
                          {isPinned ? 'Unpin' : 'Pin chat'}
                        </button>
                        <button 
                          onClick={(e) => deleteChat(conv.id, e)}
                          className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                        >
                          Delete chat
                        </button>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>

      {isProfileOpen && currentUser && (
        <ProfileModal 
          user={currentUser} 
          onClose={() => setIsProfileOpen(false)} 
          isMe={true} 
        />
      )}
    </div>
  )
}
