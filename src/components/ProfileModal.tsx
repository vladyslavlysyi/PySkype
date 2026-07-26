import React, { useState, useEffect } from 'react'
import { UserCircle, X, Mail, Info, Circle, Edit2, Check, Lock, User as UserIcon, Image as ImageIcon, MessageSquare, Phone, Video, Calendar, Image as LucideImage, File, Link as LinkIcon } from 'lucide-react'
import { User, useAppStore } from '@/store/useAppStore'

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
  const [activeTab, setActiveTab] = useState<'info' | 'media' | 'files' | 'links'>('info')
  const [messages, setMessages] = useState<Message[]>([])
  
  const [formData, setFormData] = useState({
    username: user.username || '',
    email: user.email || '',
    description: user.description || '',
    phone_number: user.phone_number || '',
    birthday: user.birthday || '',
    theme_color: user.theme_color || '',
    avatarUrl: user.avatar_url || '',
    password: ''
  })
  const [isLoading, setIsLoading] = useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsLoading(true)
    const fd = new FormData()
    fd.append("file", file)
    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "Authorization": `Bearer ${localStorage.getItem('token')}` },
        body: fd
      })
      if (res.ok) {
        const data = await res.json()
        setFormData({ ...formData, avatarUrl: data.url })
      }
    } catch (err) {
      console.error(err)
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
        theme_color: formData.theme_color
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

  messages.forEach(msg => {
    const lines = msg.content.split('\n')
    lines.forEach(line => {
      const imgMatch = line.match(/^!\[(.*?)\]\((.*?)\)$/)
      if (imgMatch) {
        mediaList.push({ name: imgMatch[1], url: imgMatch[2] })
        return
      }
      const linkMatch = line.match(/^\[(.*?)\]\((.*?)\)$/)
      if (linkMatch) {
        if (linkMatch[1].startsWith('📎 ')) {
          fileList.push({ name: linkMatch[1].replace('📎 ', ''), url: linkMatch[2] })
        } else {
          linkList.push({ name: linkMatch[1], url: linkMatch[2] })
        }
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
        
        {/* Header Background */}
        <div 
          className="h-28 w-full relative flex-shrink-0 transition-all duration-300"
          style={{ background: (isEditing ? formData.theme_color : user.theme_color) || 'linear-gradient(to right, #0078d4, #00bcf2)' }}
        >
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-2 bg-black/20 hover:bg-black/40 text-white rounded-full backdrop-blur-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          {isMe && !isEditing && (
            <button 
              onClick={() => setIsEditing(true)}
              className="absolute top-4 right-14 p-2 bg-black/20 hover:bg-black/40 text-white rounded-full backdrop-blur-md transition-colors flex items-center gap-2 px-4"
            >
              <Edit2 className="w-4 h-4" />
              <span className="text-sm font-medium">Edit</span>
            </button>
          )}
        </div>

        {/* Avatar (Outside scroll container to prevent clipping) */}
        <div className="absolute top-[64px] left-1/2 -translate-x-1/2 z-10 flex flex-col items-center">
          <div className="relative inline-block group">
            <div className="relative overflow-hidden rounded-full w-24 h-24 border-4 border-white dark:border-[#201f1e] bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
              {(isEditing ? formData.avatarUrl : user.avatar_url) ? (
                <img 
                  src={isEditing ? formData.avatarUrl : user.avatar_url} 
                  alt="avatar" 
                  className="w-full h-full object-cover bg-white dark:bg-gray-800" 
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

        {/* Scrollable Content */}
        <div className="pt-20 overflow-y-auto custom-scrollbar flex-1 flex flex-col">
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
              </div>
            </>
          ) : (
            <div className="p-6 space-y-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Edit Profile</h2>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Username</label>
                <div className="flex items-center gap-3 p-2 rounded-xl bg-gray-50 dark:bg-[#11100f] border border-gray-200 dark:border-gray-700 focus-within:border-[#0078d4] transition">
                  <UserIcon className="w-5 h-5 text-gray-400" />
                  <input 
                    type="text" 
                    value={formData.username}
                    onChange={e => setFormData({...formData, username: e.target.value})}
                    className="flex-1 bg-transparent border-none outline-none text-sm text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Phone Number</label>
                <div className="flex items-center gap-3 p-2 rounded-xl bg-gray-50 dark:bg-[#11100f] border border-gray-200 dark:border-gray-700 focus-within:border-[#0078d4] transition">
                  <Phone className="w-5 h-5 text-gray-400" />
                  <input 
                    type="tel" 
                    value={formData.phone_number}
                    placeholder="+380..."
                    onChange={e => setFormData({...formData, phone_number: e.target.value})}
                    className="flex-1 bg-transparent border-none outline-none text-sm text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Birthday</label>
                <div className="flex items-center gap-3 p-2 rounded-xl bg-gray-50 dark:bg-[#11100f] border border-gray-200 dark:border-gray-700 focus-within:border-[#0078d4] transition">
                  <Calendar className="w-5 h-5 text-gray-400" />
                  <input 
                    type="text" 
                    value={formData.birthday}
                    placeholder="e.g., Nov 24"
                    onChange={e => setFormData({...formData, birthday: e.target.value})}
                    className="flex-1 bg-transparent border-none outline-none text-sm text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Bio</label>
                <div className="flex items-start gap-3 p-2 rounded-xl bg-gray-50 dark:bg-[#11100f] border border-gray-200 dark:border-gray-700 focus-within:border-[#0078d4] transition">
                  <Info className="w-5 h-5 text-gray-400 mt-0.5" />
                  <textarea 
                    value={formData.description}
                    onChange={e => setFormData({...formData, description: e.target.value})}
                    rows={3}
                    placeholder="Tell us about yourself"
                    className="flex-1 bg-transparent border-none outline-none text-sm text-gray-900 dark:text-white resize-none custom-scrollbar"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Theme Color</label>
                <div className="flex flex-wrap gap-3">
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
                      className={`w-8 h-8 rounded-full border-2 transition-transform ${formData.theme_color === color || (!formData.theme_color && idx === 0) ? 'border-white dark:border-white scale-110 shadow-lg' : 'border-transparent hover:scale-105'}`}
                      style={{ background: color }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Email address</label>
                <div className="flex items-center gap-3 p-2 rounded-xl bg-gray-50 dark:bg-[#11100f] border border-gray-200 dark:border-gray-700 focus-within:border-[#0078d4] transition">
                  <Mail className="w-5 h-5 text-gray-400" />
                  <input 
                    type="email" 
                    value={formData.email}
                    onChange={e => setFormData({...formData, email: e.target.value})}
                    className="flex-1 bg-transparent border-none outline-none text-sm text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Change Password (optional)</label>
                <div className="flex items-center gap-3 p-2 rounded-xl bg-gray-50 dark:bg-[#11100f] border border-gray-200 dark:border-gray-700 focus-within:border-[#0078d4] transition">
                  <Lock className="w-5 h-5 text-gray-400" />
                  <input 
                    type="password"
                    placeholder="Leave blank to keep current"
                    value={formData.password}
                    onChange={e => setFormData({...formData, password: e.target.value})}
                    className="flex-1 bg-transparent border-none outline-none text-sm text-gray-900 dark:text-white"
                  />
                </div>
              </div>
              
              <div className="pt-4 flex gap-3 pb-6">
                <button 
                  onClick={() => setIsEditing(false)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#323130] transition"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSave}
                  disabled={isLoading}
                  className="flex-1 py-2.5 rounded-xl bg-[#0078d4] text-white font-medium hover:bg-[#005a9e] transition flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isLoading ? (
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Check className="w-4 h-4" /> Save
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
