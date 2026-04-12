# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## About the Project

**ThinkPod** (codename: scriptorium) — a local-first, AI-native knowledge management desktop app built on Electron. "An IDE for your thoughts, not your code."

- All notes are stored as Markdown on the user's machine (no cloud)
- **Wilfred** is the embedded AI assistant (runs continuously in background, builds understanding of the vault over time)
- LLM integration uses any OpenAI-compatible API (Ollama, LM Studio, OpenAI, Groq, etc.)

## Commands

```bash
npm run dev          # Start Electron + Vite dev server (builds main process first, then waits for renderer)
npm run build        # Production build (Electron main + Vite renderer)
npm run build:electron  # Compile only the Electron main process (TypeScript)
npm run dist         # Build distributable installers (.dmg, .exe, .AppImage)
```

There are no test or lint commands configured.

## Architecture

The app uses a standard Electron two-process architecture with a React renderer:

```
Renderer (React 19 + Zustand)
    ↕ IPC (40+ channels in src/main/ipc/channels.ts)
Main Process (Node.js)
    ├── DatabaseManager   (SQLite via better-sqlite3)
    ├── VaultManager      (Chokidar file watching → VaultIndexer)
    ├── ChatAgent         (reactive user ↔ Wilfred chat per document)
    ├── AgentLoop         (long-running background tasks with tool use)
    ├── CognitiveRunner   (proactive background thinking)
    ├── Scheduler         (node-cron triggers for cognitive jobs)
    └── SkillRegistry     (reusable prompts from resources/skills/)
```

### IPC Layer

All renderer ↔ main communication goes through typed IPC channels. Channel names are in [src/main/ipc/channels.ts](src/main/ipc/channels.ts), handlers in [src/main/ipc/handlers.ts](src/main/ipc/handlers.ts), and the bridge exposed to renderer in [src/main/preload.ts](src/main/preload.ts). When adding new IPC calls, you must touch all three files.

### Agent System

Four layers of agent capability, each with a different lifecycle:

1. **ChatAgent** ([src/main/agent/ChatAgent.ts](src/main/agent/ChatAgent.ts)) — stateful, document-scoped chat sessions
2. **AgentLoop** ([src/main/agent/AgentLoop.ts](src/main/agent/AgentLoop.ts)) — runs tool-using tasks to completion in the background
3. **CognitiveRunner** ([src/main/agent/CognitiveRunner.ts](src/main/agent/CognitiveRunner.ts)) — proactive thinking (wraps LLMClient for scheduled jobs)
4. **Scheduler** ([src/main/scheduler/Scheduler.ts](src/main/scheduler/Scheduler.ts)) — cron-based trigger for cognitive jobs

Tools are registered and validated before execution. Core tools (vault CRUD) live in [src/main/agent/tools/core/](src/main/agent/tools/core/), extended tools (web search, bash, URL fetch) in [src/main/agent/tools/extended/](src/main/agent/tools/extended/).

### State Management

- **UI state**: Zustand store at [src/renderer/src/store/appStore.ts](src/renderer/src/store/appStore.ts) — single source of truth for vault state, files, current document, agent state, theme
- **Persistence**: `DatabaseManager` — SQLite with tables for `settings`, `files` (index + FTS), `comments`, `task_runs`
- **Chat sessions**: JSONL files at `{vault}/.thinkpod/sessions/{sessionId}.jsonl`
- **Agent vault**: `{vault}/_agent_vault/` — Wilfred's learning, inbox, insights

### Vault → UI Data Flow

Chokidar (VaultManager) watches for file changes → VaultIndexer updates SQLite → IPC event emitted → Zustand store updated → React re-renders.

## Key Files to Know

| File | Purpose |
|------|---------|
| [src/main/index.ts](src/main/index.ts) | Electron app init, window creation, vault setup |
| [src/main/ipc/handlers.ts](src/main/ipc/handlers.ts) | All IPC message handlers (~1000+ lines) |
| [src/main/agent/prompts.ts](src/main/agent/prompts.ts) | System prompts and invocation templates for Wilfred |
| [src/renderer/src/store/appStore.ts](src/renderer/src/store/appStore.ts) | Global Zustand state |
| [src/renderer/src/components/shell/MainShell.tsx](src/renderer/src/components/shell/MainShell.tsx) | View router + global keyboard shortcuts |

## TypeScript Path Aliases

- `@/*` → `src/renderer/src/*`
- `@main/*` → `src/main/*`

## Data Storage Locations

- **Database**: `app.getPath('userData')/thinkpod.db` (SQLite, WAL mode)
- **Settings keys**: `vaultPath`, `llmConfig` (`{ baseUrl, model, apiKey? }`), `theme`, `userProfile`, `editorSettings`, `voiceConfig`, `toolsConfig`
- **Themes**: `parchment`, `midnight`, `forest`, `slate`, `rose`

## Build Targets

- macOS: DMG (arm64 + x64), App ID `com.thinkpod.app`
- Windows: NSIS installer
- Linux: AppImage, deb, rpm
- `resources/skills/` is bundled as an extra resource into the distributed app
