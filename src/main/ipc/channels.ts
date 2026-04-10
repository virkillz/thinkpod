export const IPC_CHANNELS = {
  // Vault
  VAULT_OPEN: 'vault:open',
  VAULT_CREATE: 'vault:create',
  VAULT_INIT: 'vault:init',
  VAULT_GET_INFO: 'vault:get-info',
  VAULT_SELECT_FOLDER: 'vault:select-folder',

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
  LLM_EDIT_TEXT: 'llm:edit-text',
  LLM_SUGGEST_FOLDER: 'llm:suggest-folder',
  LLM_CLASSIFY_THOUGHT: 'llm:classify-thought',
  LLM_GET_MISSING_FIELDS: 'llm:get-missing-fields',
  LLM_REFORMAT_THOUGHT: 'llm:reformat-thought',

  // Agent
  AGENT_RUN_TASK: 'agent:run-task',
  AGENT_ABORT_TASK: 'agent:abort-task',
  AGENT_GET_TASKS: 'agent:get-tasks',
  AGENT_CHAT: 'agent:chat',
  AGENT_CHAT_OPEN: 'agent:chat-open',
  AGENT_CHAT_SEND: 'agent:chat-send',
  AGENT_CHAT_NEW: 'agent:chat-new',
  AGENT_CHAT_GET_SYSTEM_PROMPT: 'agent:chat-get-system-prompt',

  // Inbox
  INBOX_LIST: 'inbox:list',
  INBOX_READ: 'inbox:read',
  INBOX_MARK_READ: 'inbox:mark-read',
  INBOX_DELETE: 'inbox:delete',
  INBOX_REPLY: 'inbox:reply',

  // Schedule
  SCHEDULE_LIST: 'schedule:list',
  SCHEDULE_TOGGLE: 'schedule:toggle',
  SCHEDULE_TRIGGER: 'schedule:trigger',
  SCHEDULE_CREATE: 'schedule:create',
  SCHEDULE_UPDATE: 'schedule:update',
  SCHEDULE_DELETE: 'schedule:delete',

  // Tasks (one-time)
  TASK_CREATE: 'task:create',
  TASK_UPDATE: 'task:update',
  TASK_DELETE: 'task:delete',
  TASK_LIST: 'task:list',

  // Tools
  TOOLS_GET_CONFIG: 'tools:get-config',
  TOOLS_SET_CONFIG: 'tools:set-config',

  // Cognitive jobs (system scheduler)
  COGNITIVE_JOB_LIST: 'cognitive:list',
  COGNITIVE_JOB_TRIGGER: 'cognitive:trigger',
  COGNITIVE_JOB_DRY_RUN: 'cognitive:dry-run',
  COGNITIVE_JOB_TOGGLE: 'cognitive:toggle',
  COGNITIVE_JOB_EDIT_SCHEDULE: 'cognitive:edit-schedule',
  PUSH_COGNITIVE_JOB_PROGRESS: 'push:cognitive-job-progress',

  // Vault reset
  VAULT_RESET: 'vault:reset',

  // App
  APP_GET_VERSION: 'app:get-version',
  USER_SELECT_IMAGE: 'user:select-image',

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
  PUSH_CHAT_TOOL_USE: 'push:chat-tool-use',
  PUSH_VOICE_DOWNLOAD_PROGRESS: 'push:voice-download-progress',
  PUSH_VOICE_TRANSCRIPT: 'push:voice-transcript',
} as const

export type IpcChannels = typeof IPC_CHANNELS
