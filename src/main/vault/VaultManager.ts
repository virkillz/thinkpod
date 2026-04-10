import { watch, FSWatcher } from 'chokidar'
import path from 'path'
import { EventEmitter } from 'events'

export class VaultManager extends EventEmitter {
  vaultPath: string
  private watcher: FSWatcher | null = null

  constructor(vaultPath: string) {
    super()
    this.vaultPath = vaultPath
  }

  async initialize(): Promise<void> {
    // Ensure required folders exist
    // (actual folder creation happens during vault:create)

    // Start watching for file changes
    this.startWatching()
  }

  private startWatching(): void {
    // Watch for changes to update the index
    this.watcher = watch(this.vaultPath, {
      ignored: /(^|[\/\\])\./, // ignore dotfiles
      persistent: true,
      ignoreInitial: true,
    })

    this.watcher
      .on('add', (filePath) => this.emit('fileAdded', filePath))
      .on('change', (filePath) => this.emit('fileChanged', filePath))
      .on('unlink', (filePath) => this.emit('fileRemoved', filePath))
      .on('addDir', (dirPath) => this.emit('dirAdded', dirPath))
      .on('unlinkDir', (dirPath) => this.emit('dirRemoved', dirPath))
  }

  stopWatching(): void {
    this.watcher?.close()
    this.watcher = null
  }
}
