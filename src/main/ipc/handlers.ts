import { ipcMain, dialog, app, BrowserWindow } from 'electron'
import path from 'path'
import fs from 'fs/promises'
import { IPC_CHANNELS } from './channels.js'
import type { DatabaseManager } from '../database/DatabaseManager.js'
import type { AbbeyManager } from '../abbey/AbbeyManager.js'
import { getMainWindow, getAbbeyManager, initAbbeyManager } from '../index.js'
import { LLMProcessManager } from '../agent/LLMProcessManager.js'
import { AgentLoop, TaskRun } from '../agent/AgentLoop.js'
import { LLMClient } from '../agent/LLMClient.js'
import { ChatAgent, InvocationType } from '../agent/ChatAgent.js'
import { Scheduler } from '../scheduler/Scheduler.js'
import { WhisperManager, WHISPER_MODELS, type VoiceConfig } from '../whisper/WhisperManager.js'
import { getToolMetas, DEFAULT_TOOLS_CONFIG } from '../agent/tools/index.js'
import { VoiceCaptureService } from '../whisper/VoiceCaptureService.js'

// Agent state
let llmProcessManager: LLMProcessManager | null = null
let currentAgentLoop: AgentLoop | null = null
let scheduler: Scheduler | null = null

// Chat sessions — keyed by sessionId so the renderer can hold the handle
const activeChatAgents = new Map<string, ChatAgent>()

// Whisper state
let whisperManager: WhisperManager | null = null
let voiceCaptureService: VoiceCaptureService | null = null

function pushToRenderer(channel: string, data: unknown): void {
  const win = getMainWindow()
  win?.webContents.send(channel, data)
}

export function setupIpcHandlers(
  dbManager: DatabaseManager
): void {
  // Initialise whisper manager (lazy, no heavy work until needed)
  whisperManager = new WhisperManager(dbManager)

  // Whisper: Get config + available models
  ipcMain.handle(IPC_CHANNELS.WHISPER_GET_CONFIG, async () => {
    const config = await whisperManager!.getConfig()
    const downloaded = await whisperManager!.listDownloadedModels()
    return { config, models: WHISPER_MODELS, downloaded }
  })

  // Whisper: Set config
  ipcMain.handle(IPC_CHANNELS.WHISPER_SET_CONFIG, async (_, config: VoiceConfig | null) => {
    await whisperManager!.setConfig(config)
    return { success: true }
  })

  // Whisper: Download model (streams progress via push event)
  ipcMain.handle(IPC_CHANNELS.WHISPER_DOWNLOAD_MODEL, async (_, modelName: string) => {
    try {
      await whisperManager!.downloadModel(modelName, (progress) => {
        pushToRenderer(IPC_CHANNELS.PUSH_VOICE_DOWNLOAD_PROGRESS, { modelName, progress })
      })
      return { success: true }
    } catch (error) {
      const message = (error as Error).message
      if (message === 'Download cancelled') {
        return { success: false, cancelled: true }
      }
      return { success: false, error: message }
    }
  })

  // Whisper: Cancel download
  ipcMain.handle(IPC_CHANNELS.WHISPER_CANCEL_DOWNLOAD, async () => {
    whisperManager!.cancelDownload()
    return { success: true }
  })

  // Whisper: Delete model
  ipcMain.handle(IPC_CHANNELS.WHISPER_DELETE_MODEL, async (_, modelName: string) => {
    try {
      await whisperManager!.deleteModel(modelName)
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  // Whisper: Start capture
  ipcMain.handle(IPC_CHANNELS.WHISPER_START_CAPTURE, async () => {
    if (voiceCaptureService) return { success: false, error: 'Already capturing' }

    voiceCaptureService = new VoiceCaptureService(whisperManager!)
    voiceCaptureService.on('transcript', (data: { text: string; isFinal: boolean }) => {
      pushToRenderer(IPC_CHANNELS.PUSH_VOICE_TRANSCRIPT, data)
    })
    voiceCaptureService.start()
    return { success: true }
  })

  // Whisper: Stop capture — await queue so all pending transcriptions finish
  ipcMain.handle(IPC_CHANNELS.WHISPER_STOP_CAPTURE, async () => {
    if (voiceCaptureService) {
      await voiceCaptureService.stop()
      voiceCaptureService = null
    }
    return { success: true }
  })

  // Whisper: Audio chunk from renderer AudioWorklet
  ipcMain.on(IPC_CHANNELS.WHISPER_AUDIO_CHUNK, (_, buffer: ArrayBuffer) => {
    voiceCaptureService?.handleAudioChunk(buffer)
  })
  // Abbey: Select folder dialog
  ipcMain.handle(IPC_CHANNELS.ABBEY_SELECT_FOLDER, async () => {
    const mainWindow = getMainWindow()
    if (!mainWindow) {
      throw new Error('No main window available')
    }
    
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory', 'createDirectory'],
      buttonLabel: 'Select Abbey',
      message: 'Choose a folder for your Scriptorium Abbey',
    })
    
    if (result.canceled || result.filePaths.length === 0) {
      return null
    }
    
    return result.filePaths[0]
  })

  // Abbey: Create new abbey
  ipcMain.handle(IPC_CHANNELS.ABBEY_CREATE, async (_, abbeyPath: string) => {
    try {
      // Create abbey structure
      await fs.mkdir(path.join(abbeyPath, '_drafts'), { recursive: true })
      await fs.mkdir(path.join(abbeyPath, '_inbox'), { recursive: true })
      await fs.mkdir(path.join(abbeyPath, '.scriptorium'), { recursive: true })

      // Create default folders
      await fs.mkdir(path.join(abbeyPath, 'Projects'), { recursive: true })
      await fs.mkdir(path.join(abbeyPath, 'People'), { recursive: true })
      await fs.mkdir(path.join(abbeyPath, 'Ideas'), { recursive: true })
      await fs.mkdir(path.join(abbeyPath, 'Journal'), { recursive: true })

      // Seed default agent profile in DB
      if (!dbManager.getSetting('agentProfile')) {
        dbManager.setSetting('agentProfile', {
          name: 'Wilfred',
          avatar: '✦',
          systemPrompt: `You are Wilfred, a note taking assistant. 
          Your purpose is to organise notes and knowledge. You help 
          to edit notes to make it more structured, you ask for missing information,
          you help research on the internet via tools, and organize notes.

          Your character:
          - Methodical. You work through tasks step by step.
          - Humble. When you do not know where something belongs, you ask.
          - Brief. Your note are clear and concise — do not ramble.
          - Eiger. You want to do things. With tools, instead of talking. 
          - Diligent. You persistent to achieve your goal.
          - Initiative. You can interprete intent and execute without too much ask for clarification.`,
        })
      }

      // Create abbey config
      const config = {
        createdAt: new Date().toISOString(),
        version: '0.1.0',
      }
      await fs.writeFile(
        path.join(abbeyPath, '.scriptorium', 'config.json'),
        JSON.stringify(config, null, 2),
        'utf-8'
      )
      
      // Save abbey path to database and initialize manager
      dbManager.setSetting('abbeyPath', abbeyPath)
      await initAbbeyManager(abbeyPath)

      return { success: true, path: abbeyPath }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  // Abbey: Open existing abbey
  ipcMain.handle(IPC_CHANNELS.ABBEY_OPEN, async (_, abbeyPath: string) => {
    try {
      // Verify it's a valid abbey
      const scriptoriumPath = path.join(abbeyPath, '.scriptorium')
      const stat = await fs.stat(scriptoriumPath).catch(() => null)

      if (!stat?.isDirectory()) {
        return { success: false, needsInit: true, error: 'This folder has not been set up as an abbey yet.' }
      }

      // Ensure required directories exist
      await fs.mkdir(path.join(abbeyPath, '_drafts'), { recursive: true })
      await fs.mkdir(path.join(abbeyPath, '_inbox'), { recursive: true })

      // Save abbey path to database and initialize manager
      dbManager.setSetting('abbeyPath', abbeyPath)
      await initAbbeyManager(abbeyPath)

      return { success: true, path: abbeyPath }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  // Abbey: Initialise an existing folder as an abbey (creates .scriptorium, _drafts, _inbox)
  ipcMain.handle(IPC_CHANNELS.ABBEY_INIT, async (_, abbeyPath: string) => {
    try {
      await fs.mkdir(path.join(abbeyPath, '.scriptorium'), { recursive: true })
      await fs.mkdir(path.join(abbeyPath, '_drafts'), { recursive: true })
      await fs.mkdir(path.join(abbeyPath, '_inbox'), { recursive: true })

      // Seed default agent profile in DB
      if (!dbManager.getSetting('agentProfile')) {
        dbManager.setSetting('agentProfile', {
          name: 'Wilfred',
          avatar: '✦',
          systemPrompt: `You are Wilfred, a note taking assistant. 
          Your purpose is to organise notes and knowledge. You help 
          to edit notes to make it more structured, you ask for missing information,
          you help research on the internet via tools, and organize notes.

          Your character:
          - Methodical. You work through tasks step by step.
          - Humble. When you do not know where something belongs, you ask.
          - Brief. Your notes are clear and concise — do not ramble.
          - Eiger. You want to do things. With tools, instead of talking. 
          - Diligent. You persistent to achieve your goal.
          - Initiative. You can interprete intent and execute without too much ask for clarification.`,
        })
      }

      const config = {
        createdAt: new Date().toISOString(),
        version: '0.1.0',
      }
      await fs.writeFile(
        path.join(abbeyPath, '.scriptorium', 'config.json'),
        JSON.stringify(config, null, 2),
        'utf-8'
      )

      dbManager.setSetting('abbeyPath', abbeyPath)
      await initAbbeyManager(abbeyPath)

      return { success: true, path: abbeyPath }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  // Tools: Get config + metas
  ipcMain.handle(IPC_CHANNELS.TOOLS_GET_CONFIG, () => {
    const saved = dbManager.getSetting('toolsConfig') as Record<string, unknown> | null
    const config = saved ?? DEFAULT_TOOLS_CONFIG
    return { config, metas: getToolMetas() }
  })

  // Tools: Save config
  ipcMain.handle(IPC_CHANNELS.TOOLS_SET_CONFIG, (_, config: unknown) => {
    dbManager.setSetting('toolsConfig', config)
    return { success: true }
  })

  // Abbey: Reset — delete _inbox, _drafts, .scriptorium and clear saved path
  ipcMain.handle(IPC_CHANNELS.ABBEY_RESET, async () => {
    try {
      const abbeyPath = dbManager.getSetting('abbeyPath') as string | null
      if (!abbeyPath) {
        return { success: false, error: 'No abbey configured' }
      }

      // Delete the three system folders
      for (const folder of ['_inbox', '_drafts', '.scriptorium']) {
        const folderPath = path.join(abbeyPath, folder)
        await fs.rm(folderPath, { recursive: true, force: true })
      }

      // Clear the abbey path from the database
      dbManager.setSetting('abbeyPath', null)

      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  // Abbey: Get info
  ipcMain.handle(IPC_CHANNELS.ABBEY_GET_INFO, async () => {
    const abbeyPath = dbManager.getSetting('abbeyPath') as string | null
    if (!abbeyPath) {
      return null
    }
    
    return {
      path: abbeyPath,
      name: path.basename(abbeyPath),
    }
  })

  // Files: List directory
  ipcMain.handle(IPC_CHANNELS.FILES_LIST, async (_, dirPath: string) => {
    const abbey = getAbbeyManager()
    if (!abbey) {
      throw new Error('No abbey initialized')
    }
    
    const fullPath = path.join(abbey.abbeyPath, dirPath)
    const entries = await fs.readdir(fullPath, { withFileTypes: true })
    
    return entries
      .filter(entry => !entry.name.startsWith('.') || entry.name === '.scriptorium')
      .map(entry => ({
        name: entry.name,
        path: path.join(dirPath, entry.name),
        isDirectory: entry.isDirectory(),
      }))
      .sort((a, b) => {
        if (a.isDirectory === b.isDirectory) {
          return a.name.localeCompare(b.name)
        }
        return a.isDirectory ? -1 : 1
      })
  })

  // Files: Read file
  ipcMain.handle(IPC_CHANNELS.FILES_READ, async (_, filePath: string) => {
    const abbey = getAbbeyManager()
    if (!abbey) {
      throw new Error('No abbey initialized')
    }
    
    const fullPath = path.join(abbey.abbeyPath, filePath)
    const content = await fs.readFile(fullPath, 'utf-8')
    return { content, path: filePath }
  })

  // Files: Write file
  ipcMain.handle(IPC_CHANNELS.FILES_WRITE, async (_, filePath: string, content: string) => {
    const abbey = getAbbeyManager()
    if (!abbey) {
      throw new Error('No abbey initialized')
    }

    const fullPath = path.join(abbey.abbeyPath, filePath)
    await fs.mkdir(path.dirname(fullPath), { recursive: true })
    await fs.writeFile(fullPath, content, 'utf-8')
    return { success: true }
  })

  // Files: Move / rename
  ipcMain.handle(IPC_CHANNELS.FILES_MOVE, async (_, from: string, to: string) => {
    const abbey = getAbbeyManager()
    if (!abbey) return { success: false, error: 'No abbey initialized' }

    try {
      const fullFrom = path.join(abbey.abbeyPath, from)
      const fullTo = path.join(abbey.abbeyPath, to)

      const stat = await fs.stat(fullFrom)
      const isDirectory = stat.isDirectory()

      await fs.mkdir(path.dirname(fullTo), { recursive: true })
      await fs.rename(fullFrom, fullTo)

      if (isDirectory) {
        dbManager.renameFolder(from, to)
      } else {
        dbManager.renameFile(from, to)
      }

      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  // Files: Delete
  ipcMain.handle(IPC_CHANNELS.FILES_DELETE, async (_, filePath: string) => {
    const abbey = getAbbeyManager()
    if (!abbey) return { success: false, error: 'No abbey initialized' }

    try {
      const fullPath = path.join(abbey.abbeyPath, filePath)
      const stat = await fs.stat(fullPath)

      if (stat.isDirectory()) {
        await fs.rm(fullPath, { recursive: true, force: true })
        dbManager.deleteFolder(filePath)
      } else {
        await fs.unlink(fullPath)
        dbManager.deleteFile(filePath)
      }

      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  // Settings: Get
  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, async (_, key: string) => {
    return dbManager.getSetting(key)
  })

  // Settings: Set
  ipcMain.handle(IPC_CHANNELS.SETTINGS_SET, async (_, key: string, value: unknown) => {
    dbManager.setSetting(key, value)
    return { success: true }
  })

  // LLM: Test connection
  ipcMain.handle(IPC_CHANNELS.LLM_TEST_CONNECTION, async (_, config: { baseUrl: string; model: string; apiKey?: string }) => {
    try {
      const response = await fetch(`${config.baseUrl}/models`, {
        headers: config.apiKey ? { 'Authorization': `Bearer ${config.apiKey}` } : {},
      })
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const data = await response.json()
      const hasModel = data.data?.some((m: { id: string }) => m.id === config.model) ?? false
      
      return { 
        success: true, 
        available: true,
        hasModel,
        models: data.data?.map((m: { id: string }) => m.id) ?? [],
      }
    } catch (error) {
      return { 
        success: false, 
        error: (error as Error).message,
      }
    }
  })

  // Comments: Get
  ipcMain.handle(IPC_CHANNELS.COMMENTS_GET, async (_, filePath: string) => {
    return dbManager.getComments(filePath)
  })

  // Comments: Add
  ipcMain.handle(IPC_CHANNELS.COMMENTS_ADD, async (_, filePath: string, line: number, content: string, type: string) => {
    const validTypes = ['question', 'suggestion', 'note'] as const
    if (!validTypes.includes(type as typeof validTypes[number])) {
      throw new Error('Invalid comment type')
    }
    return dbManager.addComment(filePath, line, content, type as typeof validTypes[number])
  })

  // Comments: Dismiss
  ipcMain.handle(IPC_CHANNELS.COMMENTS_DISMISS, async (_, id: number) => {
    dbManager.dismissComment(id)
    return { success: true }
  })

  // App: Get version
  ipcMain.handle(IPC_CHANNELS.APP_GET_VERSION, async () => {
    return app.getVersion()
  })

  // User: Select image for avatar
  ipcMain.handle(IPC_CHANNELS.USER_SELECT_IMAGE, async () => {
    const mainWindow = getMainWindow()
    if (!mainWindow) return null

    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] }],
      message: 'Choose a profile picture',
    })

    if (result.canceled || result.filePaths.length === 0) return null

    const filePath = result.filePaths[0]
    const data = await fs.readFile(filePath)
    const ext = path.extname(filePath).slice(1).toLowerCase()
    const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg'
      : ext === 'png' ? 'image/png'
      : ext === 'gif' ? 'image/gif'
      : 'image/webp'
    return `data:${mime};base64,${data.toString('base64')}`
  })

  // LLM: Start server
  ipcMain.handle(IPC_CHANNELS.LLM_START_SERVER, async (_, config: { model: string; port?: number }) => {
    if (llmProcessManager) {
      return { success: false, error: 'Server already running' }
    }

    llmProcessManager = new LLMProcessManager(config)
    
    llmProcessManager.on('status', (status) => {
      // TODO: Send status update to renderer via IPC or EventEmitter
      console.log('LLM status:', status)
    })
    
    llmProcessManager.on('log', (log) => {
      console.log(`[LLM ${log.level}]`, log.message)
    })
    
    llmProcessManager.on('error', (error) => {
      console.error('[LLM error]', error)
    })

    const started = await llmProcessManager.start()
    
    if (started) {
      return { success: true, url: llmProcessManager.getUrl() }
    } else {
      llmProcessManager = null
      return { success: false, error: 'Failed to start server' }
    }
  })

  // LLM: Stop server
  ipcMain.handle(IPC_CHANNELS.LLM_STOP_SERVER, async () => {
    llmProcessManager?.stop()
    llmProcessManager = null
    return { success: true }
  })

  // LLM: Get status (updated)
  ipcMain.handle(IPC_CHANNELS.LLM_GET_STATUS, async () => {
    return {
      running: llmProcessManager?.isRunning() ?? false,
      url: llmProcessManager?.getUrl() ?? null,
      managed: llmProcessManager !== null,
    }
  })

  // Agent: Run task
  ipcMain.handle(IPC_CHANNELS.AGENT_RUN_TASK, async (_, taskName: string, instruction: string) => {
    const abbey = getAbbeyManager()
    if (!abbey) {
      return { success: false, error: 'No abbey initialized' }
    }

    const llmConfig = dbManager.getSetting('llmConfig') as { baseUrl: string; model: string; apiKey?: string } | null
    if (!llmConfig) {
      return { success: false, error: 'LLM not configured' }
    }

    const agentProfile = dbManager.getSetting('agentProfile') as { name?: string; avatar?: string; systemPrompt?: string } | null
    const persona = agentProfile?.systemPrompt ?? 'You are Wilfred, a note taking assistant'

    const toolsConfig = dbManager.getSetting('toolsConfig') as Record<string, { enabled: boolean; config?: Record<string, string> }> | null

    currentAgentLoop = new AgentLoop(
      {
        abbeyPath: abbey.abbeyPath,
        dbManager,
        llmConfig,
        persona,
        toolsConfig: toolsConfig ?? DEFAULT_TOOLS_CONFIG,
      },
      (run) => {
        // Task updates logged to database
        if (run.status !== 'running') {
          dbManager.logTaskRun({
            task_name: run.taskName,
            started_at: run.startedAt,
            ended_at: run.endedAt || Date.now(),
            status: run.status,
            summary: run.summary || '',
            tool_calls: run.toolCalls,
          })
        }
      }
    )

    const result = await currentAgentLoop.runTask(taskName, instruction)
    currentAgentLoop = null

    return { success: result.status === 'done', result }
  })

  // Agent: Chat (single LLM call, no tool loop)
  ipcMain.handle(IPC_CHANNELS.AGENT_CHAT, async (_, message: string) => {
    const llmConfig = dbManager.getSetting('llmConfig') as { baseUrl: string; model: string; apiKey?: string } | null
    if (!llmConfig) {
      return { success: false, error: 'LLM not configured' }
    }

    const agentProfileChat = dbManager.getSetting('agentProfile') as { name?: string; avatar?: string; systemPrompt?: string } | null
    const persona = agentProfileChat?.systemPrompt ?? 'You are Wilfred, a note taking assistant. Respond briefly and in character.'

    try {
      const client = new LLMClient(llmConfig)
      const response = await client.chat([
        { role: 'system', content: persona },
        { role: 'user', content: message },
      ])
      return { success: true, content: response.content }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  // Agent: Open or resume a chat session
  ipcMain.handle(
    IPC_CHANNELS.AGENT_CHAT_OPEN,
    async (_, contextType: InvocationType, contextKey: string, filePath?: string) => {
      const abbey = getAbbeyManager()
      if (!abbey) return { success: false, error: 'No abbey initialized' }

      const llmConfig = dbManager.getSetting('llmConfig') as { baseUrl: string; model: string; apiKey?: string } | null
      if (!llmConfig) return { success: false, error: 'LLM not configured' }

      const agentProfile = dbManager.getSetting('agentProfile') as { systemPrompt?: string } | null
      const persona = agentProfile?.systemPrompt ?? 'You are a diligent assistant in the Scriptorium.'

      try {
        const chatToolsConfig = dbManager.getSetting('toolsConfig') as Record<string, { enabled: boolean; config?: Record<string, string> }> | null
        const { agent, sessionId, history } = await ChatAgent.open(
          { abbeyPath: abbey.abbeyPath, dbManager, llmConfig, persona, toolsConfig: chatToolsConfig ?? DEFAULT_TOOLS_CONFIG },
          contextType,
          contextKey,
          filePath
        )
        activeChatAgents.set(sessionId, agent)
        return { success: true, sessionId, history }
      } catch (error) {
        return { success: false, error: (error as Error).message }
      }
    }
  )

  // Agent: Send a chat message on an existing session
  ipcMain.handle(IPC_CHANNELS.AGENT_CHAT_SEND, async (_, sessionId: string, message: string) => {
    const agent = activeChatAgents.get(sessionId)
    if (!agent) return { success: false, error: 'Session not found' }

    try {
      dbManager.touchChatSession(sessionId)
      const { content, toolCallCount } = await agent.send(message, (toolName, args) => {
        pushToRenderer(IPC_CHANNELS.PUSH_CHAT_TOOL_USE, { sessionId, toolName, args })
      })
      return { success: true, content, toolCallCount }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  // Agent: Clear session and start fresh for the same context
  ipcMain.handle(
    IPC_CHANNELS.AGENT_CHAT_NEW,
    async (_, contextType: InvocationType, contextKey: string, filePath?: string) => {
      const abbey = getAbbeyManager()
      if (!abbey) return { success: false, error: 'No abbey initialized' }

      const llmConfig = dbManager.getSetting('llmConfig') as { baseUrl: string; model: string; apiKey?: string } | null
      if (!llmConfig) return { success: false, error: 'LLM not configured' }

      const agentProfile = dbManager.getSetting('agentProfile') as { systemPrompt?: string } | null
      const persona = agentProfile?.systemPrompt ?? 'You are a diligent assistant in the Scriptorium.'

      try {
        const freshToolsConfig = dbManager.getSetting('toolsConfig') as Record<string, { enabled: boolean; config?: Record<string, string> }> | null
        const { agent, sessionId } = await ChatAgent.openFresh(
          { abbeyPath: abbey.abbeyPath, dbManager, llmConfig, persona, toolsConfig: freshToolsConfig ?? DEFAULT_TOOLS_CONFIG },
          contextType,
          contextKey,
          filePath
        )
        activeChatAgents.set(sessionId, agent)
        return { success: true, sessionId }
      } catch (error) {
        return { success: false, error: (error as Error).message }
      }
    }
  )

  // Agent: Get the composed system prompt for a session (read-only, for UI display)
  ipcMain.handle(IPC_CHANNELS.AGENT_CHAT_GET_SYSTEM_PROMPT, async (_, sessionId: string) => {
    const agent = activeChatAgents.get(sessionId)
    if (!agent) return { success: false, error: 'Session not found' }
    return { success: true, systemPrompt: agent.getSystemPrompt() }
  })

  // Agent: Abort task
  ipcMain.handle(IPC_CHANNELS.AGENT_ABORT_TASK, async () => {
    currentAgentLoop?.abort()
    return { success: true }
  })

  // Agent: Get recent tasks
  ipcMain.handle(IPC_CHANNELS.AGENT_GET_TASKS, async () => {
    return dbManager.getRecentTaskRuns(20)
  })

  // Inbox: List
  ipcMain.handle(IPC_CHANNELS.INBOX_LIST, async () => {
    const abbey = getAbbeyManager()
    if (!abbey) {
      return []
    }

    try {
      const inboxPath = path.join(abbey.abbeyPath, '_inbox')
      const entries = await fs.readdir(inboxPath, { withFileTypes: true })

      const items = await Promise.all(
        entries
          .filter(e => e.isFile() && e.name.endsWith('.md'))
          .map(async (e) => {
            const filePath = path.join(inboxPath, e.name)
            const content = await fs.readFile(filePath, 'utf-8')

            // Parse frontmatter quickly
            const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/)
            const frontmatter: Record<string, unknown> = {}

            if (frontmatterMatch) {
              const lines = frontmatterMatch[1].split('\n')
              for (const line of lines) {
                const colonIndex = line.indexOf(':')
                if (colonIndex > 0) {
                  const key = line.slice(0, colonIndex).trim()
                  const value = line.slice(colonIndex + 1).trim()
                  try {
                    frontmatter[key] = JSON.parse(value)
                  } catch {
                    frontmatter[key] = value
                  }
                }
              }
            }

            return {
              id: e.name,
              path: `_inbox/${e.name}`,
              title: content.match(/^# (.+)$/m)?.[1] ?? e.name,
              type: frontmatter.type ?? 'insight',
              created: frontmatter.created ?? new Date().toISOString(),
              status: frontmatter.status ?? 'unread',
            }
          })
      )

      return items.sort((a, b) => new Date(b.created as string).getTime() - new Date(a.created as string).getTime())
    } catch {
      return []
    }
  })

  // Inbox: Read
  ipcMain.handle(IPC_CHANNELS.INBOX_READ, async (_, filename: string) => {
    const abbey = getAbbeyManager()
    if (!abbey) {
      throw new Error('No abbey initialized')
    }

    const filePath = path.join(abbey.abbeyPath, '_inbox', filename)
    const content = await fs.readFile(filePath, 'utf-8')
    return { content, path: `_inbox/${filename}` }
  })

  // Inbox: Mark read
  ipcMain.handle(IPC_CHANNELS.INBOX_MARK_READ, async (_, filename: string) => {
    const abbey = getAbbeyManager()
    if (!abbey) {
      throw new Error('No abbey initialized')
    }

    const filePath = path.join(abbey.abbeyPath, '_inbox', filename)
    let content = await fs.readFile(filePath, 'utf-8')

    // Replace status: unread with status: read
    content = content.replace(/status: unread/, 'status: read')

    await fs.writeFile(filePath, content, 'utf-8')
    return { success: true }
  })

  // Schedule: List
  ipcMain.handle(IPC_CHANNELS.SCHEDULE_LIST, async () => {
    return dbManager.getSchedules()
  })

  // Schedule: Toggle active
  ipcMain.handle(IPC_CHANNELS.SCHEDULE_TOGGLE, async (_, id: number, isActive: boolean) => {
    dbManager.toggleSchedule(id, isActive)
    scheduler?.reloadHour(id)
    return { success: true }
  })

  // Schedule: Trigger manually
  ipcMain.handle(IPC_CHANNELS.SCHEDULE_TRIGGER, async (_, id: number) => {
    const abbey = getAbbeyManager()
    if (!abbey) {
      return { success: false, error: 'No abbey initialized' }
    }
    if (!scheduler) {
      return { success: false, error: 'Scheduler not started' }
    }
    try {
      const result = await scheduler.triggerNow(id)
      return { success: true, result }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  // Schedule: Create
  ipcMain.handle(IPC_CHANNELS.SCHEDULE_CREATE, async (_, name: string, schedule: string, prompt: string) => {
    try {
      const id = dbManager.createSchedule(name, schedule, prompt)
      scheduler?.reloadAll()
      return { success: true, id }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  // Schedule: Update
  ipcMain.handle(IPC_CHANNELS.SCHEDULE_UPDATE, async (_, id: number, name: string, schedule: string, prompt: string) => {
    try {
      dbManager.updateSchedule(id, name, schedule, prompt)
      scheduler?.reloadHour(id)
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  // Schedule: Delete
  ipcMain.handle(IPC_CHANNELS.SCHEDULE_DELETE, async (_, id: number) => {
    try {
      scheduler?.stopJob(id)
      dbManager.deleteSchedule(id)
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  // Task: List pending/future
  ipcMain.handle(IPC_CHANNELS.TASK_LIST, async () => {
    return dbManager.listPendingAndFutureTasks()
  })

  // Task: Create
  ipcMain.handle(IPC_CHANNELS.TASK_CREATE, async (_, name: string, prompt: string, runAt: number | null) => {
    try {
      const id = dbManager.createTask(name, prompt, runAt)
      if (runAt === null) {
        // Fire immediately via scheduler (or inline if scheduler not ready)
        scheduler?.runOneOffTask(id, name, prompt)
      }
      return { success: true, id }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  // Task: Update
  ipcMain.handle(IPC_CHANNELS.TASK_UPDATE, async (_, id: number, name: string, prompt: string, runAt: number | null) => {
    try {
      dbManager.updateTask(id, name, prompt, runAt)
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  // Task: Delete
  ipcMain.handle(IPC_CHANNELS.TASK_DELETE, async (_, id: number) => {
    try {
      dbManager.deleteTask(id)
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })
}

export function setupScheduler(dbManager: DatabaseManager): void {
  const abbey = getAbbeyManager()
  if (!abbey) {
    throw new Error('Cannot start scheduler without abbey')
  }
  scheduler = new Scheduler(dbManager, abbey)

  scheduler.on('taskUpdate', (run: TaskRun) => {
    pushToRenderer(IPC_CHANNELS.PUSH_TASK_UPDATE, run)
  })

  scheduler.on('taskEnd', (run: TaskRun) => {
    pushToRenderer(IPC_CHANNELS.PUSH_TASK_END, run)
  })

  scheduler.start()
}
