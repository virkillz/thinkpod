import { ipcMain, dialog, app, BrowserWindow, shell } from 'electron'
import { createRequire } from 'module'
const _require = createRequire(import.meta.url)
const { autoUpdater } = _require('electron-updater') as typeof import('electron-updater')
import path from 'path'
import fs from 'fs/promises'
import log from 'electron-log/main.js'
import { IPC_CHANNELS } from './channels.js'
import { buildGraphData, buildStatsOverview } from '../vault/MarkdownParser.js'
import { DatabaseManager } from '../database/DatabaseManager.js'
import { SkillRegistry } from '../agent/SkillRegistry.js'
import type { VaultManager } from '../vault/VaultManager.js'
import { getMainWindow, getVaultManager, initVaultManager } from '../index.js'
import { LLMProcessManager } from '../agent/LLMProcessManager.js'
import { LLMModelManager, GEMMA_MODELS, type GGUFModelInfo, type LLMBuiltinConfig } from '../agent/LLMModelManager.js'
import { AgentLoop, TaskRun } from '../agent/AgentLoop.js'
import { LLMClient } from '../agent/LLMClient.js'
import { ChatAgent, InvocationType } from '../agent/ChatAgent.js'
import { Scheduler } from '../scheduler/Scheduler.js'
import { WhisperManager, WHISPER_MODELS, type VoiceConfig } from '../whisper/WhisperManager.js'
import { getToolMetas, DEFAULT_TOOLS_CONFIG } from '../agent/tools/index.js'
import { VoiceCaptureService } from '../whisper/VoiceCaptureService.js'
import { InboxThreadManager } from '../agent_vault/InboxThreadManager.js'
import { PersonalizationManager, type PersonalizationTopic } from '../personalization/PersonalizationManager.js'
import { PERSONALIZATION_OPENING_TRIGGERS } from '../agent/prompts.js'
import {
  DEFAULT_PERSONA,
  DEFAULT_THREAD_PERSONA,
  DEFAULT_AGENT_SYSTEM_PROMPT,
  EDIT_TEXT,
  SUGGEST_FOLDER,
  CLASSIFY_THOUGHT,
  GET_MISSING_FIELDS,
  buildReformatThoughtPrompt,
  ASSESS_THOUGHT,
  THREAD_CONTINUATION_SUFFIX,
  SYSTEM_PROMPT,
  PERSONALIZATION_QUICK_FACTS_PROMPT,
} from '../agent/prompts.js'

// ── JSON extraction helper ────────────────────────────────────────────────────

/**
 * Extract JSON from LLM response that may include markdown fences or extra text
 */
function extractJSON(raw: string): unknown {
  const stripped = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
  
  try {
    return JSON.parse(stripped)
  } catch {
    const start = stripped.indexOf('{')
    const end = stripped.lastIndexOf('}')
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(stripped.slice(start, end + 1))
      } catch {
        return null
      }
    }
    return null
  }
}

// ── Agent state ───────────────────────────────────────────────────────────────

// Agent state
let llmProcessManager: LLMProcessManager | null = null
let llmModelManager: LLMModelManager | null = null
let currentAgentLoop: AgentLoop | null = null
let scheduler: Scheduler | null = null

// Chat sessions — keyed by sessionId so the renderer can hold the handle
const activeChatAgents = new Map<string, ChatAgent>()

// Whisper state
let whisperManager: WhisperManager | null = null
let voiceCaptureService: VoiceCaptureService | null = null

// ── LLM config resolution ─────────────────────────────────────────────────────

interface LLMProfileRaw {
  id: string
  name: string
  provider: string
  baseUrl: string
  model: string
  apiKey?: string
  builtinQuant?: string
}

interface LLMStorage {
  profiles: LLMProfileRaw[]
  activeId: string | null
}

/**
 * Returns the effective LLM config to hand to LLMClient.
 * For builtin profiles, swaps in the local server URL so all existing
 * LLMClient usage works unchanged.
 */
function getEffectiveLLMConfig(
  dbManager: DatabaseManager
): { baseUrl: string; model: string; apiKey?: string } | null {
  const storage = dbManager.getSetting('llmConfig') as LLMStorage | null
  if (!storage?.profiles || !storage.activeId) return null

  const profile = storage.profiles.find(p => p.id === storage.activeId)
  if (!profile) return null

  if (profile.provider === 'builtin') {
    const url = llmProcessManager?.getUrl()
    if (!url) return null
    return { baseUrl: url, model: 'gemma-4-e4b-builtin' }
  }

  return { baseUrl: profile.baseUrl, model: profile.model, apiKey: profile.apiKey || undefined }
}

function pushToRenderer(channel: string, data: unknown): void {
  const win = getMainWindow()
  win?.webContents.send(channel, data)
}

export function setupIpcHandlers(
  dbManager: DatabaseManager
): void {
  // Initialise managers (lazy — no heavy work until needed)
  whisperManager = new WhisperManager(dbManager)
  llmModelManager = new LLMModelManager(dbManager)

  // Auto-start built-in model if it was configured and downloaded
  const storedLLM = dbManager.getSetting('llmConfig') as LLMStorage | null
  const autoStartProfile = storedLLM?.profiles?.find(p => p.id === storedLLM?.activeId) ?? null
  if (autoStartProfile?.provider === 'builtin' && autoStartProfile.builtinQuant) {
    llmModelManager.isModelDownloaded(autoStartProfile.builtinQuant).then(async (downloaded) => {
      if (downloaded && !llmProcessManager) {
        const modelPath = llmModelManager!.getModelPath(autoStartProfile.builtinQuant!)
        llmProcessManager = new LLMProcessManager()
        llmProcessManager.on('status', (status: string) => {
          pushToRenderer(IPC_CHANNELS.PUSH_LLM_STATUS, status)
        })
        llmProcessManager.on('error', (err: string) => {
          log.error('[LLM built-in]', err)
          pushToRenderer(IPC_CHANNELS.PUSH_LLM_STATUS, 'error')
        })
        const started = await llmProcessManager.start(modelPath)
        if (started) {
          const url = llmProcessManager.getUrl()
          if (url) dbManager.setSetting('llmBuiltinUrl', url)
        } else {
          llmProcessManager = null
        }
      }
    }).catch((err) => log.error('[LLM auto-start]', err))
  }

  // ── Built-in LLM model management ──────────────────────────────────────────

  ipcMain.handle(IPC_CHANNELS.LLM_MODEL_GET_INFO, async () => {
    const downloaded = await llmModelManager!.listDownloadedModels()
    const config = await llmModelManager!.getConfig()
    return {
      models: GEMMA_MODELS as GGUFModelInfo[],
      downloaded,
      config,
      serverRunning: llmProcessManager?.isRunning() ?? false,
      serverUrl: llmProcessManager?.getUrl() ?? null,
    }
  })

  ipcMain.handle(IPC_CHANNELS.LLM_MODEL_DOWNLOAD, async (_, quant: string) => {
    try {
      const alreadyDownloaded = await llmModelManager!.isModelDownloaded(quant)
      if (alreadyDownloaded) {
        pushToRenderer(IPC_CHANNELS.PUSH_LLM_DOWNLOAD_PROGRESS, { quant, progress: 100 })
        return { success: true, alreadyExists: true }
      }

      await llmModelManager!.downloadModel(quant, (progress) => {
        pushToRenderer(IPC_CHANNELS.PUSH_LLM_DOWNLOAD_PROGRESS, { quant, progress })
      })
      await llmModelManager!.setConfig({ quant } as LLMBuiltinConfig)
      return { success: true }
    } catch (error) {
      const msg = (error as Error).message
      if (msg === 'Download cancelled') return { success: false, cancelled: true }
      return { success: false, error: msg }
    }
  })

  ipcMain.handle(IPC_CHANNELS.LLM_MODEL_CANCEL_DOWNLOAD, async () => {
    llmModelManager!.cancelDownload()
    return { success: true }
  })

  ipcMain.handle(IPC_CHANNELS.LLM_MODEL_DELETE, async (_, quant: string) => {
    try {
      await llmModelManager!.deleteModel(quant)
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle(IPC_CHANNELS.LLM_MODEL_START, async (_, quant: string) => {
    log.info('[LLM_MODEL_START] called with quant:', quant)
    if (llmProcessManager?.isRunning()) {
      log.info('[LLM_MODEL_START] already running, returning existing URL')
      return { success: true, url: llmProcessManager.getUrl() }
    }

    try {
      log.info('[LLM_MODEL_START] getting model path for:', quant)
      const modelPath = llmModelManager!.getModelPath(quant)
      log.info('[LLM_MODEL_START] model path:', modelPath)
      llmProcessManager = new LLMProcessManager()
      llmProcessManager.on('status', (status: string) => {
        log.info('[LLM built-in status]', status)
        pushToRenderer(IPC_CHANNELS.PUSH_LLM_STATUS, status)
      })
      llmProcessManager.on('error', (err: string) => {
        log.error('[LLM built-in error]', err)
        pushToRenderer(IPC_CHANNELS.PUSH_LLM_STATUS, 'error')
      })

      log.info('[LLM_MODEL_START] calling llmProcessManager.start()...')
      const started = await llmProcessManager.start(modelPath)
      log.info('[LLM_MODEL_START] start() returned:', started, 'url:', llmProcessManager.getUrl())
      if (started) {
        const url = llmProcessManager.getUrl()
        if (url) dbManager.setSetting('llmBuiltinUrl', url)
        return { success: true, url }
      } else {
        llmProcessManager = null
        return { success: false, error: 'Failed to load model' }
      }
    } catch (error) {
      log.error('[LLM_MODEL_START] exception:', error)
      llmProcessManager = null
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle(IPC_CHANNELS.LLM_MODEL_STOP, async () => {
    llmProcessManager?.stop()
    llmProcessManager = null
    dbManager.setSetting('llmBuiltinUrl', null)
    return { success: true }
  })

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
      // Check if model already exists to avoid re-downloading
      const alreadyDownloaded = await whisperManager!.isModelDownloaded(modelName)
      if (alreadyDownloaded) {
        // Simulate instant completion for UI feedback
        pushToRenderer(IPC_CHANNELS.PUSH_VOICE_DOWNLOAD_PROGRESS, { modelName, progress: 100 })
        return { success: true, alreadyExists: true }
      }

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
          systemPrompt: DEFAULT_AGENT_SYSTEM_PROMPT,
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
          systemPrompt: DEFAULT_AGENT_SYSTEM_PROMPT,
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

  // Skills: List installed skills
  ipcMain.handle(IPC_CHANNELS.SKILLS_LIST, async () => {
    const vaultPath = dbManager.getSetting('vaultPath') as string | null
    if (!vaultPath) return { skills: [] }
    const registry = new SkillRegistry(vaultPath)
    const skills = await registry.discover()
    return { skills }
  })

  // Skills: Open .skills folder in Finder/Explorer
  ipcMain.handle(IPC_CHANNELS.SKILLS_OPEN_FOLDER, async () => {
    const vaultPath = dbManager.getSetting('vaultPath') as string | null
    if (!vaultPath) return { success: false }
    const registry = new SkillRegistry(vaultPath)
    await registry.ensureDir()
    shell.openPath(registry.skillsDir)
    return { success: true }
  })

  // Abbey: Reset — delete _inbox, _thoughts, .thinkpod, _agent_vault and clear saved path
  ipcMain.handle(IPC_CHANNELS.VAULT_RESET, async () => {
    try {
      const abbeyPath = dbManager.getSetting('vaultPath') as string | null
      if (!abbeyPath) {
        return { success: false, error: 'No vault configured' }
      }

      // Delete the system folders
      for (const folder of ['_inbox', '_thoughts', '.thinkpod', '_agent_vault']) {
        const folderPath = path.join(abbeyPath, folder)
        await fs.rm(folderPath, { recursive: true, force: true })
      }

      // Delete the database file entirely
      const dbPath = dbManager.getDbPath()
      dbManager.close()
      await fs.unlink(dbPath).catch(() => {}) // Ignore if file doesn't exist
      await fs.unlink(`${dbPath}-shm`).catch(() => {}) // WAL mode files
      await fs.unlink(`${dbPath}-wal`).catch(() => {})

      // Reinitialize the database
      const appDataPath = app.getPath('userData')
      const newDbManager = new DatabaseManager(appDataPath)
      await newDbManager.initialize()
      
      // Replace the global dbManager reference
      Object.assign(dbManager, newDbManager)

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

  // Vault: Index all files
  ipcMain.handle(IPC_CHANNELS.VAULT_INDEX_ALL, async () => {
    const abbey = getVaultManager()
    if (!abbey) {
      return { success: false, error: 'No vault initialized' }
    }

    try {
      const { VaultIndexer } = await import('../vault/VaultIndexer.js')
      const indexer = new VaultIndexer(abbey.vaultPath, dbManager)
      const result = await indexer.indexAllFiles()
      return { success: true, ...result }
    } catch (error) {
      return { success: false, error: (error as Error).message }
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
    
    // Index the file for search
    try {
      const { VaultIndexer } = await import('../vault/VaultIndexer.js')
      const indexer = new VaultIndexer(abbey.vaultPath, dbManager)
      await indexer.indexFile(filePath)
    } catch (error) {
      log.error(`Failed to index file ${filePath}:`, error)
    }
    
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

  // Files: Search
  ipcMain.handle(IPC_CHANNELS.FILES_SEARCH, async (_, query: string) => {
    const abbey = getVaultManager()
    if (!abbey) {
      throw new Error('No vault initialized')
    }

    try {
      const results = dbManager.searchFiles(query, 50)
      return { success: true, results }
    } catch (error) {
      return { success: false, error: (error as Error).message, results: [] }
    }
  })

  // Files: Get Recent
  ipcMain.handle(IPC_CHANNELS.FILES_GET_RECENT, async (_, limit: number = 5) => {
    return dbManager.getRecentFiles(limit)
  })

  // Settings: Get
  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, async (_, key: string) => {
    return dbManager.getSetting(key)
  })

  // Settings: Set
  ipcMain.handle(IPC_CHANNELS.SETTINGS_SET, async (_, key: string, value: unknown) => {
    dbManager.setSetting(key, value)
    
    // Clear cached chat agents when LLM config changes so they reinitialize with new settings
    if (key === 'llmConfig') {
      activeChatAgents.clear()
      log.info('[Settings] LLM config changed, cleared cached chat agents')
    }
    
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

  // Updater: wire autoUpdater events → renderer push
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.logger = log

  const pushUpdateStatus = (status: object) => {
    const win = getMainWindow()
    win?.webContents.send(IPC_CHANNELS.PUSH_UPDATE_STATUS, status)
  }

  autoUpdater.on('checking-for-update', () =>
    pushUpdateStatus({ state: 'checking' }))

  autoUpdater.on('update-available', (info) =>
    pushUpdateStatus({ state: 'available', version: info.version, releaseNotes: info.releaseNotes }))

  autoUpdater.on('update-not-available', () =>
    pushUpdateStatus({ state: 'up-to-date' }))

  autoUpdater.on('download-progress', (progress) =>
    pushUpdateStatus({ state: 'downloading', percent: Math.round(progress.percent) }))

  autoUpdater.on('update-downloaded', (info) =>
    pushUpdateStatus({ state: 'downloaded', version: info.version }))

  autoUpdater.on('error', (err) =>
    pushUpdateStatus({ state: 'error', message: err.message }))

  ipcMain.handle(IPC_CHANNELS.UPDATER_CHECK, async () => {
    try {
      await autoUpdater.checkForUpdates()
      return { success: true }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  })

  ipcMain.handle(IPC_CHANNELS.UPDATER_DOWNLOAD, async () => {
    try {
      await autoUpdater.downloadUpdate()
      return { success: true }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  })

  ipcMain.handle(IPC_CHANNELS.UPDATER_INSTALL, async () => {
    autoUpdater.quitAndInstall()
  })

  // App: Get logs
  ipcMain.handle(IPC_CHANNELS.APP_GET_LOGS, async () => {
    try {
      const logPath = log.transports.file.getFile().path
      const content = await fs.readFile(logPath, 'utf-8')
      return { success: true, content, path: logPath }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
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

  // LLM: Start server (legacy — kept for API compatibility; use LLM_MODEL_START for built-in)
  ipcMain.handle(IPC_CHANNELS.LLM_START_SERVER, async () => {
    return { success: false, error: 'Use LLM_MODEL_START for built-in model or configure an external API' }
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

    const llmConfig = getEffectiveLLMConfig(dbManager)
    if (!llmConfig) {
      return { success: false, error: 'LLM not configured' }
    }

    const agentProfile = dbManager.getSetting('agentProfile') as { name?: string; avatar?: string; systemPrompt?: string } | null
    const agentName = agentProfile?.name ?? 'Wilfred'
    const persona = (agentProfile?.systemPrompt ?? DEFAULT_PERSONA).replace(/{agentName}/g, agentName)

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
    const llmConfig = getEffectiveLLMConfig(dbManager)
    if (!llmConfig) {
      return { success: false, error: 'LLM not configured' }
    }

    const agentProfileChat = dbManager.getSetting('agentProfile') as { name?: string; avatar?: string; systemPrompt?: string } | null
    const agentName = agentProfileChat?.name ?? 'Wilfred'
    const persona = (agentProfileChat?.systemPrompt ?? DEFAULT_PERSONA).replace(/{agentName}/g, agentName)

    try {
      const client = new LLMClient(llmConfig)
      const response = await client.chat([
        { role: 'system', content: `${SYSTEM_PROMPT}\n\n${persona}` },
        { role: 'user', content: message },
      ])
      return { success: true, content: response.content }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  // LLM: Edit text with a natural language instruction
  ipcMain.handle(IPC_CHANNELS.LLM_EDIT_TEXT, async (_, text: string, instruction: string) => {
    const llmConfig = getEffectiveLLMConfig(dbManager)
    if (!llmConfig) {
      return { success: false, error: 'LLM not configured' }
    }

    try {
      const client = new LLMClient({ ...llmConfig, maxTokens: 4096 })
      const response = await client.chat([
        {
          role: 'system',
          content: `${SYSTEM_PROMPT}\n\n${EDIT_TEXT}`,
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

    const llmConfig = getEffectiveLLMConfig(dbManager)
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
          content: `${SYSTEM_PROMPT}\n\n${SUGGEST_FOLDER}`,
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
      const llmConfig = getEffectiveLLMConfig(dbManager)
      if (!llmConfig) return { success: false, error: 'LLM not configured' }

      try {
        const client = new LLMClient({ ...llmConfig, maxTokens: 200, responseFormat: 'json_object' })
        const templateList = templates.map((t) => `- id: ${t.id} | title: ${t.title} | description: ${t.description}`).join('\n')
        const response = await client.chat([
          {
            role: 'system',
            content: `${SYSTEM_PROMPT}\n\n${CLASSIFY_THOUGHT}`,
          },
          {
            role: 'user',
            content: `Templates:\n${templateList}\n\nNote:\n${content.slice(0, 2000)}`,
          },
        ])
        const raw = response.content?.trim() ?? '{}'
        const parsed = extractJSON(raw)
        if (!parsed || typeof parsed !== 'object') {
          return { success: false, error: 'Invalid JSON response from LLM' }
        }
        const data = parsed as Record<string, unknown>
        return { success: true, templateId: data.templateId ?? null, confidence: data.confidence ?? 0, folder: data.folder ?? '' }
      } catch (error) {
        return { success: false, error: (error as Error).message }
      }
    }
  )

  // LLM: Identify missing fields in a thought relative to a template
  ipcMain.handle(IPC_CHANNELS.LLM_GET_MISSING_FIELDS, async (_, content: string, templateFormat: string) => {
    const llmConfig = getEffectiveLLMConfig(dbManager)
    if (!llmConfig) return { success: false, error: 'LLM not configured' }

    try {
      const client = new LLMClient({ ...llmConfig, maxTokens: 400, responseFormat: 'json_object' })
      const response = await client.chat([
        {
          role: 'system',
          content: `${SYSTEM_PROMPT}\n\n${GET_MISSING_FIELDS}`,
        },
        {
          role: 'user',
          content: `Template:\n${templateFormat}\n\nNote:\n${content.slice(0, 2000)}`,
        },
      ])
      const raw = response.content?.trim() ?? '{}'
      const parsed = extractJSON(raw)
      if (!parsed || typeof parsed !== 'object') {
        return { success: false, error: 'Invalid JSON response from LLM' }
      }
      const data = parsed as Record<string, unknown>
      return { success: true, questions: data.questions ?? [] }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  // LLM: Reformat a thought using a template and optional user answers
  ipcMain.handle(
    IPC_CHANNELS.LLM_REFORMAT_THOUGHT,
    async (_, content: string, templateFormat: string, userAnswers: { field: string; answer: string }[]) => {
      const llmConfig = getEffectiveLLMConfig(dbManager)
      if (!llmConfig) return { success: false, error: 'LLM not configured' }

      try {
        const client = new LLMClient({ ...llmConfig, maxTokens: 32768 })
        const answersText =
          userAnswers.length > 0
            ? '\n\nAdditional answers from the user:\n' + userAnswers.map((a) => `- ${a.field}: ${a.answer}`).join('\n')
            : ''
        const response = await client.chat([
          {
            role: 'system',
            content: `${SYSTEM_PROMPT}\n\n${buildReformatThoughtPrompt()}`,
          },
          {
            role: 'user',
            content: `Template:\n${templateFormat}\n\nOriginal note:\n${content}${answersText}`,
          },
        ])
        return { success: true, reformattedContent: response.content?.trim() ?? '' }
      } catch (error) {
        return { success: false, error: (error as Error).message }
      }
    }
  )

  // LLM: Single-call assessment — classify, detect missing fields, and suggest tags
  ipcMain.handle(
    IPC_CHANNELS.LLM_ASSESS_THOUGHT,
    async (
      _,
      content: string,
      templates: { id: string; title: string; description: string; defaultFolder: string }[],
      currentFolder: string
    ) => {
      const llmConfig = getEffectiveLLMConfig(dbManager)
      if (!llmConfig) return { success: false, error: 'LLM not configured' }

      try {
        const client = new LLMClient({ ...llmConfig, maxTokens: 700, responseFormat: 'json_object' })
        const templateList = templates
          .map((t) => `- id: ${t.id} | title: ${t.title} | folder: ${t.defaultFolder} | description: ${t.description}`)
          .join('\n')
        const response = await client.chat([
          {
            role: 'system',
            content: `${SYSTEM_PROMPT}\n\n${ASSESS_THOUGHT}`,
          },
          {
            role: 'user',
            content: `Current folder: ${currentFolder}\n\nTemplates:\n${templateList}\n\nNote:\n${content.slice(0, 2000)}`,
          },
        ])
        const raw = response.content?.trim() ?? '{}'
        log.info('[assessThought] raw LLM response:', raw)
        const parsed = extractJSON(raw)
        log.info('[assessThought] parsed result:', parsed)
        if (!parsed || typeof parsed !== 'object') {
          return { success: false, error: 'Invalid JSON response from LLM' }
        }
        const data = parsed as Record<string, unknown>
        return {
          success: true,
          templateId: data.templateId ?? null,
          confidence: data.confidence ?? 0,
          folder: data.folder ?? '',
          alreadyFormatted: data.alreadyFormatted ?? false,
          missingFields: data.missingFields ?? [],
          suggestedTags: data.suggestedTags ?? [],
        }
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

      const llmConfig = getEffectiveLLMConfig(dbManager)
      if (!llmConfig) return { success: false, error: 'LLM not configured' }

      const agentProfile = dbManager.getSetting('agentProfile') as { name?: string; systemPrompt?: string } | null
      const userProfile = dbManager.getSetting('userProfile') as { name?: string; bio?: string } | null
      const agentName = agentProfile?.name ?? 'Wilfred'
      const basePersona = (agentProfile?.systemPrompt ?? DEFAULT_PERSONA).replace(/{agentName}/g, agentName)
      const userName = userProfile?.name?.trim()
      const userBio = userProfile?.bio?.trim()
      const userContext = userName
        ? `\n\nThe user you are speaking with is named ${userName}.${userBio ? ` ${userBio}` : ''} Address them by name when appropriate.`
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

        // For a new personalization session, fire the fabricated opening trigger
        // so the agent asks the first question. Only the agent's response is returned
        // (openingMessage) — the fabricated user message is hidden from the UI.
        if (contextType === 'personalization' && history.length === 0) {
          const trigger = PERSONALIZATION_OPENING_TRIGGERS[contextKey] ?? `ask me about my ${contextKey}`
          const { content } = await agent.send(trigger)
          return { success: true, sessionId, history: [], openingMessage: content }
        }

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

      const llmConfig = getEffectiveLLMConfig(dbManager)
      if (!llmConfig) return { success: false, error: 'LLM not configured' }

      const agentProfile = dbManager.getSetting('agentProfile') as { name?: string; systemPrompt?: string } | null
      const userProfile = dbManager.getSetting('userProfile') as { name?: string; bio?: string } | null
      const agentName = agentProfile?.name ?? 'Wilfred'
      const basePersona = (agentProfile?.systemPrompt ?? DEFAULT_PERSONA).replace(/{agentName}/g, agentName)
      const userName = userProfile?.name?.trim()
      const userBio = userProfile?.bio?.trim()
      const userContext = userName
        ? `\n\nThe user you are speaking with is named ${userName}.${userBio ? ` ${userBio}` : ''} Address them by name when appropriate.`
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

  // Agent: Get all chat sessions
  ipcMain.handle(IPC_CHANNELS.AGENT_CHAT_GET_ALL_SESSIONS, async () => {
    try {
      const sessions = dbManager.getAllChatSessions()
      return { success: true, sessions }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
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

  // Inbox: Reply to thread and get agent response
  ipcMain.handle(IPC_CHANNELS.INBOX_REPLY, async (_, threadId: string, replyText: string) => {
    const abbey = getVaultManager()
    if (!abbey) {
      return { success: false, error: 'No vault initialized' }
    }

    const llmConfig = getEffectiveLLMConfig(dbManager)
    if (!llmConfig) {
      return { success: false, error: 'LLM not configured' }
    }

    const agentProfile = dbManager.getSetting('agentProfile') as { name?: string; systemPrompt?: string } | null
    const userProfile = dbManager.getSetting('userProfile') as { name?: string } | null
    const userName = userProfile?.name?.trim()
    const agentName = agentProfile?.name ?? 'Wilfred'

    const threadManager = new InboxThreadManager(path.join(abbey.vaultPath, '_inbox'))

    // 1. Append human reply
    const thread = await threadManager.appendReply(threadId, replyText)
    if (!thread) {
      return { success: false, error: 'Thread not found' }
    }

    // 2. Build conversation context for LLM
    const conversation = thread.messages
      .map((m) => `${m.role === 'agent' ? agentProfile?.name ?? 'Agent' : userName ?? 'Human'}: ${m.content}`)
      .join('\n\n')

    const persona = (agentProfile?.systemPrompt ?? DEFAULT_THREAD_PERSONA).replace(/{agentName}/g, agentName)

    // 3. Call LLM for response
    try {
      const client = new LLMClient(llmConfig)
      const response = await client.chat([
        { role: 'system', content: `${SYSTEM_PROMPT}\n\n${persona}\n\n${THREAD_CONTINUATION_SUFFIX}` },
        { role: 'user', content: `Conversation so far:\n${conversation}\n\nPlease respond to the user's last message.` },
      ])

      const agentResponse = response.content?.trim() ?? ''
      if (!agentResponse) {
        return { success: false, error: 'No response from agent' }
      }

      // 4. Append agent response to thread
      await threadManager.appendAgentResponse(threadId, agentResponse)

      return { success: true, response: agentResponse }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
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

  // ── Graph & Stats ──────────────────────────────────────────────────────────

  ipcMain.handle(IPC_CHANNELS.GRAPH_GET_DATA, async () => {
    const vaultManager = getVaultManager()
    if (!vaultManager) return { nodes: [], links: [] }
    return buildGraphData(vaultManager.vaultPath)
  })

  ipcMain.handle(IPC_CHANNELS.STATS_GET_OVERVIEW, async () => {
    const vaultManager = getVaultManager()
    if (!vaultManager) return { totalDocuments: 0, totalTags: 0, avgTagsPerDoc: 0, topTags: [] }
    return buildStatsOverview(vaultManager.vaultPath)
  })

  // ── Personalization ─────────────────────────────────────────────────────────

  ipcMain.handle(IPC_CHANNELS.PERSONALIZATION_GET_TOPIC, async (_, topic: PersonalizationTopic) => {
    const vaultManager = getVaultManager()
    if (!vaultManager) return { success: false, error: 'No vault initialized' }
    const pm = new PersonalizationManager(vaultManager.vaultPath)
    const content = await pm.getTopicContent(topic)
    return { success: true, content }
  })

  ipcMain.handle(IPC_CHANNELS.PERSONALIZATION_WRITE_TOPIC, async (_, topic: PersonalizationTopic, content: string) => {
    const vaultManager = getVaultManager()
    if (!vaultManager) return { success: false, error: 'No vault initialized' }
    const pm = new PersonalizationManager(vaultManager.vaultPath)
    await pm.writeTopicContent(topic, content)
    return { success: true }
  })

  ipcMain.handle(IPC_CHANNELS.PERSONALIZATION_SUMMARIZE, async (_, sessionId: string, topic: string) => {
    const agent = activeChatAgents.get(sessionId)
    if (!agent) return { success: false, error: 'Session not found' }
    const userProfile = dbManager.getSetting('userProfile') as { name?: string } | null
    const userName = userProfile?.name?.trim() || 'the user'
    try {
      const summary = await agent.summarize(topic, userName)
      return { success: true, summary }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle(IPC_CHANNELS.PERSONALIZATION_GET_SUMMARY, async () => {
    const vaultManager = getVaultManager()
    if (!vaultManager) return { success: false, error: 'No vault initialized' }
    const pm = new PersonalizationManager(vaultManager.vaultPath)
    const content = await pm.getSummaryContent()
    return { success: true, content }
  })

  ipcMain.handle(IPC_CHANNELS.PERSONALIZATION_WRITE_SUMMARY, async (_, content: string) => {
    const vaultManager = getVaultManager()
    if (!vaultManager) return { success: false, error: 'No vault initialized' }
    const pm = new PersonalizationManager(vaultManager.vaultPath)
    await pm.writeSummaryContent(content)
    return { success: true }
  })

  ipcMain.handle(IPC_CHANNELS.PERSONALIZATION_SYNC_SUMMARY, async () => {
    const vaultManager = getVaultManager()
    if (!vaultManager) return { success: false, error: 'No vault initialized' }
    const llmConfig = getEffectiveLLMConfig(dbManager)
    if (!llmConfig) return { success: false, error: 'LLM not configured' }

    const pm = new PersonalizationManager(vaultManager.vaultPath)
    const filledTopics = await pm.getFilledTopics()
    if (filledTopics.length === 0) return { success: false, error: 'No profile topics found. Add some content first.' }

    const topicBlocks = await Promise.all(
      filledTopics.map(async (topic) => {
        const content = await pm.getTopicContent(topic)
        return `### ${topic}\n${content}`
      })
    )
    const combinedProfiles = topicBlocks.join('\n\n')

    try {
      const client = new LLMClient({ ...llmConfig, maxTokens: 400 })
      const response = await client.chat([
        { role: 'system', content: PERSONALIZATION_QUICK_FACTS_PROMPT },
        { role: 'user', content: `User profile files:\n\n${combinedProfiles}` },
      ])
      const quickFacts = response.content ?? ''
      await pm.writeSummaryContent(quickFacts)
      return { success: true, content: quickFacts }
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
