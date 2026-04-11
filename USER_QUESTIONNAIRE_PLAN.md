# User Questionnaire System

## Overview
A progressive user profiling system that gathers information about the user through engaging questions displayed in the dashboard. This allows the agent to personalize its behavior and feel more relatable to the user.

## Core Concept
Instead of a traditional onboarding form, we present one question at a time in the dashboard as a card. Users can answer, skip, or dismiss questions. Well-crafted questions serve dual purposes:
1. Entertainment/engagement (hot takes, personality quizzes)
2. Data collection for agent personalization

## Question Bank Structure

### Question Schema
```typescript
interface Question {
  id: string;
  category: QuestionCategory;
  text: string;
  type: 'multiple-choice' | 'scale' | 'text' | 'boolean';
  options?: string[]; // for multiple-choice
  scaleRange?: { min: number; max: number; labels?: string[] }; // for scale
  agentBehaviorImpact: string[]; // what agent behaviors this informs
  priority: number; // 1-10, higher = more important
  followUpQuestions?: string[]; // IDs of related questions
  tags: string[];
}

enum QuestionCategory {
  COMMUNICATION_STYLE = 'communication_style',
  WORK_PATTERNS = 'work_patterns',
  TECHNICAL_PREFERENCES = 'technical_preferences',
  PERSONALITY = 'personality',
  HOT_TAKES = 'hot_takes',
  CREATIVE_PREFERENCES = 'creative_preferences',
  LEARNING_STYLE = 'learning_style'
}
```

### User Response Schema
```typescript
interface UserResponse {
  questionId: string;
  answer: string | number | boolean;
  timestamp: Date;
  skipped: boolean;
  dismissed: boolean; // permanently dismissed
}

interface UserProfile {
  responses: UserResponse[];
  derivedTraits: {
    communicationStyle: {
      verbosity: 'concise' | 'detailed' | 'balanced';
      formality: 'casual' | 'professional' | 'mixed';
      emojiUsage: 'none' | 'occasional' | 'frequent';
    };
    workStyle: {
      timePreference: 'morning' | 'afternoon' | 'evening' | 'night';
      focusMode: 'deep-work' | 'multitasker' | 'flexible';
    };
    technicalProfile: {
      experienceLevel: 'beginner' | 'intermediate' | 'expert';
      preferredLanguages: string[];
      codingPhilosophy: string[];
    };
    personality: {
      riskTolerance: 'conservative' | 'moderate' | 'adventurous';
      decisionMaking: 'analytical' | 'intuitive' | 'collaborative';
      humorStyle: string[];
    };
  };
  lastQuestionShown: Date;
  questionsAnswered: number;
  questionsSkipped: number;
  questionsDismissed: number;
}
```

## Question Examples by Category

### Communication Style
- "How do you prefer responses from AI assistants?"
  - Options: "Brief and to the point", "Detailed with explanations", "Balanced mix"
  - Impact: Response verbosity, explanation depth

- "What's your take on emojis in professional communication?"
  - Options: "Love them! 😍", "Occasionally okay 👍", "Keep it professional 📋", "Absolutely not ❌"
  - Impact: Emoji usage in agent responses

- "When you ask a question, you want:"
  - Options: "Just the answer", "Answer + why it works", "Answer + alternatives + tradeoffs"
  - Impact: Response structure, context provision

### Work Patterns
- "When do you do your best work?"
  - Options: "Early morning (5-9am)", "Mid-day (9am-5pm)", "Evening (5-10pm)", "Night owl (10pm-5am)"
  - Impact: Notification timing, energy-aware suggestions

- "Your ideal work session is:"
  - Options: "Deep focus, 2+ hours", "Focused sprints, 25-50 min", "Flexible, as needed"
  - Impact: Task batching, interruption sensitivity

- "How do you handle context switching?"
  - Options: "Hate it, need focus time", "Fine with it", "Thrive on variety"
  - Impact: Multi-tasking suggestions, task organization

### Technical Preferences
- "Tabs or spaces?"
  - Options: "Tabs", "Spaces", "Whatever the project uses", "I have strong opinions about this"
  - Impact: Code style awareness, humor calibration

- "Your testing philosophy:"
  - Options: "TDD all the way", "Test after implementation", "Test critical paths only", "YOLO"
  - Impact: Testing suggestions, code review focus

- "When learning a new technology, you prefer:"
  - Options: "Official docs", "Tutorials/courses", "Jump in and break things", "Examples and code snippets"
  - Impact: Learning resource suggestions, explanation style

- "Your relationship with TypeScript:"
  - Options: "Love the safety", "Necessary evil", "Avoid when possible", "JavaScript forever"
  - Impact: Type safety suggestions, language recommendations

### Personality
- "When facing a bug you can't solve:"
  - Options: "Debug systematically", "Google/Stack Overflow", "Take a break and come back", "Ask for help immediately"
  - Impact: Debugging assistance style, help timing

- "Your approach to new features:"
  - Options: "Plan everything first", "Rough plan, iterate", "Start coding, figure it out", "Prototype first"
  - Impact: Planning suggestions, architecture guidance

- "Code review feedback style you prefer:"
  - Options: "Direct and blunt", "Constructive with examples", "Gentle suggestions", "Socratic questions"
  - Impact: Agent feedback tone, critique style

### Hot Takes
- "The best programming paradigm:"
  - Options: "OOP", "Functional", "Procedural", "Whatever solves the problem"
  - Impact: Code structure suggestions, pattern recommendations

- "Comments in code are:"
  - Options: "Essential documentation", "For complex logic only", "Code smell (code should be self-documenting)", "Necessary evil"
  - Impact: Documentation suggestions, code clarity expectations

- "Premature optimization is:"
  - Options: "The root of all evil", "Sometimes necessary", "Always worth considering", "My default mode"
  - Impact: Performance suggestions timing, optimization guidance

- "The ideal function length:"
  - Options: "One screen max", "Single responsibility, any length", "Short as possible", "No hard rules"
  - Impact: Refactoring suggestions, code organization

### Creative Preferences
- "Your note-taking style:"
  - Options: "Structured outlines", "Free-form thoughts", "Visual/diagrams", "Minimal bullet points"
  - Impact: Note template suggestions, organization style

- "When brainstorming, you prefer:"
  - Options: "Solo thinking time", "Talking it out", "Writing/diagramming", "Mix of all"
  - Impact: Ideation assistance style, collaboration approach

### Learning Style
- "You learn best through:"
  - Options: "Reading documentation", "Video tutorials", "Hands-on practice", "Teaching others"
  - Impact: Resource recommendations, explanation format

- "When stuck, you want the agent to:"
  - Options: "Give me the answer", "Guide me with hints", "Explain the concept first", "Show similar examples"
  - Impact: Help delivery style, scaffolding approach

## Display Logic

### Question Rotation Algorithm
1. **Priority-based selection**: Higher priority questions shown first
2. **Category balancing**: Don't show too many from same category consecutively
3. **Adaptive follow-ups**: If user answers a question, show related follow-ups sooner
4. **Skip tracking**: Questions skipped 3+ times get lower priority
5. **Cooldown period**: Don't show questions more than once per day (configurable)

### Display Rules
- Show one question at a time in dashboard
- Question card should be:
  - Visually lightweight and non-intrusive
  - Easy to answer (1-2 clicks for most questions)
  - Clearly dismissible
  - Show progress indicator (e.g., "12 questions answered")
- Don't show questions during critical workflows
- Respect user's "do not disturb" or focus mode

### Response Handling
- **Answered**: Save response, update user profile, show next question after cooldown
- **Skipped**: Increment skip counter, show again later with lower priority
- **Dismissed**: Never show this specific question again
- **"Tell me more"**: Option to see why we're asking and how it helps

## Agent Behavior Integration

### How Responses Inform Agent Behavior

#### Communication Style
- **Verbosity preference** → Adjust response length
- **Formality** → Tone and language choice
- **Emoji usage** → Include/exclude emojis
- **Explanation depth** → How much context to provide

#### Work Patterns
- **Time preference** → Schedule suggestions, notification timing
- **Focus mode** → Batch suggestions, interruption sensitivity
- **Context switching** → Task organization approach

#### Technical Preferences
- **Languages/frameworks** → Code examples, suggestions
- **Testing philosophy** → When to suggest tests
- **Learning style** → How to explain concepts

#### Personality
- **Risk tolerance** → Experimental vs. conservative suggestions
- **Decision making** → How much analysis to provide
- **Humor style** → Tone and personality in responses

### Profile Confidence Levels
Track confidence in derived traits based on:
- Number of related questions answered
- Consistency of answers
- Behavioral observations (e.g., user always dismisses verbose responses)

```typescript
interface TraitConfidence {
  trait: string;
  confidence: number; // 0-1
  basedOn: string[]; // question IDs
  observedBehavior?: string[]; // behavioral confirmations
}
```

## UI/UX Design

### Dashboard Question Card
```
┌─────────────────────────────────────────┐
│ 🎯 Get to know you better              │
│                                         │
│ How do you prefer AI responses?        │
│                                         │
│ ○ Brief and to the point               │
│ ○ Detailed with explanations           │
│ ○ Balanced mix                         │
│                                         │
│ [Skip] [Why ask this?] [Never show]    │
│                                         │
│ 12 questions answered • 3 skipped      │
└─────────────────────────────────────────┘
```

### Profile View (Optional)
Show users their profile and how it affects agent behavior:
- Answered questions
- Derived traits
- Impact examples ("Because you prefer concise responses, I keep answers brief")
- Option to edit/reset responses

## Implementation Phases

### Phase 1: Foundation
- [ ] Create question bank JSON/database
- [ ] Implement question schema and validation
- [ ] Build user profile storage
- [ ] Create basic question rotation logic

### Phase 2: Dashboard Integration
- [ ] Design question card component
- [ ] Implement display logic
- [ ] Add response handling
- [ ] Create skip/dismiss functionality

### Phase 3: Agent Integration
- [ ] Define trait derivation logic
- [ ] Implement behavior modification based on profile
- [ ] Add confidence tracking
- [ ] Create feedback loop (observe user reactions)

### Phase 4: Enhancement
- [ ] Add "why ask this?" explanations
- [ ] Implement profile view
- [ ] Create question analytics (which questions get answered/skipped)
- [ ] Add adaptive follow-up logic
- [ ] Implement behavioral observation (e.g., user always edits verbose responses to be shorter)

### Phase 5: Refinement
- [ ] A/B test question phrasing
- [ ] Optimize rotation algorithm
- [ ] Add seasonal/contextual questions
- [ ] Implement profile export/import
- [ ] Create question authoring tools

## Initial Question Bank (Starter Set)

### High Priority (Core Profile)
1. Response verbosity preference
2. Time of day preference
3. Technical experience level
4. Preferred programming languages
5. Testing philosophy
6. Learning style preference
7. Emoji usage preference
8. Explanation depth preference

### Medium Priority (Refinement)
9. Code review feedback style
10. Planning vs. iteration preference
11. Focus mode preference
12. Decision-making style
13. Risk tolerance
14. Context switching tolerance
15. Note-taking style
16. Debugging approach

### Low Priority (Nice to Have)
17. Tabs vs. spaces
18. Comment philosophy
19. Optimization timing
20. Function length preference
21. Brainstorming style
22. Humor preferences
23. Programming paradigm preference
24. Documentation preferences

## Privacy & Ethics

### Principles
- **Transparency**: Users know what data is collected and why
- **Control**: Users can view, edit, delete their profile anytime
- **Local storage**: All profile data stays on user's machine
- **No tracking**: Questions are for personalization only, not analytics
- **Opt-out**: Easy to disable questionnaire system entirely

### Data Handling
- Store in local database (SQLite/JSON)
- No external transmission
- Include in backup/export features
- Clear data retention policy

## Success Metrics

### Engagement
- Question answer rate (target: >60%)
- Questions per user (target: >10 in first week)
- Skip rate (target: <30%)
- Dismiss rate (target: <10%)

### Quality
- Profile confidence levels (target: >0.7 for core traits)
- User satisfaction with personalization
- Behavioral consistency (answers match observed behavior)

### Impact
- Agent response quality ratings
- User retention
- Feature usage correlation with profile completeness

## Future Enhancements

### Dynamic Questions
- Generate questions based on user's actual work
- "I noticed you often work with React. Do you prefer hooks or class components?"

### Collaborative Profiles
- Share anonymized profiles to improve question quality
- Community-contributed questions

### Temporal Profiles
- Track how preferences change over time
- Seasonal adjustments (e.g., different work patterns in summer)

### Multi-Agent Profiles
- Different profiles for different agent personas
- Context-aware profile switching

### Gamification
- Achievements for profile completion
- Unlock features with more answers
- Profile completeness badges

## Technical Considerations

### Storage
- Use existing database infrastructure
- Index by category, priority, user response status
- Efficient querying for rotation algorithm

### Performance
- Lazy load question bank
- Cache current question
- Async profile updates

### Extensibility
- Plugin system for custom questions
- API for third-party question packs
- Question versioning for updates

## Open Questions

1. Should we show multiple questions at once (e.g., 3 quick questions)?
2. How to handle conflicting answers (user changes mind)?
3. Should questions expire/refresh over time?
4. Integration with onboarding flow vs. pure dashboard?
5. Voice/conversational question format as alternative?
6. Should agent proactively ask questions in conversation when relevant?
