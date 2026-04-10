import fs from 'node:fs/promises'
import path from 'node:path'
import { LLMClient, LLMMessage } from './LLMClient.js'
import { ChatSession, ChatMessage } from './ChatSession.js'
import { getEnabledToolDefinitions, DEFAULT_TOOLS_CONFIG } from './ToolDefinitions.js'
import { ToolExecutor } from './ToolExecutor.js'
import type { DatabaseManager } from '../database/DatabaseManager.js'
import type { ToolsConfig } from './tools/types.js'

export type InvocationType = 'docs_review' | 'general_chat'

export interface ChatAgentConfig {
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

export type OnToolUse = (toolName: string, args: Record<string, unknown>) => void

// Default invocation prompt templates
const DEFAULT_INVOCATION_PROMPTS: Record<InvocationType, string> = {
  docs_review: `You are currently reviewing the markdown document at {file_path}.
The user may want to discuss the content, ask questions, or request edits, summaries, or other operations.
Use available tools when appropriate.

Current document content:
---
{file_content}
---`,
  general_chat: `The user is in a general conversation. No specific document is open.
Answer questions, help with the vault, or discuss ideas.`,
}

const MAX_CHAT_ITERATIONS = 10

export class ChatAgent {
  private client: LLMClient
  private session: ChatSession
  private executor: ToolExecutor
  private sessionId: string
  private systemPrompt: string
  private messages: LLMMessage[] = []
  private toolsConfig: ToolsConfig

  private constructor(
    client: LLMClient,
    session: ChatSession,
    executor: ToolExecutor,
    sessionId: string,
    systemPrompt: string,
    history: ChatMessage[],
    toolsConfig: ToolsConfig
  ) {
    this.client = client
    this.session = session
    this.executor = executor
    this.sessionId = sessionId
    this.systemPrompt = systemPrompt
    this.toolsConfig = toolsConfig

    // Reconstruct in-memory message list from JSONL history (excluding system)
    this.messages = [
      { role: 'system', content: systemPrompt },
      ...history
        .filter(m => m.role !== 'system')
        .map(m => ({ role: m.role, content: m.content })),
    ]
  }

  static async open(
    config: ChatAgentConfig,
    contextType: InvocationType,
    contextKey: string,
    contextFilePath?: string
  ): Promise<{ agent: ChatAgent; sessionId: string; history: ChatMessage[] }> {
    await ChatSession.ensure(config.vaultPath)

    const { id: sessionId, isNew } = config.dbManager.getOrCreateChatSession(contextType, contextKey)
    const session = new ChatSession(ChatSession.sessionsDir(config.vaultPath), sessionId)
    const executor = new ToolExecutor({ vaultPath: config.vaultPath, dbManager: config.dbManager, toolsConfig: config.toolsConfig ?? DEFAULT_TOOLS_CONFIG })

    const systemPrompt = await ChatAgent.buildSystemPrompt(config, contextType, contextFilePath)

    const history = isNew ? [] : await session.readAll()

    const agent = new ChatAgent(
      new LLMClient(config.llmConfig),
      session,
      executor,
      sessionId,
      systemPrompt,
      history,
      config.toolsConfig ?? DEFAULT_TOOLS_CONFIG
    )

    return { agent, sessionId, history }
  }

  static async openFresh(
    config: ChatAgentConfig,
    contextType: InvocationType,
    contextKey: string,
    contextFilePath?: string
  ): Promise<{ agent: ChatAgent; sessionId: string }> {
    await ChatSession.ensure(config.vaultPath)

    const sessionId = config.dbManager.replaceChatSession(contextType, contextKey)
    const session = new ChatSession(ChatSession.sessionsDir(config.vaultPath), sessionId)
    await session.clear()

    const executor = new ToolExecutor({ vaultPath: config.vaultPath, dbManager: config.dbManager, toolsConfig: config.toolsConfig ?? DEFAULT_TOOLS_CONFIG })
    const systemPrompt = await ChatAgent.buildSystemPrompt(config, contextType, contextFilePath)
    const agent = new ChatAgent(
      new LLMClient(config.llmConfig),
      session,
      executor,
      sessionId,
      systemPrompt,
      [],
      config.toolsConfig ?? DEFAULT_TOOLS_CONFIG
    )

    return { agent, sessionId }
  }

  async send(userMessage: string, onToolUse?: OnToolUse): Promise<{ content: string; toolCallCount: number }> {
    const userMsg: ChatMessage = { role: 'user', content: userMessage, ts: Date.now() }
    await this.session.append(userMsg)
    this.messages.push({ role: 'user', content: userMessage })

    let finalContent = ''
    let totalToolCalls = 0
    let iterations = 0

    while (iterations < MAX_CHAT_ITERATIONS) {
      iterations++

      const chatTools = getEnabledToolDefinitions(this.toolsConfig, { includeFinishTask: false })
      const response = await this.client.chatWithTools(this.messages, chatTools as unknown[])

      if (!response.toolCalls || response.toolCalls.length === 0) {
        // Natural text response — end of turn
        finalContent = response.content ?? ''
        this.messages.push({ role: 'assistant', content: finalContent })
        break
      }

      // Assistant turn with tool calls
      this.messages.push({ role: 'assistant', content: response.content || '' })
      totalToolCalls += response.toolCalls.length

      for (const toolCall of response.toolCalls) {
        let args: Record<string, unknown> = {}
        try { args = JSON.parse(toolCall.function.arguments) } catch { /* ignore */ }

        onToolUse?.(toolCall.function.name, args)

        const result = await this.executor.execute(toolCall)
        this.messages.push({
          role: 'user',
          content: `Tool result for ${toolCall.function.name}:\n${JSON.stringify(result, null, 2)}`,
        })
      }
    }

    if (!finalContent) {
      finalContent = 'I have completed the requested actions.'
      this.messages.push({ role: 'assistant', content: finalContent })
    }

    const assistantMsg: ChatMessage = { role: 'assistant', content: finalContent, ts: Date.now() }
    await this.session.append(assistantMsg)

    return { content: finalContent, toolCallCount: totalToolCalls }
  }

  getSystemPrompt(): string {
    return this.systemPrompt
  }

  getSessionId(): string {
    return this.sessionId
  }

  private static async buildSystemPrompt(
    config: ChatAgentConfig,
    contextType: InvocationType,
    contextFilePath?: string
  ): Promise<string> {
    const templates = await ChatAgent.loadInvocationPrompts(config.dbManager)
    let invocationPrompt = templates[contextType]

    if (contextType === 'docs_review' && contextFilePath) {
      const fullPath = path.join(config.vaultPath, contextFilePath)
      let fileContent = ''
      try {
        fileContent = await fs.readFile(fullPath, 'utf-8')
      } catch {
        fileContent = '(Could not read document content)'
      }
      invocationPrompt = invocationPrompt
        .replace('{file_path}', fullPath)
        .replace('{file_content}', fileContent)
    }

    return `${config.persona}\n\n${invocationPrompt}`
  }

  private static async loadInvocationPrompts(
    dbManager: DatabaseManager
  ): Promise<Record<InvocationType, string>> {
    const saved = dbManager.getSetting('invocationPrompts') as Partial<Record<InvocationType, string>> | null
    return {
      docs_review: saved?.docs_review ?? DEFAULT_INVOCATION_PROMPTS.docs_review,
      general_chat: saved?.general_chat ?? DEFAULT_INVOCATION_PROMPTS.general_chat,
    }
  }

  static getDefaultInvocationPrompts(): Record<InvocationType, string> {
    return { ...DEFAULT_INVOCATION_PROMPTS }
  }
}
