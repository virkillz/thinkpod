# Scriptorium — Implementation Status

## Phase 1: Foundation ✅ COMPLETE

### What's Working

#### Core Infrastructure
- ✅ Electron + TypeScript + React scaffold
- ✅ Vite build system for renderer
- ✅ TypeScript compilation for main process
- ✅ SQLite database with `better-sqlite3`
- ✅ IPC communication layer (secure preload script)

#### Abbey Setup (First Launch)
- ✅ 3-step setup wizard with medieval theming
  - Step 1: Welcome screen with Wilfred greeting
  - Step 2: Abbey folder selection (create or open)
  - Step 3: LLM connection configuration with test button
- ✅ Abbey structure creation:
  - `_folios/` folder for drafts
  - `_epistles/` folder for agent output
  - `.scriptorium/` config folder
  - Default folders: Projects, People, Ideas, Journal
  - Default `wilfred.md` persona file
- ✅ SQLite database initialization with:
  - Settings table
  - Files index table
  - Comments table (Wilfred's annotations)
  - Task runs log
  - Canonical hours table with defaults (Terce, Vespers)

#### Main App Shell
- ✅ Two-panel layout (sidebar + viewer)
- ✅ Collapsible sidebar with medieval-themed navigation
- ✅ Navigation items: Codex, Epistles, Chapter, Hours, Rule
- ✅ Unread badge on Epistles
- ✅ Inkwell capture button (prominent, always visible)
- ✅ Wilfred FAB (Floating Action Button) with:
  - Animated avatar
  - Status indicator
  - Greeting bubble
  - Chat panel

#### Codex (Document Browser)
- ✅ File tree sidebar with:
  - Directory expansion/collapse
  - Sorting (folders first, then alphabetically)
  - Visual selection state
- ✅ CodeMirror 6 markdown editor with:
  - Parchment-themed styling
  - Line numbers
  - Vim-like editing experience
  - Auto-save on Cmd+S
  - Read-only mode for epistles
- ✅ Comment panel (right sidebar):
  - Shows Wilfred's comments per file
  - Dismiss functionality
  - Type icons (question, suggestion, note)
- ✅ Empty state with helpful messaging

#### Capture (Inkwell)
- ✅ Modal capture sheet with:
  - Full-height textarea
  - Auto-generated filename with timestamp
  - Saves to `_folios/`
  - Cmd+Enter shortcut
  - Voice capture placeholder (Phase 5)

#### Placeholder Views
- ✅ Epistles view (empty state)
- ✅ Chapter view (task timeline structure)
- ✅ Hours view (canonical hours list)
- ✅ Rule view (settings structure):
  - Abbey path display
  - LLM configuration
  - Wilfred persona info
  - Tool management placeholder

### Technical Architecture

```
scriptorium/
├── src/
│   ├── main/               # Electron main process
│   │   ├── index.ts        # App lifecycle, window creation
│   │   ├── preload.ts      # Secure IPC bridge
│   │   ├── database/       # SQLite layer
│   │   ├── abbey/          # File system management
│   │   └── ipc/            # IPC handlers & channels
│   └── renderer/           # React frontend
│       ├── index.html      # Entry HTML
│       └── src/
│           ├── main.tsx    # React entry
│           ├── App.tsx     # Root component
│           ├── store/      # Zustand state management
│           ├── components/
│           │   ├── setup/  # Setup wizard steps
│           │   ├── shell/  # Main app chrome
│           │   ├── codex/  # File browser & editor
│           │   └── views/  # Epistles, Chapter, etc.
│           └── types/      # TypeScript definitions
├── dist/                   # Build output
│   ├── main/               # Compiled Electron main
│   └── renderer/           # Vite-built React app
└── build/                  # Build resources
```

## Phase 2: Agent Core ✅ COMPLETE

#### Agent Core
- ✅ LLM client (OpenAI-compatible HTTP) — `LLMClient.ts`
- ✅ `mlx_lm` child process manager — `LLMProcessManager.ts`
- ✅ Tool definitions: read_file, write_file, move_file, list_files, add_comment, write_epistle, finish_task
- ✅ Agent loop with token budget + iteration cap — `AgentLoop.ts`

## Phase 3: Scheduler + Live Views ✅ COMPLETE

- ✅ `node-cron` scheduler — `Scheduler.ts`, starts with app when abbey is ready
- ✅ Canonical hours CRUD (list, toggle active) in `DatabaseManager`
- ✅ IPC channels: `hours:list`, `hours:toggle`, `hours:trigger`
- ✅ Push events main → renderer: `push:task-update`, `push:task-end`
- ✅ HoursView wired to real DB (toggle active, live schedule)
- ✅ ChapterView wired to real task history + live running task display

## Phase 4: Manual Trigger ✅ COMPLETE

- ✅ "Ring the Bell" — per-hour manual trigger buttons in ChapterView
- ✅ Live task progress (iterations, tool calls) via push events
- ✅ Task archive with status icons, duration, and summary

## Phase 5: Polish + Features 🔄 IN PROGRESS

- ✅ Hide `_epistles`, `_folios`, `.scriptorium` in Codex file tree by default; toggle in Rule page (fixed reactivity bug in FileTree)
- ✅ Wire Wilfred chat panel to the real agent loop (`agentChat` IPC)
- ✅ Reset Abbey in Rule page — deletes system folders and returns to setup wizard
- [ ] Wilfred's comments as CodeMirror line decorations
- [ ] Voice capture via Whisper
- [ ] Brave Search tool integration

### Running the App

```bash
# Install dependencies
npm install

# Development mode
npm run dev

# Production build
npm run build

# Create distributable
npm run dist
```

### Design Notes

- **Color palette**: Warm parchment tones (`#F5F0E8`, `#EDE8DC`) with amber-ochre accent (`#8B6914`)
- **Typography**: Inter (UI) + Lora (editor)
- **Animations**: Gentle breathing animation on Wilfred's avatar, smooth transitions throughout
- **Layout**: Calm, focused, generous whitespace — designed for thinking, not clicking
