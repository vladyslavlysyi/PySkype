'use client'

import React, { useEffect, useState, useRef } from 'react'
import { Phone, Video as VideoIcon, MoreHorizontal, Send, Smile, Paperclip, UserCircle, ArrowLeft, Mic, Check, CheckCheck, Square, Camera, Trash2 } from 'lucide-react'
import { useAppStore, Message } from '@/store/useAppStore'
import { useWebSocket } from '@/contexts/WebSocketContext'
import { getAuthHeaders } from '@/lib/csrf'
import { ProfileModal } from './ProfileModal'
import EmojiPicker from 'emoji-picker-react'
import { VoiceMessagePlayer } from './VoiceMessagePlayer'
import { VideoMessagePlayer } from './VideoMessagePlayer'
import { DeleteMessageModal } from './DeleteMessageModal'
import { predefinedBackgrounds } from '@/utils/backgrounds'

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
  const [isRecordingVideo, setIsRecordingVideo] = useState(false)
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null)
  const videoPreviewRef = useRef<HTMLVideoElement>(null)
  const [isBgPickerOpen, setIsBgPickerOpen] = useState(false)
  const [isUploadingBg, setIsUploadingBg] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  
  const [editingMessage, setEditingMessage] = useState<Message | null>(null)
  const [replyingToMessage, setReplyingToMessage] = useState<Message | null>(null)

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
        headers: getAuthHeaders(),
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
            headers: getAuthHeaders(),
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

  const startVideoRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: { ideal: 480 }, height: { ideal: 480 } }, 
        audio: true 
      })
      const recorder = new MediaRecorder(stream)
      mediaRecorderRef.current = recorder
      audioChunksRef.current = []
      
      setVideoStream(stream)

      recorder.ondataavailable = e => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data)
      }

      recorder.onstop = async () => {
        const videoBlob = new Blob(audioChunksRef.current, { type: 'video/webm' })
        const file = new File([videoBlob], 'video_message.webm', { type: 'video/webm' })
        
        const formData = new FormData()
        formData.append("file", file)
        try {
          const res = await fetch("/api/upload", {
            method: "POST",
            headers: getAuthHeaders(),
            body: formData
          })
          if (!res.ok) {
            const errText = await res.text()
            console.error("Upload failed with response:", errText)
            throw new Error("Upload failed: " + errText)
          }
          const data = await res.json()
          
          if (activeConversation && isConnected && currentUser) {
            const receiverIds = activeConversation.participants
              .filter(p => p.user.id !== currentUser.id)
              .map(p => p.user.id)
            const targetUserId = receiverIds.length > 0 ? receiverIds[0] : undefined

            sendMessage('send_message', {
              conversation_id: activeConversation.id,
              content: `[⭕ Video Message](${data.url})`
            }, targetUserId)
          }
        } catch (err: any) {
          console.error(err)
          alert("Failed to upload video message. " + (err.message || ""))
        }
        
        // Stop tracks
        stream.getTracks().forEach(track => track.stop())
        setVideoStream(null)
      }

      recorder.start()
      setIsRecordingVideo(true)
    } catch (err) {
      console.error("Error accessing camera/microphone", err)
      alert("Could not access camera/microphone.")
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }

  const stopVideoRecording = () => {
    if (mediaRecorderRef.current && isRecordingVideo) {
      mediaRecorderRef.current.stop()
      setIsRecordingVideo(false)
    }
  }

  const isSafeUrl = (url: string) => {
    const parsedUrl = url.trim().toLowerCase();
    if (parsedUrl.startsWith('javascript:') || parsedUrl.startsWith('data:') || parsedUrl.startsWith('vbscript:')) {
      return false;
    }
    return true;
  };

  const renderMessageContent = (content: string) => {
    return content.split('\n').map((line, idx) => {
      const trimmedLine = line.trim()
      const imgMatch = trimmedLine.match(/^!\[(.*?)\]\((.*?)\)$/)
      if (imgMatch) {
        const safeImgUrl = isSafeUrl(imgMatch[2]) ? imgMatch[2] : '#';
        return (
          <a key={idx} href={safeImgUrl} target="_blank" rel="noopener noreferrer" className="block my-1">
            <img src={safeImgUrl} alt={imgMatch[1]} className="max-w-full rounded-lg max-h-64 object-cover hover:opacity-90 transition cursor-pointer" />
          </a>
        )
      }
      const linkMatch = trimmedLine.match(/^\[(.*?)\]\((.*?)\)$/)
      if (linkMatch) {
        const safeUrl = isSafeUrl(linkMatch[2]) ? linkMatch[2] : '#';
        if (linkMatch[1] === '🎤 Voice Message') {
          return (
            <div key={idx} className="my-1">
              <VoiceMessagePlayer src={safeUrl} />
            </div>
          )
        } else if (linkMatch[1] === '⭕ Video Message' || linkMatch[1] === '🎥 Video Message') {
          return (
            <div key={idx} className="my-1">
              <VideoMessagePlayer src={safeUrl} />
            </div>
          )
        }
        return (
          <a key={idx} href={safeUrl} target="_blank" rel="noopener noreferrer" className="underline text-current opacity-90 hover:opacity-100 break-all block my-1 flex items-center gap-1">
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
        headers: getAuthHeaders()
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
        headers: getAuthHeaders()
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

  const changeChatBackground = async (bgUrl: string) => {
    if (!activeConversation) return
    setIsUploadingBg(true)
    try {
      const res = await fetch(`/api/chats/${activeConversation.id}/bg`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ chat_bg: bgUrl })
      })
      if (res.ok) {
        setConversations(conversations.map(c => {
          if (c.id === activeConversation.id) {
            const part = c.participants.find(p => p.user.id === currentUser?.id)
            if (part) part.chat_bg = bgUrl
          }
          return c
        }))
      }
    } catch (err) {
      console.error(err)
    } finally {
      setIsUploadingBg(false)
      setIsBgPickerOpen(false)
    }
  }

  useEffect(() => {
    if (!activeConversation) return

    // Fetch messages
    fetch(`/api/chats/${activeConversation.id}/messages`, {
      headers: getAuthHeaders()
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

    const unsubDelete = subscribe('messages_deleted', (data: any) => {
      if (data.conversation_id === activeConversation?.id) {
        setMessages(prev => prev.filter(m => !data.message_ids.includes(m.id)))
        // if currently selecting, remove deleted from selection
        setSelectedMessageIds(prev => {
          const newSet = new Set(prev)
          data.message_ids.forEach((id: string) => newSet.delete(id))
          return newSet
        })
      }
    })

    const unsubEdited = subscribe('message_edited', (msg: Message) => {
      if (msg.conversation_id === activeConversation?.id) {
        setMessages(prev => prev.map(m => m.id === msg.id ? msg : m))
      }
    })

    return () => { unsub(); unsubRead(); unsubDelete(); unsubEdited(); }
  }, [isConnected, activeConversation, subscribe, currentUser, sendMessage])

  const [activeMenuId, setActiveMenuId] = useState<string | null>(null)
  
  // Selection mode state
  const [isSelectionMode, setIsSelectionMode] = useState(false)
  const [selectedMessageIds, setSelectedMessageIds] = useState<Set<string>>(new Set())
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  const toggleSelection = (msgId: string) => {
    setSelectedMessageIds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(msgId)) {
        newSet.delete(msgId)
        if (newSet.size === 0) setIsSelectionMode(false)
      } else {
        newSet.add(msgId)
      }
      return newSet
    })
  }

  const handleDeleteSelected = (forEveryone: boolean) => {
    if (selectedMessageIds.size === 0) return
    sendMessage('delete_messages', { 
      message_ids: Array.from(selectedMessageIds), 
      for_everyone: forEveryone,
      conversation_id: activeConversation?.id 
    })
    
    // Optimistic UI update
    setMessages(prev => prev.filter(m => !selectedMessageIds.has(m.id)))
    setSelectedMessageIds(new Set())
    setIsSelectionMode(false)
    setShowDeleteModal(false)
  }

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

  const sendMessageToSocket = async () => {
    if (!text.trim()) return

    if (editingMessage) {
      try {
        const res = await fetch(`/api/messages/${editingMessage.id}`, {
          method: 'PATCH',
          headers: {
            ...getAuthHeaders(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ content: text.trim() })
        })
        if (res.ok) {
          setText('')
          setEditingMessage(null)
        }
      } catch (err) {
        console.error(err)
      }
      return
    }

    if (isConnected && activeConversation) {
      sendMessage("send_message", {
        conversation_id: activeConversation.id,
        content: text.trim(),
        reply_to_message_id: replyingToMessage ? replyingToMessage.id : null
      })
      setText('')
      setReplyingToMessage(null)
    }
  }

  const toggleReaction = async (messageId: string, emoji: string) => {
    try {
      await fetch(`/api/messages/${messageId}/reactions`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ emoji })
      })
    } catch (err) {
      console.error(err)
    }
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
              <button onClick={() => { if (onStartCall) onStartCall(false) }} className="p-2 text-gray-500 hover:text-[#0078d4] hover:bg-gray-100 dark:hover:bg-[#323130] rounded-full transition">
                <Phone className="w-5 h-5" />
              </button>
              <button onClick={() => { if (onStartCall) onStartCall(true) }} className="p-2 text-gray-500 hover:text-[#0078d4] hover:bg-gray-100 dark:hover:bg-[#323130] rounded-full transition">
                <VideoIcon className="w-5 h-5" />
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
                    onClick={() => { setIsMenuOpen(false); setIsBgPickerOpen(true); }}
                    className="w-full text-left px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#323130] transition-colors"
                  >
                    Change background
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

      {isBgPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={() => setIsBgPickerOpen(false)} />
          <div className="relative bg-white dark:bg-[#201f1e] w-full max-w-md rounded-2xl shadow-2xl p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Choose Chat Background</h3>
            <div className="grid grid-cols-4 gap-2 mb-6">
              <button
                onClick={() => changeChatBackground('')}
                className="aspect-[3/4] rounded-lg border-2 border-transparent bg-gray-100 dark:bg-gray-800 hover:opacity-80 flex items-center justify-center"
              >
                <span className="text-[10px] text-gray-500 font-medium">Clear</span>
              </button>
              {predefinedBackgrounds.map((bg, idx) => {
                const isUrl = bg.startsWith('http') || bg.startsWith('/') || bg.startsWith('data:')
                return (
                  <button
                    key={idx}
                    onClick={() => changeChatBackground(bg)}
                    className="aspect-[3/4] rounded-lg border-2 border-transparent hover:scale-105 transition-all overflow-hidden"
                    style={{ 
                      backgroundImage: isUrl ? `url(${bg})` : bg,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center'
                    }}
                  />
                )
              })}
            </div>
            
            <label className="w-full flex items-center justify-center gap-2 py-3 bg-[#0078d4] hover:bg-[#005a9e] text-white rounded-xl cursor-pointer transition font-medium">
              {isUploadingBg ? (
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>Upload custom photo</>
              )}
              <input 
                type="file" 
                accept="image/*" 
                className="hidden"
                disabled={isUploadingBg}
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  setIsUploadingBg(true)
                  try {
                    const fd = new FormData()
                    fd.append("file", file)
                    const res = await fetch("/api/upload", {
                      method: "POST",
                      headers: getAuthHeaders(),
                      body: fd
                    })
                    if (res.ok) {
                      const data = await res.json()
                      await changeChatBackground(data.url)
                    }
                  } catch (err) {
                    console.error(err)
                    setIsUploadingBg(false)
                  }
                }}
              />
            </label>
          </div>
        </div>
      )}

      {/* Messages */}
      <div 
        ref={scrollRef} 
        className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar chat-bg"
        style={{
          backgroundImage: (() => {
            const bg = myPart?.chat_bg || currentUser?.global_chat_bg
            if (!bg) return undefined
            return bg.startsWith('http') || bg.startsWith('/') || bg.startsWith('data:') ? `url(${bg})` : bg
          })(),
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: 'fixed'
        }}
      >
        {messages.map(msg => {
          const isMine = msg.sender_id === currentUser?.id
          const isSelected = selectedMessageIds.has(msg.id)
          
          return (
            <div 
              key={msg.id} 
              id={`msg-${msg.id}`}
              className={`flex items-center gap-3 w-full ${isMine ? 'justify-end' : 'justify-start'} ${isSelectionMode ? 'cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 -mx-2 px-2 rounded-xl transition-colors' : ''}`}
              onClick={() => {
                if (isSelectionMode) toggleSelection(msg.id)
              }}
            >
              {isSelectionMode && (
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${isSelected ? 'bg-[#0078d4] border-[#0078d4]' : 'border-gray-400 dark:border-gray-600'}`}>
                  {isSelected && <Check className="w-3 h-3 text-white" />}
                </div>
              )}
              
              <div className={`max-w-[70%] flex gap-2 ${isMine ? 'flex-row-reverse' : 'flex-row'} group`}>
                {!isMine && (
                  <UserCircle className="w-8 h-8 text-gray-400 mt-auto flex-shrink-0" />
                )}
                <div className={`px-4 py-2.5 rounded-2xl relative ${isMine ? 'bg-[#0078d4] text-white rounded-br-sm' : 'bg-[#f3f2f1] dark:bg-[#201f1e] text-gray-900 dark:text-gray-100 rounded-bl-sm'}`}>
                  {msg.reply_to_message && (
                    <div 
                      className={`mb-2 pl-2 border-l-2 text-sm cursor-pointer ${isMine ? 'border-white/50 bg-black/10' : 'border-[#0078d4] bg-black/5 dark:bg-white/5'} rounded-r p-1`}
                      onClick={(e) => {
                        e.stopPropagation();
                        document.getElementById(`msg-${msg.reply_to_message?.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                      }}
                    >
                      <span className="font-semibold opacity-80 text-xs">Reply</span>
                      <p className="truncate opacity-90 max-w-[200px]">{msg.reply_to_message.content}</p>
                    </div>
                  )}
                  <div className="text-sm leading-relaxed pb-3">{renderMessageContent(msg.content)}</div>
                  <div className={`absolute bottom-1 right-2 flex items-center gap-1 text-[10px] ${isMine ? 'text-blue-100' : 'text-gray-500'}`}>
                    {msg.is_edited && <span className="opacity-70">(edited)</span>}
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

                {/* Reactions Display */}
                {msg.reactions && msg.reactions.length > 0 && (
                  <div className={`absolute -bottom-3 flex flex-wrap gap-1 ${isMine ? 'right-4' : 'left-4'}`}>
                    {Array.from(new Set(msg.reactions.map(r => r.emoji))).map(emoji => {
                      const count = msg.reactions?.filter(r => r.emoji === emoji).length || 0;
                      const hasReacted = msg.reactions?.some(r => r.emoji === emoji && r.user_id === currentUser?.id);
                      return (
                        <button 
                          key={emoji}
                          onClick={(e) => { e.stopPropagation(); toggleReaction(msg.id, emoji); }}
                          className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full border ${hasReacted ? 'bg-blue-100 border-blue-300 dark:bg-blue-900/50 dark:border-blue-700' : 'bg-white border-gray-200 dark:bg-[#2d2c2c] dark:border-gray-700 shadow-sm'}`}
                        >
                          <span>{emoji}</span>
                          <span className={hasReacted ? 'text-blue-600 dark:text-blue-300' : 'text-gray-600 dark:text-gray-400'}>{count}</span>
                        </button>
                      )
                    })}
                  </div>
                )}

                {/* Message Actions Menu */}
                {!isSelectionMode && (
                  <div className="relative opacity-0 group-hover:opacity-100 transition-opacity flex items-center self-end pb-2">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenuId(activeMenuId === msg.id ? null : msg.id)
                      }}
                      className="p-1.5 text-gray-700 dark:text-gray-200 bg-white/80 dark:bg-black/60 hover:bg-white dark:hover:bg-black backdrop-blur-sm shadow-sm rounded-full border border-gray-200/50 dark:border-gray-700/50"
                    >
                      <MoreHorizontal className="w-5 h-5" />
                    </button>
                    
                    {activeMenuId === msg.id && (
                      <div className="absolute bottom-full mb-2 right-0 w-48 bg-white dark:bg-[#2d2c2c] rounded-xl shadow-[0_0_15px_rgba(0,0,0,0.1)] dark:shadow-[0_0_15px_rgba(0,0,0,0.3)] border border-gray-200 dark:border-gray-700 py-1 z-[100]">
                        <div className="flex justify-between px-2 py-2 border-b border-gray-100 dark:border-gray-700 mb-1">
                          {['👍', '❤️', '😂', '😮', '😢', '🔥'].map(emoji => (
                            <button 
                              key={emoji} 
                              onClick={(e) => { e.stopPropagation(); toggleReaction(msg.id, emoji); setActiveMenuId(null); }}
                              className="hover:scale-125 transition-transform"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                        <button  
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsSelectionMode(true);
                            setSelectedMessageIds(new Set([msg.id]));
                            setActiveMenuId(null);
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5 transition"
                        >
                          Select
                        </button>
                        {isMine && !msg.deleted_by && (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingMessage(msg);
                              setText(msg.content);
                              setActiveMenuId(null);
                            }}
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5 transition"
                          >
                            Edit
                          </button>
                        )}
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setReplyingToMessage(msg);
                            setActiveMenuId(null);
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5 transition"
                        >
                          Reply
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Selection Toolbar / Input */}
      <div className="p-4 bg-white dark:bg-[#11100f] border-t border-gray-200 dark:border-gray-800 relative">
        {isSelectionMode ? (
          <div className="flex items-center justify-between p-2">
            <button 
              onClick={() => {
                setIsSelectionMode(false)
                setSelectedMessageIds(new Set())
              }}
              className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition"
            >
              Cancel
            </button>
            
            <div className="text-sm font-semibold text-gray-900 dark:text-white">
              {selectedMessageIds.size} Selected
            </div>

            <button 
              onClick={() => setShowDeleteModal(true)}
              className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        ) : (
          <>
            {showEmoji && (
          <div className="absolute bottom-20 right-4 z-50 shadow-2xl rounded-lg overflow-hidden">
            <div className="fixed inset-0" onClick={() => setShowEmoji(false)}></div>
            <div className="relative z-50">
              <EmojiPicker onEmojiClick={onEmojiClick} theme={typeof window !== 'undefined' && document.documentElement.classList.contains('dark') ? 'dark' : 'light' as any} />
            </div>
          </div>
        )}
        
        {editingMessage && (
          <div className="flex items-center justify-between bg-blue-50/50 dark:bg-blue-900/20 px-4 py-2 text-sm text-blue-700 dark:text-blue-300 rounded-t-xl mx-2 border-b border-blue-200 dark:border-blue-800">
            <div className="flex items-center gap-2">
              <div className="w-1 h-8 bg-blue-500 rounded-full"></div>
              <div>
                <p className="font-semibold text-[#0078d4]">Edit Message</p>
                <p className="truncate opacity-80 max-w-[200px]">{editingMessage.content}</p>
              </div>
            </div>
            <button onClick={() => { setEditingMessage(null); setText('') }} className="p-1 hover:bg-black/5 dark:hover:bg-white/10 rounded-full"><Square className="w-4 h-4"/></button>
          </div>
        )}
        {replyingToMessage && !editingMessage && (
          <div className="flex items-center justify-between bg-gray-50/50 dark:bg-white/5 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 rounded-t-xl mx-2 border-b border-gray-200 dark:border-gray-800">
            <div className="flex items-center gap-2">
              <div className="w-1 h-8 bg-[#0078d4] rounded-full"></div>
              <div>
                <p className="font-semibold text-[#0078d4]">Reply to {replyingToMessage.sender?.username || 'User'}</p>
                <p className="truncate opacity-80 max-w-[200px]">{replyingToMessage.content}</p>
              </div>
            </div>
            <button onClick={() => setReplyingToMessage(null)} className="p-1 hover:bg-black/5 dark:hover:bg-white/10 rounded-full"><Square className="w-4 h-4"/></button>
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
          {!isRecordingVideo && (
            <button 
              onClick={isRecording ? stopRecording : startRecording}
              className={`p-2 transition rounded-full ${isRecording ? 'text-red-500 bg-red-50 dark:bg-red-900/30 animate-pulse' : 'text-gray-500 hover:text-[#0078d4]'}`}
            >
              {isRecording ? <Square className="w-5 h-5 fill-current" /> : <Mic className="w-5 h-5" />}
            </button>
          )}
          {!isRecording && (
            <button 
              onClick={isRecordingVideo ? stopVideoRecording : startVideoRecording}
              className={`p-2 transition rounded-full ${isRecordingVideo ? 'text-red-500 bg-red-50 dark:bg-red-900/30 animate-pulse' : 'text-gray-500 hover:text-[#0078d4]'}`}
            >
              {isRecordingVideo ? <Square className="w-5 h-5 fill-current" /> : <Camera className="w-5 h-5" />}
            </button>
          )}
          
          {isRecordingVideo && videoStream && (
            <div className="absolute bottom-20 right-4 w-32 h-32 rounded-full overflow-hidden border-4 border-red-500 shadow-xl bg-black z-50">
              <video 
                ref={el => { if (el && el.srcObject !== videoStream) el.srcObject = videoStream }} 
                className="w-full h-full object-cover" 
                autoPlay muted playsInline 
              />
            </div>
          )}

          <button 
            onClick={sendMessageToSocket}
            disabled={!text.trim() && !isRecording && !isRecordingVideo} 
            className="p-2 text-[#0078d4] disabled:text-gray-400 disabled:bg-transparent hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-full transition"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
        </>
        )}
      </div>

      {isProfileOpen && partner && (
        <ProfileModal 
          user={partner} 
          onClose={() => setIsProfileOpen(false)} 
          conversationId={activeConversation.id}
          onStartCall={onStartCall}
        />
      )}

      {showDeleteModal && (
        <DeleteMessageModal
          count={selectedMessageIds.size}
          hasOwnMessages={Array.from(selectedMessageIds).some(id => messages.find(m => m.id === id)?.sender_id === currentUser?.id)}
          onClose={() => setShowDeleteModal(false)}
          onConfirm={handleDeleteSelected}
        />
      )}
    </div>
  )
}
