# ThinkPod Dashboard — Design Plan

## Philosophy

The dashboard is not a control panel. It is a **threshold** — the moment between arriving and writing.
The mental model: you walk into a study where Wilfred has been working on your behalf overnight.
The desk has a few things on it. Not a report. Not metrics. Just what matters right now.

---

## Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│   Good morning, Arif.                          [ Inbox  2 ]        │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Wilfred:  You've mentioned "decision fatigue" in 4 notes   │   │
│  │  this week. There might be something worth writing here.    │   │
│  │                                          [ Explore this → ] │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  What's on your mind?                                       │   │
│  │                                                             │   │
│  │                                                             │   │
│  │                                          [ Capture  ↵ ]    │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│   ┌──────────────────────────┐  ┌──────────────────────────┐       │
│   │  On this day             │  │  Pick up where you left  │       │
│   │  ─────────────────────   │  │  off                     │       │
│   │  1 year ago              │  │  ─────────────────────   │       │
│   │  "The problem with big   │  │  "Stoic Principles for   │       │
│   │  goals is that they      │  │  Modern Work"            │       │
│   │  feel abstract until..." │  │  Last edited 2 days ago  │       │
│   │                          │  │                          │       │
│   │  [ Read it → ]           │  │  [ Continue writing → ]  │       │
│   └──────────────────────────┘  └──────────────────────────┘       │
│                                                                     │
│   ┌─────────────────────────────────────────────────────────────┐  │
│   │  Unfinished thoughts Wilfred wants you to revisit           │  │
│   │  ─────────────────────────────────────────────────────────  │  │
│   │  · "Idea: async book club format"          3 weeks dormant  │  │
│   │  · "Draft: letter to future self"          6 weeks dormant  │  │
│   └─────────────────────────────────────────────────────────────┘  │
│                                                                     │
│   ┌─────────────────────────────────────────────────────────────┐  │
│   │  Chat with Wilfred                                          │  │
│   │  ─────────────────────────────────────────────────────────  │  │
│   │  Ask me anything about your vault, or just think out loud.  │  │
│   │                                                             │  │
│   │  ┌──────────────────────────────────────────────────────┐  │  │
│   │  │                                           [ Send → ] │  │  │
│   │  └──────────────────────────────────────────────────────┘  │  │
│   └─────────────────────────────────────────────────────────────┘  │
│                                                                     │
│   You've written 6 days in a row.  Wilfred last thought: 1h ago.   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Sections Breakdown

### 1. Greeting + Inbox badge
**Top of page.** Personalized greeting (time-aware: morning / afternoon / evening).
Inbox badge appears only when Wilfred has unread messages — not permanently visible.
The badge is a pull, not a push: it invites rather than demands.

---

### 2. Wilfred's Observation *(the differentiator)*
**The most important card on the page.**
This is not a generic tip or quote. Wilfred generates a specific observation derived from
recent writing — a pattern, a recurring theme, an unresolved tension. One sentence, one action.

Examples:
- *"You've been writing about burnout and about ambition. These might be in conflict."*
- *"Your last three journal entries all end with a question. Want to try answering one?"*
- *"You haven't written in the 'Projects' category in 3 weeks."*

This card makes Wilfred feel real. It should refresh daily or on each launch.

---

### 3. Quick Capture
**The primary action surface.**
A plain textarea, no labels beyond a placeholder. `↵` or `Cmd+Enter` saves immediately
to Drafts. No category selection, no title required. Friction-free.

This honors the core philosophy: *ideas are fleeting*.

---

### 4. On This Day
**A memory card.**
Surfaces one note written on this calendar date in a prior year or month.
No user action needed — Wilfred finds it. Deeply personal. Creates a sense that
the vault has depth and continuity.

If nothing exists for this date, the card is hidden. Never show an empty state here.

---

### 5. Pick Up Where You Left Off
**Last opened / last edited note.**
One note, one teaser line, one button. The goal is to eliminate the "where was I?"
re-entry cost. Not a recents list — just the single most relevant continuation.

---

### 6. Unfinished Thoughts
**Wilfred's gentle nudge list.**
Drafts that have been dormant beyond a threshold (e.g. 2+ weeks). Wilfred selects
these — not a raw "all drafts" dump. Max 3–4 items. Each shows a title and dormancy
duration. Clicking opens the draft directly.

This section is Wilfred acting as an accountability partner without being nagging.

---

### 7. Chat with Wilfred *(inline, non-FAB)*
**A persistent but calm chat entry point.**
Not a full chat interface — just an input with Wilfred's name above it. Clicking
expands into a proper conversation panel (slide-in or modal). The presence on the
dashboard signals availability without dominating the screen.

---

### 8. Footer Status Line
**One quiet line at the bottom.**
Two data points only:
- Writing streak (framed as Wilfred noticing: *"You've written 6 days in a row."*)
- When Wilfred last ran: *"Wilfred last thought: 1h ago."*

This is not a stats block. It's ambient context — proof that the system is alive
and paying attention. These numbers should feel earned, not tracked.

---

## What This Dashboard Is NOT

- Not a file manager (no lists of recent files)
- Not an analytics screen (no word count charts, no heatmaps)
- Not a notifications center (Inbox is separate)
- Not a launcher (navigation lives in the sidebar)

---

## Interaction Flow

```
User opens app
      │
      ▼
Dashboard loads
      │
      ├── Wilfred observation generated (async, shows skeleton then content)
      │
      ├── On This Day note fetched from vault
      │
      └── Last edited note fetched
      │
      ▼
User sees the desk.
      │
      ├── Option A: Types in Quick Capture → saved to Drafts → stays on dashboard
      │
      ├── Option B: Clicks "Explore this →" on Wilfred card → opens chat with context preloaded
      │
      ├── Option C: Clicks "Continue writing →" → opens last note in editor
      │
      └── Option D: Clicks an unfinished draft → opens that note in editor
```

---

## Open Questions

- Should Quick Capture support voice input inline (mic button)?
- Should the Wilfred Observation card be dismissible / refreshable manually?
- Should "On This Day" show multiple entries if several exist, or pick one?
- Should the writing streak be opt-out for users who find it anxiety-inducing?
