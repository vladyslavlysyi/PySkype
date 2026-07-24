'use client'

import React, { useEffect, useState, useRef } from 'react'
import { Phone, Video, MoreHorizontal, Send, Smile, Paperclip, UserCircle } from 'lucide-react'
import { useAppStore, Message } from '@/store/useAppStore'
import { useSocket } from '@/contexts/SocketContext'

interface ChatAreaProps {
  onStartCall: (video: boolean) => void
}

export const ChatArea = ({ onStartCall }: ChatAreaProps) => {
  const { currentUser, activeConversation } = useAppStore()
  const { socket } = useSocket()
  
  const [messages, setMessages] = useState<Message[]>([])
  const [text, setText] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  const partner = activeConversation?.participants.find(p => p.user.id !== currentUser?.id)?.user

  useEffect(() => {
    if (!activeConversation) return

    // Fetch messages
    fetch(`/api/chats/${activeConversation.id}/messages`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data.messages) setMessages(data.messages)
      })
      .catch(err => console.error(err))

  }, [activeConversation])

  useEffect(() => {
    if (!socket) return

    const handleReceiveMessage = (msg: Message) => {
      if (msg.conversationId === activeConversation?.id) {
        setMessages(prev => [...prev, msg])
      }
    }

    socket.on('receive-message', handleReceiveMessage)
    return () => {
      socket.off('receive-message', handleReceiveMessage)
    }
  }, [socket, activeConversation])

  useEffect(() => {
    // Auto scroll to bottom
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const sendMessage = () => {
    if (!text.trim() || !activeConversation || !socket || !currentUser) return

    const receiverIds = activeConversation.participants
      .filter(p => p.user.id !== currentUser.id)
      .map(p => p.user.id)

    socket.emit('send-message', {
      conversationId: activeConversation.id,
      text,
      receiverIds
    })

    setText('')
  }

  if (!activeConversation) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#faf9f8] dark:bg-[#11100f]">
        <div className="w-48 h-48 mb-6 opacity-20">
          <svg viewBox="0 0 24 24" fill="currentColor" className="text-[#0078d4]"><path d="M23.993 12.446c-.035-1.127-.247-2.224-.627-3.265-.187-.512-.39-1.02-.622-1.517-.552-1.182-1.23-2.277-2.023-3.268-1.066-1.332-2.35-2.433-3.816-3.267-1.472-.84-3.08-1.378-4.78-1.597-1.745-.224-3.528-.088-5.234.394-1.637.462-3.176 1.184-4.57 2.143-1.458 1.002-2.73 2.257-3.766 3.73-1.01 1.436-1.765 3.056-2.235 4.802-.455 1.69-.597 3.447-.417 5.17.18 1.732.697 3.407 1.53 4.975.818 1.537 1.884 2.912 3.167 4.073 1.258 1.14 2.71 2.052 4.3 2.702 1.564.64 3.228 1.006 4.945 1.085 1.758.08 3.515-.125 5.21-.607 1.637-.466 3.17-1.196 4.554-2.164 1.442-.998 2.705-2.247 3.733-3.712.982-1.4 1.716-2.97 2.176-4.665.443-1.635.586-3.342.475-5.01zm-13.435 6.096c-2.825.04-5.367-1.04-7.143-3.06-1.68-1.91-2.486-4.48-2.26-7.234.198-2.42 1.34-4.663 3.224-6.31 1.847-1.615 4.316-2.432 6.945-2.302 2.723.134 5.253 1.353 7.122 3.433 1.763 1.96 2.553 4.588 2.222 7.4-.306 2.6-1.583 4.965-3.593 6.657-1.897 1.597-4.417 2.37-7.16 2.365z"/></svg>
        </div>
        <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">Welcome to Skype</h2>
        <p className="text-sm text-gray-500 mt-2">Search for someone to start chatting</p>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col bg-white dark:bg-[#11100f]">
      {/* Header */}
      <div className="h-16 px-6 flex items-center justify-between border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-[#11100f]">
        <div className="flex items-center gap-3">
          {partner?.avatarUrl ? (
            <img src={partner.avatarUrl} alt="avatar" className="w-10 h-10 rounded-full" />
          ) : (
            <UserCircle className="w-10 h-10 text-gray-500" />
          )}
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-white">{partner?.username}</h2>
            <p className="text-xs text-[#0078d4]">{partner?.status === 'ONLINE' ? 'Active now' : 'Offline'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => onStartCall(false)} className="p-2.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition text-[#0078d4] hover:text-[#005a9e]">
            <Phone className="w-5 h-5 fill-current" />
          </button>
          <button onClick={() => onStartCall(true)} className="p-2.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition text-[#0078d4] hover:text-[#005a9e]">
            <Video className="w-5 h-5 fill-current" />
          </button>
          <button className="p-2.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition text-gray-600 dark:text-gray-300">
            <MoreHorizontal className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
        {messages.map(msg => {
          const isMine = msg.senderId === currentUser?.id
          return (
            <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[70%] flex gap-2 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
                {!isMine && (
                  <UserCircle className="w-8 h-8 text-gray-400 mt-auto flex-shrink-0" />
                )}
                <div className={`px-4 py-2.5 rounded-2xl ${isMine ? 'bg-[#0078d4] text-white rounded-br-sm' : 'bg-[#f3f2f1] dark:bg-[#201f1e] text-gray-900 dark:text-gray-100 rounded-bl-sm'}`}>
                  <p className="text-sm leading-relaxed">{msg.text}</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Input */}
      <div className="p-4 bg-white dark:bg-[#11100f] border-t border-gray-200 dark:border-gray-800">
        <div className="flex items-end gap-2 bg-[#f3f2f1] dark:bg-[#201f1e] p-2 rounded-xl border border-transparent focus-within:border-[#0078d4] focus-within:bg-white dark:focus-within:bg-[#323130] transition">
          <button className="p-2 text-gray-500 hover:text-[#0078d4] transition">
            <Paperclip className="w-5 h-5" />
          </button>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                sendMessage()
              }
            }}
            placeholder="Type a message"
            className="flex-1 bg-transparent border-none outline-none resize-none max-h-32 text-sm text-gray-900 dark:text-white py-2 custom-scrollbar"
            rows={1}
          />
          <button className="p-2 text-gray-500 hover:text-[#0078d4] transition">
            <Smile className="w-5 h-5" />
          </button>
          <button 
            onClick={sendMessage}
            disabled={!text.trim()} 
            className="p-2 text-[#0078d4] disabled:text-gray-400 disabled:bg-transparent hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-full transition"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  )
}
