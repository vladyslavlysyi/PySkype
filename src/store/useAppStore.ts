import { create } from 'zustand'

export interface User {
  id: string
  username: string
  email?: string
  avatar_url?: string | null
  description?: string
  phone_number?: string
  birthday?: string
  theme_color?: string
  global_chat_bg?: string | null
  status: 'ONLINE' | 'AWAY' | 'DO_NOT_DISTURB' | 'OFFLINE'
}

export interface Message {
  id: string
  content: string
  sender_id: string
  conversation_id?: string
  is_read?: boolean
  created_at: string
  sender?: User
}

export interface Conversation {
  id: string
  type: 'DIRECT' | 'GROUP'
  participants: { user: User, is_pinned: boolean, chat_bg?: string | null }[]
  messages?: Message[]
  last_message?: {
    content: string
    created_at: string
    is_read: boolean
    sender_id: string
  }
}

interface AppState {
  currentUser: User | null
  setCurrentUser: (user: User | null) => void

  conversations: Conversation[]
  setConversations: (conversations: Conversation[]) => void
  
  activeConversation: Conversation | null
  setActiveConversation: (conv: Conversation | null) => void

  searchQuery: string
  setSearchQuery: (q: string) => void
  
  searchResults: User[]
  setSearchResults: (users: User[]) => void

  deleteMessages: (messageIds: string[]) => void
}

import { persist } from 'zustand/middleware'

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      currentUser: null,
      setCurrentUser: (user) => set({ currentUser: user }),

      conversations: [],
      setConversations: (conversations) => set({ conversations }),

      activeConversation: null,
      setActiveConversation: (activeConversation) => set({ activeConversation }),

      searchQuery: '',
      setSearchQuery: (searchQuery) => set({ searchQuery }),

      searchResults: [],
      setSearchResults: (searchResults) => set({ searchResults }),

      deleteMessages: (messageIds) => set((state) => {
        let updatedActive = state.activeConversation
        if (updatedActive && updatedActive.messages) {
          updatedActive = {
            ...updatedActive,
            messages: updatedActive.messages.filter(m => !messageIds.includes(m.id))
          }
        }
        return { activeConversation: updatedActive }
      }),
    }),
    {
      name: 'skype-storage',
      partialize: (state) => ({ currentUser: state.currentUser }),
    }
  )
)
