import { ipcMain, dialog, app, BrowserWindow } from 'electron'
import path from 'path'
import fs from 'fs/promises'
import { IPC_CHANNELS } from './channels.js'
import type { DatabaseManager } from '../database/DatabaseManager.js'
import type { VaultManager } from '../vault/VaultManager.js'
import { getMainWindow, getVaultManager, initVaultManager } from '../index.js'
import { LLMProcessManager } from '../agent/LLMProcessManager.js'
import { AgentLoop, TaskRun } from '../agent/AgentLoop.js'
import { LLMClient } from '../agent/LLMClient.js'
import { ChatAgent, InvocationType } from '../agent/ChatAgent.js'
import { Scheduler } from '../scheduler/Scheduler.js'
import { WhisperManager, WHISPER_MODELS, type VoiceConfig } from '../whisper/WhisperManager.js'
import { getToolMetas, DEFAULT_TOOLS_CONFIG } from '../agent/tools/index.js'
import { VoiceCaptureService } from '../whisper/VoiceCaptureService.js'
import { CognitiveRunner } from '../agent/CognitiveRunner.js'
import { AgentVaultManager } from '../agent_vault/AgentVaultManager.js'
import { run as runProcessNewFiles, type CognitiveJobContext, type JobResult } from '../cognitive_jobs/ProcessNewFilesJob.js'

// ── Cognitive job helpers ─────────────────────────────────────────────────────

async function buildCognitiveContext(dbManager: DatabaseManager): Promise<{ runner: CognitiveRunner; manager: AgentVaultManager }> {
  const vaultManager = getVaultManager()
  if (!vaultManager) throw new Error('Vault not open')

  const llmConfig = dbManager.getSetting('llmConfig') as { baseUrl: string; model: string; apiKey?: string } | null
  if (!llmConfig?.baseUrl || !llmConfig?.model) throw new Error('LLM not configured')

  const manager = new AgentVaultManager(vaultManager.vaultPath)
  await manager.initialize()

  const runner = new CognitiveRunner(llmConfig)
  return { runner, manager }
}

async function runCognitiveJob(name: string, ctx: CognitiveJobContext): Promise<JobResult | null> {
  if (name === 'process_new_files') return runProcessNewFiles(ctx)
  // Other jobs will be added in later phases
  return null
}

// ── Agent state ───────────────────────────────────────────────────────────────

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
  ipcMain.handle(IPC_CHANNELS.VAULT_SELECT_FOLDER, async () => {
    const mainWindow = getMainWindow()
    if (!mainWindow) {
      throw new Error('No main window available')
    }
    
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory', 'createDirectory'],
      buttonLabel: 'Select Vault',
      message: 'Choose a folder for your ThinkPod Vault',
    })
    
    if (result.canceled || result.filePaths.length === 0) {
      return null
    }
    
    return result.filePaths[0]
  })

  // Abbey: Create new abbey
  ipcMain.handle(IPC_CHANNELS.VAULT_CREATE, async (_, abbeyPath: string) => {
    try {
      // Create abbey structure
      await fs.mkdir(path.join(abbeyPath, '_thoughts'), { recursive: true })
      await fs.mkdir(path.join(abbeyPath, '_inbox'), { recursive: true })
      await fs.mkdir(path.join(abbeyPath, '.thinkpod'), { recursive: true })

      // Create default folders (align with template defaultFolder values)
      await fs.mkdir(path.join(abbeyPath, 'Bookmarks'), { recursive: true })
      await fs.mkdir(path.join(abbeyPath, 'Ideas'), { recursive: true })
      await fs.mkdir(path.join(abbeyPath, 'Journal'), { recursive: true })
      await fs.mkdir(path.join(abbeyPath, 'Meetings'), { recursive: true })
      await fs.mkdir(path.join(abbeyPath, 'Others'), { recursive: true })
      await fs.mkdir(path.join(abbeyPath, 'Projects'), { recursive: true })
      await fs.mkdir(path.join(abbeyPath, 'Todos'), { recursive: true })

      // Seed default agent profile in DB
      if (!dbManager.getSetting('agentProfile')) {
        dbManager.setSetting('agentProfile', {
          name: 'Wilfred',
          avatar: '✦',
          systemPrompt: `You are Wilfred, a thoughtful friend who loves to brainstorm and explore ideas together.
          You're knowledgeable, smart, and genuinely supportive — like that friend who's always curious,
          asks great questions, and helps you think through things without judgment.

          Your approach:
          - Collaborative. You think *with* the user, not just for them. You bounce ideas back and forth.
          - Curious. You ask thoughtful questions that spark deeper thinking.
          - Knowledgeable. You bring relevant insights, patterns, and connections to the conversation.
          - Supportive. You encourage exploration and make the user feel heard and understood.
          - Clear. You communicate ideas simply and elegantly, avoiding unnecessary jargon.
          - Practical. When action is needed, you help break things down into doable steps.

          Whether organizing notes, researching, editing, or just chatting — you're here as a thinking partner.`,
        })
      }

      // Create abbey config
      const config = {
        createdAt: new Date().toISOString(),
        version: '0.1.0',
      }
      await fs.writeFile(
        path.join(abbeyPath, '.thinkpod', 'config.json'),
        JSON.stringify(config, null, 2),
        'utf-8'
      )
      
      // Save abbey path to database and initialize manager
      dbManager.setSetting('vaultPath', abbeyPath)
      await initVaultManager(abbeyPath)

      return { success: true, path: abbeyPath }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  // Abbey: Open existing abbey
  ipcMain.handle(IPC_CHANNELS.VAULT_OPEN, async (_, abbeyPath: string) => {
    try {
      // Verify it's a valid abbey
      const scriptoriumPath = path.join(abbeyPath, '.thinkpod')
      const stat = await fs.stat(scriptoriumPath).catch(() => null)

      if (!stat?.isDirectory()) {
        return { success: false, needsInit: true, error: 'This folder has not been set up as a vault yet.' }
      }

      // Ensure required directories exist
      await fs.mkdir(path.join(abbeyPath, '_thoughts'), { recursive: true })
      await fs.mkdir(path.join(abbeyPath, '_inbox'), { recursive: true })

      // Save abbey path to database and initialize manager
      dbManager.setSetting('vaultPath', abbeyPath)
      await initVaultManager(abbeyPath)

      return { success: true, path: abbeyPath }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  // Abbey: Initialise an existing folder as an abbey (creates .thinkpod, _thoughts, _inbox)
  ipcMain.handle(IPC_CHANNELS.VAULT_INIT, async (_, abbeyPath: string) => {
    try {
      await fs.mkdir(path.join(abbeyPath, '.thinkpod'), { recursive: true })
      await fs.mkdir(path.join(abbeyPath, '_thoughts'), { recursive: true })
      await fs.mkdir(path.join(abbeyPath, '_inbox'), { recursive: true })

      // Seed default agent profile in DB
      if (!dbManager.getSetting('agentProfile')) {
        dbManager.setSetting('agentProfile', {
          name: 'Wilfred',
          avatar: '✦',
          systemPrompt: `You are Wilfred, a thoughtful friend who loves to brainstorm and explore ideas together.
          You're knowledgeable, smart, and genuinely supportive — like that friend who's always curious,
          asks great questions, and helps you think through things without judgment.

          Your approach:
          - Collaborative. You think *with* the user, not just for them. You bounce ideas back and forth.
          - Curious. You ask thoughtful questions that spark deeper thinking.
          - Knowledgeable. You bring relevant insights, patterns, and connections to the conversation.
          - Supportive. You encourage exploration and make the user feel heard and understood.
          - Clear. You communicate ideas simply and elegantly, avoiding unnecessary jargon.
          - Practical. When action is needed, you help break things down into doable steps.

          Whether organizing notes, researching, editing, or just chatting — you're here as a thinking partner.`,
        })
      }

      const config = {
        createdAt: new Date().toISOString(),
        version: '0.1.0',
      }
      await fs.writeFile(
        path.join(abbeyPath, '.thinkpod', 'config.json'),
        JSON.stringify(config, null, 2),
        'utf-8'
      )

      dbManager.setSetting('vaultPath', abbeyPath)
      await initVaultManager(abbeyPath)

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

  // Abbey: Reset — delete _inbox, _thoughts, .thinkpod and clear saved path
  ipcMain.handle(IPC_CHANNELS.VAULT_RESET, async () => {
    try {
      const abbeyPath = dbManager.getSetting('vaultPath') as string | null
      if (!abbeyPath) {
        return { success: false, error: 'No vault configured' }
      }

      // Delete the three system folders
      for (const folder of ['_inbox', '_thoughts', '.thinkpod']) {
        const folderPath = path.join(abbeyPath, folder)
        await fs.rm(folderPath, { recursive: true, force: true })
      }

      // Clear the abbey path from the database
      dbManager.setSetting('vaultPath', null)

      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  // Abbey: Get info
  ipcMain.handle(IPC_CHANNELS.VAULT_GET_INFO, async () => {
    const abbeyPath = dbManager.getSetting('vaultPath') as string | null
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
    const abbey = getVaultManager()
    if (!abbey) {
      throw new Error('No vault initialized')
    }
    
    const fullPath = path.join(abbey.vaultPath, dirPath)
    const entries = await fs.readdir(fullPath, { withFileTypes: true })
    
    return entries
      .filter(entry => !entry.name.startsWith('.') || entry.name === '.thinkpod')
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
    const abbey = getVaultManager()
    if (!abbey) {
      throw new Error('No vault initialized')
    }
    
    const fullPath = path.join(abbey.vaultPath, filePath)
    const content = await fs.readFile(fullPath, 'utf-8')
    return { content, path: filePath }
  })

  // Files: Write file
  ipcMain.handle(IPC_CHANNELS.FILES_WRITE, async (_, filePath: string, content: string) => {
    const abbey = getVaultManager()
    if (!abbey) {
      throw new Error('No vault initialized')
    }

    const fullPath = path.join(abbey.vaultPath, filePath)
    await fs.mkdir(path.dirname(fullPath), { recursive: true })
    await fs.writeFile(fullPath, content, 'utf-8')
    return { success: true }
  })

  // Files: Move / rename
  ipcMain.handle(IPC_CHANNELS.FILES_MOVE, async (_, from: string, to: string) => {
    const abbey = getVaultManager()
    if (!abbey) return { success: false, error: 'No vault initialized' }

    try {
      const fullFrom = path.join(abbey.vaultPath, from)
      const fullTo = path.join(abbey.vaultPath, to)

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
    const abbey = getVaultManager()
    if (!abbey) return { success: false, error: 'No vault initialized' }

    try {
      const fullPath = path.join(abbey.vaultPath, filePath)
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
    const abbey = getVaultManager()
    if (!abbey) {
      return { success: false, error: 'No vault initialized' }
    }

    const llmConfig = dbManager.getSetting('llmConfig') as { baseUrl: string; model: string; apiKey?: string } | null
    if (!llmConfig) {
      return { success: false, error: 'LLM not configured' }
    }

    const agentProfile = dbManager.getSetting('agentProfile') as { name?: string; avatar?: string; systemPrompt?: string } | null
    const persona = agentProfile?.systemPrompt ?? 'You are Wilfred, a thoughtful friend who loves brainstorming and exploring ideas together.'

    const toolsConfig = dbManager.getSetting('toolsConfig') as Record<string, { enabled: boolean; config?: Record<string, string> }> | null

    currentAgentLoop = new AgentLoop(
      {
        vaultPath: abbey.vaultPath,
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
    const persona = agentProfileChat?.systemPrompt ?? 'You are Wilfred, a thoughtful friend who loves brainstorming and exploring ideas together. Be warm, curious, and supportive.'

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

  // LLM: Edit text with a natural language instruction
  ipcMain.handle(IPC_CHANNELS.LLM_EDIT_TEXT, async (_, text: string, instruction: string) => {
    const llmConfig = dbManager.getSetting('llmConfig') as { baseUrl: string; model: string; apiKey?: string } | null
    if (!llmConfig) {
      return { success: false, error: 'LLM not configured' }
    }

    try {
      const client = new LLMClient({ ...llmConfig, maxTokens: 4096 })
      const response = await client.chat([
        {
          role: 'system',
          content:
            'You are a precise text editor. Apply the user\'s instruction to the provided text and return ONLY the edited text. Do not add explanations, commentary, or formatting outside the text itself.',
        },
        {
          role: 'user',
          content: `Instruction: ${instruction}\n\nText:\n${text}`,
        },
      ])
      return { success: true, content: response.content ?? '' }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  // LLM: Suggest the best folder for a note's content
  ipcMain.handle(IPC_CHANNELS.LLM_SUGGEST_FOLDER, async (_, content: string) => {
    const abbey = getVaultManager()
    if (!abbey) return { success: false, error: 'No vault initialized' }

    const llmConfig = dbManager.getSetting('llmConfig') as { baseUrl: string; model: string; apiKey?: string } | null
    if (!llmConfig) return { success: false, error: 'LLM not configured' }

    const getFolders = async (dirPath: string, depth = 0): Promise<string[]> => {
      if (depth > 2) return []
      try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true })
        const folders: string[] = []
        for (const entry of entries) {
          if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== '_thoughts') {
            const rel = path.relative(abbey.vaultPath, path.join(dirPath, entry.name))
            folders.push(rel)
            const sub = await getFolders(path.join(dirPath, entry.name), depth + 1)
            folders.push(...sub)
          }
        }
        return folders
      } catch {
        return []
      }
    }

    const folders = await getFolders(abbey.vaultPath)
    if (folders.length === 0) return { success: false, error: 'No folders available in vault' }

    try {
      const client = new LLMClient({ ...llmConfig, maxTokens: 100 })
      const response = await client.chat([
        {
          role: 'system',
          content:
            'You are a filing assistant. Given a note and a list of folders, respond with ONLY the most appropriate folder path from the list. No explanation, no punctuation — just the exact folder path as shown.',
        },
        {
          role: 'user',
          content: `Folders:\n${folders.map((f) => `- ${f}`).join('\n')}\n\nNote:\n${content.slice(0, 1500)}`,
        },
      ])
      const suggested = response.content?.trim().replace(/^- /, '') ?? ''
      if (folders.includes(suggested)) {
        return { success: true, folder: suggested }
      }
      // Fuzzy fallback: find the folder that best overlaps with LLM output
      const match = folders.find((f) => suggested.includes(f) || f.includes(suggested))
      return { success: true, folder: match ?? folders[0] }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  // LLM: Classify a thought against enabled note templates
  ipcMain.handle(
    IPC_CHANNELS.LLM_CLASSIFY_THOUGHT,
    async (_, content: string, templates: { id: string; title: string; description: string }[]) => {
      const llmConfig = dbManager.getSetting('llmConfig') as { baseUrl: string; model: string; apiKey?: string } | null
      if (!llmConfig) return { success: false, error: 'LLM not configured' }

      try {
        const client = new LLMClient({ ...llmConfig, maxTokens: 200 })
        const templateList = templates.map((t) => `- id: ${t.id} | title: ${t.title} | description: ${t.description}`).join('\n')
        const response = await client.chat([
          {
            role: 'system',
            content:
              'You are a note classifier. Given a note and a list of templates, pick the best matching template and suggest a folder. Respond with ONLY valid JSON in this exact shape: {"templateId":"<id or null>","confidence":<0-1>,"folder":"<suggested folder path>"}. No extra text.',
          },
          {
            role: 'user',
            content: `Templates:\n${templateList}\n\nNote:\n${content.slice(0, 2000)}`,
          },
        ])
        const raw = response.content?.trim() ?? '{}'
        const parsed = JSON.parse(raw)
        return { success: true, templateId: parsed.templateId ?? null, confidence: parsed.confidence ?? 0, folder: parsed.folder ?? '' }
      } catch (error) {
        return { success: false, error: (error as Error).message }
      }
    }
  )

  // LLM: Identify missing fields in a thought relative to a template
  ipcMain.handle(IPC_CHANNELS.LLM_GET_MISSING_FIELDS, async (_, content: string, templateFormat: string) => {
    const llmConfig = dbManager.getSetting('llmConfig') as { baseUrl: string; model: string; apiKey?: string } | null
    if (!llmConfig) return { success: false, error: 'LLM not configured' }

    try {
      const client = new LLMClient({ ...llmConfig, maxTokens: 400 })
      const response = await client.chat([
        {
          role: 'system',
          content:
            'You are a note assistant. Compare the note to the template and identify what key information is missing or unclear. Respond with ONLY valid JSON: {"questions":[{"field":"<field name>","question":"<question for user>","hint":"<optional hint>"}]}. Return an empty array if nothing is missing.',
        },
        {
          role: 'user',
          content: `Template:\n${templateFormat}\n\nNote:\n${content.slice(0, 2000)}`,
        },
      ])
      const raw = response.content?.trim() ?? '{}'
      const parsed = JSON.parse(raw)
      return { success: true, questions: parsed.questions ?? [] }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  // LLM: Reformat a thought using a template and optional user answers
  ipcMain.handle(
    IPC_CHANNELS.LLM_REFORMAT_THOUGHT,
    async (_, content: string, templateFormat: string, userAnswers: { field: string; answer: string }[]) => {
      const llmConfig = dbManager.getSetting('llmConfig') as { baseUrl: string; model: string; apiKey?: string } | null
      if (!llmConfig) return { success: false, error: 'LLM not configured' }

      try {
        const client = new LLMClient({ ...llmConfig, maxTokens: 2000 })
        const answersText =
          userAnswers.length > 0
            ? '\n\nAdditional answers from the user:\n' + userAnswers.map((a) => `- ${a.field}: ${a.answer}`).join('\n')
            : ''
        const response = await client.chat([
          {
            role: 'system',
            content:
              "You are a note formatter. Reformat the provided note into the given template structure. Use the original ideas and wording — don't invent new content. Fill template sections using the original note and any additional answers. Return ONLY the reformatted note as markdown.",
          },
          {
            role: 'user',
            content: `Template:\n${templateFormat}\n\nOriginal note:\n${content.slice(0, 2000)}${answersText}`,
          },
        ])
        return { success: true, reformattedContent: response.content?.trim() ?? '' }
      } catch (error) {
        return { success: false, error: (error as Error).message }
      }
    }
  )

  // Agent: Open or resume a chat session
  ipcMain.handle(
    IPC_CHANNELS.AGENT_CHAT_OPEN,
    async (_, contextType: InvocationType, contextKey: string, filePath?: string) => {
      const abbey = getVaultManager()
      if (!abbey) return { success: false, error: 'No vault initialized' }

      const llmConfig = dbManager.getSetting('llmConfig') as { baseUrl: string; model: string; apiKey?: string } | null
      if (!llmConfig) return { success: false, error: 'LLM not configured' }

      const agentProfile = dbManager.getSetting('agentProfile') as { systemPrompt?: string } | null
      const userProfile = dbManager.getSetting('userProfile') as { name?: string; bio?: string } | null
      const basePersona = agentProfile?.systemPrompt ?? 'You are a thoughtful friend who loves brainstorming and exploring ideas together.'
      const userName = userProfile?.name?.trim()
      const userBio = userProfile?.bio?.trim()
      const userContext = userName
        ? `\n\nThe person you are speaking with is named ${userName}.${userBio ? ` ${userBio}` : ''} Address them by name when appropriate.`
        : ''
      const persona = basePersona + userContext

      try {
        const chatToolsConfig = dbManager.getSetting('toolsConfig') as Record<string, { enabled: boolean; config?: Record<string, string> }> | null
        const { agent, sessionId, history } = await ChatAgent.open(
          { vaultPath: abbey.vaultPath, dbManager, llmConfig, persona, toolsConfig: chatToolsConfig ?? DEFAULT_TOOLS_CONFIG },
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
      const { content, toolCallCount, toolErrors } = await agent.send(message, (toolName, args) => {
        pushToRenderer(IPC_CHANNELS.PUSH_CHAT_TOOL_USE, { sessionId, toolName, args })
      })
      return { success: true, content, toolCallCount, toolErrors }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  // Agent: Clear session and start fresh for the same context
  ipcMain.handle(
    IPC_CHANNELS.AGENT_CHAT_NEW,
    async (_, contextType: InvocationType, contextKey: string, filePath?: string) => {
      const abbey = getVaultManager()
      if (!abbey) return { success: false, error: 'No vault initialized' }

      const llmConfig = dbManager.getSetting('llmConfig') as { baseUrl: string; model: string; apiKey?: string } | null
      if (!llmConfig) return { success: false, error: 'LLM not configured' }

      const agentProfile = dbManager.getSetting('agentProfile') as { systemPrompt?: string } | null
      const userProfile = dbManager.getSetting('userProfile') as { name?: string; bio?: string } | null
      const basePersona = agentProfile?.systemPrompt ?? 'You are a thoughtful friend who loves brainstorming and exploring ideas together.'
      const userName = userProfile?.name?.trim()
      const userBio = userProfile?.bio?.trim()
      const userContext = userName
        ? `\n\nThe person you are speaking with is named ${userName}.${userBio ? ` ${userBio}` : ''} Address them by name when appropriate.`
        : ''
      const persona = basePersona + userContext

      try {
        const freshToolsConfig = dbManager.getSetting('toolsConfig') as Record<string, { enabled: boolean; config?: Record<string, string> }> | null
        const { agent, sessionId } = await ChatAgent.openFresh(
          { vaultPath: abbey.vaultPath, dbManager, llmConfig, persona, toolsConfig: freshToolsConfig ?? DEFAULT_TOOLS_CONFIG },
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
    const abbey = getVaultManager()
    if (!abbey) {
      return []
    }

    try {
      const inboxPath = path.join(abbey.vaultPath, '_inbox')
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
    const abbey = getVaultManager()
    if (!abbey) {
      throw new Error('No vault initialized')
    }

    const filePath = path.join(abbey.vaultPath, '_inbox', filename)
    const content = await fs.readFile(filePath, 'utf-8')
    return { content, path: `_inbox/${filename}` }
  })

  // Inbox: Mark read
  ipcMain.handle(IPC_CHANNELS.INBOX_MARK_READ, async (_, filename: string) => {
    const abbey = getVaultManager()
    if (!abbey) {
      throw new Error('No vault initialized')
    }

    const filePath = path.join(abbey.vaultPath, '_inbox', filename)
    let content = await fs.readFile(filePath, 'utf-8')

    // Replace status: unread with status: read
    content = content.replace(/status: unread/, 'status: read')

    await fs.writeFile(filePath, content, 'utf-8')
    return { success: true }
  })

  // Inbox: Delete
  ipcMain.handle(IPC_CHANNELS.INBOX_DELETE, async (_, filename: string) => {
    const abbey = getVaultManager()
    if (!abbey) {
      throw new Error('No vault initialized')
    }

    const filePath = path.join(abbey.vaultPath, '_inbox', filename)
    await fs.unlink(filePath)
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
    const abbey = getVaultManager()
    if (!abbey) {
      return { success: false, error: 'No vault initialized' }
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

  // ── Cognitive Jobs ─────────────────────────────────────────────────────────

  // List all cognitive jobs with their current DB state
  ipcMain.handle(IPC_CHANNELS.COGNITIVE_JOB_LIST, async () => {
    return dbManager.getCognitiveJobs()
  })

  // Toggle a cognitive job on/off
  ipcMain.handle(IPC_CHANNELS.COGNITIVE_JOB_TOGGLE, async (_, name: string, isActive: boolean) => {
    try {
      dbManager.toggleCognitiveJob(name, isActive)
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  // Update the cron schedule of a cognitive job
  ipcMain.handle(IPC_CHANNELS.COGNITIVE_JOB_EDIT_SCHEDULE, async (_, name: string, schedule: string) => {
    try {
      dbManager.updateCognitiveJobSchedule(name, schedule)
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  // Run a cognitive job now (production run)
  ipcMain.handle(IPC_CHANNELS.COGNITIVE_JOB_TRIGGER, async (_, name: string) => {
    try {
      const { runner, manager } = await buildCognitiveContext(dbManager)
      const result = await runCognitiveJob(name, { agentVaultManager: manager, cognitiveRunner: runner })
      if (result) {
        const status = result.errors > 0 ? 'error' : 'done'
        dbManager.updateCognitiveJobRun(name, status, `processed:${result.processed} skipped:${result.skipped} errors:${result.errors}`)
        return { success: true, result }
      }
      return { success: false, error: `Unknown job: ${name}` }
    } catch (error) {
      dbManager.updateCognitiveJobRun(name, 'error', (error as Error).message)
      return { success: false, error: (error as Error).message }
    }
  })

  // Dry-run a cognitive job — real LLM calls, no writes, returns preview
  ipcMain.handle(IPC_CHANNELS.COGNITIVE_JOB_DRY_RUN, async (_, name: string) => {
    try {
      const { runner, manager } = await buildCognitiveContext(dbManager)
      const result = await runCognitiveJob(name, { agentVaultManager: manager, cognitiveRunner: runner, dryRun: true })
      if (result) return { success: true, result }
      return { success: false, error: `Unknown job: ${name}` }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })
}

export function setupScheduler(dbManager: DatabaseManager): void {
  const abbey = getVaultManager()
  if (!abbey) {
    throw new Error('Cannot start scheduler without vault')
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
