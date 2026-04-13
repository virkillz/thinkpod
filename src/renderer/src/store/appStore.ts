import { create } from 'zustand'
import avatar01 from '../assets/avatar01.png'

export type ThemeId = 'parchment' | 'midnight' | 'forest' | 'slate' | 'rose' | 'ocean' | 'sunset' | 'nordic' | 'lavender' | 'cherry' | 'onyx'

export interface VaultInfo {
  path: string
  name: string
}

export interface FileNode {
  name: string
  path: string
  isDirectory: boolean
  children?: FileNode[]
}

export type LLMProvider = 'ollama' | 'lmstudio' | 'openai' | 'groq' | 'custom' | 'builtin'

export interface LLMProfile {
  id: string
  name: string
  provider: LLMProvider
  baseUrl: string
  model: string
  apiKey: string
  builtinQuant?: string
}

export interface UserProfile {
  name: string
  bio: string
  avatarDataUrl: string | null
}

interface AppState {
  // Setup
  isSetupComplete: boolean
  setSetupComplete: (complete: boolean) => void

  // Vault
  vault: VaultInfo | null
  setVault: (vault: VaultInfo | null) => void

  // Navigation
  currentView: 'dashboard' | 'notes' | 'inbox' | 'thoughts' | 'agents' | 'settings' | 'newthought' | 'about' | 'search' | 'graph'
  setCurrentView: (view: AppState['currentView']) => void

  // Files
  selectedFile: string | null
  setSelectedFile: (path: string | null) => void
  fileTree: FileNode[]
  setFileTree: (tree: FileNode[]) => void
  refreshFileTree: () => Promise<void>

  // LLM Profiles
  llmProfiles: LLMProfile[]
  activeProfileId: string | null
  setLLMStorage: (profiles: LLMProfile[], activeId: string | null) => void

  // UI State
  isSidebarOpen: boolean
  toggleSidebar: () => void
  isFileTreeVisible: boolean
  toggleFileTree: () => void
  showSystemFolders: boolean
  setShowSystemFolders: (show: boolean) => void
  theme: ThemeId
  setTheme: (theme: ThemeId) => void
  isAgentChatOpen: boolean
  toggleAgentChat: () => void
  setAgentChatOpen: (open: boolean) => void
  initialAgentMessage: string | null
  setInitialAgentMessage: (message: string | null) => void
  showStatusBar: boolean
  setShowStatusBar: (show: boolean) => void
  pendingSettingsTab: string | null
  setPendingSettingsTab: (tab: string | null) => void

  // User Profile
  userProfile: UserProfile
  setUserProfile: (profile: UserProfile) => void

  // Inbox
  unreadInbox: number
  setUnreadInbox: (count: number) => void

  // Thoughts
  thoughtCount: number
  refreshThoughtCount: () => Promise<void>
  newThoughtDraft: string
  setNewThoughtDraft: (draft: string) => void

  // Agent
  isAgentRunning: boolean
  setAgentRunning: (running: boolean) => void
  currentTask: string | null
  setCurrentTask: (task: string | null) => void
  agentName: string
  agentAvatar: string
  setAgentProfile: (name: string, avatar: string) => void
}

export const useAppStore = create<AppState>((set, get) => ({
  // Setup
  isSetupComplete: false,
  setSetupComplete: (complete) => set({ isSetupComplete: complete }),

  // Vault
  vault: null,
  setVault: (vault) => set({ vault }),

  // Navigation
  currentView: 'dashboard',
  setCurrentView: (view) => set({ currentView: view }),

  // Files
  selectedFile: null,
  setSelectedFile: (path) => set({ selectedFile: path }),
  fileTree: [],
  setFileTree: (tree) => set({ fileTree: tree }),
  refreshFileTree: async () => {
    const { vault } = get()
    if (!vault) return

    try {
      const files = await window.electronAPI.listFiles('.')
      set({ fileTree: files })
    } catch (error) {
      console.error('Failed to refresh file tree:', error)
    }
  },

  // LLM Profiles
  llmProfiles: [],
  activeProfileId: null,
  setLLMStorage: (profiles, activeId) => set({ llmProfiles: profiles, activeProfileId: activeId }),

  // UI State
  isSidebarOpen: true,
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  isFileTreeVisible: true,
  toggleFileTree: () => set((state) => ({ isFileTreeVisible: !state.isFileTreeVisible })),
  showSystemFolders: false,
  setShowSystemFolders: (show) => set({ showSystemFolders: show }),
  theme: 'midnight' as ThemeId,
  setTheme: (theme) => {
    set({ theme })
    document.documentElement.dataset.theme = theme
    window.electronAPI.setSetting('theme', theme)
  },
  isAgentChatOpen: false,
  toggleAgentChat: () => set((state) => ({ isAgentChatOpen: !state.isAgentChatOpen })),
  setAgentChatOpen: (open) => set({ isAgentChatOpen: open }),
  initialAgentMessage: null,
  setInitialAgentMessage: (message) => set({ initialAgentMessage: message }),
  showStatusBar: true,
  setShowStatusBar: (show) => set({ showStatusBar: show }),
  pendingSettingsTab: null,
  setPendingSettingsTab: (tab) => set({ pendingSettingsTab: tab }),

  // User Profile
  userProfile: { name: 'Chief', bio: '', avatarDataUrl: null },
  setUserProfile: (profile) => set({ userProfile: profile }),

  // Inbox
  unreadInbox: 0,
  setUnreadInbox: (count) => set({ unreadInbox: count }),

  // Thoughts
  thoughtCount: 0,
  newThoughtDraft: '',
  setNewThoughtDraft: (draft) => set({ newThoughtDraft: draft }),
  refreshThoughtCount: async () => {
    const { vault } = get()
    if (!vault) return

    try {
      const files = await window.electronAPI.listFiles('_thoughts')
      const count = files.filter((f: { isDirectory: boolean }) => !f.isDirectory).length
      set({ thoughtCount: count })
    } catch (error) {
      console.error('Failed to refresh thought count:', error)
    }
  },

  // Agent
  isAgentRunning: false,
  setAgentRunning: (running) => set({ isAgentRunning: running }),
  currentTask: null,
  setCurrentTask: (task) => set({ currentTask: task }),
  agentName: 'Wilfred',
  agentAvatar: avatar01,
  setAgentProfile: (name, avatar) => set({ agentName: name, agentAvatar: avatar }),
}))
