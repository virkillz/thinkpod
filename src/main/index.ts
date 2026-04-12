import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import path from 'path'
import { DatabaseManager } from './database/DatabaseManager.js'
import { VaultManager } from './vault/VaultManager.js'
import { VaultIndexer } from './vault/VaultIndexer.js'
import { IPC_CHANNELS } from './ipc/channels.js'
import { setupIpcHandlers, setupScheduler } from './ipc/handlers.js'
import { SkillRegistry } from './agent/SkillRegistry.js'

const isDev = process.env.NODE_ENV === 'development'

let mainWindow: BrowserWindow | null = null
let dbManager: DatabaseManager | null = null
let vaultManager: VaultManager | null = null
let vaultIndexer: VaultIndexer | null = null
let schedulerStarted = false

export function getMainWindow(): BrowserWindow | null {
  return mainWindow
}

export function getVaultManager(): VaultManager | null {
  return vaultManager
}

export async function initVaultManager(vaultPath: string): Promise<void> {
  vaultManager = new VaultManager(vaultPath)
  await vaultManager.initialize()
  
  if (dbManager) {
    vaultIndexer = new VaultIndexer(vaultPath, dbManager)
    
    // Index all existing files in the background
    vaultIndexer.indexAllFiles().then(result => {
      console.log(`Indexed ${result.indexed} files, skipped ${result.skipped}`)
    }).catch(error => {
      console.error('Failed to index vault files:', error)
    })
    
    // Set up file watching for search indexing
    vaultManager.on('fileAdded', async (filePath: string) => {
      if (filePath.endsWith('.md') && vaultIndexer) {
        const relativePath = path.relative(vaultPath, filePath)
        if (!relativePath.startsWith('_') && !relativePath.startsWith('.')) {
          try {
            await vaultIndexer.indexFile(relativePath)
          } catch (error) {
            console.error('Failed to index file:', error)
          }
        }
      }
    })
    
    vaultManager.on('fileChanged', async (filePath: string) => {
      if (filePath.endsWith('.md') && vaultIndexer) {
        const relativePath = path.relative(vaultPath, filePath)
        if (!relativePath.startsWith('_') && !relativePath.startsWith('.')) {
          try {
            await vaultIndexer.indexFile(relativePath)
          } catch (error) {
            console.error('Failed to re-index file:', error)
          }
        }
      }
    })
    
    vaultManager.on('fileRemoved', async (filePath: string) => {
      if (filePath.endsWith('.md') && vaultIndexer) {
        const relativePath = path.relative(vaultPath, filePath)
        try {
          await vaultIndexer.removeFile(relativePath)
        } catch (error) {
          console.error('Failed to remove file from index:', error)
        }
      }
    })
    
    if (!schedulerStarted) {
      schedulerStarted = true
      setupScheduler(dbManager)
    }
  }
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  mainWindow.webContents.session.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(permission === 'media')
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

async function initializeApp(): Promise<void> {
  // Set built-in skills path so all SkillRegistry instances can find them
  SkillRegistry.builtinSkillsPath = app.isPackaged
    ? path.join(process.resourcesPath, 'skills')
    : path.join(app.getAppPath(), 'resources', 'skills')

  // Initialize database (in app data directory)
  const appDataPath = app.getPath('userData')
  dbManager = new DatabaseManager(appDataPath)
  await dbManager.initialize()

  // Check for saved vault path
  const vaultPath = dbManager.getSetting('vaultPath') as string | null

  if (vaultPath) {
    vaultManager = new VaultManager(vaultPath)
    await vaultManager.initialize()
    
    vaultIndexer = new VaultIndexer(vaultPath, dbManager)
    
    // Index all existing files in the background
    vaultIndexer.indexAllFiles().then(result => {
      console.log(`Indexed ${result.indexed} files, skipped ${result.skipped}`)
    }).catch(error => {
      console.error('Failed to index vault files:', error)
    })
    
    // Set up file watching for search indexing
    vaultManager.on('fileAdded', async (filePath: string) => {
      if (filePath.endsWith('.md') && vaultIndexer) {
        const relativePath = path.relative(vaultPath, filePath)
        if (!relativePath.startsWith('_') && !relativePath.startsWith('.')) {
          try {
            await vaultIndexer.indexFile(relativePath)
          } catch (error) {
            console.error('Failed to index file:', error)
          }
        }
      }
    })
    
    vaultManager.on('fileChanged', async (filePath: string) => {
      if (filePath.endsWith('.md') && vaultIndexer) {
        const relativePath = path.relative(vaultPath, filePath)
        if (!relativePath.startsWith('_') && !relativePath.startsWith('.')) {
          try {
            await vaultIndexer.indexFile(relativePath)
          } catch (error) {
            console.error('Failed to re-index file:', error)
          }
        }
      }
    })
    
    vaultManager.on('fileRemoved', async (filePath: string) => {
      if (filePath.endsWith('.md') && vaultIndexer) {
        const relativePath = path.relative(vaultPath, filePath)
        try {
          await vaultIndexer.removeFile(relativePath)
        } catch (error) {
          console.error('Failed to remove file from index:', error)
        }
      }
    })
  }

  // Create window BEFORE setting up IPC handlers
  createWindow()

  // Setup IPC handlers (now mainWindow is available)
  setupIpcHandlers(dbManager)

  // Start scheduler if vault is ready
  if (vaultManager) {
    schedulerStarted = true
    setupScheduler(dbManager)
  }
}

app.whenReady().then(initializeApp)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

// Handle app shutdown
app.on('before-quit', () => {
  dbManager?.close()
})
