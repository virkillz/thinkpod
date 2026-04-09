import Database from 'better-sqlite3'
import path from 'path'

export class DatabaseManager {
  private db: Database.Database
  private dbPath: string

  constructor(appDataPath: string) {
    this.dbPath = path.join(appDataPath, 'scriptorium.db')
    this.db = new Database(this.dbPath)
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
        tags TEXT
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

    // Canonical hours (scheduled tasks)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS canonical_hours (
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

    // Create default canonical hours if none exist
    const count = this.db.prepare('SELECT COUNT(*) as count FROM canonical_hours').get() as { count: number }
    if (count.count === 0) {
      this.createDefaultCanonicalHours()
    }
  }

  private createDefaultCanonicalHours(): void {
    const now = Date.now()
    const stmt = this.db.prepare(`
      INSERT INTO canonical_hours (name, schedule, prompt, tools, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `)

    // Terce — Triage Folios (every 5 minutes for testing, will be */5 * * * *)
    stmt.run(
      'Terce — Triage Folios',
      '*/5 * * * *',
      'Review `_folios/` for new files. For each: identify the project, person, or topic it belongs to. If context is missing, add a comment question. If context is clear, move it to the correct folder and write a brief epistle summarising what you did.',
      JSON.stringify(['read_file', 'write_file', 'move_file', 'list_files', 'add_comment', 'write_epistle']),
      now,
      now
    )

    // Vespers — Weekly Reflection (Sundays at 20:00)
    stmt.run(
      'Vespers — Weekly Reflection',
      '0 20 * * 0',
      'Review all files modified this week. Identify patterns, stale content, orphaned notes, or connections worth surfacing. Write a weekly digest epistle.',
      JSON.stringify(['read_file', 'list_files', 'write_epistle']),
      now,
      now
    )
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

  // Get recent files for abbey index
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

  close(): void {
    this.db.close()
  }
}
