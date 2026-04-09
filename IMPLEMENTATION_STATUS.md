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

### What's Next (Phase 2)

#### Agent Core
- [ ] LLM client (OpenAI-compatible HTTP)
- [ ] `mlx_lm` child process manager
- [ ] Tool definitions: read_file, write_file, move_file, list_files, add_comment, write_epistle, finish_task
- [ ] Agent loop with token budget + iteration cap

#### Phase 3
- [ ] `node-cron` scheduler
- [ ] Epistles viewer with unread badge (live)
- [ ] Wilfred's comments as CodeMirror line decorations

#### Phase 4
- [ ] Chapter timeline with live task log
- [ ] Manual task trigger ("ring the bell")

#### Phase 5
- [ ] Voice capture via Whisper
- [ ] Brave Search tool integration
- [ ] Obsidian exclusion for `.scriptorium/`

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
