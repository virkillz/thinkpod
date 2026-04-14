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
  getRecentFiles: (limit?: number) => Promise<Array<{ path: string; title: string; modified_at: number; word_count: number }>>
  searchFiles: (query: string) => Promise<{
    success: boolean
    results: Array<{
      path: string
      title: string
      folder: string
      modified_at: number
      snippet: string
      rank: number
    }>
    error?: string
  }>
  indexAllFiles: () => Promise<{ success: boolean; indexed?: number; skipped?: number; error?: string }>

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
  agentChatGetAllSessions: () => Promise<{
    success: boolean
    sessions?: Array<{
      id: string
      context_type: string
      context_key: string
      created_at: number
      last_message_at: number
    }>
    error?: string
  }>

  // Inbox
  listInbox: () => Promise<Array<{
    id: number
    subject: string
    body: string
    type: string
    status: string
    from_addr: string
    source_job: string | null
    created_at: number
    reply_count: number
  }>>
  readInboxItem: (id: number) => Promise<{
    id: number
    subject: string
    body: string
    type: string
    status: string
    from_addr: string
    source_job: string | null
    created_at: number
    replies: Array<{ id: number; role: string; body: string; created_at: number }>
  }>
  markInboxRead: (id: number) => Promise<{ success: boolean }>
  deleteInboxItem: (id: number) => Promise<{ success: boolean }>
  archiveInboxItem: (id: number) => Promise<{ success: boolean }>
  replyToThread: (messageId: number, replyText: string) => Promise<{ success: boolean; response?: string; error?: string }>
  composeInboxMessage: (subject: string, body: string) => Promise<{ success: boolean; messageId?: number; error?: string }>
  createWelcomeMessage: () => Promise<{ success: boolean; messageId?: number }>

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
  getScheduleSystemPrompt: (name: string, prompt: string) => Promise<{ success: boolean; systemPrompt?: string; error?: string }>

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

  // Graph & Stats
  getGraphData: () => Promise<{
    nodes: Array<{ id: string; label: string; tags: string[]; group: string; val: number }>
    links: Array<{ source: string; target: string; sharedTags: string[]; weight: number }>
  }>
  getStatsOverview: () => Promise<{
    totalDocuments: number
    totalTags: number
    avgTagsPerDoc: number
    topTags: Array<{ tag: string; count: number }>
  }>

  // App
  getAppVersion: () => Promise<string>
  selectUserImage: () => Promise<string | null>

  // Updater
  checkForUpdates: () => Promise<{ success: boolean; error?: string }>
  downloadUpdate: () => Promise<{ success: boolean; error?: string }>
  installUpdate: () => void
  onUpdateStatus: (callback: (status: unknown) => void) => () => void

  // Built-in LLM model management
  getLLMModelInfo: () => Promise<{
    models: GGUFModelInfo[]
    downloaded: string[]
    config: LLMBuiltinConfig | null
    serverRunning: boolean
    serverUrl: string | null
    isAppleSilicon: boolean
  }>
  downloadLLMModel: (quant: string) => Promise<{ success: boolean; alreadyExists?: boolean; cancelled?: boolean; error?: string }>
  cancelLLMModelDownload: () => Promise<{ success: boolean }>
  deleteLLMModel: (quant: string) => Promise<{ success: boolean; error?: string }>
  startBuiltinLLM: (opts: { backend?: 'gguf' | 'mlx'; quant?: string; hfRepo?: string }) => Promise<{ success: boolean; url?: string; error?: string }>
  stopBuiltinLLM: () => Promise<{ success: boolean }>
  downloadMLXModel: (hfRepo: string) => Promise<{ success: boolean; error?: string }>

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
  onLLMDownloadProgress: (callback: (data: { quant: string; progress: number }) => void) => () => void
  onLLMStatus: (callback: (status: string) => void) => () => void
  onLLMMlxDownloadProgress: (callback: (data: { hfRepo: string; status: 'downloading' | 'done' | 'error' }) => void) => () => void
  onFileChanged: (callback: (data: { type: string; path: string }) => void) => () => void
  onInboxUpdated: (callback: () => void) => () => void

  // Personalization
  getPersonalizationTopic: (topic: string) => Promise<{ success: boolean; content: string | null; error?: string }>
  writePersonalizationTopic: (topic: string, content: string) => Promise<{ success: boolean; error?: string }>
  summarizePersonalization: (sessionId: string, topic: string) => Promise<{ success: boolean; summary?: string; error?: string }>
  getPersonalizationSummary: () => Promise<{ success: boolean; content: string | null; error?: string }>
  writePersonalizationSummary: (content: string) => Promise<{ success: boolean; error?: string }>
  syncPersonalizationSummary: () => Promise<{ success: boolean; content?: string; error?: string }>
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

interface GGUFModelInfo {
  quant: string
  label: string
  description: string
  sizeMb: number
  filename: string
}

interface LLMBuiltinConfig {
  quant: string
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
