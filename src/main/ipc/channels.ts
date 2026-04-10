export const IPC_CHANNELS = {
  // Abbey
  ABBEY_OPEN: 'abbey:open',
  ABBEY_CREATE: 'abbey:create',
  ABBEY_INIT: 'abbey:init',
  ABBEY_GET_INFO: 'abbey:get-info',
  ABBEY_SELECT_FOLDER: 'abbey:select-folder',
  
  // Files
  FILES_LIST: 'files:list',
  FILES_READ: 'files:read',
  FILES_WRITE: 'files:write',
  FILES_MOVE: 'files:move',
  FILES_DELETE: 'files:delete',
  
  // Comments
  COMMENTS_GET: 'comments:get',
  COMMENTS_ADD: 'comments:add',
  COMMENTS_DISMISS: 'comments:dismiss',
  
  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',
  
  // LLM
  LLM_TEST_CONNECTION: 'llm:test-connection',
  LLM_GET_STATUS: 'llm:get-status',
  LLM_START_SERVER: 'llm:start-server',
  LLM_STOP_SERVER: 'llm:stop-server',
  
  // Agent
  AGENT_RUN_TASK: 'agent:run-task',
  AGENT_ABORT_TASK: 'agent:abort-task',
  AGENT_GET_TASKS: 'agent:get-tasks',
  AGENT_CHAT: 'agent:chat',
  
  // Epistles
  EPISTLES_LIST: 'epistles:list',
  EPISTLES_READ: 'epistles:read',
  EPISTLES_MARK_READ: 'epistles:mark-read',

  // Canonical hours
  HOURS_LIST: 'hours:list',
  HOURS_TOGGLE: 'hours:toggle',
  HOURS_TRIGGER: 'hours:trigger',

  // Abbey reset
  ABBEY_RESET: 'abbey:reset',

  // App
  APP_GET_VERSION: 'app:get-version',

  // Whisper / Voice
  WHISPER_GET_CONFIG: 'whisper:get-config',
  WHISPER_SET_CONFIG: 'whisper:set-config',
  WHISPER_DOWNLOAD_MODEL: 'whisper:download-model',
  WHISPER_CANCEL_DOWNLOAD: 'whisper:cancel-download',
  WHISPER_DELETE_MODEL: 'whisper:delete-model',
  WHISPER_START_CAPTURE: 'whisper:start-capture',
  WHISPER_STOP_CAPTURE: 'whisper:stop-capture',
  WHISPER_AUDIO_CHUNK: 'whisper:audio-chunk',

  // Push (main → renderer)
  PUSH_TASK_UPDATE: 'push:task-update',
  PUSH_TASK_END: 'push:task-end',
  PUSH_VOICE_DOWNLOAD_PROGRESS: 'push:voice-download-progress',
  PUSH_VOICE_TRANSCRIPT: 'push:voice-transcript',
} as const

export type IpcChannels = typeof IPC_CHANNELS
