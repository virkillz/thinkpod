import fs from 'fs/promises'
import path from 'path'
import type { Dirent } from 'fs'
import type { DatabaseManager } from '../database/DatabaseManager.js'

export class VaultIndexer {
  private vaultPath: string
  private dbManager: DatabaseManager

  constructor(vaultPath: string, dbManager: DatabaseManager) {
    this.vaultPath = vaultPath
    this.dbManager = dbManager
  }

  async indexAllFiles(): Promise<{ indexed: number; skipped: number }> {
    const files = await this.collectVaultFiles()
    let indexed = 0
    let skipped = 0

    for (const filePath of files) {
      try {
        await this.indexFile(filePath)
        indexed++
      } catch (error) {
        console.error(`Failed to index ${filePath}:`, error)
        skipped++
      }
    }

    return { indexed, skipped }
  }

  async indexFile(relativePath: string): Promise<void> {
    const fullPath = path.join(this.vaultPath, relativePath)
    
    try {
      const content = await fs.readFile(fullPath, 'utf-8')
      const title = this.extractTitle(content, relativePath)
      const folder = relativePath.includes('/') 
        ? relativePath.slice(0, relativePath.lastIndexOf('/')) 
        : ''
      const wordCount = this.countWords(content)

      this.dbManager.indexFile(relativePath, title, content, folder, wordCount)
    } catch (error) {
      throw new Error(`Failed to index file ${relativePath}: ${(error as Error).message}`)
    }
  }

  async removeFile(relativePath: string): Promise<void> {
    this.dbManager.removeFileFromIndex(relativePath)
  }

  private extractTitle(content: string, filePath: string): string {
    const lines = content.split('\n')
    
    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed.startsWith('# ')) {
        return trimmed.slice(2).trim()
      }
    }

    const fileName = path.basename(filePath, '.md')
    return fileName
  }

  private countWords(content: string): number {
    const text = content.replace(/[#*_`~\[\]()]/g, ' ')
    const words = text.split(/\s+/).filter(word => word.length > 0)
    return words.length
  }

  private async collectVaultFiles(): Promise<string[]> {
    const results: string[] = []

    const walk = async (dir: string): Promise<void> => {
      let entries: Dirent[]
      try {
        entries = await fs.readdir(dir, { withFileTypes: true })
      } catch {
        return
      }

      for (const entry of entries) {
        const absPath = path.join(dir, entry.name)
        const relPath = path.relative(this.vaultPath, absPath)

        if (entry.isDirectory() && (entry.name.startsWith('_') || entry.name.startsWith('.'))) {
          continue
        }
        if (entry.isFile() && entry.name.startsWith('.')) {
          continue
        }

        if (entry.isDirectory()) {
          await walk(absPath)
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
          results.push(relPath)
        }
      }
    }

    await walk(this.vaultPath)
    return results
  }
}
