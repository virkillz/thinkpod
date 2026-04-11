export interface ElectronAPI {
  // Vault
  selectVaultFolder: () => Promise<string | null>
  createVault: (path: string) => Promise<{ success: boolean; path?: string; error?: string }>
  initVault: (path: string) => Promise<{ success: boolean; path?: string; error?: string }>
  openVault: (path: string) => Promise<{ success: boolean; path?: string; error?: string; needsInit?: boolean }>
  getVaultInfo: () => Promise<{ path: string; name: string } | null>
  resetVault: () => Promise<{ success: boolean; error?: string }>

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
  editText: (text: string, instruction: string) => Promise<{ success: boolean; content?: string; error?: string }>
  suggestFolder: (content: string) => Promise<{ success: boolean; folder?: string; error?: string }>
  classifyThought: (
    content: string,
    templates: { id: string; title: string; description: string }[]
  ) => Promise<{ success: boolean; templateId?: string | null; confidence?: number; folder?: string; error?: string }>
  getMissingFields: (
    content: string,
    templateFormat: string
  ) => Promise<{ success: boolean; questions?: { field: string; question: string; hint?: string }[]; error?: string }>
  reformatThought: (
    content: string,
    templateFormat: string,
    userAnswers: { field: string; answer: string }[]
  ) => Promise<{ success: boolean; reformattedContent?: string; error?: string }>
  assessThought: (
    content: string,
    templates: { id: string; title: string; description: string; defaultFolder: string }[],
    currentFolder: string
  ) => Promise<{
    success: boolean
    templateId?: string | null
    confidence?: number
    folder?: string
    alreadyFormatted?: boolean
    missingFields?: { field: string; question: string; hint?: string }[]
    suggestedTags?: string[]
    error?: string
  }>

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
  agentChatOpen: (contextType: string, contextKey: string, filePath?: string) => Promise<{
    success: boolean
    sessionId?: string
    history?: ChatMessage[]
    error?: string
  }>
  agentChatSend: (sessionId: string, message: string) => Promise<{ success: boolean; content?: string; toolCallCount?: number; error?: string; toolErrors?: { toolName: string; error: string; ts: number }[] }>
  agentChatNew: (contextType: string, contextKey: string, filePath?: string) => Promise<{ success: boolean; sessionId?: string; error?: string }>
  agentChatGetSystemPrompt: (sessionId: string) => Promise<{ success: boolean; systemPrompt?: string; error?: string }>

  // Inbox
  listInbox: () => Promise<Array<{
    id: string
    path: string
    title: string
    type: string
    created: string
    status: string
  }>>
  readInboxItem: (filename: string) => Promise<{ content: string; path: string }>
  markInboxRead: (filename: string) => Promise<{ success: boolean }>
  deleteInboxItem: (filename: string) => Promise<{ success: boolean }>
  replyToThread: (threadId: string, replyText: string) => Promise<{ success: boolean; response?: string; error?: string }>

  // Schedule
  listSchedules: () => Promise<Array<{
    id: number
    name: string
    schedule: string
    prompt: string
    tools: string
    is_active: number
  }>>
  toggleSchedule: (id: number, isActive: boolean) => Promise<{ success: boolean }>
  triggerSchedule: (id: number) => Promise<{ success: boolean; result?: unknown; error?: string }>
  createSchedule: (name: string, schedule: string, prompt: string) => Promise<{ success: boolean; id?: number; error?: string }>
  updateSchedule: (id: number, name: string, schedule: string, prompt: string) => Promise<{ success: boolean; error?: string }>
  deleteSchedule: (id: number) => Promise<{ success: boolean; error?: string }>

  // Tasks (one-time)
  listTasks: () => Promise<Array<{
    id: number
    name: string
    prompt: string
    run_at: number | null
    status: string
  }>>
  createTask: (name: string, prompt: string, runAt: number | null) => Promise<{ success: boolean; id?: number; error?: string }>
  updateTask: (id: number, name: string, prompt: string, runAt: number | null) => Promise<{ success: boolean; error?: string }>
  deleteTask: (id: number) => Promise<{ success: boolean; error?: string }>

  // Cognitive Jobs
  listCognitiveJobs: () => Promise<Array<{
    id: number
    name: string
    schedule: string
    is_active: number
    last_run_at: number | null
    last_run_status: string | null
    last_run_summary: string | null
  }>>
  triggerCognitiveJob: (name: string) => Promise<{ success: boolean; result?: unknown; error?: string }>
  dryRunCognitiveJob: (name: string) => Promise<{ success: boolean; result?: unknown; error?: string }>
  toggleCognitiveJob: (name: string, isActive: boolean) => Promise<{ success: boolean; error?: string }>

  // App
  getAppVersion: () => Promise<string>
  selectUserImage: () => Promise<string | null>

  // Whisper / Voice
  getWhisperConfig: () => Promise<{
    config: VoiceConfig | null
    models: ModelInfo[]
    downloaded: string[]
  }>
  setWhisperConfig: (config: VoiceConfig | null) => Promise<{ success: boolean }>
  downloadWhisperModel: (modelName: string) => Promise<{ success: boolean; cancelled?: boolean; error?: string }>
  cancelWhisperDownload: () => Promise<{ success: boolean }>
  deleteWhisperModel: (modelName: string) => Promise<{ success: boolean; error?: string }>
  startVoiceCapture: () => Promise<{ success: boolean; error?: string }>
  stopVoiceCapture: () => Promise<{ success: boolean }>
  sendAudioChunk: (buffer: ArrayBuffer) => void

  // Tools
  getToolsConfig: () => Promise<{ config: Record<string, { enabled: boolean; config?: Record<string, string> }>; metas: unknown[] }>
  setToolsConfig: (config: Record<string, { enabled: boolean; config?: Record<string, string> }>) => Promise<{ success: boolean }>

  // Skills
  listSkills: () => Promise<{ skills: Array<{ name: string; description: string; dirPath: string }> }>
  openSkillsFolder: () => Promise<{ success: boolean }>

  // Push events (main → renderer)
  onTaskUpdate: (callback: (run: TaskRun) => void) => () => void
  onTaskEnd: (callback: (run: TaskRun) => void) => () => void
  onVoiceDownloadProgress: (callback: (data: { modelName: string; progress: number }) => void) => () => void
  onVoiceTranscript: (callback: (data: { text: string; isFinal: boolean }) => void) => () => void
  onChatToolUse: (callback: (data: { sessionId: string; toolName: string; args: Record<string, unknown> }) => void) => () => void
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'tool_result'
  content: string
  ts: number
  toolName?: string
  toolSuccess?: boolean
}

interface VoiceConfig {
  modelName: string
  language: 'en' | 'auto'
}

interface ModelInfo {
  name: string
  label: string
  description: string
  sizeMb: number
  tier: 'fast' | 'accurate' | 'custom'
  languages: 'english-only' | 'multilingual'
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
