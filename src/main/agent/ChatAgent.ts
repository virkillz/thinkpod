import fs from 'node:fs/promises'
import path from 'node:path'
import { LLMClient, LLMMessage } from './LLMClient.js'
import { ChatSession, ChatMessage } from './ChatSession.js'
import { getEnabledToolDefinitions, DEFAULT_TOOLS_CONFIG } from './ToolDefinitions.js'
import { ToolExecutor } from './ToolExecutor.js'
import type { DatabaseManager } from '../database/DatabaseManager.js'
import type { ToolsConfig } from './tools/types.js'
import {
  INVOCATION_DOCS_REVIEW,
  INVOCATION_GENERAL_CHAT,
  SYSTEM_PROMPT,
  buildPersonalizationInvocationPrompt,
  PERSONALIZATION_SUMMARIZE_PROMPT,
} from './prompts.js'
import { SkillRegistry } from './SkillRegistry.js'
import { PersonalizationManager, type PersonalizationTopic } from '../personalization/PersonalizationManager.js'

export type InvocationType = 'docs_review' | 'general_chat' | 'personalization'

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

// Default invocation prompt templates (text lives in prompts.ts)
// personalization is always built dynamically — this is a placeholder only
const DEFAULT_INVOCATION_PROMPTS: Record<InvocationType, string> = {
  docs_review: INVOCATION_DOCS_REVIEW,
  general_chat: INVOCATION_GENERAL_CHAT,
  personalization: '',
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
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
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

    const systemPrompt = await ChatAgent.buildSystemPrompt(config, contextType, contextKey, contextFilePath)

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
    const systemPrompt = await ChatAgent.buildSystemPrompt(config, contextType, contextKey, contextFilePath)
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

  async send(userMessage: string, onToolUse?: OnToolUse): Promise<{ content: string; toolCallCount: number; toolErrors: { toolName: string; error: string; ts: number }[] }> {
    const userMsg: ChatMessage = { role: 'user', content: userMessage, ts: Date.now() }
    await this.session.append(userMsg)
    this.messages.push({ role: 'user', content: userMessage })

    let finalContent = ''
    let totalToolCalls = 0
    let iterations = 0
    const toolErrors: { toolName: string; error: string; ts: number }[] = []

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
        const ts = Date.now()

        // Persist tool result to JSONL for post-mortem debugging
        await this.session.append({
          role: 'tool_result',
          content: result.success
            ? JSON.stringify(result.data ?? {})
            : (result.error ?? 'Unknown error'),
          ts,
          toolName: toolCall.function.name,
          toolSuccess: result.success,
        })

        if (!result.success) {
          toolErrors.push({ toolName: toolCall.function.name, error: result.error ?? 'Unknown error', ts })
        }

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

    return { content: finalContent, toolCallCount: totalToolCalls, toolErrors }
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
    contextKey?: string,
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
    } else if (contextType === 'personalization' && contextKey) {
      const pm = new PersonalizationManager(config.vaultPath)
      const existingContent = await pm.getTopicContent(contextKey as PersonalizationTopic)
      invocationPrompt = buildPersonalizationInvocationPrompt(contextKey, existingContent)
    }

    const registry = new SkillRegistry(config.vaultPath)
    const skills = await registry.discover()
    const skillsBlock = SkillRegistry.buildMetadataBlock(skills)

    const parts = [SYSTEM_PROMPT, '', `${config.persona}\n\n${invocationPrompt}`]
    if (skillsBlock) parts.push('', skillsBlock)
    return parts.join('\n')
  }

  async summarize(topic: string, userName = 'the user'): Promise<string> {
    const transcript = this.messages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n\n')

    const systemPrompt = PERSONALIZATION_SUMMARIZE_PROMPT
      .replace(/{topic}/g, topic)
      .replace(/{userName}/g, userName)
    const summaryMessages: LLMMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Conversation:\n\n${transcript}` },
    ]

    const response = await this.client.chat(summaryMessages)
    return response.content ?? ''
  }

  private static async loadInvocationPrompts(
    dbManager: DatabaseManager
  ): Promise<Record<InvocationType, string>> {
    const saved = dbManager.getSetting('invocationPrompts') as Partial<Record<InvocationType, string>> | null
    return {
      docs_review: saved?.docs_review ?? DEFAULT_INVOCATION_PROMPTS.docs_review,
      general_chat: saved?.general_chat ?? DEFAULT_INVOCATION_PROMPTS.general_chat,
      personalization: '',
    }
  }

  static getDefaultInvocationPrompts(): Record<InvocationType, string> {
    return { ...DEFAULT_INVOCATION_PROMPTS }
  }
}
