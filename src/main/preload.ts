import { contextBridge, ipcRenderer } from 'electron'

// Import channels as a simple object to avoid module resolution issues
const IPC_CHANNELS = {
  VAULT_SELECT_FOLDER: 'vault:select-folder',
  VAULT_CREATE: 'vault:create',
  VAULT_INIT: 'vault:init',
  VAULT_OPEN: 'vault:open',
  VAULT_GET_INFO: 'vault:get-info',
  TOOLS_GET_CONFIG: 'tools:get-config',
  TOOLS_SET_CONFIG: 'tools:set-config',
  SKILLS_LIST: 'skills:list',
  SKILLS_OPEN_FOLDER: 'skills:open-folder',
  VAULT_RESET: 'vault:reset',
  FILES_LIST: 'files:list',
  FILES_READ: 'files:read',
  FILES_WRITE: 'files:write',
  FILES_MOVE: 'files:move',
  FILES_DELETE: 'files:delete',
  FILES_SEARCH: 'files:search',
  FILES_GET_RECENT: 'files:get-recent',
  VAULT_INDEX_ALL: 'vault:index-all',
  COMMENTS_GET: 'comments:get',
  COMMENTS_ADD: 'comments:add',
  COMMENTS_DISMISS: 'comments:dismiss',
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',
  LLM_TEST_CONNECTION: 'llm:test-connection',
  LLM_GET_STATUS: 'llm:get-status',
  LLM_START_SERVER: 'llm:start-server',
  LLM_STOP_SERVER: 'llm:stop-server',
  LLM_EDIT_TEXT: 'llm:edit-text',
  LLM_SUGGEST_FOLDER: 'llm:suggest-folder',
  LLM_CLASSIFY_THOUGHT: 'llm:classify-thought',
  LLM_GET_MISSING_FIELDS: 'llm:get-missing-fields',
  LLM_REFORMAT_THOUGHT: 'llm:reformat-thought',
  LLM_ASSESS_THOUGHT: 'llm:assess-thought',
  AGENT_RUN_TASK: 'agent:run-task',
  AGENT_ABORT_TASK: 'agent:abort-task',
  AGENT_GET_TASKS: 'agent:get-tasks',
  AGENT_CHAT: 'agent:chat',
  AGENT_CHAT_OPEN: 'agent:chat-open',
  AGENT_CHAT_SEND: 'agent:chat-send',
  AGENT_CHAT_NEW: 'agent:chat-new',
  AGENT_CHAT_GET_SYSTEM_PROMPT: 'agent:chat-get-system-prompt',
  AGENT_CHAT_GET_ALL_SESSIONS: 'agent:chat-get-all-sessions',
  INBOX_LIST: 'inbox:list',
  INBOX_READ: 'inbox:read',
  INBOX_MARK_READ: 'inbox:mark-read',
  INBOX_DELETE: 'inbox:delete',
  INBOX_REPLY: 'inbox:reply',
  SCHEDULE_LIST: 'schedule:list',
  SCHEDULE_TOGGLE: 'schedule:toggle',
  SCHEDULE_TRIGGER: 'schedule:trigger',
  SCHEDULE_CREATE: 'schedule:create',
  SCHEDULE_UPDATE: 'schedule:update',
  SCHEDULE_DELETE: 'schedule:delete',
  TASK_CREATE: 'task:create',
  TASK_UPDATE: 'task:update',
  TASK_DELETE: 'task:delete',
  TASK_LIST: 'task:list',
  APP_GET_VERSION: 'app:get-version',
  USER_SELECT_IMAGE: 'user:select-image',
  PUSH_TASK_UPDATE: 'push:task-update',
  PUSH_TASK_END: 'push:task-end',
  PUSH_CHAT_TOOL_USE: 'push:chat-tool-use',
  WHISPER_GET_CONFIG: 'whisper:get-config',
  WHISPER_SET_CONFIG: 'whisper:set-config',
  WHISPER_DOWNLOAD_MODEL: 'whisper:download-model',
  WHISPER_CANCEL_DOWNLOAD: 'whisper:cancel-download',
  WHISPER_DELETE_MODEL: 'whisper:delete-model',
  WHISPER_START_CAPTURE: 'whisper:start-capture',
  WHISPER_STOP_CAPTURE: 'whisper:stop-capture',
  WHISPER_AUDIO_CHUNK: 'whisper:audio-chunk',
  PUSH_VOICE_DOWNLOAD_PROGRESS: 'push:voice-download-progress',
  PUSH_VOICE_TRANSCRIPT: 'push:voice-transcript',
  LLM_MODEL_GET_INFO: 'llm-model:get-info',
  LLM_MODEL_DOWNLOAD: 'llm-model:download',
  LLM_MODEL_CANCEL_DOWNLOAD: 'llm-model:cancel-download',
  LLM_MODEL_DELETE: 'llm-model:delete',
  LLM_MODEL_START: 'llm-model:start',
  LLM_MODEL_STOP: 'llm-model:stop',
  PUSH_LLM_DOWNLOAD_PROGRESS: 'push:llm-download-progress',
  PUSH_LLM_STATUS: 'push:llm-status',
  GRAPH_GET_DATA: 'graph:get-data',
  STATS_GET_OVERVIEW: 'stats:get-overview',
  PERSONALIZATION_GET_TOPIC: 'personalization:get-topic',
  PERSONALIZATION_WRITE_TOPIC: 'personalization:write-topic',
  PERSONALIZATION_SUMMARIZE: 'personalization:summarize',
  PERSONALIZATION_GET_SUMMARY: 'personalization:get-summary',
  PERSONALIZATION_WRITE_SUMMARY: 'personalization:write-summary',
  PERSONALIZATION_SYNC_SUMMARY: 'personalization:sync-summary',
}

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Vault
  selectVaultFolder: () => ipcRenderer.invoke(IPC_CHANNELS.VAULT_SELECT_FOLDER),
  createVault: (path: string) => ipcRenderer.invoke(IPC_CHANNELS.VAULT_CREATE, path),
  initVault: (path: string) => ipcRenderer.invoke(IPC_CHANNELS.VAULT_INIT, path),
  openVault: (path: string) => ipcRenderer.invoke(IPC_CHANNELS.VAULT_OPEN, path),
  getVaultInfo: () => ipcRenderer.invoke(IPC_CHANNELS.VAULT_GET_INFO),
  resetVault: () => ipcRenderer.invoke(IPC_CHANNELS.VAULT_RESET),

  // Files
  listFiles: (path: string) => ipcRenderer.invoke(IPC_CHANNELS.FILES_LIST, path),
  readFile: (path: string) => ipcRenderer.invoke(IPC_CHANNELS.FILES_READ, path),
  writeFile: (path: string, content: string) => ipcRenderer.invoke(IPC_CHANNELS.FILES_WRITE, path, content),
  moveFile: (from: string, to: string) => ipcRenderer.invoke(IPC_CHANNELS.FILES_MOVE, from, to),
  deleteFile: (path: string) => ipcRenderer.invoke(IPC_CHANNELS.FILES_DELETE, path),
  searchFiles: (query: string) => ipcRenderer.invoke(IPC_CHANNELS.FILES_SEARCH, query),
  getRecentFiles: (limit?: number) => ipcRenderer.invoke(IPC_CHANNELS.FILES_GET_RECENT, limit),
  indexAllFiles: () => ipcRenderer.invoke(IPC_CHANNELS.VAULT_INDEX_ALL),

  // Comments
  getComments: (filePath: string) => ipcRenderer.invoke(IPC_CHANNELS.COMMENTS_GET, filePath),
  addComment: (filePath: string, line: number, content: string, type: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.COMMENTS_ADD, filePath, line, content, type),
  dismissComment: (id: number) => ipcRenderer.invoke(IPC_CHANNELS.COMMENTS_DISMISS, id),

  // Settings
  getSetting: (key: string) => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET, key),
  setSetting: (key: string, value: unknown) => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SET, key, value),

  // LLM
  testLLMConnection: (config: { baseUrl: string; model: string; apiKey?: string }) =>
    ipcRenderer.invoke(IPC_CHANNELS.LLM_TEST_CONNECTION, config),
  getLLMStatus: () => ipcRenderer.invoke(IPC_CHANNELS.LLM_GET_STATUS),
  startLLMServer: (config: { model: string; port?: number }) => ipcRenderer.invoke(IPC_CHANNELS.LLM_START_SERVER, config),
  stopLLMServer: () => ipcRenderer.invoke(IPC_CHANNELS.LLM_STOP_SERVER),
  editText: (text: string, instruction: string) => ipcRenderer.invoke(IPC_CHANNELS.LLM_EDIT_TEXT, text, instruction),
  suggestFolder: (content: string) => ipcRenderer.invoke(IPC_CHANNELS.LLM_SUGGEST_FOLDER, content),
  classifyThought: (content: string, templates: { id: string; title: string; description: string }[]) =>
    ipcRenderer.invoke(IPC_CHANNELS.LLM_CLASSIFY_THOUGHT, content, templates),
  getMissingFields: (content: string, templateFormat: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.LLM_GET_MISSING_FIELDS, content, templateFormat),
  reformatThought: (content: string, templateFormat: string, userAnswers: { field: string; answer: string }[]) =>
    ipcRenderer.invoke(IPC_CHANNELS.LLM_REFORMAT_THOUGHT, content, templateFormat, userAnswers),
  assessThought: (
    content: string,
    templates: { id: string; title: string; description: string; defaultFolder: string }[],
    currentFolder: string
  ) => ipcRenderer.invoke(IPC_CHANNELS.LLM_ASSESS_THOUGHT, content, templates, currentFolder),

  // Agent
  runAgentTask: (taskName: string, instruction: string) => ipcRenderer.invoke(IPC_CHANNELS.AGENT_RUN_TASK, taskName, instruction),
  abortAgentTask: () => ipcRenderer.invoke(IPC_CHANNELS.AGENT_ABORT_TASK),
  getAgentTasks: () => ipcRenderer.invoke(IPC_CHANNELS.AGENT_GET_TASKS),
  agentChat: (message: string) => ipcRenderer.invoke(IPC_CHANNELS.AGENT_CHAT, message),
  agentChatOpen: (contextType: string, contextKey: string, filePath?: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.AGENT_CHAT_OPEN, contextType, contextKey, filePath),
  agentChatSend: (sessionId: string, message: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.AGENT_CHAT_SEND, sessionId, message),
  agentChatNew: (contextType: string, contextKey: string, filePath?: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.AGENT_CHAT_NEW, contextType, contextKey, filePath),
  agentChatGetSystemPrompt: (sessionId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.AGENT_CHAT_GET_SYSTEM_PROMPT, sessionId),
  agentChatGetAllSessions: () =>
    ipcRenderer.invoke(IPC_CHANNELS.AGENT_CHAT_GET_ALL_SESSIONS),

  // Inbox
  listInbox: () => ipcRenderer.invoke(IPC_CHANNELS.INBOX_LIST),
  readInboxItem: (filename: string) => ipcRenderer.invoke(IPC_CHANNELS.INBOX_READ, filename),
  markInboxRead: (filename: string) => ipcRenderer.invoke(IPC_CHANNELS.INBOX_MARK_READ, filename),
  deleteInboxItem: (filename: string) => ipcRenderer.invoke(IPC_CHANNELS.INBOX_DELETE, filename),
  replyToThread: (threadId: string, replyText: string) => ipcRenderer.invoke(IPC_CHANNELS.INBOX_REPLY, threadId, replyText),

  // Schedule
  listSchedules: () => ipcRenderer.invoke(IPC_CHANNELS.SCHEDULE_LIST),
  toggleSchedule: (id: number, isActive: boolean) => ipcRenderer.invoke(IPC_CHANNELS.SCHEDULE_TOGGLE, id, isActive),
  triggerSchedule: (id: number) => ipcRenderer.invoke(IPC_CHANNELS.SCHEDULE_TRIGGER, id),
  createSchedule: (name: string, schedule: string, prompt: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SCHEDULE_CREATE, name, schedule, prompt),
  updateSchedule: (id: number, name: string, schedule: string, prompt: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SCHEDULE_UPDATE, id, name, schedule, prompt),
  deleteSchedule: (id: number) => ipcRenderer.invoke(IPC_CHANNELS.SCHEDULE_DELETE, id),

  // Tasks (one-time)
  listTasks: () => ipcRenderer.invoke(IPC_CHANNELS.TASK_LIST),
  createTask: (name: string, prompt: string, runAt: number | null) =>
    ipcRenderer.invoke(IPC_CHANNELS.TASK_CREATE, name, prompt, runAt),
  updateTask: (id: number, name: string, prompt: string, runAt: number | null) =>
    ipcRenderer.invoke(IPC_CHANNELS.TASK_UPDATE, id, name, prompt, runAt),
  deleteTask: (id: number) => ipcRenderer.invoke(IPC_CHANNELS.TASK_DELETE, id),

  // App
  getAppVersion: () => ipcRenderer.invoke(IPC_CHANNELS.APP_GET_VERSION),
  selectUserImage: () => ipcRenderer.invoke(IPC_CHANNELS.USER_SELECT_IMAGE),

  // Tools
  getToolsConfig: () => ipcRenderer.invoke(IPC_CHANNELS.TOOLS_GET_CONFIG),
  setToolsConfig: (config: unknown) => ipcRenderer.invoke(IPC_CHANNELS.TOOLS_SET_CONFIG, config),

  // Skills
  listSkills: () => ipcRenderer.invoke(IPC_CHANNELS.SKILLS_LIST),
  openSkillsFolder: () => ipcRenderer.invoke(IPC_CHANNELS.SKILLS_OPEN_FOLDER),

  // Whisper / Voice
  getWhisperConfig: () => ipcRenderer.invoke(IPC_CHANNELS.WHISPER_GET_CONFIG),
  setWhisperConfig: (config: unknown) => ipcRenderer.invoke(IPC_CHANNELS.WHISPER_SET_CONFIG, config),
  downloadWhisperModel: (modelName: string) => ipcRenderer.invoke(IPC_CHANNELS.WHISPER_DOWNLOAD_MODEL, modelName),
  cancelWhisperDownload: () => ipcRenderer.invoke(IPC_CHANNELS.WHISPER_CANCEL_DOWNLOAD),
  deleteWhisperModel: (modelName: string) => ipcRenderer.invoke(IPC_CHANNELS.WHISPER_DELETE_MODEL, modelName),
  startVoiceCapture: () => ipcRenderer.invoke(IPC_CHANNELS.WHISPER_START_CAPTURE),
  stopVoiceCapture: () => ipcRenderer.invoke(IPC_CHANNELS.WHISPER_STOP_CAPTURE),
  sendAudioChunk: (buffer: ArrayBuffer) => ipcRenderer.send(IPC_CHANNELS.WHISPER_AUDIO_CHUNK, buffer),

  // Built-in LLM model management
  getLLMModelInfo: () => ipcRenderer.invoke(IPC_CHANNELS.LLM_MODEL_GET_INFO),
  downloadLLMModel: (quant: string) => ipcRenderer.invoke(IPC_CHANNELS.LLM_MODEL_DOWNLOAD, quant),
  cancelLLMModelDownload: () => ipcRenderer.invoke(IPC_CHANNELS.LLM_MODEL_CANCEL_DOWNLOAD),
  deleteLLMModel: (quant: string) => ipcRenderer.invoke(IPC_CHANNELS.LLM_MODEL_DELETE, quant),
  startBuiltinLLM: (quant: string) => ipcRenderer.invoke(IPC_CHANNELS.LLM_MODEL_START, quant),
  stopBuiltinLLM: () => ipcRenderer.invoke(IPC_CHANNELS.LLM_MODEL_STOP),

  // Push events (main → renderer)
  onTaskUpdate: (callback: (run: unknown) => void) => {
    ipcRenderer.on(IPC_CHANNELS.PUSH_TASK_UPDATE, (_, run) => callback(run))
    return () => ipcRenderer.removeAllListeners(IPC_CHANNELS.PUSH_TASK_UPDATE)
  },
  onTaskEnd: (callback: (run: unknown) => void) => {
    ipcRenderer.on(IPC_CHANNELS.PUSH_TASK_END, (_, run) => callback(run))
    return () => ipcRenderer.removeAllListeners(IPC_CHANNELS.PUSH_TASK_END)
  },
  onVoiceDownloadProgress: (callback: (data: { modelName: string; progress: number }) => void) => {
    ipcRenderer.on(IPC_CHANNELS.PUSH_VOICE_DOWNLOAD_PROGRESS, (_, data) => callback(data))
    return () => ipcRenderer.removeAllListeners(IPC_CHANNELS.PUSH_VOICE_DOWNLOAD_PROGRESS)
  },
  onVoiceTranscript: (callback: (data: { text: string; isFinal: boolean }) => void) => {
    ipcRenderer.on(IPC_CHANNELS.PUSH_VOICE_TRANSCRIPT, (_, data) => callback(data))
    return () => ipcRenderer.removeAllListeners(IPC_CHANNELS.PUSH_VOICE_TRANSCRIPT)
  },
  onChatToolUse: (callback: (data: { sessionId: string; toolName: string; args: Record<string, unknown> }) => void) => {
    ipcRenderer.on(IPC_CHANNELS.PUSH_CHAT_TOOL_USE, (_, data) => callback(data))
    return () => ipcRenderer.removeAllListeners(IPC_CHANNELS.PUSH_CHAT_TOOL_USE)
  },
  onLLMDownloadProgress: (callback: (data: { quant: string; progress: number }) => void) => {
    ipcRenderer.on(IPC_CHANNELS.PUSH_LLM_DOWNLOAD_PROGRESS, (_, data) => callback(data))
    return () => ipcRenderer.removeAllListeners(IPC_CHANNELS.PUSH_LLM_DOWNLOAD_PROGRESS)
  },
  onLLMStatus: (callback: (status: string) => void) => {
    ipcRenderer.on(IPC_CHANNELS.PUSH_LLM_STATUS, (_, status) => callback(status))
    return () => ipcRenderer.removeAllListeners(IPC_CHANNELS.PUSH_LLM_STATUS)
  },

  // Graph & Stats
  getGraphData: () => ipcRenderer.invoke(IPC_CHANNELS.GRAPH_GET_DATA),
  getStatsOverview: () => ipcRenderer.invoke(IPC_CHANNELS.STATS_GET_OVERVIEW),

  // Personalization
  getPersonalizationTopic: (topic: string) => ipcRenderer.invoke(IPC_CHANNELS.PERSONALIZATION_GET_TOPIC, topic),
  writePersonalizationTopic: (topic: string, content: string) => ipcRenderer.invoke(IPC_CHANNELS.PERSONALIZATION_WRITE_TOPIC, topic, content),
  summarizePersonalization: (sessionId: string, topic: string) => ipcRenderer.invoke(IPC_CHANNELS.PERSONALIZATION_SUMMARIZE, sessionId, topic),
  getPersonalizationSummary: () => ipcRenderer.invoke(IPC_CHANNELS.PERSONALIZATION_GET_SUMMARY),
  writePersonalizationSummary: (content: string) => ipcRenderer.invoke(IPC_CHANNELS.PERSONALIZATION_WRITE_SUMMARY, content),
  syncPersonalizationSummary: () => ipcRenderer.invoke(IPC_CHANNELS.PERSONALIZATION_SYNC_SUMMARY),
})
