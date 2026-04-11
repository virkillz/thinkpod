export interface NoteTemplate {
  id: string
  title: string
  description: string
  isEnabled: boolean
  format: string
  defaultFolder: string
  requireTags: boolean
}

export const DEFAULT_TEMPLATES: NoteTemplate[] = [
  {
    id: 'journal',
    title: 'Journal',
    description: 'Daily reflection and personal notes',
    isEnabled: true,
    defaultFolder: 'Journal/',
    requireTags: true,
    format: `

# Journal — {insert_date_here}

## How am I feeling?

[Write freely here]

## What's the plan for today?

[Write freely or bullet points]

## What is actually happening?

[Write freely or bullet points]

## Reflection

[What did I learn or notice?]`,
  },
  {
    id: 'meeting',
    title: 'Meeting Notes',
    description: 'Structured notes from a meeting with agenda and action items',
    isEnabled: true,
    defaultFolder: 'Meetings/',
    requireTags: false,
    format: `

# Meeting: [Subject]

## Agenda

[Agenda description]

## Notes

- [Note 1]
- [Note 2]

## Action Items

- [ ] [Who] — [What]`,
  },
  {
    id: 'project',
    title: 'Project Note',
    description: 'Progress notes for a project including goals and blockers',
    isEnabled: true,
    defaultFolder: 'Projects/',
    requireTags: true,
    format: `

# Project: [Name]

## Goal

[What are we trying to achieve?]

## Progress

[What has been done?]

## Blockers

- [Blocker 1]

## Next Steps

- [ ] [Next action]`,
  },
  {
    id: 'todo',
    title: 'Todo',
    description: 'A simple checklist of tasks',
    isEnabled: true,
    defaultFolder: 'Todos/',
    requireTags: false,
    format: `

# Todo: [Subject]

## Tasks

- [ ] [Task 1]
- [ ] [Task 2]
- [ ] [Task 3]

## Notes

[Optional context]`,
  },
  {
    id: 'bookmark',
    title: 'Bookmark',
    description: 'A saved link with context and tags',
    isEnabled: true,
    defaultFolder: 'Bookmarks/',
    requireTags: true,
    format: `

# [Page Title]

## Why I saved this

[Reason]

## Key takeaways

- [Point 1]
- [Point 2]`,
  },
  {
    id: 'ideas',
    title: 'Ideas',
    description: 'A captured idea with comprehensible description',
    isEnabled: true,
    defaultFolder: 'Ideas/',
    requireTags: true,
    format: `

# Idea: [Title]

## What is it?

[Describe the idea]

## Why it matters

[Motivation or potential impact]

## Next Steps

- [ ] [First step]`,
  },
  {
    id: 'braindump',
    title: 'Braindump',
    description: "Unstructured catch-all for anything that doesn't fit elsewhere",
    isEnabled: true,
    defaultFolder: 'Others/',
    requireTags: false,
    format: `

# Braindump — [date]

[Write anything here, no structure needed]`,
  },
  {
    id: 'credentials',
    title: 'Sensitive Credentials',
    description: 'Store passwords, API keys, and other sensitive credentials',
    isEnabled: true,
    defaultFolder: 'Credentials/',
    requireTags: false,
    format: `
# Sensitive Credentials

Platform Name:
Type:
Value:
Note: `,
  },
  {
    id: 'article',
    title: 'Article',
    description: 'Long-form content for blogs, articles, stories, and narration',
    isEnabled: true,
    defaultFolder: 'Articles/',
    requireTags: true,
    format: `
# [Article Title]

## Introduction

[Hook or opening paragraph that draws the reader in]

## Main Content

[Your main content here. Use headings to organize sections.]

### Section 1

[Content for this section]

### Section 2

[Content for this section]

## Conclusion

[Wrap up your thoughts and key takeaways]

---

**Notes:**
- [Any additional notes or references]`,
  },
]
