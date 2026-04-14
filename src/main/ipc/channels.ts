export const IPC_CHANNELS = {
  // Vault
  VAULT_OPEN: 'vault:open',
  VAULT_CREATE: 'vault:create',
  VAULT_INIT: 'vault:init',
  VAULT_GET_INFO: 'vault:get-info',
  VAULT_SELECT_FOLDER: 'vault:select-folder',
  VAULT_INDEX_ALL: 'vault:index-all',

  // Files
  FILES_LIST: 'files:list',
  FILES_READ: 'files:read',
  FILES_WRITE: 'files:write',
  FILES_MOVE: 'files:move',
  FILES_DELETE: 'files:delete',
  FILES_SEARCH: 'files:search',
  FILES_GET_RECENT: 'files:get-recent',

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
  LLM_ASSESS_THOUGHT: 'llm:assess-thought',

  // Agent
  AGENT_RUN_TASK: 'agent:run-task',
  AGENT_ABORT_TASK: 'agent:abort-task',
  AGENT_GET_TASKS: 'agent:get-tasks',
  AGENT_CHAT: 'agent:chat',
  AGENT_CHAT_OPEN: 'agent:chat-open',
  AGENT_CHAT_SEND: 'agent:chat-send',
  AGENT_CHAT_NEW: 'agent:chat-new',
  AGENT_CHAT_GET_SYSTEM_PROMPT: 'agent:chat-get-system-prompt',
  AGENT_CHAT_GET_ALL_SESSIONS: 'agent:chat-get-all-sessions',

  // Inbox
  INBOX_LIST: 'inbox:list',
  INBOX_READ: 'inbox:read',
  INBOX_MARK_READ: 'inbox:mark-read',
  INBOX_DELETE: 'inbox:delete',
  INBOX_ARCHIVE: 'inbox:archive',
  INBOX_REPLY: 'inbox:reply',
  INBOX_COMPOSE: 'inbox:compose',
  INBOX_CREATE_WELCOME: 'inbox:create-welcome',

  // Schedule
  SCHEDULE_LIST: 'schedule:list',
  SCHEDULE_TOGGLE: 'schedule:toggle',
  SCHEDULE_TRIGGER: 'schedule:trigger',
  SCHEDULE_CREATE: 'schedule:create',
  SCHEDULE_UPDATE: 'schedule:update',
  SCHEDULE_DELETE: 'schedule:delete',
  SCHEDULE_GET_SYSTEM_PROMPT: 'schedule:get-system-prompt',

  // Tools
  TOOLS_GET_CONFIG: 'tools:get-config',
  TOOLS_SET_CONFIG: 'tools:set-config',

  // Skills
  SKILLS_LIST: 'skills:list',
  SKILLS_OPEN_FOLDER: 'skills:open-folder',

  // Graph & Stats
  GRAPH_GET_DATA: 'graph:get-data',
  STATS_GET_OVERVIEW: 'stats:get-overview',

  // Vault reset
  VAULT_RESET: 'vault:reset',

  // Personalization
  PERSONALIZATION_GET_TOPIC: 'personalization:get-topic',
  PERSONALIZATION_WRITE_TOPIC: 'personalization:write-topic',
  PERSONALIZATION_SUMMARIZE: 'personalization:summarize',
  PERSONALIZATION_GET_SUMMARY: 'personalization:get-summary',
  PERSONALIZATION_WRITE_SUMMARY: 'personalization:write-summary',
  PERSONALIZATION_SYNC_SUMMARY: 'personalization:sync-summary',

  // App
  APP_GET_VERSION: 'app:get-version',
  APP_GET_LOGS: 'app:get-logs',
  USER_SELECT_IMAGE: 'user:select-image',

  // Built-in LLM model management
  LLM_MODEL_GET_INFO: 'llm-model:get-info',
  LLM_MODEL_DOWNLOAD: 'llm-model:download',
  LLM_MODEL_CANCEL_DOWNLOAD: 'llm-model:cancel-download',
  LLM_MODEL_DELETE: 'llm-model:delete',
  LLM_MODEL_START: 'llm-model:start',
  LLM_MODEL_STOP: 'llm-model:stop',
  LLM_MLX_DOWNLOAD: 'llm-model:mlx-download',

  // Whisper / Voice
  WHISPER_GET_CONFIG: 'whisper:get-config',
  WHISPER_SET_CONFIG: 'whisper:set-config',
  WHISPER_DOWNLOAD_MODEL: 'whisper:download-model',
  WHISPER_CANCEL_DOWNLOAD: 'whisper:cancel-download',
  WHISPER_DELETE_MODEL: 'whisper:delete-model',
  WHISPER_START_CAPTURE: 'whisper:start-capture',
  WHISPER_STOP_CAPTURE: 'whisper:stop-capture',
  WHISPER_AUDIO_CHUNK: 'whisper:audio-chunk',

  // Updater
  UPDATER_CHECK: 'updater:check',
  UPDATER_DOWNLOAD: 'updater:download',
  UPDATER_INSTALL: 'updater:install',

  // Push (main → renderer)
  PUSH_TASK_UPDATE: 'push:task-update',
  PUSH_UPDATE_STATUS: 'push:update-status',
  PUSH_TASK_END: 'push:task-end',
  PUSH_CHAT_TOOL_USE: 'push:chat-tool-use',
  PUSH_VOICE_DOWNLOAD_PROGRESS: 'push:voice-download-progress',
  PUSH_VOICE_TRANSCRIPT: 'push:voice-transcript',
  PUSH_LLM_DOWNLOAD_PROGRESS: 'push:llm-download-progress',
  PUSH_LLM_STATUS: 'push:llm-status',
  PUSH_LLM_MLX_DOWNLOAD_PROGRESS: 'push:llm-mlx-download-progress',
  PUSH_FILE_CHANGED: 'push:file-changed',
  PUSH_INBOX_UPDATED: 'push:inbox-updated',
} as const

export type IpcChannels = typeof IPC_CHANNELS
