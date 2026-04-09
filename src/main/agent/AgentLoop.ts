/**
 * Agent Loop - Wilfred's thinking process
 * 
 * Cancellation: Every async operation (LLM calls, tool execution) must check
 * the abort signal and throw TaskAbortedError when cancelled.
 */

import { LLMClient, LLMMessage, ToolCall } from './LLMClient.js'
import { TOOL_DEFINITIONS } from './ToolDefinitions.js'
import { ToolExecutor, ToolContext } from './ToolExecutor.js'
import type { DatabaseManager } from '../database/DatabaseManager.js'

export class TaskAbortedError extends Error {
  constructor() {
    super('Task aborted')
    this.name = 'TaskAbortedError'
  }
}

export interface TaskConfig {
  abbeyPath: string
  dbManager: DatabaseManager
  llmConfig: {
    baseUrl: string
    model: string
    apiKey?: string
  }
  persona: string
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
      abbeyPath: config.abbeyPath,
      dbManager: config.dbManager,
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
      
      // Get abbey index for context
      const abbeyIndex = await this.buildAbbeyIndex()
      
      this.messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Abbey contents:\n${abbeyIndex}\n\nTask: ${instruction}` },
      ]

      // Start the loop
      while (this.taskRun.iterations < MAX_TASK_ITERATIONS) {
        this.checkAbort()
        
        this.taskRun.iterations++
        this.onUpdate(this.taskRun)

        // Get LLM response
        const response = await this.client.chatWithTools(this.messages, TOOL_DEFINITIONS)
        
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
              this.taskRun.summary = result.data?.summary || 'Task completed'
              this.taskRun.endedAt = Date.now()
              return this.taskRun
            }
          }
        } else {
          // No tool calls - treat as natural end, write epistle
          await this.writeEpistleFromResponse(response.content || '')
          this.taskRun.status = 'done'
          this.taskRun.summary = 'Written to epistle'
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

You have access to tools to work with the abbey's files. When you complete your work, call finish_task().

Rules:
- Be methodical: work step by step
- When uncertain, use add_comment() to ask rather than guess
- Keep epistles clear and concise
- finish_task() when done

Abbey root: ${this.config.abbeyPath}
Today: ${new Date().toISOString().split('T')[0]}`
  }

  private async buildAbbeyIndex(): Promise<string> {
    try {
      // List recent folios
      const foliosPath = path.join(this.context.abbeyPath, '_folios')
      const files = await this.context.dbManager.getRecentFiles(20)
      
      if (files.length === 0) {
        return 'Abbey is empty. No folios to triage.'
      }

      return files.map(f => {
        const date = new Date(f.modified_at).toLocaleDateString()
        return `- ${f.path} (${f.word_count} words, modified ${date})`
      }).join('\n')
    } catch (error) {
      console.error('Failed to build abbey index:', error)
      return 'Unable to read abbey contents'
    }
  }

  private async writeEpistleFromResponse(content: string): Promise<void> {
    await this.executor.execute({
      id: 'epistle-from-response',
      type: 'function',
      function: {
        name: 'write_epistle',
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
