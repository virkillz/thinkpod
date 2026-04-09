# Scriptorium — Product & Architecture Plan

## Goal

Build a local-first, AI-powered personal knowledge operating system as an Electron desktop app for macOS. A monk named **Wilfred** runs continuously in the background — triaging your folios, asking clarifying questions, and leaving epistles in your inbox with insights and recommendations. Think less "AI assistant" and more "the brother who never sleeps and has read everything in the library."

## Background

This project is inspired by [locco](~/Projects/locco/README.md), a proof-of-concept showing that small local models (4–8B parameters) can be genuinely useful with the right scaffolding — persistent memory, tool calling, and an autonomous thought loop. Locco proved the agent pattern works. Scriptorium applies it to a specific domain: personal knowledge management.

The gap in the market: tools like Obsidian are excellent vaults for markdown but passive — they do nothing until you act. Tools like Notion AI are active but cloud-dependent and expensive at scale. Scriptorium combines vault-style markdown files (local, portable, Obsidian-compatible) with a continuously running local agent that does the cognitive overhead work for you.

The name comes from the *scriptorium* — the room in a medieval monastery where monks copied, organised, and illuminated manuscripts. The AI agent is **Wilfred**, a diligent monk with a patient, methodical character: he organises with care, asks before he assumes, and leaves well-reasoned notes for the scholar (you) to review.

---

## Naming — Medieval Theme

| Feature / Concept | Scriptorium Name | Meaning |
|---|---|---|
| App | **Scriptorium** | The monastery room for manuscript work |
| AI Agent | **Wilfred** | The monk; patient, methodical, always at work |
| Working vault (directory) | **Abbey** | The whole monastery — your chosen folder |
| Capture / input area | **Inkwell** | Where you dip your quill before writing |
| Draft files (`_folios/`) | **Folios** | Loose manuscript pages not yet organised |
| Document browser | **Codex** | The library of bound manuscripts |
| Agent output folder (`_epistles/`) | **Epistles** | Letters Wilfred leaves for you to read |
| Scheduler (recurring tasks) | **Canonical Hours** | Fixed times monks worked and prayed |
| Task backlog / queue | **Chapter** | The daily chapter meeting where work was assigned |
| Tool management | **Reliquary** | Where sacred tools are kept and configured |
| Settings | **Rule** | After the Rule of Saint Benedict |

---

## Core Principles

- **Abbey-first**: All content lives as plain `.md` files in a user-chosen directory. No proprietary format. Open the same folder in Obsidian and everything works.
- **Wilfred writes directly**: Agent writes and moves files without a staging/approval step. Notes are low-stakes; the gain in flow outweighs the risk.
- **Wilfred asks before assuming**: When context is missing, Wilfred adds a comment (via SQLite annotation) rather than guessing. Questions appear as inline highlights in the Codex view.
- **Episltes are read-only from the UI**: Wilfred's `_epistles/` folder is his outbox. You read, act, or dismiss — you don't edit his letters.
- **Built from locco patterns**: Reuse the OpenAI-compatible HTTP agent loop, tool definitions schema, and token budget approach from locco — adapted for vault operations.

---

## Technology Stack

| Layer | Choice | Reason |
|---|---|---|
| Shell | Electron | TypeScript/Node.js throughout, native macOS integration |
| Language | TypeScript | Consistent with locco |
| UI | React + TailwindCSS | Component model suits multi-panel layout |
| Markdown editor | **CodeMirror 6** | Full editor with inline decoration API for Wilfred's comment anchoring |
| LLM inference | `mlx_lm` HTTP server (managed by app) | OpenAI-compatible, provider-agnostic, switchable |
| Default model | `gemma-4-e4b-it-q4` (4-bit) | ~3 GB VRAM, fast on Apple Silicon |
| Metadata store | SQLite via `better-sqlite3` | Local, zero-config, synchronous |
| Markdown parse | `remark` / `gray-matter` | Frontmatter parsing for file metadata |

---

## LLM / Inference Strategy

Scriptorium manages `mlx_lm` as a child process — started on app launch, killed on quit. The user never touches a terminal. If `mlx_lm` is not installed, the app shows a one-time setup prompt.

**Configurable fallback**: In the Rule (settings), the user can override the inference backend entirely:

| Setting | Default | Description |
|---|---|---|
| `llm.mode` | `managed` | `managed` = app starts mlx_lm; `external` = user-managed URL |
| `llm.baseUrl` | `http://localhost:8765/v1` | OpenAI-compatible base URL |
| `llm.model` | `gemma-4-e4b-it-q4` | Model name passed to the server |
| `llm.apiKey` | _(none)_ | Optional — for cloud providers or secured local servers |

With `mode: external`, the user can point Scriptorium at any OpenAI-compatible endpoint: a different local server, LM Studio, or a cloud provider. The agent loop code is identical in all cases.

**Startup sequence (managed mode):**
```
Electron main process
  └── spawn: python -m mlx_lm.server --model gemma-4-e4b-it-q4 --port 8765
        └── poll /health (1s interval, 30s timeout)
              └── ready → open app window
```

---

## Abbey Structure

```
abbey/                          ← user's chosen vault root
├── .scriptorium/
│   ├── db.sqlite               # metadata, comments, task log
│   └── config.json             # abbey-level settings (overrides global)
├── _folios/                    # raw capture drafts (the Inkwell lands here)
├── _epistles/                  # Wilfred's outbox — his letters to you
├── Projects/
├── People/
├── Ideas/
├── Journal/
└── (user's own folders)
```

`.scriptorium/` is excluded from Obsidian sync via `.obsidian/app.json` on first open.

---

## Features

### 1. Abbey Setup (First Launch)
- Dialog: "Open an existing abbey or create a new one"
- Creates `_folios/` and `_epistles/` if missing
- Initialises SQLite schema
- Checks for `mlx_lm` install; offers setup instructions if missing
- Writes default Canonical Hours (see below)

---

### 2. Inkwell (Capture)

The input interface. Two modes:
- **Quill (text)**: CodeMirror 6 editor. Saves to `_folios/YYYY-MM-DD-HH-mm-<slug>.md` on demand or auto-save
- **Voice** *(Phase 5)*: Whisper via MLX transcribes audio, output drops into `_folios/`

Folios are intentionally raw. Wilfred triages them on his schedule.

---

### 3. Codex (Document Browser)

Three-column layout:
- **Left**: abbey file tree with folder grouping
- **Centre**: CodeMirror 6 markdown editor (rendered preview toggle)
- **Right**: Wilfred's comment panel — questions and notes attached to the current file, stored in SQLite, never embedded in the `.md`

Wilfred's comments appear as highlighted line decorations in CodeMirror. Clicking a highlight opens the comment in the right panel. Each comment has a **Dismiss** or **Reply** (which logs a note back to SQLite for Wilfred's context).

---

### 4. Epistles (`_epistles/`)

Wilfred's outbox. Each epistle is a `.md` file he writes when he has something to say.

Frontmatter convention:
```yaml
---
type: insight | recommendation | question | housekeeping
created: 2026-04-09T14:30:00
source_files: [Projects/alpha.md, Ideas/pivot.md]
status: unread
---
```

The Scriptorium UI shows an unread badge on the Epistles nav item. Epistles are read-only in the UI (this is Wilfred's folder). You act on them by editing the source files or dropping a new folio in response.

---

### 5. Canonical Hours (Scheduler)

A list of recurring tasks. Each hour has:
- **Name** (e.g. "Terce — Triage Folios")
- **Schedule**: cron expression
- **Prompt**: instruction to Wilfred
- **Tools**: which tools are available for this task

Default canonical hours shipped with the app:

| Name | Schedule | Prompt |
|---|---|---|
| **Terce** — Triage Folios | `*/5 * * * *` | "Review `_folios/` for new files. For each: identify the project, person, or topic it belongs to. If context is missing, add a comment question. If context is clear, move it to the correct folder and write a brief epistle summarising what you did." |
| **Vespers** — Weekly Reflection | Sundays 20:00 | "Review all files modified this week. Identify patterns, stale content, orphaned notes, or connections worth surfacing. Write a weekly digest epistle." |

Users can add, edit, pause, or delete canonical hours.

---

### 6. Chapter (Task Backlog)

A timeline view showing all of Wilfred's work:
- **Upcoming**: next scheduled canonical hour with countdown
- **Active**: currently running task with live tool-call log (streamed via IPC)
- **Archive**: completed task history, last 30 days, with summary and files touched

Manual controls:
- **Ring the bell**: trigger any canonical hour immediately
- **One-off task**: write a custom prompt, run once on the next cycle

---

### 7. Reliquary (Tool Management)

Configure which tools Wilfred can use:

| Tool | Description |
|---|---|
| `read_file` | Read any abbey file by path |
| `write_file` | Write/overwrite an abbey file |
| `move_file` | Move a file within the abbey |
| `list_files` | List files in a directory, with optional glob filter |
| `add_comment` | Add a question or note to a file (SQLite only) |
| `write_epistle` | Write a new file to `_epistles/` |
| `brave_search` | Web search via Brave API (optional, requires key) |
| `fetch_url` | Fetch a URL and return text content |

Each tool can be toggled per canonical hour. API keys configured here.

---

## Agent Loop Architecture

Adapted directly from locco's `thought/loop.ts`:

```
Canonical Hour fires
    │
    ▼
Build system prompt
  - Wilfred's persona + Rule of the Abbey
  - Task instruction
  - Vault index (file list + recent modifications)
    │
    ▼
POST /chat/completions  →  mlx_lm (or configured endpoint)
    │
    ├─ tool_calls?  →  execute → append result → repeat
    │
    ├─ finish_task() called?  →  log to SQLite, done
    │
    └─ plain text, no tool call  →  write to _epistles/, done
```

**Stop conditions** (same discipline as locco):
1. Wilfred calls `finish_task()` — structured, intentional stop
2. Token budget exceeded (`TASK_TOKEN_BUDGET = 6000`)
3. `MAX_TASK_ITERATIONS = 25` safety cap
4. Intent-without-tool-call detected → re-prompt once (locco pattern)
5. Plain text response → natural end, content written as epistle

**Token budget per task run:**
- Wilfred's persona + task instruction: ~800 tokens
- Abbey index (file list): ~600 tokens
- Tool call history: remaining budget

---

## Wilfred's Persona

Wilfred's system prompt is the foundation of every task run. It should be brief and consistent.

```
You are Wilfred, a diligent monk in the Scriptorium. Your purpose is to
organise and tend to the Abbey's manuscripts with care and patience.

Your character:
- Methodical. You work through tasks step by step.
- Humble. When you do not know where something belongs, you ask.
- Brief. Your epistles are clear and concise — a monk does not ramble.
- Faithful. You do exactly what the Rule asks, no more, no less.

The Abbey root path is: {abbey_path}
Today is: {date}
```

The persona lives in a user-editable file at `.scriptorium/wilfred.md`, so users can modify his voice without changing code.

---

## Data Model (SQLite)

```sql
-- File index for fast context-building
CREATE TABLE files (
  path        TEXT PRIMARY KEY,
  title       TEXT,
  folder      TEXT,
  created_at  INTEGER,
  modified_at INTEGER,
  word_count  INTEGER,
  tags        TEXT              -- JSON array
);

-- Wilfred's comments (never written into .md files)
CREATE TABLE comments (
  id          INTEGER PRIMARY KEY,
  file_path   TEXT REFERENCES files(path),
  line        INTEGER,          -- anchor line in the file
  content     TEXT,
  type        TEXT,             -- 'question' | 'suggestion' | 'note'
  status      TEXT DEFAULT 'open',  -- 'open' | 'dismissed'
  created_at  INTEGER,
  dismissed_at INTEGER
);

-- Task execution log
CREATE TABLE task_runs (
  id          INTEGER PRIMARY KEY,
  task_name   TEXT,
  started_at  INTEGER,
  ended_at    INTEGER,
  status      TEXT,             -- 'running' | 'done' | 'error' | 'budget_exceeded'
  summary     TEXT,
  files_read  TEXT,             -- JSON array
  files_written TEXT,           -- JSON array
  tool_calls  INTEGER
);
```

> Staged edits deferred — Wilfred writes directly. Revisit if write quality warrants a review layer.

---

## Electron Process Architecture

```
Main Process (Node.js)
├── Abbey manager (file watching, path resolution)
├── mlx_lm child process (managed mode)
├── SQLite (better-sqlite3, synchronous)
├── LLM client (OpenAI-compatible HTTP, adapted from locco)
├── Agent scheduler (node-cron)
├── IPC handlers
└── System tray (Wilfred status indicator)

Renderer Process (React)
├── Inkwell — capture editor (CodeMirror 6)
├── Codex — file tree + markdown editor (CodeMirror 6) + comment panel
├── Epistles — unread inbox with badge
├── Canonical Hours — scheduler management
├── Chapter — task backlog + live log
└── Rule — settings (LLM config, abbey path, tool keys)
```

IPC channels:
- `abbey:open`, `abbey:files`, `abbey:read`, `abbey:write`, `abbey:move`
- `agent:run-task`, `agent:task-log` (stream)
- `comments:get`, `comments:dismiss`
- `scheduler:list`, `scheduler:update`, `scheduler:trigger`
- `llm:status` (mlx_lm health)

---

## Implementation Phases

### Phase 1 — Foundation
- [ ] Electron + TypeScript + React scaffold
- [ ] Abbey open/create dialog on first launch
- [ ] File tree (Codex sidebar)
- [ ] Markdown viewer (CodeMirror 6, read-only first)
- [ ] SQLite init with schema

### Phase 2 — Agent Core
- [ ] LLM client (OpenAI-compatible HTTP, from locco's `llm.ts`)
- [ ] `mlx_lm` child process manager (start, health poll, kill on quit)
- [ ] Rule page: LLM URL, model, API key, mode toggle
- [ ] Tool definitions: `read_file`, `write_file`, `move_file`, `list_files`, `add_comment`, `write_epistle`, `finish_task`
- [ ] Agent loop with token budget + iteration cap (from locco's `thought/loop.ts`)

### Phase 3 — Canonical Hours + Epistles
- [ ] `node-cron` scheduler
- [ ] Default Terce and Vespers tasks
- [ ] Task run logging to SQLite
- [ ] Epistles viewer with unread badge
- [ ] Wilfred's comments as CodeMirror 6 line decorations

### Phase 4 — Inkwell + Chapter
- [ ] Inkwell capture editor → saves to `_folios/`
- [ ] CodeMirror 6 editable mode in Codex
- [ ] Chapter timeline UI (upcoming, active, archive)
- [ ] Manual task trigger ("ring the bell")
- [ ] Live tool-call log stream from main → renderer

### Phase 5 — Polish
- [ ] Canonical Hours management UI (add/edit/delete)
- [ ] Reliquary UI (enable/disable tools, set API keys)
- [ ] Wilfred persona editor (edit `.scriptorium/wilfred.md`)
- [ ] Voice capture via Whisper (MLX)
- [ ] Brave Search tool
- [ ] Obsidian exclusion for `.scriptorium/`

---

---

## UI / UX — Visual Layout & Hierarchy

### Design Philosophy

The interface is calm, focused, and slightly monastic. Think warm off-white parchment tones, a serif-adjacent typeface for headings, and generous whitespace — a tool made for thinking, not for clicking. Wilfred is a background presence, not a chatbot widget; he surfaces when you need him, recedes when you don't.

---

### Primary Layout — Two-Panel Shell

```
┌─────────────────────────────────────────────────────────────┐
│  [App chrome / traffic lights]                              │
├──────────────┬──────────────────────────────────────────────┤
│              │                                              │
│   SIDEBAR    │              VIEWER / EDITOR                 │
│   (Codex)    │                                              │
│              │                                              │
│  ┌─────────┐ │                                              │
│  │ Inkwell │ │                                              │
│  │ (Capture│ │                                              │
│  │ Button) │ │                                              │
│  └─────────┘ │                                              │
│              │                                              │
│  Nav items:  │                                              │
│  · Codex     │                                              │
│  · Epistles  │                                              │
│  · Chapter   │                                              │
│  · Hours     │                                              │
│  · Rule      │                                              │
│              │                                              │
│              │                              ┌─────────────┐ │
│              │                              │  Wilfred    │ │
│              │                              │  FAB + chat │ │
│              │                              └─────────────┘ │
└──────────────┴──────────────────────────────────────────────┘
```

- **Sidebar** — fixed width (~240 px), collapsible. Houses the abbey file tree (Codex) and primary navigation. The Inkwell capture button is pinned at the top of the sidebar, always visible.
- **Viewer** — the remainder of the window. Renders whatever the active nav item requires: markdown editor, epistles inbox, chapter timeline, scheduler list, or the Rule page.
- **Wilfred FAB** — floating above the bottom-right corner of the viewer area. Always visible but unobtrusive.

---

### Visual Hierarchy — Priority Order

| Priority | Element | Rationale |
|---|---|---|
| 1 | **Capture button (Inkwell)** | Core user action — must be instant and frictionless |
| 2 | **Active document / content** | The viewer fills the majority of the screen |
| 3 | **Wilfred FAB** | Ambient presence, escalates only when needed |
| 4 | **Epistles unread badge** | Wilfred's output — draws attention when he has something to say |
| 5 | **Navigation items** | Mode switching, secondary |
| 6 | **Settings (Rule)** | Rare, tucked at the bottom of nav |

---

### Inkwell — Capture (Primary Action)

The Capture button is the most prominent element in the sidebar — large, labelled, and always in the same spot. Clicking it opens a **Capture Sheet** that slides up from the bottom or appears as a modal overlay, keeping the user in context.

**Capture Sheet layout:**
```
┌────────────────────────────────┐
│  New Folio          [✕ close]  │
│                                │
│  ┌──────────────────────────┐  │
│  │  Write here…             │  │
│  │                          │  │
│  │  (CodeMirror 6 editor)   │  │
│  └──────────────────────────┘  │
│                                │
│  [🎙 Voice]       [Save Folio] │
└────────────────────────────────┘
```

- **Quill (text)**: default mode — full-height CodeMirror editor.
- **Voice**: secondary button. Activating it shows a pulsing mic indicator and a live transcript preview. On stop, the transcript drops into the editor for the user to review before saving.
- **Save Folio**: primary button — saves to `_folios/`. Keyboard shortcut: `Cmd+Enter`.
- The capture sheet does **not** navigate away — it overlays the current view so there is no context switch.

---

### Wilfred — Floating Presence

A **Floating Action Button** anchored to the bottom-right of the viewer. It consists of:

1. **Wilfred's avatar** — a small illustrated monk icon (circular, ~48 px). Softly animated: gentle idle breath or quill-pen bob at rest; a subtle glow when Wilfred is actively running a task.
2. **Greeting bubble** — on first launch and after long idle periods, a small speech bubble appears above the avatar: *"Good morning. Your folios are resting quietly."* or similar time-aware greeting from Wilfred. Auto-dismisses after 6 seconds.
3. **Status indicator** — a small dot on the avatar: green (idle), amber (running), red (error). Mirrors the system-tray indicator.

**Clicking the avatar** opens the **Wilfred Chat Panel** — a drawer that slides in from the right (or expands inline), replacing the Wilfred comment panel temporarily:

```
┌──────────────────────────┐
│ Wilfred             [✕]  │
│ ──────────────────────── │
│                          │
│  [message history]       │
│                          │
│  ──────────────────────  │
│  Ask Wilfred…   [Send →] │
└──────────────────────────┘
```

- Chat with Wilfred is a direct one-off agent run: the user's message becomes the task prompt, Wilfred responds via the standard agent loop, and his reply appears inline.
- Wilfred can use tools during a chat turn (e.g. look up a note to answer a question).
- Chat history is stored in SQLite per session; it is *not* shown in the Chapter timeline (that is for scheduled work).

---

### Navigation — Sidebar Items

```
[Inkwell — Capture]      ← primary button, not a nav link

─────────────────────

  Codex                  ← file tree + editor
  Epistles        (3)    ← unread badge
  Chapter                ← task timeline
  Canonical Hours        ← scheduler

─────────────────────

  Rule ⚙                 ← settings, bottom of list
```

Icons are simple line icons. Active item gets a subtle left-border highlight in the accent colour (warm amber/ochre to match the monastic theme). No icon labels on collapse — icons are self-descriptive.

---

### Rule (Settings) — Page Structure

The Rule page is a single-column settings view, sectioned by concern. Sections map to a vertical tab list on the left with the setting form on the right.

```
Rule
├── Abbey
│   └── Vault path, open/change abbey folder
│
├── Inference
│   ├── Mode: Managed / External
│   ├── Base URL (when External)
│   ├── Model name
│   └── API key (optional)
│
└── Wilfred
    ├── Persona — edit wilfred.md in-app
    ├── Behaviour — token budget, iteration cap
    ├── Appearance — avatar style (future)
    └── Reliquary (Tool Management)
        ├── Toggle each tool on/off globally
        ├── Per-hour overrides (link to Canonical Hours)
        └── API keys for optional tools (Brave Search, etc.)
```

**Tool Management lives under Wilfred → Reliquary.** It is not a top-level nav item — it is a natural extension of configuring Wilfred's capabilities.

---

### Codex — Document Browser (Detailed)

When Codex is the active view, the viewer splits into two sub-columns:

```
┌──────────────┬──────────────────────────┬─────────────────┐
│  Sidebar     │  Markdown editor         │  Wilfred        │
│  (file tree) │  (CodeMirror 6)          │  Comments panel │
│              │                          │  (collapsible)  │
└──────────────┴──────────────────────────┴─────────────────┘
```

The comment panel slides in only when the active file has open Wilfred comments. When empty, it collapses — the editor takes the full viewer width.

---

### First-Launch Experience — Setup Wizard

The app opens to a full-screen wizard (no sidebar, no chrome). Three steps; Wilfred is present throughout via his avatar and speech bubble in the lower-right corner.

---

#### Step 1 — Greeting

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                                                             │
│              ✦  Scriptorium  ✦                              │
│                                                             │
│         Welcome to the Scriptorium.                         │
│         I am Wilfred, your faithful monk.                   │
│         I will help you tend your manuscripts               │
│         and keep your thoughts in order.                    │
│                                                             │
│         Shall we prepare the Abbey?                         │
│                                                             │
│                          [ Begin → ]                        │
│                                                             │
│                                          ┌──────────────┐   │
│                                          │  Wilfred 🖋  │   │
│                                          │  (avatar)    │   │
│                                          └──────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

- Full-bleed background in `--bg-base` (warm parchment).
- App wordmark centred, large.
- Short welcoming paragraph — Wilfred's voice, not marketing copy.
- Single primary button: **Begin →**
- Wilfred avatar animates gently in the bottom-right; no speech bubble here (the body text *is* his greeting).

---

#### Step 2 — Select Vault Folder

```
┌─────────────────────────────────────────────────────────────┐
│  Step 2 of 3                              ● ○ ○             │
│                                                             │
│              Choose your Abbey                              │
│                                                             │
│   This is the folder where all your manuscripts will        │
│   be kept. You can use an existing folder or create         │
│   a new one.                                                │
│                                                             │
│   ┌───────────────────────────────────────┐  [ Browse… ]   │
│   │  /Users/you/Documents/my-abbey        │                 │
│   └───────────────────────────────────────┘                 │
│                                                             │
│   ✓ Wilfred will create _folios/ and _epistles/ inside      │
│     this folder if they do not already exist.               │
│                                                             │
│   [ ← Back ]                        [ Continue → ]         │
│                                                             │
│                                          ┌──────────────┐   │
│                                          │  "A fine     │   │
│                                          │   choice."   │   │
│                                          └──────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

- Step indicator (dots or `2 of 3`) top-right.
- Read-only path input + **Browse…** button opens a native folder-picker dialog.
- Helper text explains what Wilfred will create.
- Wilfred's bubble updates once a folder is selected: *"A fine choice."*
- **Continue →** is disabled until a folder is selected. **← Back** returns to Step 1.

---

#### Step 3 — LLM Setup

```
┌─────────────────────────────────────────────────────────────┐
│  Step 3 of 3                              ○ ○ ●             │
│                                                             │
│              Connect an Inference Server                    │
│                                                             │
│   Wilfred thinks through a local language model.            │
│   Point him at your inference server.                       │
│                                                             │
│   Base URL                                                  │
│   ┌─────────────────────────────────────────────────────┐   │
│   │  http://localhost:8000/v1                           │   │
│   └─────────────────────────────────────────────────────┘   │
│                                                             │
│   Model Name                                                │
│   ┌─────────────────────────────────────────────────────┐   │
│   │  gemma-4-e4b-it-4bit                                │   │
│   └─────────────────────────────────────────────────────┘   │
│                                                             │
│   API Key  (optional)                                       │
│   ┌─────────────────────────────────────────────────────┐   │
│   │                                                     │   │
│   └─────────────────────────────────────────────────────┘   │
│                                                             │
│   [ Test Connection ]   ← idle / testing… / ✓ OK / ✗ fail  │
│                                                             │
│   [ ← Back ]                     [ Finish  ]  ← disabled   │
│                                          until test passes  │
│                                          ┌──────────────┐   │
│                                          │  "I am       │   │
│                                          │   ready."    │   │
│                                          └──────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

**Field defaults:**

| Field | Default |
|---|---|
| Base URL | `http://localhost:8000/v1` |
| Model Name | `gemma-4-e4b-it-4bit` |
| API Key | *(empty)* |

**Test Connection button states:**

| State | Label | Style |
|---|---|---|
| Idle (no test run yet) | `Test Connection` | Secondary button |
| Testing | `Testing…` | Disabled, spinner |
| Pass | `✓ Connected` | Green tint |
| Fail | `✗ Could not connect` | Red tint, error detail below |

**Finish button:**
- Disabled until a successful test has been recorded for the current URL + model combination.
- If the user edits the URL or model name after a passing test, the test result is cleared and Finish disables again.
- On click: writes `config.json`, initialises SQLite, creates abbey subfolders, then transitions to the main app shell. No splash — the sidebar and viewer animate in directly.

**Wilfred's bubble progression during Step 3:**
- On load: *"Tell me where to find the words."*
- Test passing: *"I am ready."*
- Test failing: *"Something is amiss. Check the server is running."*

---

### Colour & Typography Direction

| Token | Value | Use |
|---|---|---|
| `--bg-base` | `#F5F0E8` | Main background — warm parchment |
| `--bg-sidebar` | `#EDE8DC` | Sidebar, slightly darker |
| `--accent` | `#8B6914` | Amber-ochre — buttons, active states, badges |
| `--text-primary` | `#1C1917` | Stone-dark for body copy |
| `--text-muted` | `#78716C` | Secondary labels, metadata |
| `--wilfred-glow` | `#F59E0B` (pulsing) | Wilfred FAB active state |

Typography: `Inter` or `DM Sans` for UI; `Lora` or `Merriweather` for the editor — a humanist serif that feels handwritten without being precious.

---

## Reference

- locco agent loop: `src/thought/loop.ts`
- locco tool definitions: `src/tools/definitions.ts`
- locco LLM client: `src/llm.ts`
- locco token budget: `src/tokens.ts`
