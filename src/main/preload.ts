import { contextBridge, ipcRenderer } from 'electron'

// Import channels as a simple object to avoid module resolution issues
const IPC_CHANNELS = {
  ABBEY_SELECT_FOLDER: 'abbey:select-folder',
  ABBEY_CREATE: 'abbey:create',
  ABBEY_INIT: 'abbey:init',
  ABBEY_OPEN: 'abbey:open',
  ABBEY_GET_INFO: 'abbey:get-info',
  FILES_LIST: 'files:list',
  FILES_READ: 'files:read',
  FILES_WRITE: 'files:write',
  FILES_MOVE: 'files:move',
  FILES_DELETE: 'files:delete',
  COMMENTS_GET: 'comments:get',
  COMMENTS_ADD: 'comments:add',
  COMMENTS_DISMISS: 'comments:dismiss',
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',
  LLM_TEST_CONNECTION: 'llm:test-connection',
  LLM_GET_STATUS: 'llm:get-status',
  LLM_START_SERVER: 'llm:start-server',
  LLM_STOP_SERVER: 'llm:stop-server',
  AGENT_RUN_TASK: 'agent:run-task',
  AGENT_ABORT_TASK: 'agent:abort-task',
  AGENT_GET_TASKS: 'agent:get-tasks',
  AGENT_CHAT: 'agent:chat',
  EPISTLES_LIST: 'epistles:list',
  EPISTLES_READ: 'epistles:read',
  EPISTLES_MARK_READ: 'epistles:mark-read',
  HOURS_LIST: 'hours:list',
  HOURS_TOGGLE: 'hours:toggle',
  HOURS_TRIGGER: 'hours:trigger',
  APP_GET_VERSION: 'app:get-version',
  PUSH_TASK_UPDATE: 'push:task-update',
  PUSH_TASK_END: 'push:task-end',
}

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Abbey
  selectAbbeyFolder: () => ipcRenderer.invoke(IPC_CHANNELS.ABBEY_SELECT_FOLDER),
  createAbbey: (path: string) => ipcRenderer.invoke(IPC_CHANNELS.ABBEY_CREATE, path),
  initAbbey: (path: string) => ipcRenderer.invoke(IPC_CHANNELS.ABBEY_INIT, path),
  openAbbey: (path: string) => ipcRenderer.invoke(IPC_CHANNELS.ABBEY_OPEN, path),
  getAbbeyInfo: () => ipcRenderer.invoke(IPC_CHANNELS.ABBEY_GET_INFO),

  // Files
  listFiles: (path: string) => ipcRenderer.invoke(IPC_CHANNELS.FILES_LIST, path),
  readFile: (path: string) => ipcRenderer.invoke(IPC_CHANNELS.FILES_READ, path),
  writeFile: (path: string, content: string) => ipcRenderer.invoke(IPC_CHANNELS.FILES_WRITE, path, content),
  moveFile: (from: string, to: string) => ipcRenderer.invoke(IPC_CHANNELS.FILES_MOVE, from, to),
  deleteFile: (path: string) => ipcRenderer.invoke(IPC_CHANNELS.FILES_DELETE, path),

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

  // Agent
  runAgentTask: (taskName: string, instruction: string) => ipcRenderer.invoke(IPC_CHANNELS.AGENT_RUN_TASK, taskName, instruction),
  abortAgentTask: () => ipcRenderer.invoke(IPC_CHANNELS.AGENT_ABORT_TASK),
  getAgentTasks: () => ipcRenderer.invoke(IPC_CHANNELS.AGENT_GET_TASKS),
  agentChat: (message: string) => ipcRenderer.invoke(IPC_CHANNELS.AGENT_CHAT, message),

  // Epistles
  listEpistles: () => ipcRenderer.invoke(IPC_CHANNELS.EPISTLES_LIST),
  readEpistle: (filename: string) => ipcRenderer.invoke(IPC_CHANNELS.EPISTLES_READ, filename),
  markEpistleRead: (filename: string) => ipcRenderer.invoke(IPC_CHANNELS.EPISTLES_MARK_READ, filename),

  // Canonical hours
  listHours: () => ipcRenderer.invoke(IPC_CHANNELS.HOURS_LIST),
  toggleHour: (id: number, isActive: boolean) => ipcRenderer.invoke(IPC_CHANNELS.HOURS_TOGGLE, id, isActive),
  triggerHour: (id: number) => ipcRenderer.invoke(IPC_CHANNELS.HOURS_TRIGGER, id),

  // App
  getAppVersion: () => ipcRenderer.invoke(IPC_CHANNELS.APP_GET_VERSION),

  // Push events (main → renderer)
  onTaskUpdate: (callback: (run: unknown) => void) => {
    ipcRenderer.on(IPC_CHANNELS.PUSH_TASK_UPDATE, (_, run) => callback(run))
    return () => ipcRenderer.removeAllListeners(IPC_CHANNELS.PUSH_TASK_UPDATE)
  },
  onTaskEnd: (callback: (run: unknown) => void) => {
    ipcRenderer.on(IPC_CHANNELS.PUSH_TASK_END, (_, run) => callback(run))
    return () => ipcRenderer.removeAllListeners(IPC_CHANNELS.PUSH_TASK_END)
  },
})
