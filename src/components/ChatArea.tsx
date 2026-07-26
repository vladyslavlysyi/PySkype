'use client'

import React, { useEffect, useState, useRef } from 'react'
import { Phone, Video, MoreHorizontal, Send, Smile, Paperclip, UserCircle, ArrowLeft, Mic, Check, CheckCheck, Square } from 'lucide-react'
import { useAppStore, Message } from '@/store/useAppStore'
import { useWebSocket } from '@/contexts/WebSocketContext'
import { ProfileModal } from './ProfileModal'
import EmojiPicker from 'emoji-picker-react'

interface ChatAreaProps {
  onStartCall: (video: boolean) => void
}

export const ChatArea = ({ onStartCall }: ChatAreaProps) => {
  const { currentUser, activeConversation, setActiveConversation, conversations, setConversations } = useAppStore()
  const { isConnected, sendMessage, subscribe } = useWebSocket()
  
  const [messages, setMessages] = useState<Message[]>([])
  const [text, setText] = useState('')
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [showEmoji, setShowEmoji] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      alert("File size exceeds 5MB limit.")
      return
    }

    const formData = new FormData()
    formData.append("file", file)

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "Authorization": `Bearer ${localStorage.getItem('token')}` },
        body: formData
      })
      if (!res.ok) throw new Error("Upload failed")
      
      const data = await res.json()
      
      const isImage = file.type.startsWith("image/")
      const markdown = isImage ? `![${file.name}](${data.url})` : `[📎 ${file.name}](${data.url})`
      
      setText(prev => prev ? `${prev}\n${markdown}` : markdown)
    } catch (err) {
      alert("Failed to upload file.")
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const onEmojiClick = (emojiData: any) => {
    setText(prev => prev + emojiData.emoji)
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      mediaRecorderRef.current = recorder
      audioChunksRef.current = []

      recorder.ondataavailable = e => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data)
      }

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        const file = new File([audioBlob], 'voice_message.webm', { type: 'audio/webm' })
        
        const formData = new FormData()
        formData.append("file", file)
        try {
          const res = await fetch("/api/upload", {
            method: "POST",
            headers: { "Authorization": `Bearer ${localStorage.getItem('token')}` },
            body: formData
          })
          if (!res.ok) throw new Error("Upload failed")
          const data = await res.json()
          
          if (activeConversation && isConnected && currentUser) {
            const receiverIds = activeConversation.participants
              .filter(p => p.user.id !== currentUser.id)
              .map(p => p.user.id)
            const targetUserId = receiverIds.length > 0 ? receiverIds[0] : undefined

            sendMessage('send_message', {
              conversation_id: activeConversation.id,
              content: `[🎤 Voice Message](${data.url})`
            }, targetUserId)
          }
        } catch (err) {
          alert("Failed to upload voice message.")
        }
        
        // Stop tracks
        stream.getTracks().forEach(track => track.stop())
      }

      recorder.start()
      setIsRecording(true)
    } catch (err) {
      console.error("Error accessing microphone", err)
      alert("Could not access microphone.")
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }

  const renderMessageContent = (content: string) => {
    return content.split('\n').map((line, idx) => {
      const trimmedLine = line.trim()
      const imgMatch = trimmedLine.match(/^!\[(.*?)\]\((.*?)\)$/)
      if (imgMatch) {
        return (
          <a key={idx} href={imgMatch[2]} target="_blank" rel="noopener noreferrer" className="block my-1">
            <img src={imgMatch[2]} alt={imgMatch[1]} className="max-w-full rounded-lg max-h-64 object-cover hover:opacity-90 transition cursor-pointer" />
          </a>
        )
      }
      const linkMatch = trimmedLine.match(/^\[(.*?)\]\((.*?)\)$/)
      if (linkMatch) {
        if (linkMatch[1] === '🎤 Voice Message') {
          return (
            <div key={idx} className="my-1">
              <audio controls src={linkMatch[2]} className="max-w-[200px] sm:max-w-[250px] h-10 outline-none" />
            </div>
          )
        }
        return (
          <a key={idx} href={linkMatch[2]} target="_blank" rel="noopener noreferrer" className="underline text-current opacity-90 hover:opacity-100 break-all block my-1 flex items-center gap-1">
            {linkMatch[1].startsWith('📎') ? null : '🔗'} {linkMatch[1]}
          </a>
        )
      }
      
      const parts = line.split(/(https?:\/\/[^\s]+)/g)
      return (
        <span key={idx} className="block break-words whitespace-pre-wrap">
          {parts.map((part, i) => {
            if (part.match(/^https?:\/\//)) {
              return <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="underline text-current opacity-90 hover:opacity-100 break-all">{part}</a>
            }
            return part
          })}
        </span>
      )
    })
  }

  const myPart = activeConversation?.participants.find(p => p.user.id === currentUser?.id)
  const isPinned = myPart?.is_pinned
  const partner = activeConversation?.participants.find(p => p.user.id !== currentUser?.id)?.user

  const pinChat = async () => {
    if (!activeConversation) return
    try {
      const res = await fetch(`/api/chats/${activeConversation.id}/pin`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      })
      const data = await res.json()
      if (data.status === 'success') {
        setConversations(conversations.map(c => {
          if (c.id === activeConversation.id) {
            const part = c.participants.find(p => p.user.id === currentUser?.id)
            if (part) part.is_pinned = data.is_pinned
          }
          return c
        }))
      }
    } catch (err) {
      console.error(err)
    } finally {
      setIsMenuOpen(false)
    }
  }

  const deleteChat = async () => {
    if (!activeConversation) return
    if (!window.confirm("Are you sure you want to delete this chat?")) return
    try {
      const res = await fetch(`/api/chats/${activeConversation.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      })
      if (res.ok) {
        setConversations(conversations.filter(c => c.id !== activeConversation.id))
        setActiveConversation(null)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setIsMenuOpen(false)
    }
  }

  useEffect(() => {
    if (!activeConversation) return

    // Fetch messages
    fetch(`/api/chats/${activeConversation.id}/messages`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setMessages(data)
        } else if (data.messages) {
          setMessages(data.messages)
        }
      })
      .catch(err => console.error(err))

  }, [activeConversation])

  useEffect(() => {
    if (!isConnected) return

    const unsub = subscribe('receive_message', (msg: Message) => {
      if (msg.conversation_id === activeConversation?.id) {
        setMessages(prev => [...prev, msg])
        // Mark as read immediately if we are viewing this chat
        if (msg.sender_id !== currentUser?.id && activeConversation?.id) {
          sendMessage('mark_read', { conversation_id: activeConversation.id })
        }
      }
    })

    const unsubRead = subscribe('messages_read', (data: any) => {
      if (data.conversation_id === activeConversation?.id) {
        setMessages(prev => prev.map(m => 
          m.sender_id !== data.read_by ? { ...m, is_read: true } : m
        ))
      }
    })

    return () => { unsub(); unsubRead() }
  }, [isConnected, activeConversation, subscribe, currentUser, sendMessage])

  useEffect(() => {
    // When opening a chat, mark messages as read
    if (activeConversation && isConnected) {
      sendMessage('mark_read', { conversation_id: activeConversation.id })
    }
  }, [activeConversation, isConnected, sendMessage])

  useEffect(() => {
    // Auto scroll to bottom
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const sendMessageToSocket = () => {
    if (!text.trim() || !activeConversation || !isConnected || !currentUser) return

    const receiverIds = activeConversation.participants
      .filter(p => p.user.id !== currentUser.id)
      .map(p => p.user.id)

    // For FastAPI backend we might send to multiple targets, but currently our backend supports target_user_id
    // If it's a direct message, receiverIds[0] is the target
    const targetUserId = receiverIds.length > 0 ? receiverIds[0] : undefined

    sendMessage('send_message', {
      conversation_id: activeConversation.id,
      content: text
    }, targetUserId)

    setText('')
  }

  if (!activeConversation) {
    return (
      <div className="hidden md:flex flex-1 flex-col items-center justify-center bg-[#faf9f8] dark:bg-[#11100f]">
        <div className="w-48 h-48 mb-6 opacity-20">
          <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
        </div>
        <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">Welcome to Skype</h2>
        <p className="text-sm text-gray-500 mt-2">Search for someone to start chatting</p>
      </div>
    )
  }

  return (
    <div className={`flex-1 flex-col bg-white dark:bg-[#11100f] ${!activeConversation ? 'hidden md:flex' : 'flex'} w-full md:w-auto`}>
      {/* Header */}
      <div className="h-16 px-4 md:px-6 flex items-center justify-between border-b border-gray-300 dark:border-gray-800 bg-[#f3f2f1] dark:bg-[#201f1e] shadow-md relative z-10">
        <div className="flex items-center gap-2 md:gap-3">
          <button 
            className="md:hidden p-2 -ml-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition"
            onClick={() => setActiveConversation(null)}
          >
            <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          </button>
          <div 
            className="flex items-center gap-3 cursor-pointer hover:bg-gray-200 dark:hover:bg-[#323130] p-1.5 rounded-xl transition"
            onClick={() => setIsProfileOpen(true)}
          >
            {partner?.avatar_url ? (
              <img src={partner.avatar_url} alt="avatar" className="w-10 h-10 rounded-full ring-2 ring-gray-100 dark:ring-gray-800" />
            ) : (
              <UserCircle className="w-10 h-10 text-gray-500" />
            )}
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-gray-900 dark:text-white">{partner?.username}</h2>
                {isPinned && <span className="text-[10px] text-[#0078d4]">📌</span>}
              </div>
              <p className="text-xs text-[#0078d4] font-medium">{partner?.status === 'ONLINE' ? 'Active now' : 'Offline'}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 relative">
          <button onClick={() => onStartCall(false)} className="p-2.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition text-[#0078d4] hover:text-[#005a9e]">
            <Phone className="w-5 h-5 fill-current" />
          </button>
          <button onClick={() => onStartCall(true)} className="p-2.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition text-[#0078d4] hover:text-[#005a9e]">
            <Video className="w-5 h-5 fill-current" />
          </button>
          <div className="relative">
            <button 
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-2.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition text-gray-600 dark:text-gray-300"
            >
              <MoreHorizontal className="w-5 h-5" />
            </button>
            
            {/* Context Menu Dropdown */}
            {isMenuOpen && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setIsMenuOpen(false)}
                />
                <div className="absolute right-0 top-12 z-50 w-40 bg-white dark:bg-[#201f1e] rounded-xl shadow-xl shadow-black/5 dark:shadow-black/20 border border-gray-100 dark:border-gray-800 py-2 transform transition-all origin-top-right overflow-hidden">
                  <button 
                    onClick={pinChat}
                    className="w-full text-left px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#323130] transition-colors"
                  >
                    {isPinned ? 'Unpin chat' : 'Pin chat'}
                  </button>
                  <div className="h-px bg-gray-100 dark:bg-gray-800 my-1"></div>
                  <button 
                    onClick={deleteChat}
                    className="w-full text-left px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    Delete chat
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
        {messages.map(msg => {
          const isMine = msg.sender_id === currentUser?.id
          return (
            <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[70%] flex gap-2 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
                {!isMine && (
                  <UserCircle className="w-8 h-8 text-gray-400 mt-auto flex-shrink-0" />
                )}
                <div className={`px-4 py-2.5 rounded-2xl relative ${isMine ? 'bg-[#0078d4] text-white rounded-br-sm' : 'bg-[#f3f2f1] dark:bg-[#201f1e] text-gray-900 dark:text-gray-100 rounded-bl-sm'}`}>
                  <div className="text-sm leading-relaxed pb-3">{renderMessageContent(msg.content)}</div>
                  <div className={`absolute bottom-1 right-2 flex items-center gap-1 text-[10px] ${isMine ? 'text-blue-100' : 'text-gray-500'}`}>
                    <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    {isMine && (
                      msg.is_read ? (
                        <CheckCheck className="w-3.5 h-3.5 text-[#47c6ff]" />
                      ) : (
                        <Check className="w-3 h-3 text-blue-200" />
                      )
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Input */}
      <div className="p-4 bg-white dark:bg-[#11100f] border-t border-gray-200 dark:border-gray-800 relative">
        {showEmoji && (
          <div className="absolute bottom-20 right-4 z-50 shadow-2xl rounded-lg overflow-hidden">
            <div className="fixed inset-0" onClick={() => setShowEmoji(false)}></div>
            <div className="relative z-50">
              <EmojiPicker onEmojiClick={onEmojiClick} theme={typeof window !== 'undefined' && document.documentElement.classList.contains('dark') ? 'dark' : 'light' as any} />
            </div>
          </div>
        )}
        <div className="flex items-end gap-2 bg-[#f3f2f1] dark:bg-[#201f1e] p-2 rounded-xl border border-transparent focus-within:border-[#0078d4] focus-within:bg-white dark:focus-within:bg-[#323130] transition">
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            className="hidden" 
          />
          <button onClick={() => fileInputRef.current?.click()} className="p-2 text-gray-500 hover:text-[#0078d4] transition">
            <Paperclip className="w-5 h-5" />
          </button>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                sendMessageToSocket()
              }
            }}
            placeholder="Type a message"
            className="flex-1 bg-transparent border-none outline-none resize-none max-h-32 text-sm text-gray-900 dark:text-white py-2 custom-scrollbar"
            rows={1}
          />
          <button onClick={() => setShowEmoji(!showEmoji)} className="p-2 text-gray-500 hover:text-[#0078d4] transition">
            <Smile className="w-5 h-5" />
          </button>
          <button 
            onClick={isRecording ? stopRecording : startRecording}
            className={`p-2 transition rounded-full ${isRecording ? 'text-red-500 bg-red-50 dark:bg-red-900/30 animate-pulse' : 'text-gray-500 hover:text-[#0078d4]'}`}
          >
            {isRecording ? <Square className="w-5 h-5 fill-current" /> : <Mic className="w-5 h-5" />}
          </button>
          
          <button 
            onClick={sendMessageToSocket}
            disabled={!text.trim() && !isRecording} 
            className="p-2 text-[#0078d4] disabled:text-gray-400 disabled:bg-transparent hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-full transition"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>

      {isProfileOpen && partner && (
        <ProfileModal 
          user={partner} 
          onClose={() => setIsProfileOpen(false)} 
          conversationId={activeConversation.id}
          onStartCall={onStartCall}
        />
      )}
    </div>
  )
}
