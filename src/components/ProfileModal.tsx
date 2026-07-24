import React, { useState } from 'react'
import { UserCircle, X, Mail, Info, Circle, Edit2, Check, Lock, User as UserIcon, Image as ImageIcon } from 'lucide-react'
import { User, useAppStore } from '@/store/useAppStore'

interface ProfileModalProps {
  user: User
  onClose: () => void
  isMe?: boolean
}

export const ProfileModal = ({ user, onClose, isMe = false }: ProfileModalProps) => {
  const { setCurrentUser } = useAppStore()
  const [isEditing, setIsEditing] = useState(false)
  
  const [formData, setFormData] = useState({
    username: user.username || '',
    email: user.email || '',
    description: user.description || '',
    avatarUrl: user.avatar_url || '',
    password: ''
  })
  const [isLoading, setIsLoading] = useState(false)

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ONLINE': return 'text-green-500'
      case 'AWAY': return 'text-yellow-500'
      case 'DO_NOT_DISTURB': return 'text-red-500'
      default: return 'text-gray-400'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'ONLINE': return 'Active now'
      case 'AWAY': return 'Away'
      case 'DO_NOT_DISTURB': return 'Do not disturb'
      default: return 'Offline'
    }
  }

  const handleSave = async () => {
    setIsLoading(true)
    try {
      const payload: any = {
        username: formData.username,
        description: formData.description,
      }
      
      // Pydantic fails validation if email or avatar_url are empty strings
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white dark:bg-[#201f1e] w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden transform transition-all flex flex-col max-h-[90vh]">
        {/* Header Background */}
        <div className="h-32 bg-gradient-to-r from-[#0078d4] to-[#00bcf2] w-full relative flex-shrink-0">
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

        {/* Profile Info Wrapper */}
        <div className="px-6 pb-6 relative flex-1 flex flex-col min-h-0">
          {/* Avatar (Outside scroll container to prevent clipping) */}
          <div className="absolute -top-12 left-6 z-10">
            <div className="relative inline-block">
              {user.avatar_url ? (
                <img 
                  src={user.avatar_url} 
                  alt="avatar" 
                  className="w-24 h-24 rounded-full border-4 border-white dark:border-[#201f1e] object-cover bg-white dark:bg-gray-800" 
                />
              ) : (
                <div className="w-24 h-24 rounded-full border-4 border-white dark:border-[#201f1e] bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                  <UserCircle className="w-16 h-16 text-gray-400" />
                </div>
              )}
              <div className={`absolute bottom-1 right-1 w-5 h-5 rounded-full border-2 border-white dark:border-[#201f1e] bg-current ${getStatusColor(user.status)}`} />
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="pt-16 overflow-y-auto custom-scrollbar flex-1">
            {!isEditing ? (
              <>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {user.username}
                </h2>
                <div className="flex items-center gap-1.5 mt-1">
                  <Circle className={`w-3 h-3 fill-current ${getStatusColor(user.status)}`} />
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                    {getStatusText(user.status)}
                  </span>
                </div>

                <div className="mt-6 space-y-4">
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-[#11100f] border border-gray-100 dark:border-gray-800">
                    <Mail className="w-5 h-5 text-gray-400" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Email address</p>
                      <p className="text-sm text-gray-900 dark:text-white truncate">
                        {user.email || 'No email provided'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 dark:bg-[#11100f] border border-gray-100 dark:border-gray-800">
                    <Info className="w-5 h-5 text-gray-400 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">About</p>
                      <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">
                        {user.description || (isMe ? "Add a description to your profile." : `No description provided.`)}
                      </p>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-4">
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
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">About</label>
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
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Avatar Image URL</label>
                  <div className="flex items-center gap-3 p-2 rounded-xl bg-gray-50 dark:bg-[#11100f] border border-gray-200 dark:border-gray-700 focus-within:border-[#0078d4] transition">
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
                
                <div className="pt-4 flex gap-3">
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
    </div>
  )
}
