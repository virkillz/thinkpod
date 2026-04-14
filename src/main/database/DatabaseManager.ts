import Database from 'better-sqlite3'
import path from 'path'

export class DatabaseManager {
  private db: Database.Database
  private dbPath: string
  private onInboxUpdated?: () => void

  constructor(appDataPath: string) {
    this.dbPath = path.join(appDataPath, 'thinkpod.db')
    this.db = new Database(this.dbPath)
  }

  setInboxUpdateCallback(callback: () => void): void {
    this.onInboxUpdated = callback
  }

  async initialize(): Promise<void> {
    // Enable WAL mode for better performance
    this.db.pragma('journal_mode = WAL')

    // Create tables
    this.createTables()
  }

  private createTables(): void {
    // Settings table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      )
    `)

    // Files index table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS files (
        path TEXT PRIMARY KEY,
        title TEXT,
        folder TEXT,
        created_at INTEGER,
        modified_at INTEGER,
        word_count INTEGER,
        tags TEXT,
        content TEXT
      )
    `)

    // Migrations: add columns that may be missing from older databases
    const filesCols = this.db.pragma('table_info(files)') as Array<{ name: string }>
    const colNames = filesCols.map(c => c.name)
    if (!colNames.includes('content')) {
      this.db.exec('ALTER TABLE files ADD COLUMN content TEXT')
    }

    // Full-text search virtual table
    this.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS files_fts USING fts5(
        path,
        title,
        content,
        tokenize = 'porter'
      )
    `)

    // Comments table (Wilfred's annotations)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_path TEXT REFERENCES files(path),
        line INTEGER,
        content TEXT,
        type TEXT,
        status TEXT DEFAULT 'open',
        created_at INTEGER,
        dismissed_at INTEGER
      )
    `)

    // Task runs log
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS task_runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_name TEXT,
        started_at INTEGER,
        ended_at INTEGER,
        status TEXT,
        summary TEXT,
        files_read TEXT,
        files_written TEXT,
        tool_calls INTEGER
      )
    `)

    // Chat sessions — one per (context_type, context_key) pair
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS chat_sessions (
        id TEXT PRIMARY KEY,
        context_type TEXT NOT NULL,
        context_key TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        last_message_at INTEGER NOT NULL,
        UNIQUE(context_type, context_key)
      )
    `)

    // Schedules (automated tasks)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schedules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        schedule TEXT NOT NULL,
        prompt TEXT NOT NULL,
        tools TEXT,
        is_active INTEGER DEFAULT 1,
        created_at INTEGER,
        updated_at INTEGER
      )
    `)

    // One-time tasks (pending queue)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        prompt TEXT NOT NULL,
        run_at INTEGER,
        status TEXT DEFAULT 'pending',
        summary TEXT,
        created_at INTEGER,
        updated_at INTEGER
      )
    `)

    // Inbox messages (email-like)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS inbox_messages (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        subject     TEXT NOT NULL,
        body        TEXT NOT NULL,
        type        TEXT NOT NULL DEFAULT 'insight',
        status      TEXT NOT NULL DEFAULT 'unread',
        from_addr   TEXT NOT NULL DEFAULT 'wilfred@thinkpod.dev',
        source_job  TEXT,
        created_at  INTEGER NOT NULL
      )
    `)

    // Inbox replies (threaded conversation per message)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS inbox_replies (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        message_id  INTEGER NOT NULL REFERENCES inbox_messages(id) ON DELETE CASCADE,
        role        TEXT NOT NULL,
        body        TEXT NOT NULL,
        created_at  INTEGER NOT NULL
      )
    `)

    // Enable foreign keys for cascade deletes
    this.db.pragma('foreign_keys = ON')

    // Create default schedules if none exist
    const count = this.db.prepare('SELECT COUNT(*) as count FROM schedules').get() as { count: number }
    if (count.count === 0) {
      this.createDefaultSchedules()
    }
  }

  private createDefaultSchedules(): void {
    const now = Date.now()
  }

  getSetting(key: string): unknown {
    const row = this.db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined
    if (!row) return null
    try {
      return JSON.parse(row.value)
    } catch {
      return row.value
    }
  }

  setSetting(key: string, value: unknown): void {
    const jsonValue = typeof value === 'string' ? value : JSON.stringify(value)
    this.db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, jsonValue)
  }

  // Comments
  addComment(filePath: string, line: number, content: string, type: 'question' | 'suggestion' | 'note'): number {
    const result = this.db.prepare(`
      INSERT INTO comments (file_path, line, content, type, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(filePath, line, content, type, Date.now())
    return result.lastInsertRowid as number
  }

  getComments(filePath: string): Array<{
    id: number
    file_path: string
    line: number
    content: string
    type: string
    status: string
    created_at: number
  }> {
    return this.db.prepare(`
      SELECT * FROM comments
      WHERE file_path = ? AND status = 'open'
      ORDER BY line, created_at
    `).all(filePath) as Array<{
      id: number
      file_path: string
      line: number
      content: string
      type: string
      status: string
      created_at: number
    }>
  }

  dismissComment(id: number): void {
    this.db.prepare(`
      UPDATE comments
      SET status = 'dismissed', dismissed_at = ?
      WHERE id = ?
    `).run(Date.now(), id)
  }

  // File management — path updates cascade to comments
  renameFile(oldPath: string, newPath: string): void {
    const newFolder = newPath.includes('/') ? newPath.slice(0, newPath.lastIndexOf('/')) : ''
    this.db.transaction(() => {
      this.db.prepare('UPDATE files SET path = ?, folder = ? WHERE path = ?').run(newPath, newFolder, oldPath)
      this.db.prepare('UPDATE comments SET file_path = ? WHERE file_path = ?').run(newPath, oldPath)
    })()
  }

  renameFolder(oldPrefix: string, newPrefix: string): void {
    const affected = this.db.prepare(
      'SELECT path FROM files WHERE path = ? OR path LIKE ?'
    ).all(oldPrefix, `${oldPrefix}/%`) as { path: string }[]

    const updateFile = this.db.prepare('UPDATE files SET path = ?, folder = ? WHERE path = ?')
    const updateComments = this.db.prepare('UPDATE comments SET file_path = ? WHERE file_path = ?')

    this.db.transaction(() => {
      for (const { path: oldPath } of affected) {
        const newPath = newPrefix + oldPath.slice(oldPrefix.length)
        const newFolder = newPath.includes('/') ? newPath.slice(0, newPath.lastIndexOf('/')) : ''
        updateFile.run(newPath, newFolder, oldPath)
        updateComments.run(newPath, oldPath)
      }
    })()
  }

  deleteFile(filePath: string): void {
    this.db.transaction(() => {
      this.db.prepare('DELETE FROM comments WHERE file_path = ?').run(filePath)
      this.db.prepare('DELETE FROM files WHERE path = ?').run(filePath)
    })()
  }

  deleteFolder(folderPath: string): void {
    this.db.transaction(() => {
      this.db.prepare('DELETE FROM comments WHERE file_path = ? OR file_path LIKE ?').run(folderPath, `${folderPath}/%`)
      this.db.prepare('DELETE FROM files WHERE path = ? OR path LIKE ?').run(folderPath, `${folderPath}/%`)
    })()
  }

  // Get recent files for vault index
  getRecentFiles(limit: number = 20): Array<{
    path: string
    title: string
    modified_at: number
    word_count: number
  }> {
    return this.db.prepare(`
      SELECT path, title, modified_at, word_count
      FROM files
      ORDER BY modified_at DESC
      LIMIT ?
    `).all(limit) as Array<{
      path: string
      title: string
      modified_at: number
      word_count: number
    }>
  }

  // Task runs
  logTaskRun(run: {
    task_name: string
    started_at: number
    ended_at: number
    status: string
    summary: string
    tool_calls: number
  }): void {
    this.db.prepare(`
      INSERT INTO task_runs (task_name, started_at, ended_at, status, summary, tool_calls)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      run.task_name,
      run.started_at,
      run.ended_at,
      run.status,
      run.summary,
      run.tool_calls
    )
  }

  // Schedules
  getSchedules(): Array<{
    id: number
    name: string
    schedule: string
    prompt: string
    tools: string
    is_active: number
  }> {
    return this.db.prepare(`
      SELECT id, name, schedule, prompt, tools, is_active
      FROM schedules
      ORDER BY id ASC
    `).all() as Array<{
      id: number
      name: string
      schedule: string
      prompt: string
      tools: string
      is_active: number
    }>
  }

  toggleSchedule(id: number, isActive: boolean): void {
    this.db.prepare(`
      UPDATE schedules SET is_active = ?, updated_at = ? WHERE id = ?
    `).run(isActive ? 1 : 0, Date.now(), id)
  }

  createSchedule(name: string, schedule: string, prompt: string): number {
    const now = Date.now()
    const result = this.db.prepare(`
      INSERT INTO schedules (name, schedule, prompt, is_active, created_at, updated_at)
      VALUES (?, ?, ?, 1, ?, ?)
    `).run(name, schedule, prompt, now, now)
    return result.lastInsertRowid as number
  }

  updateSchedule(id: number, name: string, schedule: string, prompt: string): void {
    this.db.prepare(`
      UPDATE schedules SET name = ?, schedule = ?, prompt = ?, updated_at = ? WHERE id = ?
    `).run(name, schedule, prompt, Date.now(), id)
  }

  deleteSchedule(id: number): void {
    this.db.prepare('DELETE FROM schedules WHERE id = ?').run(id)
  }

  // One-time tasks
  createTask(name: string, prompt: string, runAt: number | null): number {
    const now = Date.now()
    const status = runAt === null ? 'immediate' : 'pending'
    const result = this.db.prepare(`
      INSERT INTO tasks (name, prompt, run_at, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(name, prompt, runAt, status, now, now)
    return result.lastInsertRowid as number
  }

  updateTask(id: number, name: string, prompt: string, runAt: number | null): void {
    const status = runAt === null ? 'immediate' : 'pending'
    this.db.prepare(`
      UPDATE tasks SET name = ?, prompt = ?, run_at = ?, status = ?, updated_at = ?
      WHERE id = ? AND status IN ('pending', 'immediate')
    `).run(name, prompt, runAt, status, Date.now(), id)
  }

  deleteTask(id: number): void {
    this.db.prepare("DELETE FROM tasks WHERE id = ? AND status IN ('pending', 'immediate')").run(id)
  }

  getPendingTasks(): Array<{ id: number; name: string; prompt: string; run_at: number }> {
    return this.db.prepare(`
      SELECT id, name, prompt, run_at FROM tasks
      WHERE status = 'pending' AND run_at IS NOT NULL AND run_at <= ?
    `).all(Date.now()) as Array<{ id: number; name: string; prompt: string; run_at: number }>
  }

  getImmediateTasks(): Array<{ id: number; name: string; prompt: string }> {
    return this.db.prepare(`
      SELECT id, name, prompt FROM tasks WHERE status = 'immediate'
    `).all() as Array<{ id: number; name: string; prompt: string }>
  }

  markTaskRunning(id: number): void {
    this.db.prepare("UPDATE tasks SET status = 'running', updated_at = ? WHERE id = ?").run(Date.now(), id)
  }

  markTaskDone(id: number, status: string, summary: string): void {
    this.db.prepare(`
      UPDATE tasks SET status = ?, summary = ?, updated_at = ? WHERE id = ?
    `).run(status, summary, Date.now(), id)
  }

  listPendingAndFutureTasks(): Array<{
    id: number
    name: string
    prompt: string
    run_at: number | null
    status: string
  }> {
    return this.db.prepare(`
      SELECT id, name, prompt, run_at, status FROM tasks
      WHERE status IN ('pending', 'immediate')
      ORDER BY run_at ASC NULLS LAST, created_at ASC
    `).all() as Array<{ id: number; name: string; prompt: string; run_at: number | null; status: string }>
  }

  getRecentTaskRuns(limit: number = 10): Array<{
    id: number
    task_name: string
    started_at: number
    ended_at: number
    status: string
    summary: string
  }> {
    return this.db.prepare(`
      SELECT id, task_name, started_at, ended_at, status, summary
      FROM task_runs
      ORDER BY started_at DESC
      LIMIT ?
    `).all(limit) as Array<{
      id: number
      task_name: string
      started_at: number
      ended_at: number
      status: string
      summary: string
    }>
  }

  // Chat sessions
  getOrCreateChatSession(contextType: string, contextKey: string): { id: string; isNew: boolean } {
    const existing = this.db.prepare(
      'SELECT id FROM chat_sessions WHERE context_type = ? AND context_key = ?'
    ).get(contextType, contextKey) as { id: string } | undefined

    if (existing) return { id: existing.id, isNew: false }

    const id = crypto.randomUUID()
    const now = Date.now()
    this.db.prepare(
      'INSERT INTO chat_sessions (id, context_type, context_key, created_at, last_message_at) VALUES (?, ?, ?, ?, ?)'
    ).run(id, contextType, contextKey, now, now)
    return { id, isNew: true }
  }

  replaceChatSession(contextType: string, contextKey: string): string {
    const id = crypto.randomUUID()
    const now = Date.now()
    this.db.prepare(
      'INSERT OR REPLACE INTO chat_sessions (id, context_type, context_key, created_at, last_message_at) VALUES (?, ?, ?, ?, ?)'
    ).run(id, contextType, contextKey, now, now)
    return id
  }

  touchChatSession(sessionId: string): void {
    this.db.prepare('UPDATE chat_sessions SET last_message_at = ? WHERE id = ?').run(Date.now(), sessionId)
  }

  getAllChatSessions(): Array<{
    id: string
    context_type: string
    context_key: string
    created_at: number
    last_message_at: number
  }> {
    return this.db.prepare(`
      SELECT id, context_type, context_key, created_at, last_message_at
      FROM chat_sessions
      ORDER BY last_message_at DESC
    `).all() as Array<{
      id: string
      context_type: string
      context_key: string
      created_at: number
      last_message_at: number
    }>
  }

  clearAllSettings(): void {
    this.db.prepare('DELETE FROM settings').run()
  }

  getDbPath(): string {
    return this.dbPath
  }

  // Search files by query
  searchFiles(query: string, limit: number = 50): Array<{
    path: string
    title: string
    folder: string
    modified_at: number
    snippet: string
    rank: number
  }> {
    if (!query.trim()) return []

    // Use FTS5 for full-text search
    const results = this.db.prepare(`
      SELECT 
        f.path,
        f.title,
        f.folder,
        f.modified_at,
        snippet(files_fts, 2, '<mark>', '</mark>', '...', 32) as snippet,
        files_fts.rank as rank
      FROM files_fts
      JOIN files f ON files_fts.path = f.path
      WHERE files_fts MATCH ?
      ORDER BY rank
      LIMIT ?
    `).all(query, limit) as Array<{
      path: string
      title: string
      folder: string
      modified_at: number
      snippet: string
      rank: number
    }>

    return results
  }

  // Index or update file in search index
  indexFile(path: string, title: string, content: string, folder: string, wordCount: number, tags: string = '', modifiedAt?: number): void {
    const now = Date.now()
    const fileModifiedAt = modifiedAt ?? now

    this.db.transaction(() => {
      // Update or insert into files table
      this.db.prepare(`
        INSERT INTO files (path, title, folder, created_at, modified_at, word_count, tags, content)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(path) DO UPDATE SET
          title = excluded.title,
          folder = excluded.folder,
          modified_at = excluded.modified_at,
          word_count = excluded.word_count,
          tags = excluded.tags,
          content = excluded.content
      `).run(path, title, folder, now, fileModifiedAt, wordCount, tags, content)

      // Update FTS index (FTS5 virtual tables don't support upsert — delete then insert)
      this.db.prepare('DELETE FROM files_fts WHERE path = ?').run(path)
      this.db.prepare(`
        INSERT INTO files_fts (path, title, content)
        VALUES (?, ?, ?)
      `).run(path, title, content)
    })()
  }

  // Remove file from search index
  removeFileFromIndex(path: string): void {
    this.db.transaction(() => {
      this.db.prepare('DELETE FROM files_fts WHERE path = ?').run(path)
      this.db.prepare('DELETE FROM files WHERE path = ?').run(path)
    })()
  }

  // ─── Inbox ────────────────────────────────────────────────────────────────

  createInboxMessage(opts: {
    subject: string
    body: string
    type: string
    sourceJob?: string
    fromAddr?: string
  }): number {
    const result = this.db.prepare(`
      INSERT INTO inbox_messages (subject, body, type, status, from_addr, source_job, created_at)
      VALUES (?, ?, ?, 'unread', ?, ?, ?)
    `).run(
      opts.subject,
      opts.body,
      opts.type,
      opts.fromAddr ?? 'wilfred@thinkpod.dev',
      opts.sourceJob ?? null,
      Date.now()
    )
    
    // Notify renderer of inbox update
    if (this.onInboxUpdated) {
      this.onInboxUpdated()
    }
    
    return result.lastInsertRowid as number
  }

  listInboxMessages(): Array<{
    id: number
    subject: string
    body: string
    type: string
    status: string
    from_addr: string
    source_job: string | null
    created_at: number
    reply_count: number
  }> {
    return this.db.prepare(`
      SELECT
        m.id, m.subject, m.body, m.type, m.status, m.from_addr, m.source_job, m.created_at,
        COUNT(r.id) AS reply_count
      FROM inbox_messages m
      LEFT JOIN inbox_replies r ON r.message_id = m.id
      GROUP BY m.id
      ORDER BY m.created_at DESC
    `).all() as Array<{
      id: number; subject: string; body: string; type: string; status: string
      from_addr: string; source_job: string | null; created_at: number; reply_count: number
    }>
  }

  getInboxMessage(id: number): {
    id: number
    subject: string
    body: string
    type: string
    status: string
    from_addr: string
    source_job: string | null
    created_at: number
    replies: Array<{ id: number; role: string; body: string; created_at: number }>
  } | null {
    const msg = this.db.prepare('SELECT * FROM inbox_messages WHERE id = ?').get(id) as {
      id: number; subject: string; body: string; type: string; status: string
      from_addr: string; source_job: string | null; created_at: number
    } | undefined
    if (!msg) return null

    const replies = this.db.prepare(
      'SELECT id, role, body, created_at FROM inbox_replies WHERE message_id = ? ORDER BY created_at ASC'
    ).all(id) as Array<{ id: number; role: string; body: string; created_at: number }>

    return { ...msg, replies }
  }

  markInboxRead(id: number): void {
    this.db.prepare("UPDATE inbox_messages SET status = 'read' WHERE id = ? AND status = 'unread'").run(id)
  }

  archiveInboxMessage(id: number): void {
    this.db.prepare("UPDATE inbox_messages SET status = 'archived' WHERE id = ?").run(id)
  }

  deleteInboxMessage(id: number): void {
    this.db.prepare('DELETE FROM inbox_messages WHERE id = ?').run(id)
  }

  appendInboxReply(messageId: number, role: 'agent' | 'human', body: string): number {
    const result = this.db.prepare(
      'INSERT INTO inbox_replies (message_id, role, body, created_at) VALUES (?, ?, ?, ?)'
    ).run(messageId, role, body, Date.now())
    return result.lastInsertRowid as number
  }

  getInboxUnreadCount(): number {
    const row = this.db.prepare(
      "SELECT COUNT(*) as count FROM inbox_messages WHERE status = 'unread'"
    ).get() as { count: number }
    return row.count
  }

  close(): void {
    this.db.close()
  }
}
