/**
 * Scheduler
 * Schedules and fires Wilfred's automated tasks.
 */

import { schedule, ScheduledTask } from 'node-cron'
import { EventEmitter } from 'events'
import type { DatabaseManager } from '../database/DatabaseManager.js'
import type { VaultManager } from '../vault/VaultManager.js'
import { AgentLoop, TaskRun } from '../agent/AgentLoop.js'
import fs from 'fs/promises'
import path from 'node:path'

export interface SchedulerEvents {
  taskStart: (run: TaskRun) => void
  taskUpdate: (run: TaskRun) => void
  taskEnd: (run: TaskRun) => void
}

interface QueuedTask {
  name: string
  prompt: string
  resolve: (run: TaskRun) => void
  reject: (err: Error) => void
}

export class Scheduler extends EventEmitter {
  private jobs = new Map<number, ScheduledTask>()
  private runningTask: AgentLoop | null = null
  private taskQueue: QueuedTask[] = []

  constructor(
    private dbManager: DatabaseManager,
    private vaultManager: VaultManager
  ) {
    super()
  }

  /**
   * Load all active hours from DB and schedule them.
   */
  start(): void {
    const hours = this.dbManager.getSchedules()
    for (const hour of hours) {
      if (hour.is_active) {
        this.scheduleHour(hour.id, hour.name, hour.schedule, hour.prompt)
      }
    }
  }

  /**
   * Stop all scheduled jobs.
   */
  stop(): void {
    for (const job of this.jobs.values()) {
      job.stop()
    }
    this.jobs.clear()
    this.runningTask?.abort()
    for (const queued of this.taskQueue) {
      queued.reject(new Error('Scheduler stopped'))
    }
    this.taskQueue = []
  }

  /**
   * Reload a single hour after a toggle or update.
   */
  reloadHour(id: number): void {
    const existing = this.jobs.get(id)
    if (existing) {
      existing.stop()
      this.jobs.delete(id)
    }

    const hours = this.dbManager.getSchedules()
    const hour = hours.find(h => h.id === id)
    if (hour?.is_active) {
      this.scheduleHour(hour.id, hour.name, hour.schedule, hour.prompt)
    }
  }

  /**
   * Trigger a task manually (Ring the Bell).
   */
  async triggerNow(id: number): Promise<TaskRun> {
    const hours = this.dbManager.getSchedules()
    const hour = hours.find(h => h.id === id)
    if (!hour) {
      throw new Error(`No scheduled task with id ${id}`)
    }
    return this.runTask(hour.name, hour.prompt)
  }

  /**
   * Abort the running task.
   */
  abortRunning(): void {
    this.runningTask?.abort()
  }

  /**
   * Reload all active schedules (used after create/delete).
   */
  reloadAll(): void {
    for (const job of this.jobs.values()) {
      job.stop()
    }
    this.jobs.clear()
    this.start()
  }

  /**
   * Stop and remove a single job (used on delete).
   */
  stopJob(id: number): void {
    const job = this.jobs.get(id)
    if (job) {
      job.stop()
      this.jobs.delete(id)
    }
  }

  private scheduleHour(id: number, name: string, cronExpr: string, prompt: string): void {
    const job = schedule(cronExpr, () => {
      this.runTask(name, prompt).catch(err => {
        console.error(`[Scheduler] Error running "${name}":`, err)
      })
    })
    this.jobs.set(id, job)
    console.log(`[Scheduler] Scheduled "${name}" (${cronExpr})`)
  }

  private runNextQueued(): void {
    const next = this.taskQueue.shift()
    if (!next) return
    this.runTask(next.name, next.prompt).then(next.resolve).catch(next.reject)
  }

  private async runTask(name: string, prompt: string): Promise<TaskRun> {
    if (this.runningTask) {
      console.log(`[Scheduler] Task queued (queue length: ${this.taskQueue.length + 1}): "${name}"`)
      return new Promise((resolve, reject) => {
        this.taskQueue.push({ name, prompt, resolve, reject })
      })
    }

    interface LLMStorageMin {
      profiles: Array<{ id: string; provider: string; baseUrl: string; model: string; apiKey?: string; builtinQuant?: string }>
      activeId: string | null
    }
    const stored = this.dbManager.getSetting('llmConfig') as LLMStorageMin | null
    const activeProfile = stored?.profiles?.find(p => p.id === stored?.activeId) ?? null
    if (!activeProfile) {
      throw new Error('LLM not configured')
    }
    const llmConfig = activeProfile.provider === 'builtin'
      ? (() => {
          const url = this.dbManager.getSetting('llmBuiltinUrl') as string | null
          return url ? { baseUrl: url, model: 'gemma-4-e4b-builtin', apiKey: undefined } : null
        })()
      : { baseUrl: activeProfile.baseUrl, model: activeProfile.model, apiKey: activeProfile.apiKey }

    if (!llmConfig) {
      throw new Error('LLM not configured')
    }

    const agentProfile = this.dbManager.getSetting('agentProfile') as { name?: string; systemPrompt?: string } | null
    const agentName = agentProfile?.name ?? 'Wilfred'
    let persona = `You are ${agentName}, a diligent assistant in ThinkPod.`
    try {
      const personaPath = path.join(this.vaultManager.vaultPath, '.thinkpod', 'wilfred.md')
      persona = await fs.readFile(personaPath, 'utf-8')
    } catch {
      // use default
    }

    const toolsConfig = this.dbManager.getSetting('toolsConfig') as Record<string, { enabled: boolean; config?: Record<string, string> }> | null

    const loop = new AgentLoop(
      {
        vaultPath: this.vaultManager.vaultPath,
        dbManager: this.dbManager,
        llmConfig,
        persona,
        toolsConfig: toolsConfig ?? undefined,
      },
      (run) => {
        this.emit('taskUpdate', run)
        if (run.status !== 'running') {
          this.dbManager.logTaskRun({
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

    this.runningTask = loop
    this.emit('taskStart', { taskName: name, status: 'running', startedAt: Date.now(), iterations: 0, toolCalls: 0, id: '', prompt })

    try {
      const result = await loop.runTask(name, prompt)
      this.emit('taskEnd', result)
      return result
    } finally {
      this.runningTask = null
      this.runNextQueued()
    }
  }
}
