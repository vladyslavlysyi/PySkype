import React, { useState, useEffect, useCallback } from 'react'
import { UserCircle, X, Mail, Info, Circle, Edit2, Check, Lock, User as UserIcon, Image as ImageIcon, MessageSquare, Phone, Video, Calendar, Image as LucideImage, File, Link as LinkIcon, Mic, ZoomIn, ZoomOut } from 'lucide-react'
import { User, useAppStore } from '@/store/useAppStore'
import { VoiceMessagePlayer } from './VoiceMessagePlayer'
import Cropper from 'react-easy-crop'
import getCroppedImg from '@/utils/cropImage'
import { predefinedBackgrounds } from '@/utils/backgrounds'

interface ProfileModalProps {
  user: User
  onClose: () => void
  isMe?: boolean
  conversationId?: string
  onStartCall?: (video: boolean) => void
}

interface Message {
  id: string
  content: string
}

export const ProfileModal = ({ user, onClose, isMe = false, conversationId, onStartCall }: ProfileModalProps) => {
  const { setCurrentUser } = useAppStore()
  const [isEditing, setIsEditing] = useState(false)
  const [activeTab, setActiveTab] = useState<'info' | 'media' | 'files' | 'links' | 'voice'>('info')
  const [messages, setMessages] = useState<Message[]>([])
  
  const [formData, setFormData] = useState({
    username: user.username || '',
    email: user.email || '',
    description: user.description || '',
    phone_number: user.phone_number || '',
    birthday: user.birthday || '',
    theme_color: user.theme_color || '',
    global_chat_bg: user.global_chat_bg || '',
    avatarUrl: user.avatar_url || '',
    password: ''
  })
  const [isLoading, setIsLoading] = useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  // Cropper states
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null)
  const [imageSrc, setImageSrc] = useState<string | null>(null)
  const [isCropping, setIsCropping] = useState(false)

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.addEventListener('load', () => {
      setImageSrc(reader.result?.toString() || null)
      setIsCropping(true)
    })
    reader.readAsDataURL(file)
  }

  const onCropComplete = useCallback((croppedArea: any, croppedAreaPx: any) => {
    setCroppedAreaPixels(croppedAreaPx)
  }, [])

  const handleCropSave = async () => {
    if (!imageSrc || !croppedAreaPixels) return
    setIsLoading(true)
    try {
      const croppedImageBlob = await getCroppedImg(imageSrc, croppedAreaPixels, 0)
      const fd = new FormData()
      fd.append("file", croppedImageBlob, "avatar.jpg")
      
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "Authorization": `Bearer ${localStorage.getItem('token')}` },
        body: fd
      })
      if (res.ok) {
        const data = await res.json()
        setFormData({ ...formData, avatarUrl: data.url })
        setIsCropping(false)
        setImageSrc(null)
      } else {
        const errText = await res.text()
        alert("Upload failed: " + errText)
      }
    } catch (err: any) {
      console.error(err)
      alert("Error: " + err.message)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (conversationId) {
      fetch(`/api/chats/${conversationId}/messages`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setMessages(data)
        else if (data.messages) setMessages(data.messages)
      })
      .catch(err => console.error(err))
    }
  }, [conversationId])

  const getStatusText = (status: string) => {
    switch (status) {
      case 'ONLINE': return 'Active now'
      case 'AWAY': return 'Away'
      case 'DO_NOT_DISTURB': return 'Do not disturb'
      default: return 'Offline'
    }
  }
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ONLINE': return 'text-green-500'
      case 'AWAY': return 'text-yellow-500'
      case 'DO_NOT_DISTURB': return 'text-red-500'
      default: return 'text-gray-400'
    }
  }

  const handleSave = async () => {
    setIsLoading(true)
    try {
      const payload: any = {
        username: formData.username,
        description: formData.description,
        phone_number: formData.phone_number,
        birthday: formData.birthday,
        theme_color: formData.theme_color,
        global_chat_bg: formData.global_chat_bg
      }
      
      if (formData.email) payload.email = formData.email
      if (formData.avatarUrl) payload.avatar_url = formData.avatarUrl
      if (formData.password) payload.password = formData.password
      
      const res = await fetch('/api/users/me', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(payload)
      })
      
      if (res.ok) {
        const updatedUser = await res.json()
        setCurrentUser(updatedUser)
        setIsEditing(false)
      } else {
        console.error("Failed to update profile")
      }
    } catch (err) {
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  // Parse media, files, links from messages
  const mediaList: { url: string, name: string }[] = []
  const fileList: { url: string, name: string }[] = []
  const linkList: { url: string, name: string }[] = []
  const voiceList: { url: string, date?: string }[] = []

  messages.forEach(msg => {
    const lines = msg.content.split('\n')
    lines.forEach(line => {
      const trimmedLine = line.trim()
      const imgMatch = trimmedLine.match(/^!\[(.*?)\]\((.*?)\)$/)
      if (imgMatch) {
        mediaList.push({ name: imgMatch[1], url: imgMatch[2] })
        return
      }
      const linkMatch = trimmedLine.match(/^\[(.*?)\]\((.*?)\)$/)
      if (linkMatch) {
        if (linkMatch[1] === '🎤 Voice Message') {
          voiceList.push({ url: linkMatch[2] })
        } else if (linkMatch[1].startsWith('📎 ')) {
          fileList.push({ name: linkMatch[1].replace('📎 ', ''), url: linkMatch[2] })
        } else {
          linkList.push({ name: linkMatch[1], url: linkMatch[2] })
        }
        return
      }
      
      const rawUrlMatches = line.match(/(https?:\/\/[^\s]+)/g)
      if (rawUrlMatches) {
        rawUrlMatches.forEach(url => {
          linkList.push({ name: url, url: url })
        })
      }
    })
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white dark:bg-[#201f1e] w-full max-w-[400px] h-[90vh] md:h-auto md:max-h-[85vh] rounded-2xl shadow-2xl overflow-hidden transform transition-all flex flex-col">
        
        {/* Sticky Header Buttons */}
        <div className="absolute top-4 right-4 z-20 flex gap-2">
          {isMe && !isEditing && (
            <button 
              onClick={() => setIsEditing(true)}
              className="p-2 bg-black/20 hover:bg-black/40 text-white rounded-full backdrop-blur-md transition-colors flex items-center gap-2 px-4"
            >
              <Edit2 className="w-4 h-4" />
              <span className="text-sm font-medium">Edit</span>
            </button>
          )}
          <button 
            onClick={onClose}
            className="p-2 bg-black/20 hover:bg-black/40 text-white rounded-full backdrop-blur-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto custom-scrollbar flex-1 flex flex-col relative">
          
          {/* Header Background (Scrolls with content) */}
          <div 
            className="h-32 w-full flex-shrink-0 transition-all duration-300"
            style={{ background: (isEditing ? formData.theme_color : user.theme_color) || 'linear-gradient(to right, #0078d4, #00bcf2)' }}
          />

          {/* Avatar (Scrolls with content) */}
          <div className="absolute top-[64px] left-1/2 -translate-x-1/2 z-10 flex flex-col items-center">
            <div className="relative inline-block group">
              <div className="relative overflow-hidden rounded-full w-24 h-24 border-4 border-white dark:bg-[#201f1e] dark:border-[#201f1e] bg-gray-100 flex items-center justify-center">
                {(isEditing ? formData.avatarUrl : user.avatar_url) ? (
                  <img 
                    src={(isEditing ? formData.avatarUrl : user.avatar_url) || undefined} 
                    alt="avatar" 
                    className="w-full h-full object-cover bg-white dark:bg-[#201f1e]" 
                  />
                ) : (
                  <UserCircle className="w-16 h-16 text-gray-400" />
                )}
                {isEditing && (
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute inset-0 bg-black/40 flex items-center justify-center cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Edit2 className="w-6 h-6 text-white" />
                  </div>
                )}
              </div>
              {!isEditing && <div className={`absolute bottom-1 right-1 w-5 h-5 rounded-full border-2 border-white dark:border-[#201f1e] bg-current ${getStatusColor(user.status)}`} />}
              <input type="file" ref={fileInputRef} onChange={handleAvatarUpload} className="hidden" accept="image/*" />
            </div>
          </div>

          <div className="pt-16 flex-1 flex flex-col bg-white dark:bg-[#201f1e]">
          {!isEditing ? (
            <>
              {/* Profile Details */}
              <div className="flex flex-col items-center px-6 pb-6 border-b border-gray-100 dark:border-gray-800">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {user.username}
                </h2>
                <span className="text-sm font-medium text-gray-500 dark:text-gray-400 mt-1">
                  {getStatusText(user.status)}
                </span>


                {/* Quick Actions */}
                {!isMe && (
                  <div className="flex gap-4 mt-6">
                    <button onClick={onClose} className="flex flex-col items-center justify-center gap-1 group">
                      <div className="w-12 h-12 rounded-full bg-[#f3f2f1] dark:bg-[#323130] flex items-center justify-center group-hover:bg-[#0078d4] transition-colors text-gray-700 dark:text-gray-300 group-hover:text-white">
                        <MessageSquare className="w-5 h-5 fill-current" />
                      </div>
                      <span className="text-xs font-medium text-gray-600 dark:text-gray-400 group-hover:text-[#0078d4]">Message</span>
                    </button>
                    <button onClick={() => { if (onStartCall) onStartCall(false); onClose(); }} className="flex flex-col items-center justify-center gap-1 group">
                      <div className="w-12 h-12 rounded-full bg-[#f3f2f1] dark:bg-[#323130] flex items-center justify-center group-hover:bg-[#0078d4] transition-colors text-gray-700 dark:text-gray-300 group-hover:text-white">
                        <Phone className="w-5 h-5 fill-current" />
                      </div>
                      <span className="text-xs font-medium text-gray-600 dark:text-gray-400 group-hover:text-[#0078d4]">Call</span>
                    </button>
                    <button onClick={() => { if (onStartCall) onStartCall(true); onClose(); }} className="flex flex-col items-center justify-center gap-1 group">
                      <div className="w-12 h-12 rounded-full bg-[#f3f2f1] dark:bg-[#323130] flex items-center justify-center group-hover:bg-[#0078d4] transition-colors text-gray-700 dark:text-gray-300 group-hover:text-white">
                        <Video className="w-5 h-5 fill-current" />
                      </div>
                      <span className="text-xs font-medium text-gray-600 dark:text-gray-400 group-hover:text-[#0078d4]">Video</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Tabs */}
              <div className="flex px-4 border-b border-gray-100 dark:border-gray-800">
                <button 
                  onClick={() => setActiveTab('info')}
                  className={`flex-1 py-3 text-sm font-semibold transition-colors border-b-2 ${activeTab === 'info' ? 'border-[#0078d4] text-[#0078d4]' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                >
                  Info
                </button>
                {conversationId && (
                  <>
                    <button 
                      onClick={() => setActiveTab('media')}
                      className={`flex-1 py-3 text-sm font-semibold transition-colors border-b-2 flex items-center justify-center gap-1 ${activeTab === 'media' ? 'border-[#0078d4] text-[#0078d4]' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                    >
                      Media {mediaList.length > 0 && <span className="bg-gray-100 dark:bg-gray-800 text-xs px-1.5 py-0.5 rounded-md text-gray-500">{mediaList.length}</span>}
                    </button>
                    <button 
                      onClick={() => setActiveTab('files')}
                      className={`flex-1 py-3 text-sm font-semibold transition-colors border-b-2 flex items-center justify-center gap-1 ${activeTab === 'files' ? 'border-[#0078d4] text-[#0078d4]' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                    >
                      Files {fileList.length > 0 && <span className="bg-gray-100 dark:bg-gray-800 text-xs px-1.5 py-0.5 rounded-md text-gray-500">{fileList.length}</span>}
                    </button>
                    <button 
                      onClick={() => setActiveTab('links')}
                      className={`flex-1 py-3 text-sm font-semibold transition-colors border-b-2 flex items-center justify-center gap-1 ${activeTab === 'links' ? 'border-[#0078d4] text-[#0078d4]' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                    >
                      Links {linkList.length > 0 && <span className="bg-gray-100 dark:bg-gray-800 text-xs px-1.5 py-0.5 rounded-md text-gray-500">{linkList.length}</span>}
                    </button>
                    <button 
                      onClick={() => setActiveTab('voice')}
                      className={`flex-1 py-3 text-sm font-semibold transition-colors border-b-2 flex items-center justify-center gap-1 ${activeTab === 'voice' ? 'border-[#0078d4] text-[#0078d4]' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                    >
                      Voice {voiceList.length > 0 && <span className="bg-gray-100 dark:bg-gray-800 text-xs px-1.5 py-0.5 rounded-md text-gray-500">{voiceList.length}</span>}
                    </button>
                  </>
                )}
              </div>

              {/* Tab Content */}
              <div className="flex-1 p-6">
                {activeTab === 'info' && (
                  <div className="space-y-5">
                    {user.phone_number && (
                      <div className="flex items-center gap-4">
                        <Phone className="w-5 h-5 text-[#0078d4]" />
                        <div>
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">{user.phone_number}</p>
                          <p className="text-xs text-gray-500">Mobile</p>
                        </div>
                      </div>
                    )}
                    
                    <div className="flex items-center gap-4">
                      <UserIcon className="w-5 h-5 text-[#0078d4]" />
                      <div>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">@{user.username.toLowerCase().replace(/\s+/g, '_')}</p>
                        <p className="text-xs text-gray-500">Username</p>
                      </div>
                    </div>

                    {user.birthday && (
                      <div className="flex items-center gap-4">
                        <Calendar className="w-5 h-5 text-[#0078d4]" />
                        <div>
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">{user.birthday}</p>
                          <p className="text-xs text-gray-500">Birthday</p>
                        </div>
                      </div>
                    )}

                    {user.description && (
                      <div className="flex items-start gap-4">
                        <Info className="w-5 h-5 text-[#0078d4] mt-0.5" />
                        <div>
                          <p className="text-sm font-semibold text-gray-900 dark:text-white whitespace-pre-wrap">{user.description}</p>
                          <p className="text-xs text-gray-500">About</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'media' && (
                  <div>
                    {mediaList.length > 0 ? (
                      <div className="grid grid-cols-3 gap-2">
                        {mediaList.map((m, i) => (
                          <a key={i} href={m.url} target="_blank" rel="noopener noreferrer" className="aspect-square bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden group">
                            <img src={m.url} alt={m.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                          </a>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center text-gray-500 py-10">
                        <LucideImage className="w-12 h-12 mb-3 opacity-20" />
                        <p className="text-sm">No media shared yet</p>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'files' && (
                  <div className="space-y-3">
                    {fileList.length > 0 ? (
                      fileList.map((f, i) => (
                        <a key={i} href={f.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-[#11100f] hover:bg-gray-100 dark:hover:bg-[#323130] transition border border-gray-100 dark:border-gray-800 group">
                          <div className="w-10 h-10 rounded-lg bg-[#0078d4]/10 flex items-center justify-center text-[#0078d4] group-hover:bg-[#0078d4] group-hover:text-white transition">
                            <File className="w-5 h-5" />
                          </div>
                          <span className="text-sm font-medium text-gray-900 dark:text-white truncate flex-1">{f.name}</span>
                        </a>
                      ))
                    ) : (
                      <div className="flex flex-col items-center justify-center text-gray-500 py-10">
                        <File className="w-12 h-12 mb-3 opacity-20" />
                        <p className="text-sm">No files shared yet</p>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'links' && (
                  <div className="space-y-3">
                    {linkList.length > 0 ? (
                      linkList.map((l, i) => (
                        <a key={i} href={l.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-[#11100f] hover:bg-gray-100 dark:hover:bg-[#323130] transition border border-gray-100 dark:border-gray-800 group">
                          <div className="w-10 h-10 rounded-lg bg-[#0078d4]/10 flex items-center justify-center text-[#0078d4] group-hover:bg-[#0078d4] group-hover:text-white transition">
                            <LinkIcon className="w-5 h-5" />
                          </div>
                          <span className="text-sm font-medium text-[#0078d4] truncate flex-1 hover:underline">{l.url}</span>
                        </a>
                      ))
                    ) : (
                      <div className="flex flex-col items-center justify-center text-gray-500 py-10">
                        <LinkIcon className="w-12 h-12 mb-3 opacity-20" />
                        <p className="text-sm">No links shared yet</p>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'voice' && (
                  <div className="space-y-4">
                    {voiceList.length > 0 ? (
                      voiceList.map((v, i) => (
                        <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-[#0078d4] shadow-sm">
                          <VoiceMessagePlayer src={v.url} />
                        </div>
                      ))
                    ) : (
                      <div className="flex flex-col items-center justify-center text-gray-500 py-10">
                        <Mic className="w-12 h-12 mb-3 opacity-20" />
                        <p className="text-sm">No voice messages yet</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="p-6 flex flex-col gap-6">
              <div className="text-center pb-2 border-b border-gray-100 dark:border-gray-800">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Edit Profile</h2>
                <p className="text-xs text-gray-500 mt-1">Update your personal details</p>
              </div>

              {/* Inputs block */}
              <div className="bg-white dark:bg-[#201f1e] rounded-2xl shadow-sm overflow-hidden border border-gray-100 dark:border-gray-800 space-y-1">
                  {/* Username */}
                  <div className="group flex items-center gap-4 px-4 py-3 border-b border-gray-100 dark:border-gray-800 focus-within:bg-gray-50 dark:focus-within:bg-[#323130] transition-colors">
                    <UserIcon className="w-6 h-6 text-gray-400 group-focus-within:text-[#0078d4] transition-colors flex-shrink-0" />
                    <div className="flex-1 flex flex-col justify-center">
                      <label className="text-[11px] uppercase font-bold text-gray-400 tracking-wider mb-0.5">Username</label>
                      <input 
                        type="text" 
                        value={formData.username}
                        onChange={e => setFormData({...formData, username: e.target.value})}
                        className="w-full bg-transparent border-none outline-none text-base font-medium text-gray-900 dark:text-white p-0"
                      />
                    </div>
                  </div>
                  
                  {/* Phone */}
                  <div className="group flex items-center gap-4 px-4 py-3 border-b border-gray-100 dark:border-gray-800 focus-within:bg-gray-50 dark:focus-within:bg-[#323130] transition-colors">
                    <Phone className="w-6 h-6 text-gray-400 group-focus-within:text-[#0078d4] transition-colors flex-shrink-0" />
                    <div className="flex-1 flex flex-col justify-center">
                      <label className="text-[11px] uppercase font-bold text-gray-400 tracking-wider mb-0.5">Phone</label>
                      <input 
                        type="tel" 
                        value={formData.phone_number}
                        placeholder="+380..."
                        onChange={e => setFormData({...formData, phone_number: e.target.value})}
                        className="w-full bg-transparent border-none outline-none text-base font-medium text-gray-900 dark:text-white p-0"
                      />
                    </div>
                  </div>

                  {/* Birthday */}
                  <div className="group flex items-center gap-4 px-4 py-3 border-b border-gray-100 dark:border-gray-800 focus-within:bg-gray-50 dark:focus-within:bg-[#323130] transition-colors">
                    <Calendar className="w-6 h-6 text-gray-400 group-focus-within:text-[#0078d4] transition-colors flex-shrink-0" />
                    <div className="flex-1 flex flex-col justify-center">
                      <label className="text-[11px] uppercase font-bold text-gray-400 tracking-wider mb-0.5">Birthday</label>
                      <input 
                        type="text" 
                        value={formData.birthday}
                        placeholder="e.g., Nov 24"
                        onChange={e => setFormData({...formData, birthday: e.target.value})}
                        className="w-full bg-transparent border-none outline-none text-base font-medium text-gray-900 dark:text-white p-0"
                      />
                    </div>
                  </div>
                  
                  {/* Bio */}
                  <div className="group flex items-start gap-4 px-4 py-3 focus-within:bg-gray-50 dark:focus-within:bg-[#323130] transition-colors">
                    <Info className="w-6 h-6 text-gray-400 group-focus-within:text-[#0078d4] transition-colors mt-2 flex-shrink-0" />
                    <div className="flex-1 flex flex-col justify-center">
                      <label className="text-[11px] uppercase font-bold text-gray-400 tracking-wider mb-0.5">Bio</label>
                      <textarea 
                        value={formData.description}
                        onChange={e => setFormData({...formData, description: e.target.value})}
                        rows={2}
                        placeholder="Tell us about yourself"
                        className="w-full bg-transparent border-none outline-none text-base font-medium text-gray-900 dark:text-white p-0 resize-none custom-scrollbar"
                      />
                    </div>
                  </div>
                </div>

                {/* Theme Color Picker */}
                <div className="bg-white dark:bg-[#201f1e] rounded-2xl shadow-sm overflow-hidden border border-gray-100 dark:border-gray-800 p-4">
                  <label className="text-[11px] uppercase font-bold text-gray-400 tracking-wider block mb-3 pl-2">Theme Color</label>
                  <div className="flex flex-wrap gap-3 pl-2">
                    {[
                      'linear-gradient(to right, #0078d4, #00bcf2)',
                      'linear-gradient(to right, #8a2be2, #4b0082)',
                      'linear-gradient(to right, #ff7e5f, #feb47b)',
                      'linear-gradient(to right, #00b4db, #0083b0)',
                      'linear-gradient(to right, #11998e, #38ef7d)',
                      'linear-gradient(to right, #333333, #000000)',
                    ].map((color, idx) => (
                      <button
                        key={idx}
                        onClick={() => setFormData({...formData, theme_color: color})}
                        className={`w-10 h-10 rounded-full transition-all ${formData.theme_color === color || (!formData.theme_color && idx === 0) ? 'ring-2 ring-offset-2 ring-offset-white dark:ring-offset-[#201f1e] ring-[#0078d4] scale-110 shadow-md' : 'hover:scale-105 opacity-80 hover:opacity-100'}`}
                        style={{ background: color }}
                      />
                    ))}
                  </div>
                </div>

                {/* Global Chat Background Picker */}
                <div className="bg-white dark:bg-[#201f1e] rounded-2xl shadow-sm overflow-hidden border border-gray-100 dark:border-gray-800 p-4">
                  <label className="text-[11px] uppercase font-bold text-gray-400 tracking-wider block mb-3 pl-2 flex justify-between items-center">
                    Global Chat Background
                    <label className="cursor-pointer text-[#0078d4] hover:underline flex items-center gap-1 normal-case text-xs">
                      <LucideImage className="w-3 h-3" /> Upload custom
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0]
                          if (!file) return
                          setIsLoading(true)
                          try {
                            const fd = new FormData()
                            fd.append("file", file)
                            const res = await fetch("/api/upload", {
                              method: "POST",
                              headers: { "Authorization": `Bearer ${localStorage.getItem('token')}` },
                              body: fd
                            })
                            if (res.ok) {
                              const data = await res.json()
                              setFormData({...formData, global_chat_bg: data.url})
                            }
                          } catch (err) {
                            console.error(err)
                          } finally {
                            setIsLoading(false)
                          }
                        }}
                      />
                    </label>
                  </label>
                  <div className="grid grid-cols-4 gap-2 pl-2">
                    {/* Default (null) option */}
                    <button
                      onClick={() => setFormData({...formData, global_chat_bg: ''})}
                      className={`aspect-[3/4] rounded-lg border-2 overflow-hidden flex items-center justify-center transition-all ${!formData.global_chat_bg ? 'border-[#0078d4] shadow-md' : 'border-transparent opacity-80 hover:opacity-100'}`}
                      style={{ background: 'var(--bg-chat)' }} // Use standard default chat bg
                    >
                      <span className="text-[10px] text-gray-500 font-medium">Default</span>
                    </button>
                    {predefinedBackgrounds.map((bg, idx) => (
                      <button
                        key={idx}
                        onClick={() => setFormData({...formData, global_chat_bg: bg})}
                        className={`aspect-[3/4] rounded-lg border-2 overflow-hidden flex items-center justify-center transition-all ${formData.global_chat_bg === bg ? 'border-[#0078d4] shadow-md scale-105' : 'border-transparent opacity-80 hover:opacity-100 hover:scale-105'}`}
                        style={{ 
                          backgroundImage: bg.startsWith('http') || bg.startsWith('/') || bg.startsWith('data:') ? `url(${bg})` : bg,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center'
                        }}
                      />
                    ))}
                  </div>
                </div>

                {/* Auth Details */}
                <div className="bg-white dark:bg-[#201f1e] rounded-2xl shadow-sm overflow-hidden border border-gray-100 dark:border-gray-800 space-y-1">
                  {/* Email */}
                  <div className="group flex items-center gap-4 px-4 py-3 border-b border-gray-100 dark:border-gray-800 focus-within:bg-gray-50 dark:focus-within:bg-[#323130] transition-colors">
                    <Mail className="w-6 h-6 text-gray-400 group-focus-within:text-[#0078d4] transition-colors flex-shrink-0" />
                    <div className="flex-1 flex flex-col justify-center">
                      <label className="text-[11px] uppercase font-bold text-gray-400 tracking-wider mb-0.5">Email address</label>
                      <input 
                        type="email" 
                        value={formData.email}
                        onChange={e => setFormData({...formData, email: e.target.value})}
                        className="w-full bg-transparent border-none outline-none text-base font-medium text-gray-900 dark:text-white p-0"
                      />
                    </div>
                  </div>
                  {/* Password */}
                  <div className="group flex items-center gap-4 px-4 py-3 focus-within:bg-gray-50 dark:focus-within:bg-[#323130] transition-colors">
                    <Lock className="w-6 h-6 text-gray-400 group-focus-within:text-[#0078d4] transition-colors flex-shrink-0" />
                    <div className="flex-1 flex flex-col justify-center">
                      <label className="text-[11px] uppercase font-bold text-gray-400 tracking-wider mb-0.5">Change Password</label>
                      <input 
                        type="password"
                        placeholder="Leave blank to keep current"
                        value={formData.password}
                        onChange={e => setFormData({...formData, password: e.target.value})}
                        className="w-full bg-transparent border-none outline-none text-base font-medium text-gray-900 dark:text-white p-0"
                      />
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex gap-3 mt-4">
                <button 
                  onClick={() => setIsEditing(false)}
                  className="flex-1 py-3 rounded-xl font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#323130] transition"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSave} 
                  disabled={isLoading}
                  className="flex-1 py-3 rounded-xl bg-[#0078d4] text-white font-medium hover:bg-[#005a9e] transition flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
                >
                  {isLoading ? (
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Check className="w-5 h-5" /> Save Changes
                    </>
                  )}
                </button>
              </div>
            </>
          )}
          </div>
        </div>

        {isCropping && imageSrc && (
          <div className="absolute inset-0 z-50 bg-black flex flex-col rounded-2xl overflow-hidden">
            <div className="flex-1 relative">
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onCropComplete={onCropComplete}
                onZoomChange={setZoom}
              />
            </div>
            <div className="p-6 bg-[#201f1e] flex flex-col gap-4 border-t border-gray-800">
              <div className="flex items-center gap-4">
                <ZoomOut className="w-5 h-5 text-gray-400" />
                <input
                  type="range"
                  value={zoom}
                  min={1}
                  max={3}
                  step={0.1}
                  aria-labelledby="Zoom"
                  onChange={(e) => {
                    setZoom(Number(e.target.value))
                  }}
                  className="flex-1 accent-[#0078d4]"
                />
                <ZoomIn className="w-5 h-5 text-gray-400" />
              </div>
              <div className="flex justify-end gap-3">
                <button 
                  onClick={() => {
                    setIsCropping(false)
                    setImageSrc(null)
                    if (fileInputRef.current) fileInputRef.current.value = ''
                  }}
                  className="px-4 py-2 text-white hover:bg-white/10 rounded-lg transition"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleCropSave}
                  disabled={isLoading}
                  className="px-6 py-2 bg-[#0078d4] hover:bg-[#005a9e] text-white rounded-lg transition flex items-center justify-center min-w-[100px]"
                >
                  {isLoading ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Apply'}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
