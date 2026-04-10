import type { SchemaObject } from '../agent/CognitiveRunner.js'

export interface QuestionCategory {
  id: string
  label: string
  learningFile: string   // which dense learning file receives results
  prompt: (documentText: string) => string
  schema: SchemaObject
  example: object
}

const findingsSchema: SchemaObject = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      items: { type: 'string' },
    },
  },
  required: ['findings'],
}

export const QUESTION_BATTERY: QuestionCategory[] = [
  {
    id: 'character',
    label: 'Character & Personality',
    learningFile: 'character',
    prompt: (text) => `Read this document and extract observations about the writer's character and personality.
Look for: emotional states, how they handle difficulty or setbacks, patience, anxiety, confidence, curiosity,
values they express, habits of mind, self-awareness, and recurring attitudes.
Only include observations directly evidenced by the text — do not infer or assume.
Return JSON with a "findings" array of short, specific strings (each 1-2 sentences).

Document:
${text}`,
    schema: findingsSchema,
    example: {
      findings: [
        'Shows patience — spent 3 weeks on a hard problem without giving up',
        'Felt anxious about the upcoming investor meeting',
        'Curious about how Elixir handles concurrency under load',
      ],
    },
  },

  {
    id: 'facts',
    label: 'Facts & Preferences',
    learningFile: 'facts',
    prompt: (text) => `Read this document and extract concrete, factual details about the writer.
Look for: where they live, what tools/languages/frameworks they use, dietary preferences, schedule habits,
physical details, skills mentioned, things they like or dislike, possessions, and recurring factual statements.
Only include facts clearly stated in the text.
Return JSON with a "findings" array of short, specific strings.

Document:
${text}`,
    schema: findingsSchema,
    example: {
      findings: [
        'Uses Elixir for the backend of the current project',
        'Dislikes JavaScript tooling',
        'Wakes up early — mentioned a 6am work session',
      ],
    },
  },

  {
    id: 'people',
    label: 'People & Relationships',
    learningFile: 'people',
    prompt: (text) => `Read this document and extract information about the people mentioned.
For each person: their name (if given), how they relate to the writer (colleague, friend, family, etc.),
and what is said or implied about them or their relationship with the writer.
Return JSON with a "findings" array, one entry per notable person-mention.

Document:
${text}`,
    schema: findingsSchema,
    example: {
      findings: [
        'Mentions "Alice" — unclear relationship, seems to be a collaborator on the project',
        'References a co-founder who is handling investor relations',
        'Alex described as a mentor who gave advice on the architecture decision',
      ],
    },
  },

  {
    id: 'work',
    label: 'Work & Projects',
    learningFile: 'projects',
    prompt: (text) => `Read this document and extract information about the writer's work and projects.
Look for: project names, what the project does, current status, blockers, milestones, decisions made,
technologies used, collaborators involved, and any next steps mentioned.
Return JSON with a "findings" array of specific strings.

Document:
${text}`,
    schema: findingsSchema,
    example: {
      findings: [
        'Working on a crypto-related project — specific domain unclear',
        'Architecture decision: chose event sourcing over a traditional CRUD approach',
        'Next step: deploy to staging before the end of the week',
      ],
    },
  },

  {
    id: 'goals',
    label: 'Goals & Plans',
    learningFile: 'goals',
    prompt: (text) => `Read this document and extract the writer's goals, intentions, and plans.
Look for: things they want to achieve, timelines mentioned, explicit plans, aspirations, things they
intend to learn or build, and recurring motivations.
Return JSON with a "findings" array of specific strings.

Document:
${text}`,
    schema: findingsSchema,
    example: {
      findings: [
        'Wants to launch a beta by Q3',
        'Intends to learn more about distributed systems',
        'Planning to reach out to potential early adopters next month',
      ],
    },
  },

  {
    id: 'beliefs',
    label: 'Beliefs & Worldview',
    learningFile: 'beliefs',
    prompt: (text) => `Read this document and extract the writer's beliefs, opinions, and worldview.
Look for: things they assert as true about the world, opinions about technology, people, or society,
philosophical stances, recurring values, and how they frame problems or decisions.
Return JSON with a "findings" array of specific strings.

Document:
${text}`,
    schema: findingsSchema,
    example: {
      findings: [
        'Believes simplicity in system design is more valuable than premature optimisation',
        'Skeptical of large companies — prefers working with small, focused teams',
        'Values deep work and mentions protecting uninterrupted time as important',
      ],
    },
  },

  {
    id: 'open_questions',
    label: 'Open Questions',
    learningFile: 'open_questions',
    prompt: (text) => `Read this document and identify things that are unclear, ambiguous, or that raise questions
about the writer's life, work, or relationships.
For each question, suggest the best way to answer it:
- "internal_vault": the answer might already exist in other notes
- "web": would require a web search
- "ask_human": only the writer can answer this

Return JSON with a "questions" array.

Document:
${text}`,
    schema: {
      type: 'object',
      properties: {
        questions: {
          type: 'array',
          items: {
            type: 'object' as const,
            properties: {
              question: { type: 'string' },
              search_method: { type: 'string' },
            },
          },
        },
      },
      required: ['questions'],
    } as SchemaObject,
    example: {
      questions: [
        { question: 'Who is "Alice"? She is mentioned frequently but never described.', search_method: 'internal_vault' },
        { question: 'What does the crypto project do specifically?', search_method: 'internal_vault' },
        { question: 'What is event sourcing and why was it chosen over CRUD here?', search_method: 'web' },
        { question: "What is the writer's timeline for the beta launch?", search_method: 'ask_human' },
      ],
    },
  },
]
