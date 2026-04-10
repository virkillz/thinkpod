/**
 * Canonical Hours Scheduler
 * Schedules and fires Wilfred's tasks according to the abbey's Rule.
 */

import { schedule, ScheduledTask } from 'node-cron'
import { EventEmitter } from 'events'
import type { DatabaseManager } from '../database/DatabaseManager.js'
import type { AbbeyManager } from '../abbey/AbbeyManager.js'
import { AgentLoop, TaskRun } from '../agent/AgentLoop.js'
import fs from 'fs/promises'
import path from 'node:path'

export interface SchedulerEvents {
  taskStart: (run: TaskRun) => void
  taskUpdate: (run: TaskRun) => void
  taskEnd: (run: TaskRun) => void
}

export class Scheduler extends EventEmitter {
  private jobs = new Map<number, ScheduledTask>()
  private runningTask: AgentLoop | null = null

  constructor(
    private dbManager: DatabaseManager,
    private abbeyManager: AbbeyManager
  ) {
    super()
  }

  /**
   * Load all active hours from DB and schedule them.
   */
  start(): void {
    const hours = this.dbManager.getCanonicalHours()
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

    const hours = this.dbManager.getCanonicalHours()
    const hour = hours.find(h => h.id === id)
    if (hour?.is_active) {
      this.scheduleHour(hour.id, hour.name, hour.schedule, hour.prompt)
    }
  }

  /**
   * Trigger a task manually (Ring the Bell).
   */
  async triggerNow(id: number): Promise<TaskRun> {
    const hours = this.dbManager.getCanonicalHours()
    const hour = hours.find(h => h.id === id)
    if (!hour) {
      throw new Error(`No canonical hour with id ${id}`)
    }
    return this.runTask(hour.name, hour.prompt)
  }

  /**
   * Abort the running task.
   */
  abortRunning(): void {
    this.runningTask?.abort()
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

  private async runTask(name: string, prompt: string): Promise<TaskRun> {
    if (this.runningTask) {
      console.warn(`[Scheduler] Task already running, skipping "${name}"`)
      throw new Error('A task is already running')
    }

    const llmConfig = this.dbManager.getSetting('llmConfig') as {
      baseUrl: string
      model: string
      apiKey?: string
    } | null

    if (!llmConfig) {
      throw new Error('LLM not configured')
    }

    let persona = 'You are Wilfred, a diligent monk in the Scriptorium.'
    try {
      const personaPath = path.join(this.abbeyManager.abbeyPath, '.scriptorium', 'wilfred.md')
      persona = await fs.readFile(personaPath, 'utf-8')
    } catch {
      // use default
    }

    const loop = new AgentLoop(
      {
        abbeyPath: this.abbeyManager.abbeyPath,
        dbManager: this.dbManager,
        llmConfig,
        persona,
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
    }
  }
}
