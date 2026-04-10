import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import path from 'path'
import { DatabaseManager } from './database/DatabaseManager.js'
import { VaultManager } from './vault/VaultManager.js'
import { IPC_CHANNELS } from './ipc/channels.js'
import { setupIpcHandlers, setupScheduler } from './ipc/handlers.js'

const isDev = process.env.NODE_ENV === 'development'

let mainWindow: BrowserWindow | null = null
let dbManager: DatabaseManager | null = null
let vaultManager: VaultManager | null = null
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
  if (dbManager && !schedulerStarted) {
    schedulerStarted = true
    setupScheduler(dbManager)
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
  // Initialize database (in app data directory)
  const appDataPath = app.getPath('userData')
  dbManager = new DatabaseManager(appDataPath)
  await dbManager.initialize()

  // Check for saved vault path
  const vaultPath = dbManager.getSetting('vaultPath') as string | null

  if (vaultPath) {
    vaultManager = new VaultManager(vaultPath)
    await vaultManager.initialize()
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
