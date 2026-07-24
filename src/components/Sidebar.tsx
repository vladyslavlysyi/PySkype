'use client'

import React, { useEffect, useState } from 'react'
import { Search, UserCircle, MessageSquare, Phone, MoreVertical, CheckCircle2, Clock, XCircle, Moon } from 'lucide-react'
import { useAppStore, User } from '@/store/useAppStore'

export const Sidebar = () => {
  const { currentUser, conversations, activeConversation, setActiveConversation, searchQuery, setSearchQuery, searchResults, setSearchResults } = useAppStore()
  const [isSearching, setIsSearching] = useState(false)

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
        const res = await fetch(`/api/users/search?q=${searchQuery}`)
        const data = await res.json()
        setSearchResults(data.users || [])
      } catch (err) {
        console.error(err)
      } finally {
        setIsSearching(false)
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [searchQuery, setSearchResults])

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
        setSearchQuery('')
      }
    } catch (err) {
      console.error(err)
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

  return (
    <div className="w-80 h-full bg-[#f3f2f1] dark:bg-[#201f1e] border-r border-gray-300 dark:border-gray-800 flex flex-col">
      {/* Header Profile */}
      <div className="p-4 flex items-center justify-between border-b border-gray-300 dark:border-gray-800">
        <div className="flex items-center gap-3 cursor-pointer">
          <div className="relative">
            {currentUser?.avatarUrl ? (
              <img src={currentUser.avatarUrl} alt="avatar" className="w-10 h-10 rounded-full object-cover" />
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
        <button className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition">
          <MoreVertical className="w-5 h-5 text-gray-600 dark:text-gray-300" />
        </button>
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
                  <div className="relative">
                    <UserCircle className="w-10 h-10 text-gray-500" />
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
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase px-2 mb-2">Recent Chats</h3>
            {conversations.length === 0 ? (
              <p className="text-sm text-gray-500 px-2">No recent chats.</p>
            ) : (
              conversations.map(conv => {
                const partner = conv.participants.find(p => p.user.id !== currentUser?.id)?.user
                const isActive = activeConversation?.id === conv.id

                return (
                  <div 
                    key={conv.id} 
                    onClick={() => setActiveConversation(conv)}
                    className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition ${isActive ? 'bg-[#e1dfdd] dark:bg-[#323130]' : 'hover:bg-gray-200 dark:hover:bg-[#323130]'}`}
                  >
                    <div className="relative flex-shrink-0">
                      <UserCircle className="w-10 h-10 text-gray-500" />
                      {partner && <div className="absolute bottom-0 right-0">{getStatusIcon(partner.status)}</div>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline">
                        <h4 className="text-sm font-medium text-gray-900 dark:text-white truncate">{conv.type === 'GROUP' ? 'Group Chat' : partner?.username}</h4>
                        <span className="text-[10px] text-gray-500">12:34</span>
                      </div>
                      <p className="text-xs text-gray-500 truncate">Select to view messages...</p>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>
    </div>
  )
}
