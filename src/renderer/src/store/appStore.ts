import { create } from 'zustand'

export type ThemeId = 'parchment' | 'midnight' | 'forest' | 'slate' | 'rose'

export interface AbbeyInfo {
  path: string
  name: string
}

export interface FileNode {
  name: string
  path: string
  isDirectory: boolean
  children?: FileNode[]
}

export interface LLMConfig {
  baseUrl: string
  model: string
  apiKey: string
}

interface AppState {
  // Setup
  isSetupComplete: boolean
  setSetupComplete: (complete: boolean) => void

  // Abbey
  abbey: AbbeyInfo | null
  setAbbey: (abbey: AbbeyInfo | null) => void

  // Navigation
  currentView: 'notes' | 'inbox' | 'drafts' | 'agents' | 'settings' | 'newdraft'
  setCurrentView: (view: AppState['currentView']) => void

  // Files
  selectedFile: string | null
  setSelectedFile: (path: string | null) => void
  fileTree: FileNode[]
  setFileTree: (tree: FileNode[]) => void
  refreshFileTree: () => Promise<void>

  // LLM Config
  llmConfig: LLMConfig
  setLLMConfig: (config: Partial<LLMConfig>) => void

  // UI State
  isSidebarOpen: boolean
  toggleSidebar: () => void
  isFileTreeVisible: boolean
  toggleFileTree: () => void
  showSystemFolders: boolean
  setShowSystemFolders: (show: boolean) => void
  theme: ThemeId
  setTheme: (theme: ThemeId) => void

  // Inbox
  unreadInbox: number
  setUnreadInbox: (count: number) => void

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

  // Abbey
  abbey: null,
  setAbbey: (abbey) => set({ abbey }),

  // Navigation
  currentView: 'notes',
  setCurrentView: (view) => set({ currentView: view }),

  // Files
  selectedFile: null,
  setSelectedFile: (path) => set({ selectedFile: path }),
  fileTree: [],
  setFileTree: (tree) => set({ fileTree: tree }),
  refreshFileTree: async () => {
    const { abbey } = get()
    if (!abbey) return

    try {
      const files = await window.electronAPI.listFiles('.')
      set({ fileTree: files })
    } catch (error) {
      console.error('Failed to refresh file tree:', error)
    }
  },

  // LLM Config
  llmConfig: {
    baseUrl: 'http://localhost:8000/v1',
    model: 'gemma-4-e4b-it-4bit',
    apiKey: '',
  },
  setLLMConfig: (config) => set((state) => ({
    llmConfig: { ...state.llmConfig, ...config }
  })),

  // UI State
  isSidebarOpen: true,
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  isFileTreeVisible: true,
  toggleFileTree: () => set((state) => ({ isFileTreeVisible: !state.isFileTreeVisible })),
  showSystemFolders: false,
  setShowSystemFolders: (show) => set({ showSystemFolders: show }),
  theme: 'parchment' as ThemeId,
  setTheme: (theme) => {
    set({ theme })
    document.documentElement.dataset.theme = theme
    window.electronAPI.setSetting('theme', theme)
  },

  // Inbox
  unreadInbox: 0,
  setUnreadInbox: (count) => set({ unreadInbox: count }),

  // Agent
  isAgentRunning: false,
  setAgentRunning: (running) => set({ isAgentRunning: running }),
  currentTask: null,
  setCurrentTask: (task) => set({ currentTask: task }),
  agentName: 'Wilfred',
  agentAvatar: '✦',
  setAgentProfile: (name, avatar) => set({ agentName: name, agentAvatar: avatar }),
}))
