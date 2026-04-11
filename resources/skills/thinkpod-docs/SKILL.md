---
name: thinkpod-docs
description: Answer questions about ThinkPod and Wilfred — what they are, how features work, keyboard shortcuts, AI provider setup, and common troubleshooting. Use when the user asks about ThinkPod, Wilfred, settings, shortcuts, or how to do something in the app.
---

# ThinkPod & Wilfred — Quick Reference

ThinkPod is a **100% local, AI-powered personal knowledge base** desktop app. It stores notes as plain markdown files in a folder called your **Vault**. The core differentiator: an embedded AI agent — **Wilfred** — who is proactive, not reactive.

## What is Wilfred?

Wilfred is ThinkPod's integrated AI agent. Unlike chatbots, he:
- Reads the document you currently have open (automatically, no pasting)
- Runs background tasks on a schedule while you work or sleep
- Sends proactive insights and research to your **Inbox**
- Builds understanding of your entire vault over time

Open Wilfred: `Cmd+J` (Mac) / `Ctrl+J` (Windows/Linux)

## Core Features

| Feature | How to access |
|---------|---------------|
| New note | `Cmd+N` |
| Open Wilfred chat | `Cmd+J` |
| Toggle sidebar | `Cmd+B` |
| Save document | `Cmd+S` |
| Voice capture | Microphone icon in toolbar |
| Inbox (Wilfred's messages) | `Cmd+J` → Inbox |

## Talking to Wilfred

- Type your message → press **Enter** to send
- **Shift+Enter** = new line without sending
- Wilfred automatically has full context of the open document — say "summarize this" or "what's the main argument" without pasting
- Close with **Esc**

## Configuring AI (Settings → Inference)

ThinkPod uses any **OpenAI-compatible API**:

| Provider | Base URL | Notes |
|----------|----------|-------|
| Ollama (local) | `http://localhost:11434/v1` | Free, fully local |
| LM Studio (local) | `http://localhost:1234/v1` | Free, GUI included |
| OpenRouter | `https://openrouter.ai/api/v1` | Needs API key |
| Groq | `https://api.groq.com/openai/v1` | Fast, free tier |
| OpenAI | `https://api.openai.com/v1` | Needs API key |

Leave API Key blank for local providers.

## Vault Structure

Your Vault is a folder of plain markdown files organized into:
- **Journal** — daily reflections
- **Ideas** — brainstorms, concepts
- **Projects** — work in progress
- **People** — notes about individuals
- **Others** — everything else
- **Drafts** — unfinished thoughts (move to a category when ready)

## Privacy

- Notes are stored locally as plain markdown — you own them
- Local models: nothing leaves your machine
- Cloud providers: only the specific messages/documents you discuss are sent
- No telemetry, no tracking, no analytics

## Common Questions

**Can I use ThinkPod offline?** Yes, with a local model (Ollama, LM Studio).

**Where are my notes?** In your Vault folder — plain `.md` files you can open in any editor.

**Can I use existing notes?** Yes — point your Vault to any folder with markdown files.

**Is it free?** Yes. Open source (MIT). You only pay if you use a paid cloud AI provider.

**Mobile app?** Not yet — desktop only (macOS, Windows, Linux).

---

## Available Documentation

For comprehensive information, refer to these detailed guides:

### Getting Started
- `OVERVIEW.md` — what ThinkPod is, core features, and differentiators
- `INSTALLATION.md` — setup, prerequisites, building from source, troubleshooting
- `QUICK-START.md` — get productive in 5 minutes, essential workflows
- `PHILOSOPHY.md` — local-first, agent-native, and fast capture principles

### Core Features
- `WILFRED.md` — full Wilfred capabilities, tips, and troubleshooting
- `VAULT.md` — vault structure, file management, backup/sync
- `VOICE-CAPTURE.md` — voice dictation setup, tips, and troubleshooting
- `SHORTCUTS.md` — complete keyboard shortcut reference

### Configuration & Privacy
- `AI-PROVIDERS.md` — all supported AI providers with setup instructions
- `PRIVACY.md` — comprehensive privacy & security information
- `FAQ.md` — common questions and answers

### Technical
- `TECH-STACK.md` — technical architecture, dependencies, development info
