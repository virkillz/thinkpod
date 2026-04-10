export interface ElectronAPI {
  // Abbey
  selectAbbeyFolder: () => Promise<string | null>
  createAbbey: (path: string) => Promise<{ success: boolean; path?: string; error?: string }>
  initAbbey: (path: string) => Promise<{ success: boolean; path?: string; error?: string }>
  openAbbey: (path: string) => Promise<{ success: boolean; path?: string; error?: string }>
  getAbbeyInfo: () => Promise<{ path: string; name: string } | null>
  resetAbbey: () => Promise<{ success: boolean; error?: string }>

  // Files
  listFiles: (path: string) => Promise<Array<{ name: string; path: string; isDirectory: boolean }>>
  readFile: (path: string) => Promise<{ content: string; path: string }>
  writeFile: (path: string, content: string) => Promise<{ success: boolean }>
  moveFile: (from: string, to: string) => Promise<{ success: boolean }>
  deleteFile: (path: string) => Promise<{ success: boolean }>

  // Comments
  getComments: (filePath: string) => Promise<Array<{
    id: number
    file_path: string
    line: number
    content: string
    type: string
    status: string
    created_at: number
  }>>
  addComment: (filePath: string, line: number, content: string, type: string) => Promise<number>
  dismissComment: (id: number) => Promise<void>

  // Settings
  getSetting: (key: string) => Promise<unknown>
  setSetting: (key: string, value: unknown) => Promise<{ success: boolean }>

  // LLM
  testLLMConnection: (config: { baseUrl: string; model: string; apiKey?: string }) => Promise<{
    success: boolean
    available?: boolean
    hasModel?: boolean
    models?: string[]
    error?: string
  }>
  getLLMStatus: () => Promise<{ running: boolean; url: string | null; managed: boolean }>
  startLLMServer: (config: { model: string; port?: number }) => Promise<{ success: boolean; url?: string; error?: string }>
  stopLLMServer: () => Promise<{ success: boolean }>

  // Agent
  runAgentTask: (taskName: string, instruction: string) => Promise<{
    success: boolean
    result?: {
      id: string
      taskName: string
      status: 'running' | 'done' | 'error' | 'aborted' | 'budget_exceeded'
      startedAt: number
      endedAt?: number
      iterations: number
      toolCalls: number
      summary?: string
      error?: string
    }
    error?: string
  }>
  abortAgentTask: () => Promise<{ success: boolean }>
  getAgentTasks: () => Promise<Array<{
    id: number
    task_name: string
    started_at: number
    ended_at: number
    status: string
    summary: string
  }>>
  agentChat: (message: string) => Promise<{ success: boolean; content?: string; error?: string }>

  // Epistles
  listEpistles: () => Promise<Array<{
    id: string
    path: string
    title: string
    type: string
    created: string
    status: string
  }>>
  readEpistle: (filename: string) => Promise<{ content: string; path: string }>
  markEpistleRead: (filename: string) => Promise<{ success: boolean }>

  // Canonical hours
  listHours: () => Promise<Array<{
    id: number
    name: string
    schedule: string
    prompt: string
    tools: string
    is_active: number
  }>>
  toggleHour: (id: number, isActive: boolean) => Promise<{ success: boolean }>
  triggerHour: (id: number) => Promise<{ success: boolean; result?: unknown; error?: string }>

  // App
  getAppVersion: () => Promise<string>

  // Push events (main → renderer)
  onTaskUpdate: (callback: (run: TaskRun) => void) => () => void
  onTaskEnd: (callback: (run: TaskRun) => void) => () => void
}

interface TaskRun {
  id: string
  taskName: string
  prompt: string
  status: 'running' | 'done' | 'error' | 'aborted' | 'budget_exceeded'
  startedAt: number
  endedAt?: number
  iterations: number
  toolCalls: number
  summary?: string
  error?: string
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
