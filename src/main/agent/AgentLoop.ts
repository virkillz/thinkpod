/**
 * Agent Loop - Wilfred's thinking process
 * 
 * Cancellation: Every async operation (LLM calls, tool execution) must check
 * the abort signal and throw TaskAbortedError when cancelled.
 */

import path from 'node:path'
import { LLMClient, LLMMessage } from './LLMClient.js'
import { getEnabledToolDefinitions, DEFAULT_TOOLS_CONFIG } from './ToolDefinitions.js'
import { ToolExecutor, ToolContext } from './ToolExecutor.js'
import type { ToolsConfig } from './tools/types.js'
import type { DatabaseManager } from '../database/DatabaseManager.js'

export class TaskAbortedError extends Error {
  constructor() {
    super('Task aborted')
    this.name = 'TaskAbortedError'
  }
}

export interface TaskConfig {
  vaultPath: string
  dbManager: DatabaseManager
  llmConfig: {
    baseUrl: string
    model: string
    apiKey?: string
  }
  persona: string
  toolsConfig?: ToolsConfig
}

export interface TaskRun {
  id: string
  taskName: string
  prompt: string
  status: 'running' | 'done' | 'error' | 'aborted' | 'budget_exceeded'
  startedAt: number
  endedAt?: number
  iterations: number
  toolCalls: number
  summary?: string
  error?: string
}

// Token budget constraints (same discipline as locco)
const TASK_TOKEN_BUDGET = 6000
const MAX_TASK_ITERATIONS = 25

export class AgentLoop {
  private client: LLMClient
  private executor: ToolExecutor
  private context: ToolContext
  private taskRun: TaskRun
  private messages: LLMMessage[] = []
  private abortController: AbortController | null = null

  constructor(
    private config: TaskConfig,
    private onUpdate: (run: TaskRun) => void
  ) {
    this.client = new LLMClient(config.llmConfig)
    this.context = {
      vaultPath: config.vaultPath,
      dbManager: config.dbManager,
      toolsConfig: config.toolsConfig ?? DEFAULT_TOOLS_CONFIG,
    }
    this.executor = new ToolExecutor(this.context)
    
    this.taskRun = {
      id: crypto.randomUUID(),
      taskName: 'ad-hoc',
      prompt: '',
      status: 'running',
      startedAt: Date.now(),
      iterations: 0,
      toolCalls: 0,
    }
  }

  /**
   * Run a task with the given instruction
   */
  async runTask(taskName: string, instruction: string): Promise<TaskRun> {
    this.abortController = new AbortController()
    
    this.taskRun.taskName = taskName
    this.taskRun.prompt = instruction

    try {
      // Build initial system prompt
      const systemPrompt = this.buildSystemPrompt(taskName, instruction)
      
      // Get vault index for context
      const vaultIndex = await this.buildVaultIndex()
      
      this.messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Vault contents:\n${vaultIndex}\n\nTask: ${instruction}` },
      ]

      // Start the loop
      while (this.taskRun.iterations < MAX_TASK_ITERATIONS) {
        this.checkAbort()
        
        this.taskRun.iterations++
        this.onUpdate(this.taskRun)

        // Get LLM response
        const toolDefs = getEnabledToolDefinitions(this.config.toolsConfig ?? DEFAULT_TOOLS_CONFIG)
        const response = await this.client.chatWithTools(this.messages, toolDefs as unknown[])
        
        // Add assistant message
        this.messages.push({
          role: 'assistant',
          content: response.content || '',
        })

        // Check for tool calls
        if (response.toolCalls && response.toolCalls.length > 0) {
          this.taskRun.toolCalls += response.toolCalls.length
          this.onUpdate(this.taskRun)

          // Execute each tool call
          for (const toolCall of response.toolCalls) {
            this.checkAbort()
            
            const result = await this.executor.execute(toolCall)
            
            // Add tool result to messages
            this.messages.push({
              role: 'user',
              content: `Tool result for ${toolCall.function.name}:\n${JSON.stringify(result, null, 2)}`,
            })

            // Check if task is finished
            if (toolCall.function.name === 'finish_task' && result.success) {
              this.taskRun.status = 'done'
              this.taskRun.summary = (result.data as { summary?: string })?.summary || 'Task completed'
              this.taskRun.endedAt = Date.now()
              return this.taskRun
            }
          }
        } else {
          // No tool calls - treat as natural end, write to Inbox
          await this.writeInboxFromResponse(response.content || '')
          this.taskRun.status = 'done'
          this.taskRun.summary = 'Written to inbox'
          this.taskRun.endedAt = Date.now()
          return this.taskRun
        }

        // Check budget
        // Note: Actual token counting would require tiktoken or similar
        // For now we use iteration count as a proxy
        if (this.taskRun.iterations >= MAX_TASK_ITERATIONS - 1) {
          this.taskRun.status = 'budget_exceeded'
          this.taskRun.error = 'Task exceeded iteration budget'
          this.taskRun.endedAt = Date.now()
          return this.taskRun
        }
      }

      this.taskRun.status = 'done'
      this.taskRun.summary = 'Task completed'
      this.taskRun.endedAt = Date.now()
      return this.taskRun

    } catch (error) {
      if (error instanceof TaskAbortedError) {
        this.taskRun.status = 'aborted'
        this.taskRun.summary = 'Task was cancelled'
      } else {
        this.taskRun.status = 'error'
        this.taskRun.error = (error as Error).message
      }
      this.taskRun.endedAt = Date.now()
      return this.taskRun
    }
  }

  /**
   * Abort the current task
   */
  abort(): void {
    this.abortController?.abort()
  }

  private checkAbort(): void {
    if (this.abortController?.signal.aborted) {
      throw new TaskAbortedError()
    }
  }

  private buildSystemPrompt(taskName: string, instruction: string): string {
    return `${this.config.persona}

You are executing a task: "${taskName}"
Task instruction: ${instruction}

You have access to tools to work with the vault's files. When you complete your work, call finish_task().

Rules:
- Be methodical: work step by step
- When uncertain, use add_comment() to ask rather than guess
- Keep notes clear and concise
- finish_task() when done

Vault root: ${this.config.vaultPath}
Today: ${new Date().toISOString().split('T')[0]}`
  }

  private async buildVaultIndex(): Promise<string> {
    try {
      // List recent folios
      const foliosPath = path.join(this.context.vaultPath, '_folios')
      const files = await this.context.dbManager.getRecentFiles(20)
      
      if (files.length === 0) {
        return 'Vault is empty. No folios to triage.'
      }

      return files.map(f => {
        const date = new Date(f.modified_at).toLocaleDateString()
        return `- ${f.path} (${f.word_count} words, modified ${date})`
      }).join('\n')
    } catch (error) {
      console.error('Failed to build vault index:', error)
      return 'Unable to read vault contents'
    }
  }

  private async writeInboxFromResponse(content: string): Promise<void> {
    await this.executor.execute({
      id: 'inbox-from-response',
      type: 'function',
      function: {
        name: 'write_inbox',
        arguments: JSON.stringify({
          title: 'Response from Wilfred',
          content,
          type: 'insight',
          source_files: [],
        }),
      },
    })
  }
}
