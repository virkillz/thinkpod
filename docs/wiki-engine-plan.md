# Wiki Engine — Implementation Plan

## Background

ThinkPod is a local-first, AI-native knowledge management desktop app (Electron + React). The embedded AI assistant is called **Wilfred**. All notes are stored as markdown on the user's machine.

This plan describes the **Wiki Engine** — a feature that allows Wilfred to incrementally build and maintain a persistent, structured knowledge base (the `_agent_vault`) from selected folders in the user's vault. The idea originates from Andrej Karpathy's "LLM wiki" concept: instead of re-deriving answers from raw documents on every query, the LLM compiles knowledge once into a structured wiki and keeps it current as sources change.

### Problem being solved

The user's vault contains many files of varying quality (junk, works-in-progress, finished notes). A "whole vault ingest" is not viable. The wiki engine solves this by:

1. Letting the user select which **first-level folders** to include
2. Processing only those sources through an LLM ingest pipeline
3. Writing synthesized output into `_agent_vault/` — a dedicated directory Wilfred owns entirely

The user reads the wiki; Wilfred writes it.

### Key design decisions (from planning session)

- **Folder-based selection only** (not tag-based) for v1. First-level folders under the vault root, shown as checkboxes in Settings.
- **`_agent_vault/` is Wilfred's write space.** The user's source files are never modified.
- **Document linking happens inside `_agent_vault/` only.** The user's notes are not annotated with wikilinks. This sidesteps the "linking discipline" problem entirely.
- **Type-based folder structure** inside `_agent_vault/` (not topic-based). Predictable and writable by the LLM without naming ambiguity.
- **All new backend code lives in `src/main/wiki_engine/`** — isolated for easy rollback or deletion.
- **Hash-based deduplication** in SQLite. Files already ingested at the same content hash are skipped on restart.
- **Sequential ingestion** (one file at a time). Safer, easier to debug, log reflects real progress.
- **`SCHEMA.md` drives LLM behavior.** Hardcoded default template, overridable by the user in `_agent_vault/SCHEMA.md`.

---

## `_agent_vault/` Structure

```
{vault}/_agent_vault/
├── SCHEMA.md          ← conventions and instructions for Wilfred (user-editable)
├── index.md           ← catalog of all wiki pages (Wilfred rebuilds on every ingest)
├── log.md             ← append-only chronological record
├── sources/           ← one summary page per ingested source file
├── concepts/          ← ideas and topics that appear across multiple sources
├── entities/          ← people, organisations, places
└── synthesis/         ← cross-source analysis, filed answers to good questions
```

### `SCHEMA.md` — default template

This file is written once by the system if it does not exist. The user can edit it. The ingest prompt always reads it before processing a source.

```markdown
# Wiki Schema

## Folder conventions
- `sources/` — one page per ingested document. Named after the source filename (kebab-case, .md).
- `concepts/` — ideas or topics that appear in two or more sources. Create a page when a concept recurs.
- `entities/` — named people, organisations, or places. Create a page when an entity appears with meaningful context.
- `synthesis/` — cross-source analysis or filed answers. Created on demand, not during standard ingest.

## Page frontmatter (required on all pages)
```yaml
---
type: source | concept | entity | synthesis
sources: []          # list of source filenames this page draws from
updated: YYYY-MM-DD
---
```

## index.md format
The index is grouped by folder. Each entry is one line: `- [[path/to/page]] — one-line description`.
Do not add prose. The index is a navigation tool, not a summary.

## log.md format
Each entry starts with: `## [YYYY-MM-DD] action | title`
Actions: `ingest`, `update`, `lint`, `query-filed`
Append only. Never edit existing entries.

## What to create during a standard ingest
1. A `sources/` page for the ingested file (always)
2. Update or create `concepts/` pages for recurring ideas
3. Update or create `entities/` pages for named people/orgs/places with meaningful context
4. Update `index.md`
5. Append to `log.md`

## What NOT to do
- Do not modify files in the user's vault (outside `_agent_vault/`)
- Do not create `synthesis/` pages during standard ingest — only on explicit request
- Do not nest folders deeper than one level inside `_agent_vault/`
- Do not create a concept page for something mentioned only once
```

---

## Code Structure — Containment Strategy

All new backend files live under `src/main/wiki_engine/`. This is intentional: the entire feature can be deleted or disabled by removing this folder plus a small number of integration points.

```
src/main/wiki_engine/
├── WikiManager.ts       ← orchestrator: lifecycle, file discovery, job queue
├── WikiIngestJob.ts     ← single-file LLM ingest: prompt, parse response, apply writes
├── WikiFileStore.ts     ← read/write helpers scoped to _agent_vault/
├── WikiSchema.ts        ← default SCHEMA.md content as a string constant
└── types.ts             ← shared types for this module
```

Integration points outside `wiki_engine/` (minimal):

| File | Change |
|---|---|
| `src/main/ipc/channels.ts` | Add `WIKI_*` channel constants |
| `src/main/ipc/handlers.ts` | Register wiki IPC handlers |
| `src/main/preload.ts` | Expose wiki channels to renderer |
| `src/main/DatabaseManager.ts` | Add `wiki_sources` table migration |
| `src/main/index.ts` | Instantiate `WikiManager` on app start |
| Settings UI | Add Wiki section in settings panel |

---

## State Machine

```
STOPPED
  │  wiki:start
  ▼
INGESTING  ←──────────────────────────────────┐
  │  (processes file queue sequentially)       │
  │  emits: wiki:status, wiki:log-entry        │
  │  queue exhausted                           │
  ▼                                            │
WATCHING                                       │
  │  (chokidar watches selected folders)       │
  │  new/changed file detected ────────────────┘
  │  wiki:stop
  ▼
STOPPED
```

State is held in memory by `WikiManager`. It is not persisted — on app restart the engine is always STOPPED and must be started explicitly (or auto-started if `wikiConfig.enabled === true`).

---

## Settings Key

New key in the existing `settings` SQLite table:

```ts
// key: 'wikiConfig'
type WikiConfig = {
  enabled: boolean          // auto-start on app launch
  folders: string[]         // selected first-level folder names (not full paths)
  status: 'stopped' | 'ingesting' | 'watching'  // last known status (for UI restore)
}
```

Default: `{ enabled: false, folders: [], status: 'stopped' }`

---

## SQLite Table

New table in `DatabaseManager`. Add to the existing migration sequence.

```sql
CREATE TABLE IF NOT EXISTS wiki_sources (
  file_path    TEXT PRIMARY KEY,   -- absolute path to source file
  content_hash TEXT NOT NULL,      -- SHA-256 of file content at ingest time
  processed_at INTEGER NOT NULL,   -- Unix timestamp
  pages_written TEXT NOT NULL      -- JSON array of _agent_vault page paths written/updated
);
```

Used to skip unchanged files on restart. On `wiki:stop` + restart, the engine resumes from where it left off (only unprocessed or changed files are queued).

---

## IPC Channels

Add to `IPC_CHANNELS` in `src/main/ipc/channels.ts`:

```ts
// Wiki Engine
WIKI_GET_CONFIG: 'wiki:get-config',
WIKI_SET_CONFIG: 'wiki:set-config',
WIKI_GET_FOLDERS: 'wiki:get-folders',   // returns first-level vault folders
WIKI_START: 'wiki:start',
WIKI_STOP: 'wiki:stop',
WIKI_GET_STATUS: 'wiki:get-status',

// Push (main → renderer)
PUSH_WIKI_STATUS: 'push:wiki-status',     // { status, current, total }
PUSH_WIKI_LOG: 'push:wiki-log',           // { timestamp, message }
```

`PUSH_WIKI_STATUS` payload:
```ts
type WikiStatusPush = {
  status: 'stopped' | 'ingesting' | 'watching'
  current?: number    // file index being processed
  total?: number      // total files in queue
  currentFile?: string
}
```

`PUSH_WIKI_LOG` payload:
```ts
type WikiLogPush = {
  timestamp: number
  level: 'info' | 'warn' | 'error'
  message: string
}
```

---

## WikiManager

```ts
// src/main/wiki_engine/WikiManager.ts

class WikiManager {
  private status: WikiStatus = 'stopped'
  private queue: string[] = []          // file paths pending ingest
  private watcher: FSWatcher | null = null

  constructor(
    private db: DatabaseManager,
    private llmClient: LLMClient,
    private mainWindow: BrowserWindow
  ) {}

  async start(config: WikiConfig): Promise<void>
  async stop(): Promise<void>
  async getStatus(): Promise<WikiStatusPush>

  private async buildQueue(vaultPath: string, folders: string[]): Promise<string[]>
  private async processQueue(): Promise<void>
  private async processFile(filePath: string): Promise<void>
  private startWatching(vaultPath: string, folders: string[]): void
  private emit(channel: string, payload: unknown): void  // sends IPC push to renderer
  private log(level: string, message: string): void       // emits + appends to log.md
}
```

`buildQueue` discovers all `.md` files under selected folders, then filters out files whose `content_hash` matches the `wiki_sources` table. Result is the list of files Wilfred hasn't seen yet (or that changed).

`processFile` calls `WikiIngestJob`, receives write operations, calls `WikiFileStore` to apply them, then upserts the row in `wiki_sources`.

---

## WikiIngestJob

This is a **single focused LLM call**, not a full AgentLoop tool-use loop. The input is deterministic; the output is a structured list of page writes.

```ts
// src/main/wiki_engine/WikiIngestJob.ts

type WikiPageWrite = {
  path: string       // relative to _agent_vault/, e.g. "sources/my-note.md"
  content: string    // full markdown content to write
}

type IngestResult = {
  writes: WikiPageWrite[]
  logEntry: string   // single line to append to log.md
}

class WikiIngestJob {
  constructor(private llmClient: LLMClient, private fileStore: WikiFileStore) {}

  async run(sourceFilePath: string, sourceContent: string): Promise<IngestResult>
}
```

### Prompt structure

```
System:
  You are Wilfred, the wiki maintenance agent for ThinkPod.
  You are ingesting a source document into the _agent_vault wiki.
  Follow the instructions in SCHEMA.md exactly.
  Respond ONLY with a JSON object matching the IngestResult schema.
  Do not include explanations outside the JSON.

  <schema>
  {SCHEMA.md content}
  </schema>

  <current_index>
  {index.md content — so Wilfred knows what pages already exist}
  </current_index>

User:
  Ingest this source document.
  Filename: {sourceFileName}

  <source>
  {sourceContent}
  </source>
```

The response is parsed as JSON. If parsing fails, the job logs a warning and skips the file (does not crash the queue).

After receiving `writes`, `WikiIngestJob` also triggers an `index.md` rebuild via `WikiFileStore.rebuildIndex()`.

---

## WikiFileStore

Scoped read/write helpers. All paths are relative to `{vault}/_agent_vault/`.

```ts
// src/main/wiki_engine/WikiFileStore.ts

class WikiFileStore {
  constructor(private agentVaultPath: string) {}

  async ensureStructure(): Promise<void>    // creates folders + SCHEMA.md if missing
  async readSchema(): Promise<string>
  async readIndex(): Promise<string>
  async readPage(relativePath: string): Promise<string | null>
  async writePage(relativePath: string, content: string): Promise<void>
  async appendLog(entry: string): Promise<void>
  async rebuildIndex(): Promise<void>       // scans all pages, rewrites index.md from frontmatter
  async listAllPages(): Promise<string[]>   // returns all relative page paths
}
```

`rebuildIndex` scans every `.md` file under `_agent_vault/` (except `index.md`, `log.md`, `SCHEMA.md`), reads their frontmatter, and regenerates `index.md` in the catalog format defined in SCHEMA.md. This is called after every ingest.

---

## Settings UI

New section in the existing Settings panel. Suggested placement: after LLM config, before advanced options.

**Wiki Engine section:**
- Header: "Wiki Engine" with status badge (Stopped / Ingesting N of M / Watching)
- Folder list: checkboxes for each first-level vault folder (loaded via `wiki:get-folders`)
- Start / Stop button (disabled when no folders selected)
- Log panel: scrollable list of `PUSH_WIKI_LOG` entries, newest at bottom, max 200 lines in memory
- Auto-start toggle: "Start automatically when vault opens"

The log panel is a live stream — it does not read `log.md` from disk. It collects `PUSH_WIKI_LOG` events for the current session only. For historical log, the user can open `_agent_vault/log.md` in the editor.

---

## Implementation Order

Build in this sequence so each step is independently testable:

1. **`WikiSchema.ts`** — the default SCHEMA.md as a string constant. No dependencies.

2. **`WikiFileStore.ts`** — file I/O only. Can be tested by running `ensureStructure()` against a temp vault.

3. **`wiki_sources` table** — add migration to `DatabaseManager`. One SQL statement.

4. **`WikiIngestJob.ts`** — the LLM call. Test by pointing at a real LLM with a sample markdown file and inspecting the JSON output before any file writes happen.

5. **`WikiManager.ts`** — wires everything: queue, jobs, watcher, SQLite, IPC push events. Testable via `wiki:start` IPC call from devtools console.

6. **IPC channels** — add to `channels.ts`, register handlers in `handlers.ts`, expose in `preload.ts`.

7. **Settings UI** — wire up to IPC. The backend should be fully functional before touching the UI.

---

## Out of Scope for v1

- Tag-based source selection (only folder-based in v1)
- User writing to `_agent_vault/` (it's Wilfred's space)
- Lint operation (contradictions, orphan pages) — planned for v2
- Synthesis page generation (on-demand, not during ingest) — v2
- Query answering grounded in wiki (Wilfred reading index.md before answering) — v2
- Embedding-based search over wiki pages — v2
- Multi-vault support

---

## File Deletion / Rollback Checklist

To fully remove the Wiki Engine feature:

1. Delete `src/main/wiki_engine/`
2. Remove `WIKI_*` and `PUSH_WIKI_*` entries from `src/main/ipc/channels.ts`
3. Remove wiki handler registrations from `src/main/ipc/handlers.ts`
4. Remove wiki channel exposures from `src/main/preload.ts`
5. Remove `wiki_sources` table migration from `DatabaseManager.ts`
6. Remove `WikiManager` instantiation from `src/main/index.ts`
7. Remove Wiki section from Settings UI component
8. Optionally delete `{vault}/_agent_vault/` from the user's vault
