import { create } from 'zustand'

export interface User {
  id: string
  username: string
  email?: string
  avatarUrl?: string | null
  description?: string
  status: 'ONLINE' | 'AWAY' | 'DO_NOT_DISTURB' | 'OFFLINE'
}

export interface Message {
  id: string
  content: string
  sender_id: string
  conversation_id?: string
  created_at: string
  sender?: User
}

export interface Conversation {
  id: string
  type: 'DIRECT' | 'GROUP'
  participants: { user: User, is_pinned: boolean }[]
  messages?: Message[]
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
}

export const useAppStore = create<AppState>((set) => ({
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
}))
