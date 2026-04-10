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

  // Push (main → renderer)
  PUSH_TASK_UPDATE: 'push:task-update',
  PUSH_TASK_END: 'push:task-end',
} as const

export type IpcChannels = typeof IPC_CHANNELS
