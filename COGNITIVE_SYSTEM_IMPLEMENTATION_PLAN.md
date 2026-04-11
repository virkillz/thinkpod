# Implementation Plan: Agent Cognitive System

*Revised: April 11, 2026 — Strategy pivot*

---

## Why the Original Approach Was Wrong

The original system collected personal facts: health symptoms, relationship details, daily habits, emotional states. This is surveillance-style data that creates discomfort, not connection. If a stranger mentioned your daughter's name, you'd be suspicious, not warm.

**What actually creates connection between two people:**

1. **Shared interests** — knowing what someone cares about right now is the most powerful connector. If you both care about LLM fine-tuning or Iran geopolitics, you have genuine common ground.

2. **Communication style** — tone match matters more than fact recall. Casual vs. formal, terse vs. verbose, playful vs. serious. A mismatch here creates friction even when interests align.

That's it. Everything else is noise — or worse, intrusive.

---

## New Architecture

### Two things the agent learns

**1. Interest Graph** (`_agent_vault/interest_graph.json`)

For every vault file processed: one LLM call → 5–10 semantic topic tags. Tags are accumulated into a recency-weighted graph. Topics the user engaged with recently score high; old topics decay.

```json
{
  "llm fine-tuning": { "count": 8, "last_mentioned": 1744387200000, "files": ["notes/2026-04-01.md"] },
  "iran geopolitics": { "count": 3, "last_mentioned": 1744473600000, "files": ["notes/2026-04-08.md"] }
}
```

Score = `count × exp(−daysSince / 30)` — recent mentions count heavily; anything not mentioned in ~90 days fades out.

**Used by:**
- `inspiration_search` — picks top interests to browse the web for
- `context injection` — injects "what you care about right now" into every session
- `synthesize_week` — clusters notes by shared interest tags

**2. Communication Style** (`_agent_vault/communication_style.md`)

A short markdown snippet — the agent's current best description of how to talk to this person. Written by `session_style_review` job after analyzing conversation logs.

```markdown
## How to communicate

- Tone: casual and direct, no formal titles
- Length: concise — gets to the point, doesn't like long preambles  
- Explicit preferences:
  - "don't call me sir"
  - prefers examples over abstract explanations
```

This file gets injected into every agent system prompt, replacing the old 6 dense learning files.

---

## What Changes vs. Original Plan

| Original | New |
|---|---|
| 7-category question battery | Single interest extraction call |
| Dense learning files (character, facts, people, projects, goals, beliefs) | interest_graph.json |
| NoteReviewJob: consolidate facts across 6 files | InterestGraph maintenance (prune stale topics) |
| Open questions system (vault hunt, web hunt, ask_human) | Removed |
| KnowYourHumanJob (asks intrusive personal questions) | Removed |
| LinkGraphBuilder (entity/wikilink graph) | Replaced by InterestGraph |
| Context injection: 6 dense learning files | Top interests + communication_style.md |
| No communication style tracking | SessionStyleReviewJob |

---

## Codebase Snapshot (What Already Exists)

| What | Where | Status |
|------|-------|--------|
| Scheduler | `src/main/scheduler/Scheduler.ts` | ✅ unchanged |
| AgentLoop | `src/main/agent/AgentLoop.ts` | needs Phase 7 update |
| VaultManager | `src/main/vault/VaultManager.ts` | ✅ unchanged |
| DatabaseManager | `src/main/database/DatabaseManager.ts` | needs session_logs table |
| Tools | `src/main/agent/tools/` | ✅ unchanged |
| CognitiveRunner | `src/main/agent/CognitiveRunner.ts` | ✅ unchanged |
| AgentVaultManager | `src/main/agent_vault/AgentVaultManager.ts` | needs update |
| Manifest | `src/main/agent_vault/Manifest.ts` | ✅ unchanged |
| LinkGraphBuilder | `src/main/agent_vault/LinkGraphBuilder.ts` | ⚠️ retire — replaced by InterestGraph |
| QuestionBattery | `src/main/agent_vault/QuestionBattery.ts` | needs rewrite |
| RawLearningWriter | `src/main/agent_vault/RawLearningWriter.ts` | needs rewrite |
| LearningFileManager | `src/main/agent_vault/LearningFileManager.ts` | ⚠️ retire — no longer needed |
| ProcessNewFilesJob | `src/main/cognitive_jobs/ProcessNewFilesJob.ts` | needs rewrite |
| NoteReviewJob | `src/main/cognitive_jobs/NoteReviewJob.ts` | needs rewrite |
| InboxView | `src/renderer/.../views/InboxView.tsx` | ✅ unchanged |
| ScheduleView | `src/renderer/.../views/ScheduleView.tsx` | ✅ unchanged |

---

## Architecture: Two LLM Runners (unchanged)

```
AgentLoop (existing)              CognitiveRunner (existing)
─────────────────────             ─────────────────────────
Multi-turn                        Single call
Free-form tool calling            Structured JSON output
Used for: chat, tasks,            Used for: all cognitive jobs
  scheduled agent prompts
Up to 25 iterations               One call, validate, retry once, then skip
```

---

## Phase 1: App Infrastructure ✅ COMPLETE

*Completed: 2026-04-10*

Largely unchanged. Minor updates needed:

### 1.1 — `_agent_vault` Folder Structure UPDATE NEEDED

**Remove:** `learning/` folder and its 8 files (character.md, facts.md, people.md, etc.)

**Add:**
- `_agent_vault/interest_graph.json` — initialized as `{}`
- `_agent_vault/communication_style.md` — initialized empty
- `_agent_vault/session_logs/` — conversation summaries for style analysis

**Updated schema:**
```
_agent_vault/
  manifest.json
  interest_graph.json       ← NEW: replaces link_graph.json + learning files
  communication_style.md    ← NEW: agent communication style prompt snippet
  raw_learning/             ← one file per vault file (now: just interest tags)
  session_logs/             ← NEW: brief chat session summaries for style review
  insights/
  inbox/
    threads/
  synthesis/
  inspiration/
  plans/
```

**Note:** `link_graph.json` and `learning/` are retired — existing data stays on disk but no new writes.

### 1.2 — Manifest System ✅ (unchanged)

### 1.3 — Link Graph Builder → RETIRE

**Replace with:** `InterestGraph.ts` (see Phase 2)

### 1.4 — Entity & Keyword Extractor ✅ (unchanged)

`Extractor.ts` — still used for manifest keywords/entities. Not used for the question battery anymore.

### 1.5 — DB Migration ✅ (unchanged)

`cognitive_jobs` table — same structure.

**New migration: `session_logs` table**

```sql
CREATE TABLE IF NOT EXISTS session_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  summary TEXT NOT NULL,           -- brief summary of conversation topics/tone
  raw_excerpt TEXT,                -- short excerpt of conversation for style analysis
  style_reviewed INTEGER DEFAULT 0, -- 0 = not yet processed by style job
  created_at INTEGER NOT NULL
)
```

---

## Phase 2: Interest Extraction (replaces Question Battery) — REWRITE

*Goal: A file gets processed → interest tags written → interest graph updated.*

### 2.1 — CognitiveRunner ✅ (unchanged)

### 2.2 — QuestionBattery → REWRITE: Single Interest Extraction

**File:** `src/main/agent_vault/QuestionBattery.ts`

Replace 7 categories with one:

```typescript
export const INTEREST_EXTRACTION: QuestionCategory = {
  id: 'interests',
  label: 'Interests & Topics',
  prompt: (text) => `Extract 5–10 specific topic tags from this document.
Tags should reflect what the document is actually about and the interests it reveals.

Be specific:
- Not "technology" → "LLM fine-tuning" or "Elixir concurrency"  
- Not "politics" → "Iran geopolitics" or "EU AI regulation"
- Not "health" → "sleep optimization" or "chronic fatigue"

Avoid generic tags: "journal", "notes", "work", "life", "thoughts".
Use lowercase. Return JSON with a "tags" array.

Document:
${text}`,
  schema: { type: 'object', properties: { tags: { type: 'array', items: { type: 'string' } } } },
  example: { tags: ['llm fine-tuning', 'startup fundraising', 'elixir concurrency', 'iran geopolitics'] }
}
```

One LLM call per file. No userName needed (interests are topic-based, not person-based).

### 2.3 — InterestGraph (NEW — replaces LinkGraphBuilder)

**New file:** `src/main/agent_vault/InterestGraph.ts`

```typescript
interface InterestEntry {
  count: number
  last_mentioned: number   // unix ms
  files: string[]          // vault-relative paths where tag appeared
}

type InterestGraphData = Record<string, InterestEntry>

class InterestGraph {
  constructor(agentVaultPath: string) {}
  
  async read(): Promise<InterestGraphData>
  async write(data: InterestGraphData): Promise<void>
  
  /** Add tags from a newly processed file. Upserts — increments count if tag exists. */
  async addTags(tags: string[], filePath: string, timestamp: number): Promise<void>
  
  /** 
   * Return top N interests sorted by recency-weighted score.
   * score = count × exp(−daysSince / halfLifeDays)
   * halfLifeDays defaults to 30 — interest from last month weighs ~37% of today's.
   */
  async getTopInterests(n: number, halfLifeDays?: number): Promise<Array<{
    tag: string
    score: number
    count: number
    daysSince: number
  }>>
  
  /** Drop topics with count ≤ 1 and not mentioned in 90 days. */
  async prune(): Promise<number>  // returns count of pruned topics
}
```

### 2.4 — RawLearningWriter → REWRITE

**File:** `src/main/agent_vault/RawLearningWriter.ts`

Raw learning notes now just record extracted tags:

```markdown
---
source: notes/journal/2026-04-08.md
processed_at: 2026-04-09T03:14:00
---

## Interests
- iran geopolitics
- llm fine-tuning
- startup product strategy
- elixir concurrency
```

Simple, readable, auditable.

### 2.5 — `process_new_files` Job → REWRITE

**File:** `src/main/cognitive_jobs/ProcessNewFilesJob.ts`

```typescript
async function run(context): Promise<JobResult> {
  // 1. Collect vault files, find unprocessed/changed (same as before)
  
  // 2. For each file:
  //    a. Read content
  //    b. Compute hash — skip if unchanged
  //    c. Extract keywords/entities (Extractor.ts) — unchanged
  //    d. ONE CognitiveRunner call: interest extraction → { tags: string[] }
  //    e. Write raw learning note (just tags)
  //    f. Update interest graph: interestGraph.addTags(tags, filePath, now)
  //    g. Update manifest
  
  // 3. Return { processed, skipped, errors }
}
```

Goes from 7 parallel LLM calls per file → 1 call. 7× cheaper, faster, less noisy.

---

## Phase 3: Style Review & Interest Maintenance (replaces Note Review)

*Goal: Interest graph stays clean. Agent learns how to talk to the user.*

### 3.1 — InterestGraph Maintenance Job (replaces NoteReviewJob)

**File:** `src/main/cognitive_jobs/NoteReviewJob.ts` (repurposed, rename optional)

```typescript
async function run(context): Promise<JobResult> {
  // 1. Prune stale low-count topics from interest graph
  const pruned = await interestGraph.prune()
  
  // 2. Log top 10 current interests (for debugging / admin view)
  const top = await interestGraph.getTopInterests(10)
  console.log('[interest_maintenance] Top interests:', top.map(t => `${t.tag} (${t.count})`))
  
  return { processed: pruned, skipped: 0, errors: 0 }
}
```

Schedule: daily — `0 4 * * *`

### 3.2 — SessionStyleReviewJob (NEW)

**New file:** `src/main/cognitive_jobs/SessionStyleReviewJob.ts`

Analyzes conversation logs to extract communication style and explicit preferences.

```typescript
async function run(context): Promise<JobResult> {
  // 1. Read unreviewed session logs from session_logs table
  //    (style_reviewed = 0, limit 10 per run)
  
  // 2. Read current communication_style.md
  
  // 3. CognitiveRunner call:
  //    "Here are recent conversation excerpts between an AI agent and a human.
  //     Describe the human's communication style in 3-5 bullet points.
  //     Also list any explicit preferences they stated (e.g. 'don't call me sir').
  //     Here is the current style description: [existing content]
  //     Return JSON: { style: string[], explicit_preferences: string[], changed: boolean }"
  
  // 4. If changed: rewrite communication_style.md
  
  // 5. Mark session logs as reviewed (style_reviewed = 1)
  
  return { processed: N, skipped: 0, errors: 0 }
}
```

**Schema:**
```typescript
{
  style: string[]               // e.g. ["casual and direct", "prefers short responses"]
  explicit_preferences: string[] // e.g. ["don't call me sir"]
  changed: boolean
}
```

**communication_style.md output format:**
```markdown
## Communication style

- Casual and direct — no formal titles
- Prefers concise responses, gets to the point fast
- Likes examples over abstract explanations

## Explicit preferences

- Don't use "sir" or formal address
- Prefers bullet points over long paragraphs
```

**Prerequisite:** Session logs must be written somewhere. Two options:

- **Option A (simpler):** After each chat session ends, AgentLoop writes a brief summary to `session_logs/` folder and inserts a row in `session_logs` DB table. Summary = last N turns of the conversation.
- **Option B (richer):** Persist full chat messages in a new `chat_messages` DB table. SessionStyleReviewJob reads from there.

**Decision:** Start with Option A. After chat completes (finish_task), write a 500-token summary of the exchange to `_agent_vault/session_logs/{session_id}.md` and record in DB. Style job reads these files.

Schedule: daily — `0 6 * * *`

---

## Phase 4: Inbox Threading (Two-Way Communication) — SIMPLIFIED

*Goal: Agent can surface insights and plans to human. Reply mechanism stays.*

The thread system stays. However, the `question` thread type is removed — we no longer probe the user with personal questions. Thread types are now:

- `insight` — something interesting the agent noticed (read-only)
- `plan` — action items from inspiration synthesis (read-only)
- `inspiration` — interesting find from web search (read-only)

If the agent needs to communicate something that requires a response, it uses a normal chat message instead.

### 4.1–4.4 — Thread file format, ThreadManager, IPC, InboxView

Same as original plan. Remove `question` type from thread type enum.

---

## Phase 5: Question Hunting Jobs — REMOVED

*The vault hunt, web hunt, and KnowYourHuman jobs are eliminated.*

These jobs existed to answer personal questions about the user. Under the new strategy, we don't ask those questions. The agent learns what the user cares about through their writing, not through interrogation.

**Removed:**
- `question_vault_hunt` job
- `question_web_hunt` job
- `know_your_human` job

---

## Phase 6: Scheduler UI — Cognitive Jobs Panel

*Goal: User can see and manually trigger cognitive jobs.*

Same design as original plan. Updated job list:

| Job | Schedule | Purpose |
|-----|----------|---------|
| `process_new_files` | `*/30 * * * *` | Extract interests from vault files |
| `interest_maintenance` | `0 4 * * *` | Prune stale topics from interest graph |
| `session_style_review` | `0 6 * * *` | Analyze chat logs, update comm style |
| `random_insight` | `0 8,14,20 * * *` | Surface connections between notes |
| `inspiration_search` | `0 10 * * 1,3,5` | Browse web based on top interests |
| `inspiration_to_plan` | `0 9 * * 1` | Turn inspiration into action items |
| `synthesize_week` | `0 21 * * 0` | Weekly note synthesis |

Down from 9 jobs to 7. No more hunting jobs.

---

## Phase 7: Context Injection (Long-Term Memory) — REDESIGNED

*Goal: Agent knows what user cares about and how to talk to them.*

### 7.1 — `buildLearningContext()` in AgentLoop

**Modify:** `src/main/agent/AgentLoop.ts`

```typescript
private async buildLearningContext(): Promise<string> {
  const sections: string[] = []
  
  // 1. Top current interests (from interest_graph)
  const interestGraph = new InterestGraph(this.agentVaultPath)
  const topInterests = await interestGraph.getTopInterests(12)
  if (topInterests.length > 0) {
    const lines = topInterests.map(t => `- ${t.tag}`)
    sections.push(`## What you care about right now\n\n${lines.join('\n')}`)
  }
  
  // 2. Communication style (from communication_style.md)
  try {
    const style = await fs.readFile(communicationStylePath, 'utf-8')
    if (style.trim()) sections.push(style.trim())
  } catch { /* not yet generated */ }
  
  return sections.join('\n\n')
}
```

**Token budget:** Interest graph top-12 ≈ 200 tokens. Communication style ≈ 300 tokens. Total ≈ 500 tokens — a fraction of the old approach's 18,000 token budget. More focused, less bloat.

### 7.2 — Session Log Writing

**Modify** `src/main/agent/AgentLoop.ts`:

After `finish_task()` is called (or on session end), write a brief session log:

```typescript
private async writeSessionLog(sessionId: string, turns: ConversationTurn[]): Promise<void> {
  // Take last 10 turns max, cap at ~800 tokens
  const excerpt = turns.slice(-10).map(t => `${t.role}: ${t.content.slice(0, 200)}`).join('\n\n')
  
  const logPath = path.join(this.agentVaultPath, 'session_logs', `${sessionId}.md`)
  await fs.writeFile(logPath, `---\nsession_id: ${sessionId}\ncreated_at: ${new Date().toISOString()}\n---\n\n${excerpt}`, 'utf-8')
  
  // Insert into session_logs table (style_reviewed = 0)
  this.dbManager.insertSessionLog(sessionId, excerpt)
}
```

---

## Phase 8: Generative Cognition Jobs — UPDATED

*Goal: The agent feels alive — surfacing insights, finding inspiration, synthesizing.*

### 8.1 — `random_insight` Job (unchanged)

Still reads random vault files, finds related files via shared interest tags (using interest_graph instead of link_graph). Same output: inbox insight thread.

### 8.2 — `inspiration_search` Job (updated)

```typescript
// 1. Get top 3 interests from interest_graph.getTopInterests(3)
// 2. Call Brave Search for each
// 3. CognitiveRunner: "What's interesting here? What does this make you think about?"
// 4. Write to _agent_vault/inspiration/{date}-{tag}.md
```

The interest graph directly drives what gets searched — no more reading facts.md/beliefs.md to guess topics.

### 8.3 — `inspiration_to_plan` Job (unchanged)

### 8.4 — `synthesize_week` Job (updated)

Use interest tags from raw_learning notes to cluster notes by topic instead of entity overlap.

---

## Phase 9: Auto-generated Vault Index — UPDATED

`VaultIndexGenerator.ts` changes:

- Replace "Top 10 entities by mention count (from link_graph)" → "Top 10 interests by recency score (from interest_graph)"
- Add: "Communication style last updated: [date]"

---

## Implementation Sequence

```
Phase 1 (Foundation) ✅ COMPLETE — 2026-04-10
  ├── AgentVaultManager + folder init ✅
  ├── Manifest system ✅
  ├── Extractor ✅
  └── DB migration (cognitive_jobs table) ✅
  
  ⚠️ NEEDS UPDATE:
  ├── Add interest_graph.json init
  ├── Add communication_style.md init
  ├── Add session_logs/ folder
  └── Add session_logs DB table

Phase 2 (Interest Extraction) — REWRITE
  ├── QuestionBattery.ts → single interest extraction
  ├── InterestGraph.ts (new — replaces LinkGraphBuilder)
  ├── RawLearningWriter.ts → simplified (interest tags only)
  └── process_new_files job → single LLM call + interest graph update

Phase 3 (Style Review & Maintenance) — REWRITE
  ├── NoteReviewJob.ts → interest_maintenance (prune stale topics)
  └── SessionStyleReviewJob.ts (new)

Phase 4 (Inbox Threading)
  ├── InboxThreadManager (remove question type)
  ├── Thread IPC channels
  └── InboxView updates

Phase 5 (Question Hunting) — REMOVED

Phase 6 (Scheduler UI)
  ├── CognitiveJobScheduler (7 jobs, not 9)
  ├── IPC channels
  └── CognitiveJobsPanel component

Phase 7 (Context Injection)
  ├── buildLearningContext() → interests + comm style
  └── writeSessionLog() → writes session_logs after chat

Phase 8 (Generative Cognition)
  ├── random_insight job (uses interest_graph for clustering)
  ├── inspiration_search job (uses interest_graph for topic selection)
  ├── inspiration_to_plan job
  └── synthesize_week job (clusters by interest tags)

Phase 9 (Vault Index)
  └── VaultIndexGenerator (top interests instead of entities)
```

---

## New Files Summary

```
src/main/
  agent_vault/
    InterestGraph.ts              ← NEW: recency-weighted interest graph
    QuestionBattery.ts            ← REWRITE: single interest extraction
    RawLearningWriter.ts          ← REWRITE: just writes interest tags
    AgentVaultManager.ts          ← UPDATE: new paths, new init files
    [LinkGraphBuilder.ts]         ← RETIRE: keep on disk, stop using
    [LearningFileManager.ts]      ← RETIRE: keep on disk, stop using
  cognitive_jobs/
    ProcessNewFilesJob.ts         ← REWRITE: single call, interest graph update
    NoteReviewJob.ts              ← REWRITE: interest graph maintenance only
    SessionStyleReviewJob.ts      ← NEW: analyze chat logs, update comm style
    [QuestionVaultHuntJob.ts]     ← DON'T BUILD
    [QuestionWebHuntJob.ts]       ← DON'T BUILD
    [KnowYourHumanJob.ts]         ← DON'T BUILD
    RandomInsightJob.ts           ← unchanged design
    InspirationSearchJob.ts       ← UPDATE: uses interest_graph
    InspirationToPlanJob.ts       ← unchanged design
    SynthesizeWeekJob.ts          ← UPDATE: clusters by interest tags
```

---

## Key Design Principles

1. **Not a dossier.** We learn what someone cares about, not who they are. Topics, not facts.

2. **Recency matters.** If someone talked about Iran war last week, that's their current mind. Five-year-old interests are irrelevant.

3. **Style emerges from behavior.** We don't ask "how do you like to be talked to?" — we observe it from how they actually write and correct the agent.

4. **No interrogation.** The `know_your_human` job asked probing questions about the user's life. Eliminated. The agent learns by watching, not by asking.

5. **Tiny context footprint.** Old system: ~18,000 tokens injected. New system: ~500 tokens. Tighter signal, less noise.
