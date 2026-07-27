import React, { useState, useEffect } from 'react'
import { X, Search, CheckCircle2, Circle } from 'lucide-react'
import { getAuthHeaders } from '@/lib/csrf'
import { User, useAppStore } from '@/store/useAppStore'

interface GroupModalProps {
  isOpen: boolean
  onClose: () => void
  onGroupCreated: () => void
}

export const GroupModal = ({ isOpen, onClose, onGroupCreated }: GroupModalProps) => {
  const [name, setName] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<User[]>([])
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(false)
  const { currentUser } = useAppStore()

  useEffect(() => {
    if (!isOpen) {
      setName('')
      setSearchQuery('')
      setSearchResults([])
      setSelectedUsers(new Set())
    }
  }, [isOpen])

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      return
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/users/search?q=${searchQuery}`, { headers: getAuthHeaders() })
        const data = await res.json()
        if (Array.isArray(data)) {
          setSearchResults(data.filter((u: User) => u.id !== currentUser?.id))
        }
      } catch (err) {
        console.error(err)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery, currentUser])

  const toggleUser = (userId: string) => {
    const next = new Set(selectedUsers)
    if (next.has(userId)) next.delete(userId)
    else next.add(userId)
    setSelectedUsers(next)
  }

  const handleCreate = async () => {
    if (!name.trim() || selectedUsers.size === 0) return
    setIsLoading(true)
    try {
      const res = await fetch('/api/chats/group', {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          member_ids: Array.from(selectedUsers)
        })
      })
      if (res.ok) {
        onGroupCreated()
        onClose()
      }
    } catch (err) {
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#201f1e] w-full max-w-md rounded-2xl shadow-xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-lg font-semibold dark:text-white">New Group Chat</h2>
          <button onClick={onClose} className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full transition">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-4 flex flex-col gap-4">
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Group Name</label>
            <input 
              type="text" 
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Project Alpha"
              className="w-full bg-gray-50 dark:bg-[#11100f] border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-2.5 outline-none focus:border-[#0078d4] dark:text-white transition"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Add Members</label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input 
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search users..."
                className="w-full bg-gray-50 dark:bg-[#11100f] border border-gray-200 dark:border-gray-800 rounded-xl pl-10 pr-4 py-2 outline-none focus:border-[#0078d4] dark:text-white transition"
              />
            </div>
          </div>

          <div className="flex-1 min-h-[200px] max-h-[300px] overflow-y-auto space-y-1 custom-scrollbar">
            {searchResults.map(user => (
              <div 
                key={user.id}
                onClick={() => toggleUser(user.id)}
                className="flex items-center justify-between p-2 hover:bg-gray-50 dark:hover:bg-white/5 rounded-xl cursor-pointer transition"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-[#0078d4] font-semibold">
                    {user.username[0].toUpperCase()}
                  </div>
                  <span className="text-sm font-medium dark:text-white">{user.username}</span>
                </div>
                {selectedUsers.has(user.id) ? (
                  <CheckCircle2 className="w-5 h-5 text-[#0078d4]" />
                ) : (
                  <Circle className="w-5 h-5 text-gray-300 dark:text-gray-600" />
                )}
              </div>
            ))}
            {searchResults.length === 0 && searchQuery && (
              <div className="text-center text-sm text-gray-500 py-4">No users found</div>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-gray-200 dark:border-gray-800 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition">
            Cancel
          </button>
          <button 
            onClick={handleCreate}
            disabled={!name.trim() || selectedUsers.size === 0 || isLoading}
            className="px-6 py-2 text-sm font-medium text-white bg-[#0078d4] hover:bg-[#106ebe] rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isLoading ? 'Creating...' : `Create Group (${selectedUsers.size})`}
          </button>
        </div>
      </div>
    </div>
  )
}
