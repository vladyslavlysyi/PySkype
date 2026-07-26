import React, { useState } from 'react'
import { UserCircle, X, Mail, Info, Circle, Edit2, Check, Lock, User as UserIcon, Image as ImageIcon, MessageSquare, BellOff, Phone, Video, Calendar, MoreHorizontal, Gift, Bookmark, Image as LucideImage, File, Headphones, Link as LinkIcon } from 'lucide-react'
import { User, useAppStore } from '@/store/useAppStore'

interface ProfileModalProps {
  user: User
  onClose: () => void
  isMe?: boolean
}

export const ProfileModal = ({ user, onClose, isMe = false }: ProfileModalProps) => {
  const { setCurrentUser } = useAppStore()
  const [isEditing, setIsEditing] = useState(false)
  const [activeTab, setActiveTab] = useState('media')
  
  const [formData, setFormData] = useState({
    username: user.username || '',
    email: user.email || '',
    description: user.description || '',
    phone_number: user.phone_number || '',
    birthday: user.birthday || '',
    avatarUrl: user.avatar_url || '',
    password: ''
  })
  const [isLoading, setIsLoading] = useState(false)

  const getStatusText = (status: string) => {
    switch (status) {
      case 'ONLINE': return 'last seen just now'
      case 'AWAY': return 'last seen recently'
      case 'DO_NOT_DISTURB': return 'do not disturb'
      default: return 'last seen a long time ago'
    }
  }

  const handleSave = async () => {
    setIsLoading(true)
    try {
      const payload: any = {
        username: formData.username,
        description: formData.description,
        phone_number: formData.phone_number,
        birthday: formData.birthday
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-4 bg-black/60 backdrop-blur-sm">
      {/* Backdrop */}
      <div 
        className="absolute inset-0"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-[#17212b] w-full h-full md:h-auto md:max-h-[90vh] md:max-w-[400px] md:rounded-2xl shadow-2xl flex flex-col overflow-hidden text-[#f5f5f5]">
        
        {/* Header Actions */}
        <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-10">
          <button 
            onClick={onClose}
            className="p-2 bg-black/20 hover:bg-black/40 rounded-full transition-colors"
          >
            <X className="w-6 h-6 text-white" />
          </button>
          
          <div className="flex gap-2">
            {isMe && !isEditing && (
              <button 
                onClick={() => setIsEditing(true)}
                className="p-2 bg-black/20 hover:bg-black/40 rounded-full transition-colors flex items-center gap-2 px-4"
              >
                <Edit2 className="w-4 h-4 text-white" />
                <span className="text-sm font-medium text-white">Edit</span>
              </button>
            )}
            <button className="p-2 bg-black/20 hover:bg-black/40 rounded-full transition-colors">
              <MoreHorizontal className="w-6 h-6 text-white" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {!isEditing ? (
            <>
              {/* Profile Header section */}
              <div className="flex flex-col items-center pt-10 pb-4">
                {user.avatar_url ? (
                  <img 
                    src={user.avatar_url} 
                    alt="avatar" 
                    className="w-24 h-24 rounded-full object-cover mb-3" 
                  />
                ) : (
                  <UserCircle className="w-24 h-24 text-gray-500 mb-3" />
                )}
                
                <h2 className="text-xl font-semibold text-white">
                  {user.username}
                </h2>
                
                <div className="flex items-center gap-1.5 mt-1 text-[#708499]">
                  {user.status === 'ONLINE' && <div className="w-3 h-3 bg-[#42a5f5] rounded-full flex items-center justify-center"><div className="w-1.5 h-1.5 bg-white rounded-full"></div></div>}
                  <span className="text-sm font-medium">
                    {getStatusText(user.status)}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-center gap-2 px-4 pb-4 border-b border-gray-800">
                <button className="flex flex-col items-center justify-center w-[72px] h-[64px] bg-[#232e3c] hover:bg-[#2b3a4a] rounded-2xl transition">
                  <MessageSquare className="w-6 h-6 mb-1 text-white" />
                  <span className="text-xs text-white">Message</span>
                </button>
                <button className="flex flex-col items-center justify-center w-[72px] h-[64px] bg-[#232e3c] hover:bg-[#2b3a4a] rounded-2xl transition">
                  <BellOff className="w-6 h-6 mb-1 text-white" />
                  <span className="text-xs text-white">Mute</span>
                </button>
                <button className="flex flex-col items-center justify-center w-[72px] h-[64px] bg-[#232e3c] hover:bg-[#2b3a4a] rounded-2xl transition">
                  <Phone className="w-6 h-6 mb-1 text-white" />
                  <span className="text-xs text-white">Call</span>
                </button>
                <button className="flex flex-col items-center justify-center w-[72px] h-[64px] bg-[#232e3c] hover:bg-[#2b3a4a] rounded-2xl transition">
                  <Video className="w-6 h-6 mb-1 text-white" />
                  <span className="text-xs text-white">Video</span>
                </button>
              </div>

              {/* Info Section */}
              <div className="p-4 space-y-5 border-b border-gray-800">
                {user.phone_number && (
                  <div>
                    <p className="text-[16px] text-white leading-tight">{user.phone_number}</p>
                    <p className="text-sm text-[#708499]">Mobile</p>
                  </div>
                )}
                
                {user.description && (
                  <div>
                    <p className="text-[16px] text-white leading-tight whitespace-pre-wrap">{user.description}</p>
                    <p className="text-sm text-[#708499]">Bio</p>
                  </div>
                )}

                <div>
                  <p className="text-[16px] text-[#42a5f5] leading-tight">@{user.username.toLowerCase().replace(/\s+/g, '_')}</p>
                  <p className="text-sm text-[#708499]">Username</p>
                </div>
                
                {user.birthday && (
                  <div>
                    <p className="text-[16px] text-white leading-tight">{user.birthday}</p>
                    <p className="text-sm text-[#708499]">Birthday</p>
                  </div>
                )}
              </div>

              {/* Mocked List / Tabs */}
              <div className="p-2 space-y-1">
                <div className="flex items-center gap-4 p-3 hover:bg-[#232e3c] rounded-xl cursor-pointer transition">
                  <Gift className="w-6 h-6 text-[#708499]" />
                  <span className="text-[15px] text-white">0 gifts 🎁</span>
                </div>
                <div className="flex items-center gap-4 p-3 hover:bg-[#232e3c] rounded-xl cursor-pointer transition">
                  <Bookmark className="w-6 h-6 text-[#708499]" />
                  <span className="text-[15px] text-white">0 saved messages</span>
                </div>
                <div className="flex items-center gap-4 p-3 hover:bg-[#232e3c] rounded-xl cursor-pointer transition">
                  <LucideImage className="w-6 h-6 text-[#708499]" />
                  <span className="text-[15px] text-white">0 photos</span>
                </div>
                <div className="flex items-center gap-4 p-3 hover:bg-[#232e3c] rounded-xl cursor-pointer transition">
                  <Video className="w-6 h-6 text-[#708499]" />
                  <span className="text-[15px] text-white">0 videos</span>
                </div>
                <div className="flex items-center gap-4 p-3 hover:bg-[#232e3c] rounded-xl cursor-pointer transition">
                  <File className="w-6 h-6 text-[#708499]" />
                  <span className="text-[15px] text-white">0 files</span>
                </div>
                <div className="flex items-center gap-4 p-3 hover:bg-[#232e3c] rounded-xl cursor-pointer transition">
                  <Headphones className="w-6 h-6 text-[#708499]" />
                  <span className="text-[15px] text-white">0 audio files</span>
                </div>
                <div className="flex items-center gap-4 p-3 hover:bg-[#232e3c] rounded-xl cursor-pointer transition">
                  <LinkIcon className="w-6 h-6 text-[#708499]" />
                  <span className="text-[15px] text-white">0 shared links</span>
                </div>
              </div>
            </>
          ) : (
            <div className="p-6 pt-16 space-y-4 bg-white dark:bg-[#201f1e] min-h-full">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Edit Profile</h2>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Username</label>
                <div className="flex items-center gap-3 p-2 rounded-xl bg-gray-50 dark:bg-[#11100f] border border-gray-200 dark:border-gray-700 focus-within:border-[#42a5f5] transition">
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
                <div className="flex items-center gap-3 p-2 rounded-xl bg-gray-50 dark:bg-[#11100f] border border-gray-200 dark:border-gray-700 focus-within:border-[#42a5f5] transition">
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
                <div className="flex items-center gap-3 p-2 rounded-xl bg-gray-50 dark:bg-[#11100f] border border-gray-200 dark:border-gray-700 focus-within:border-[#42a5f5] transition">
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
                <div className="flex items-start gap-3 p-2 rounded-xl bg-gray-50 dark:bg-[#11100f] border border-gray-200 dark:border-gray-700 focus-within:border-[#42a5f5] transition">
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
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Avatar Image URL</label>
                <div className="flex items-center gap-3 p-2 rounded-xl bg-gray-50 dark:bg-[#11100f] border border-gray-200 dark:border-gray-700 focus-within:border-[#42a5f5] transition">
                  <ImageIcon className="w-5 h-5 text-gray-400" />
                  <input 
                    type="url"
                    placeholder="https://example.com/image.jpg"
                    value={formData.avatarUrl}
                    onChange={e => setFormData({...formData, avatarUrl: e.target.value})}
                    className="flex-1 bg-transparent border-none outline-none text-sm text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Email address</label>
                <div className="flex items-center gap-3 p-2 rounded-xl bg-gray-50 dark:bg-[#11100f] border border-gray-200 dark:border-gray-700 focus-within:border-[#42a5f5] transition">
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
                <div className="flex items-center gap-3 p-2 rounded-xl bg-gray-50 dark:bg-[#11100f] border border-gray-200 dark:border-gray-700 focus-within:border-[#42a5f5] transition">
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
                  className="flex-1 py-2.5 rounded-xl bg-[#42a5f5] text-white font-medium hover:bg-[#2b8cdb] transition flex items-center justify-center gap-2 disabled:opacity-50"
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
