# Agent Vision: The Living Knowledge Base

*Evaluation and architectural thinking — April 10, 2026*

---

## The Core Differentiator

Most note-taking apps treat AI as a *reactive* tool — you ask, it answers. ThinkPod's vision flips this: the agent is *proactive*, running continuously, building its own understanding of the vault over time. This is not just a feature difference. It's a philosophical one.

The closest analogy: imagine a brilliant research assistant who lives in your library, reads everything you've written, thinks about it while you sleep, and leaves you notes in the morning. No other consumer tool does this at this level. Obsidian, Notion, Bear — all passive. This is the gap.

---

## Why Local Model Changes Everything

Running 24/7 on a local model means:
- **No API cost accumulation** — the agent can run continuously without billing anxiety
- **Privacy** — the vault never leaves the machine; personal journals, family notes, sensitive ideas are safe
- **Autonomy** — no rate limits, no dependency on cloud uptime
- **True continuity** — the agent can take its time, revisit old conclusions

This makes the "always-on thinking partner" viable in a way that cloud-only tools cannot match.

---

## Foundational Design Principle: App Is the Brain, Model Is the Voice

Local models are weak at open-ended reasoning. They hallucinate, lose track of instructions in long prompts, and produce inconsistent output when asked to "think freely." **This does not kill the vision — it reshapes the architecture.**

The solution: **the application does all the reasoning; the model only articulates what the app has already figured out.**

Every model call must follow this pattern:

```
App pre-processes → App detects pattern/gap → App builds narrow, structured prompt
→ Model writes a sentence or paragraph → App validates output → App saves
```

### Practical rules for every model call:
1. **One task per call** — never ask the model to do two things at once
2. **Pre-fill all context** — the app gathers relevant data, model just articulates it
3. **Require JSON output** — every call uses a strict schema; app validates before saving
4. **Keep prompts short** — local models degrade with long prompts; under 1500 tokens when possible
5. **No open-ended reasoning** — replace "what do you think?" with "describe this pattern in 2-3 sentences"
6. **Include output examples** — few-shot examples in every prompt template

---

## The Read-Think-Write Loop: Multi-Question Extraction

When the agent reads a new or changed file, it does not ask one vague question. It runs a **battery of narrow, specific questions** against the document — each targeting a different dimension of understanding. The app fires these as separate model calls (or a structured multi-answer JSON call), then writes all answers into a raw learning note.

### The Question Battery

**Character & Personality**
- What does this document reveal about the writer's patience or persistence?
- What emotional state does the writer seem to be in? (anxious, excited, frustrated, calm)
- What does this reveal about how the writer handles uncertainty or failure?
- Does this show any values or principles the writer holds? (eg: fairness, quality, autonomy)
- What does this reveal about how the writer makes decisions? (analytical, intuitive, impulsive)
- Is there evidence of the writer being critical of themselves or others?

**Facts & Preferences**
- What technologies, tools, or programming languages are mentioned or implied?
- What hobbies, interests, or recreational activities appear?
- What foods, places, media, or entertainment are mentioned?
- What does the writer explicitly like or dislike?
- What habits or routines are described or implied?

**People & Relationships**
- Who is mentioned by name? What is their apparent relationship to the writer?
- What does this reveal about the writer's relationship dynamics? (supportive, tense, distant)
- Are there any new people appearing for the first time?

**Work & Projects**
- What projects, products, or professional work is mentioned?
- What domain or industry does this relate to?
- What problems is the writer trying to solve?
- What skills are they developing or struggling with?
- What tools or workflows are used professionally?

**Goals & Plans**
- What short-term goals or intentions are expressed?
- What long-term aspirations or ambitions appear?
- What is the writer planning to do next?
- Are any deadlines or time constraints mentioned?

**Beliefs & Worldview**
- What opinions or beliefs does the writer express?
- What mental models or frameworks do they use?
- What does the writer seem to care about most in this document?

**Open Questions (most important)**
- What claims in this document could be verified or expanded via web search?
- What is left ambiguous or unresolved that could be answered by searching the vault?
- What would be useful to know more about based on this document?

Each answer is tagged with its source file and the question category. The result is a **raw learning note** — not polished, not deduplicated, just extracted facts and questions.

---

## The Learning Note Format

Every processed file produces a raw learning note in `_agent_vault/raw_learning/`:

```markdown
---
source: notes/journal/2026-04-01.md
processed_at: 2026-04-02T03:14:00
---

## Extracted Facts

- [character/persistence] Spent 3 weeks debugging a hard issue and expressed satisfaction at solving it
- [character/emotional] Felt anxious about the upcoming meeting with investor
- [preference/tech] Uses Elixir for the backend of current project
- [preference/tech] Mentioned frustration with JavaScript tooling
- [work/project] Working on a crypto-related product, seems early stage
- [people] "Alice" mentioned as someone who gave feedback — relationship unclear
- [goal/short-term] Wants to finish the auth module this week
- [belief] Expressed belief that simplicity in code matters more than clever abstractions

## Open Questions

- [ ] What is the crypto project specifically? [search: internal vault]
- [ ] Who is Alice? Is she a colleague, investor, friend? [search: internal vault]
- [ ] What does Elixir look like for crypto applications? [search: web]
- [ ] What happened at the investor meeting? [search: internal vault, future notes]
```

---

## The Dense Learning Files

Raw learning notes are noisy and redundant. The scheduled `note_review` job consolidates them into **dense learning files** — the agent's actual long-term memory. These are what get injected into the context window.

```
_agent_vault/
  learning/
    character.md         ← personality traits, patterns of behavior
    facts.md             ← verified facts: tech preferences, habits, likes/dislikes
    people.md            ← known people and relationships
    projects.md          ← known projects and professional context
    goals.md             ← short and long term goals
    beliefs.md           ← expressed opinions and mental models
    open_questions.md    ← all unresolved questions, tagged by answer method
```

Example entry in `facts.md`:
```
- Uses Elixir for backend development [seen: 3 notes] [first: 2026-01-10] [last: 2026-04-01]
- Works on a crypto-related product (name unknown) [seen: 2 notes] [last: 2026-04-01]
- Dislikes JavaScript tooling [seen: 1 note] [last: 2026-04-01]
```

The `[seen: N notes]` count is **app-computed** from the manifest, not from the model's memory.

---

## Scheduled Cognitive Jobs (Full Set)

### `process_new_files` (every 30 min)
App detects new/changed files → **sorts by modified date descending (newest first)** so recent thinking is always processed before old — runs question battery → writes raw_learning note → updates manifest. Cap at 20 files per run to avoid blocking.

### `note_review` (daily)
App loads all new raw_learning notes since last review → loads existing dense learning files →
Model is asked: *"Here are new extracted facts. Here are the existing dense facts. Identify: which are new, which update existing entries, which are duplicates. Output a consolidated update in JSON."*
App applies the diff to the dense learning files.

Also in the same job, app loads new open questions from raw_learning notes → loads existing `open_questions.md` →
Model is asked: *"Here are new open questions. Here are existing open questions. Does any new question duplicate an existing one? Does any new fact in this batch answer an existing open question? Output: merged questions list with duplicates removed, and any questions now answered with their answer."*
App updates `open_questions.md` accordingly.

### `question_web_hunt` (daily)
App reads `open_questions.md` and picks questions tagged `[search: web]` →
App does web search → feeds top results as context →
Model attempts answer from the search results (no free reasoning) →
Answer appended to `open_questions.md` and relevant dense learning file →
Question marked resolved or refined

### `question_vault_hunt` (daily)
App reads `open_questions.md` and picks questions tagged `[search: internal vault]` →
App runs regex/full-text search across vault to find candidate answers →
Model synthesizes answer from matched excerpts →
Answer written back to learning files, question resolved or escalated to web hunt

### `know_your_human` (daily 5am)
App scans dense learning files for empty fields, stale entries (not updated in 30+ days), or contradictions →
Model writes 1-2 sentences filling in the gap if vault evidence exists, or generates a question to surface to the user →
User-facing questions go to inbox

### `inspiration_search` (3x/week)
App derives search topics from `facts.md` and `beliefs.md` (what the human is interested in) →
App runs web search on those topics →
Model reads results and writes: "what this makes me think" in a free, exploratory tone →
Written to `_agent_vault/inspiration/{date}-{topic}.md`

This job intentionally gives the model more freedom — inspiration is generative, not factual.

### `inspiration_to_plan` (weekly)
App collects recent inspiration files →
Model extracts: what action items, ideas, or experiments could come from these? →
Written to `_agent_vault/plans/{date}.md` →
Surfaced to user inbox

### `random_insight` (3x/day)
App picks a random vault file not surfaced recently →
App looks up its link_graph entry (mention count, days since last mention, related entities) →
App assembles: the file, its extracted facts, and 2-3 related notes →
Model writes a short observation connecting these →
Pushed to inbox

### `synthesize_week` (Sunday night)
App collects all raw_learning notes from past 7 days →
App clusters by keyword/entity overlap →
Model writes a 1-paragraph description of each cluster →
Written to `_agent_vault/synthesis/weekly_YYYY-WW.md`

---

## Long-Term Memory: Token Budgeting

This is the payoff of the whole architecture. The dense learning files are a **compressed, cumulative representation** of everything the agent knows about the human. Instead of injecting raw vault notes into context (expensive, noisy), you inject the learning files (dense, structured, reliable).

The local model has a **128K context window** — this is generous. We have real room to inject rich context without compromise. The goal is not to minimize tokens; it is to inject the *most useful* context for the current task, with budget allocated by priority.

**Token budget allocation for context (128K total):**

```
System prompt base          ~1,000 tokens   (core instructions, persona)
vault_index.md              ~2,000 tokens   (map of vault structure + recent files)
character.md                ~2,000 tokens   (full personality profile)
facts.md                    ~3,000 tokens   (all known facts about human)
people.md                   ~2,000 tokens   (all known relationships)
projects.md                 ~3,000 tokens   (all known work + projects)
goals.md                    ~1,500 tokens   (goals, timeline, intentions)
beliefs.md                  ~1,500 tokens   (worldview, opinions)
recent weekly synthesis     ~2,000 tokens   (last 2 weekly syntheses)
─────────────────────────────────────────────────────────
Fixed long-term memory      ~18,000 tokens

Remaining for task          ~110,000 tokens (conversation, documents, search results)
```

Open questions are **not injected** by default — they are internal working state, not context the agent needs for general conversation. They are loaded only by the question-hunting jobs that specifically process them.

As the vault grows, the dense files grow slowly because `note_review` deduplicates. A year of journaling might produce ~8,000 tokens of dense learning notes. Still leaves 100K+ for the task. We can afford to be thorough.

The budget above is the **baseline**. For specific tasks (e.g., a docs review job), relevant sections can be added on top. For lightweight tasks, the full learning context is still always present.

**The learning compounds over time.** Every new file adds a little. The `note_review` job keeps it clean. The question-hunting jobs fill in gaps. Eventually the agent has a genuinely rich model of who the user is — built from their own writing, not from what they told the agent directly.

---

## Open Question Lifecycle

Not all questions deserve to live forever. An open question has a lifecycle:

```
Created (from raw_learning note)
  → Auto-resolve attempt (vault search or web search)
      → Answered: fact written to learning file, question closed
      → Unanswered: evaluate importance
          → Important: escalate to human via inbox thread
          → Not important: drop
  → Stale (no progress in 30 days): auto-drop
```

### Dropping Questions

The agent should drop questions aggressively. Most questions raised from a single note are low-signal — they were fleeting, not important, or will be answered naturally as new notes are written. Keeping them creates noise.

**Auto-drop criteria (app-enforced, no model needed):**
- Question is older than 30 days with no progress
- Question was seen in only 1 source note (low signal)
- Question is a duplicate or near-duplicate of a resolved question

**Model-assisted drop (in `note_review` job):**
The model is asked: *"Given what we know about this person, rate the importance of answering this question: [question]. Score 1-5. If 1-2, mark for drop."* Low-scored questions are dropped automatically.

Dropped questions go to `_agent_vault/dropped_questions.md` as an archive (not injected into context), so the user can review if they want.

---

## The Inbox: Two-Way Human Communication

The inbox is currently one-directional (agent → human). It needs to grow into a **threaded conversation** — so the agent can ask the human something and receive a reply that gets processed back into the learning system.

### Thread Structure

Each inbox item is a thread file in `_agent_vault/inbox/`:

```markdown
---
thread_id: abc123
type: question          ← question | insight | plan | inspiration
status: awaiting_reply  ← new | awaiting_reply | replied | resolved
created: 2026-04-10T03:00:00
source_job: know_your_human
---

## Agent (2026-04-10 03:00)
I've noticed you mention "the investor" in 3 different notes but I don't know who 
they are. Who is this person and what's your relationship with them?

---

## Human (2026-04-10 09:15)
That's my co-founder's contact, Sarah Chen. She invested in our seed round.
```

### How Replies Work

1. In the inbox UI, each agent message has a **Reply** button
2. Human types reply, it's appended to the thread file as a `## Human (timestamp)` block
3. Thread status flips to `replied`
4. On the next `know_your_human` or `note_review` cycle, the app detects threads with `status: replied`
5. Model reads the thread and extracts: what facts were revealed? what open questions are now answered?
6. Facts written to the relevant dense learning file
7. Thread status set to `resolved`

### Growing This Over Time

The email-thread metaphor scales naturally:
- **Phase 1:** Agent asks → human replies → one-shot resolution (above)
- **Phase 2:** Multi-turn threads — agent can follow up on a reply ("Thanks, and is Sarah still involved?")
- **Phase 3:** Human can initiate threads too ("Hey, I want you to know that Alice left the company")
- **Phase 4:** Thread history becomes part of the learning context, not just individual facts

The key design constraint: **the agent should ask sparingly.** One question per `know_your_human` cycle maximum. Too many questions feels like an interrogation. The agent should prioritize questions that unlock high-value gaps in the learning files.

---

## Manual Job Triggers: Scheduler UI

All scheduled cognitive jobs should be manually triggerable from the UI. Reasons:
- The user may want immediate processing after writing a lot of notes
- Testing and debugging during development
- The user may want to kick off a `question_web_hunt` before a conversation

### UI Design

A **Scheduler Panel** (accessible from the sidebar or settings) shows:

```
┌─────────────────────────────────────────────────────┐
│  Cognitive Jobs                            [Run All] │
├─────────────────────────────────────────────────────┤
│  process_new_files   Last run: 12 min ago   [Run ▶] │
│  note_review         Last run: 6 hrs ago    [Run ▶] │
│  question_vault_hunt Last run: 1 day ago    [Run ▶] │
│  question_web_hunt   Last run: 2 days ago   [Run ▶] │
│  know_your_human     Last run: 18 hrs ago   [Run ▶] │
│  inspiration_search  Last run: 3 days ago   [Run ▶] │
│  inspiration_to_plan Last run: 1 week ago   [Run ▶] │
│  random_insight      Last run: 4 hrs ago    [Run ▶] │
│  synthesize_week     Last run: 5 days ago   [Run ▶] │
├─────────────────────────────────────────────────────┤
│  Running: note_review... (file 3 of 12)  [Cancel ✕] │
└─────────────────────────────────────────────────────┘
```

Each job shows:
- Last run timestamp
- Current status (idle / running / failed)
- A Run button (disabled while running)
- Progress indicator when active

The panel also shows the inbox count and a link to the learning files directory, so the user can see what the agent has accumulated.

---

## What Makes This Feel Alive

The agent should surface observations with context, not just summaries. With the multi-question approach, the app has already computed the interesting patterns — it just hands them to the model fully formed.

**Wrong approach** (model reasons freely):
> "Read this note and tell me something interesting."

**Right approach** (app detects, model articulates):
> "The user wrote this note. According to extracted facts, they have mentioned 'project-x' in 8 notes but not in the last 51 days. Their last mention expressed uncertainty. They have an open question about it. Describe this pattern warmly and curiously in 2-3 sentences."

Same quality of observation. The data is what makes it interesting. The model just writes it up.

---

## Key Risks and Mitigations

### Risk: Raw learning notes accumulate garbage
**Mitigation:** `note_review` job is the quality gate. Raw notes are never injected into context — only the consolidated dense files are. Garbage gets filtered or deduplicated before it matters.

### Risk: Model produces wrong facts ("he likes Rust" when he said he tried it once)
**Mitigation:** Every fact carries a `[seen: N notes]` count and source links. Low-count facts are marked tentative. The user can review and delete learning entries via a UI.

### Risk: Open questions multiply endlessly
**Mitigation:** Aggressive lifecycle management — auto-drop after 30 days, auto-drop if single-source, model-scored importance threshold, and a hard cap on `open_questions.md` size (top 50 max). Overflow goes to `dropped_questions.md` archive.

### Risk: Agent asks too many questions via inbox and annoys the user
**Mitigation:** Hard limit: one agent-initiated question per `know_your_human` cycle. Questions are ranked by importance before sending. If the inbox already has an unanswered question thread, no new question is sent until it's resolved.

### Risk: Dense learning files become stale or wrong over time
**Mitigation:** Every entry has a `[last: date]`. The `know_your_human` job flags entries not refreshed in 60+ days for re-verification. User can mark entries as wrong via UI.

### Risk: Context window limits
**Mitigation:** The dense learning files are explicitly token-budgeted. Total long-term memory injection target: ~1800 tokens. Everything beyond that is on-demand (loaded when relevant to the current query).

---

## Implementation Sequence

1. **App infrastructure** — manifest system, link_graph builder, entity/keyword extractor
2. **`_agent_vault` folder structure** — schema and file conventions
3. **Question battery** — define all extraction questions as prompt templates
4. **`process_new_files` job** — newest-first ordering, run question battery, produce raw_learning notes
5. **`note_review` job** — consolidate raw notes into dense learning files + update open_questions.md
6. **Open question lifecycle** — drop logic, importance scoring, archive to dropped_questions.md
7. **Scheduler UI panel** — manual triggers, last-run timestamps, progress indicator
8. **Inbox UI** — thread view with reply capability
9. **Reply processing** — detect replied threads, extract facts, close threads
10. **`question_vault_hunt` + `question_web_hunt`** — auto-resolve open questions
11. **`know_your_human` job** — profile gap detection, one inbox question per cycle
12. **Token budgeting and context injection** — wire dense files into every prompt at 18K tokens
13. **`inspiration_search` + `inspiration_to_plan`** — generative cognition layer
14. **`random_insight` + `synthesize_week`** — ambient awareness layer

Steps 1-6 are the foundation. Steps 7-9 make it interactive. Everything else is additive.

---

## Bottom Line

The multi-question extraction approach solves the local model problem elegantly: instead of one hard question ("what's interesting?"), ask many easy questions ("what technology is mentioned?", "what emotion is present?"). Each answer is trivial. The intelligence is in the *breadth of questions* and the *accumulation over time*, not in the model's reasoning in any single call.

The dense learning files are the payoff: a growing, deduplicated, token-efficient model of who the user is — built from their own writing, continuously refined by question-hunting jobs, and always available in context.

This is not a chatbot with memory. This is a system that genuinely learns.
