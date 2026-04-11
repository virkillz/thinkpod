# ThinkPod Philosophy

ThinkPod is built on three core principles that guide every design decision.

## 1. Local-First

**All your notes and AI processing run on your machine. No cloud, no subscription, no privacy trade-off.**

### Why This Matters

Running locally means:
- **No API cost accumulation** — the agent can run continuously without billing anxiety
- **Privacy** — the vault never leaves your machine; personal journals, family notes, sensitive ideas are safe
- **Autonomy** — no rate limits, no dependency on cloud uptime
- **True continuity** — the agent can take its time, revisit old conclusions

This makes the "always-on thinking partner" viable in a way that cloud-only tools cannot match.

### What "Local-First" Means in Practice

- Notes stored as **plain markdown files** in a folder you choose
- Metadata in a **local SQLite database** (no cloud sync)
- AI runs through **local model servers** (Ollama, LM Studio) or your chosen API
- Voice transcription via **local Whisper** (audio never uploaded)
- **No telemetry**, no tracking, no data collection

You can still use cloud AI providers if you want (OpenAI, Anthropic, etc.), but it's your choice, not a requirement.

## 2. Agent-Native

**Wilfred is not a chatbot bolted on top — he lives inside the app and participates in your writing lifecycle.**

### The Difference

Most apps with "AI features" treat the AI as a separate tool:
- You write → You ask AI → AI responds → You continue writing

ThinkPod integrates the agent into the flow:
- You write → Wilfred reads automatically → Wilfred thinks → Wilfred proactively suggests
- Wilfred runs tasks while you sleep
- Wilfred builds understanding of your entire vault over time

### What This Enables

- **Context awareness**: Wilfred knows what document you're viewing
- **Proactive insights**: Wilfred sends you messages without being asked
- **Background processing**: Schedule tasks (research, triage, summarization)
- **Continuous learning**: Wilfred's understanding grows with your vault
- **True collaboration**: You and Wilfred work together, not in sequence

## 3. Fast Capture

**Ideas are fleeting. ThinkPod makes it quick and frictionless to get thoughts down, then helps improve them.**

### The Problem

Most note apps optimize for organization, not capture:
- Too many clicks to create a note
- Forced to choose categories upfront
- Interrupts flow with formatting decisions
- Ideas lost while navigating menus

### ThinkPod's Solution

- **Keyboard-first**: `Cmd+N` creates a new thought instantly
- **Drafts area**: Unfinished thoughts have a home
- **Voice capture**: Dictate while walking, driving, or thinking
- **Agent assistance**: Wilfred can categorize and organize later
- **Markdown simplicity**: No formatting toolbar, just write

The philosophy: **Capture first, organize later, let Wilfred help.**

---

## Why Local Changes Everything

The combination of these three principles creates something unique:

Because the agent runs **locally**, it can run **continuously** without cost anxiety.

Because it runs **continuously**, it can be **proactive** instead of reactive.

Because it's **proactive**, it becomes a true **thinking partner**, not just a tool.

This is the gap that ThinkPod fills — a note-taking app where the AI is not a feature, but a collaborator.

---

## Design Principles

These philosophies translate into specific design decisions:

1. **No lock-in**: Your notes are plain markdown files you can move anytime
2. **Keyboard-first**: Every action has a shortcut
3. **Minimal UI**: The focus is on writing, not chrome
4. **Privacy by default**: Local is the default, cloud is opt-in
5. **Open source**: Transparent, auditable, community-driven
6. **No subscription**: Free software, you pay only for AI if you choose cloud

---

## Next Steps

- `WILFRED.md` - Your AI agent
- `VAULT.md` - How notes are organized
- `AI-PROVIDERS.md` - Local vs cloud options
