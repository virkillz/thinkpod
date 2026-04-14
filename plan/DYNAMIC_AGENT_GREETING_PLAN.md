# Dynamic Agent Greeting System - Technical Implementation Plan

## Overview

Transform the static agent greeting into a context-aware, dynamic system that responds intelligently to user actions, application state, and content. The agent will feel more alive by generating personalized, timely messages that enhance user engagement.

## Goals

1. **Context-Aware Messaging**: Agent greetings adapt based on current view, user actions, and content state
2. **LLM-Powered Generation**: Use LLM to generate natural, varied responses for specific contexts
3. **Extensible Architecture**: Easy to add new triggers and message types
4. **Performance**: Minimal impact on UI responsiveness
5. **Personality Consistency**: Maintain agent's voice and character across all messages

## Architecture

### Core Components

#### 1. **Agent Greeting Service** (`src/main/agent/AgentGreetingService.ts`)

Central service running in the main process that:
- Monitors application state changes via IPC
- Determines when to show greetings based on triggers
- Manages greeting generation strategies (static vs LLM)
- Caches recent messages to avoid repetition
- Rate-limits greeting frequency to prevent spam

**Key Responsibilities:**
- Event subscription and filtering
- Context aggregation
- Message generation orchestration
- Cooldown/throttling logic

#### 2. **Greeting Context Analyzer** (`src/main/agent/GreetingContextAnalyzer.ts`)

Analyzes current application state to build context for message generation:
- Current view and navigation history
- File/thought counts and states
- Time of day, session duration
- Recent user actions
- Content metadata (e.g., thought count, note length)

**Output:** Structured context object with:
```typescript
interface GreetingContext {
  trigger: GreetingTrigger
  view: string
  metadata: {
    thoughtCount?: number
    hasUnfinishedThoughts?: boolean
    selectedNote?: {
      title: string
      wordCount: number
      lastModified: Date
    }
    timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night'
    sessionDuration: number
  }
  userProfile: {
    name: string
    preferences?: Record<string, any>
  }
}
```

#### 3. **Message Generator** (`src/main/agent/MessageGenerator.ts`)

Handles message generation with multiple strategies:

**Strategy Pattern:**
- `StaticMessageStrategy`: Pre-written messages for common scenarios
- `TemplateMessageStrategy`: Template-based with variable substitution
- `LLMMessageStrategy`: LLM-generated contextual messages

**Message Types:**
```typescript
type MessageType = 
  | 'welcome'           // Initial app load
  | 'encouragement'     // Unfinished thoughts
  | 'appreciation'      // After completing actions
  | 'observation'       // Contextual comments on content
  | 'reminder'          // Gentle nudges
  | 'celebration'       // Achievements/milestones
```

#### 4. **Greeting Trigger System** (`src/main/agent/triggers/`)

Event-based trigger system with individual trigger handlers:

**Trigger Types:**
```typescript
interface GreetingTrigger {
  id: string
  type: TriggerType
  condition: (context: AppContext) => boolean
  priority: number
  cooldown: number // milliseconds
  messageType: MessageType
  useStrategy: 'static' | 'template' | 'llm'
}
```

**Built-in Triggers:**
- `ViewChangeTrigger`: Fires when user navigates to different views
- `ThoughtStateTrigger`: Monitors thought folder state
- `NoteOpenTrigger`: When user opens a note
- `IdleTimeTrigger`: After period of inactivity
- `AchievementTrigger`: Completing tasks (inbox zero, etc.)

#### 5. **Greeting State Manager** (`src/main/agent/GreetingStateManager.ts`)

Manages greeting display state and history:
- Tracks last shown message and timestamp
- Maintains cooldown timers per trigger type
- Stores message history to avoid repetition
- Manages dismissal and interaction tracking

#### 6. **LLM Prompt Templates** (`src/main/agent/greeting-prompts.ts`)

Specialized prompts for different greeting scenarios:

```typescript
const GREETING_PROMPTS = {
  unfinishedThought: `You are {agentName}, a thoughtful writing companion. The user {userName} has {count} unfinished thought(s) in their inbox. Generate a brief, encouraging message (max 15 words) that gently nudges them to complete their thoughts. Be warm, not pushy. Match this tone: casual, supportive, slightly playful.`,
  
  noteAppreciation: `You are {agentName}. The user just opened a note titled "{noteTitle}" with {wordCount} words. Generate a brief, genuine comment (max 12 words) about their writing. Be specific if possible, encouraging, and authentic. Avoid generic praise.`,
  
  // ... more prompts
}
```

### Frontend Integration

#### 7. **Enhanced AgentFAB Component** (`src/renderer/src/components/shell/AgentFAB.tsx`)

Update to consume dynamic greetings:

```typescript
interface DynamicGreeting {
  id: string
  message: string
  type: MessageType
  timestamp: number
  dismissible: boolean
  actionButton?: {
    label: string
    action: () => void
  }
}
```

**Changes:**
- Subscribe to greeting events via IPC
- Display greetings with appropriate styling per type
- Handle user interactions (dismiss, click actions)
- Animate entrance/exit based on message priority

#### 8. **Greeting Display Queue** (`src/renderer/src/hooks/useGreetingQueue.ts`)

Custom hook to manage greeting display:
- Queue multiple greetings if they arrive simultaneously
- Prioritize by importance
- Handle timing and transitions
- Prevent overlapping messages

### IPC Communication

#### 9. **IPC Channels** (`src/main/ipc/greeting-handlers.ts`)

New IPC handlers for greeting system:

```typescript
// Main → Renderer
'greeting:show' - Send greeting to display
'greeting:hide' - Hide current greeting

// Renderer → Main
'greeting:dismissed' - User dismissed greeting
'greeting:interacted' - User clicked greeting action
'greeting:context-update' - Send context updates (view change, etc.)
```

### Data Flow

```
User Action (View Change, File Open, etc.)
    ↓
AppStore State Change
    ↓
IPC Event → Main Process
    ↓
AgentGreetingService receives event
    ↓
GreetingContextAnalyzer builds context
    ↓
Trigger System evaluates conditions
    ↓
[If triggered]
    ↓
GreetingStateManager checks cooldown/history
    ↓
MessageGenerator selects strategy
    ↓
[If LLM strategy]
    ↓
LLMClient generates message
    ↓
Message sent via IPC to Renderer
    ↓
AgentFAB displays greeting
```

## Implementation Phases

### Phase 1: Foundation (Core Infrastructure)
**Goal:** Build the basic architecture without LLM integration

**Tasks:**
1. Create `AgentGreetingService` skeleton
2. Implement `GreetingStateManager` with cooldown logic
3. Create `GreetingContext` and `GreetingContextAnalyzer`
4. Build static `MessageGenerator` with template strategy
5. Set up IPC channels for greeting communication
6. Update `AgentFAB` to receive and display dynamic greetings

**Deliverable:** Static context-aware greetings working

### Phase 2: Trigger System
**Goal:** Implement event-based trigger architecture

**Tasks:**
1. Create base `GreetingTrigger` interface and registry
2. Implement core triggers:
   - `ViewChangeTrigger`
   - `ThoughtStateTrigger`
   - `NoteOpenTrigger`
3. Add trigger evaluation logic to `AgentGreetingService`
4. Create trigger configuration system
5. Add trigger priority and cooldown handling

**Deliverable:** Multiple triggers working with static messages

### Phase 3: LLM Integration
**Goal:** Add AI-generated contextual messages

**Tasks:**
1. Create `LLMMessageStrategy` class
2. Write greeting-specific prompts in `greeting-prompts.ts`
3. Implement context-to-prompt conversion
4. Add LLM response parsing and validation
5. Implement fallback to static messages on LLM failure
6. Add message caching to reduce LLM calls

**Deliverable:** LLM-generated greetings for key scenarios

### Phase 4: Advanced Features
**Goal:** Polish and enhance user experience

**Tasks:**
1. Implement greeting queue in frontend
2. Add interactive greeting actions (buttons)
3. Create greeting analytics/tracking
4. Add user preferences for greeting frequency
5. Implement smart cooldown (context-aware timing)
6. Add A/B testing framework for message effectiveness

**Deliverable:** Production-ready dynamic greeting system

### Phase 5: Content Analysis & Personalization
**Goal:** Deep content understanding for better messages

**Tasks:**
1. Add content analysis for notes (sentiment, topics)
2. Implement user behavior learning
3. Create personalized message templates
4. Add seasonal/time-based variations
5. Implement achievement detection system

**Deliverable:** Highly personalized, context-aware agent

## Technical Specifications

### Message Generation Guidelines

**Static Messages:**
- Pre-written for common, predictable scenarios
- Fast, no API calls
- Used as fallbacks

**Template Messages:**
- Variable substitution (e.g., `{userName}`, `{count}`)
- Quick generation
- Good for semi-dynamic content

**LLM Messages:**
- For complex, nuanced contexts
- Requires context-rich prompts
- Cached aggressively
- Max 15-20 words to maintain brevity

### Performance Targets

- **Greeting Display Latency:** < 100ms for static, < 500ms for LLM
- **Cooldown Default:** 5 minutes between greetings
- **LLM Cache Hit Rate:** > 60% for common scenarios
- **Memory Footprint:** < 5MB for greeting service

### Configuration

Create `greeting-config.json` for easy tuning:

```json
{
  "enabled": true,
  "defaultCooldown": 300000,
  "maxQueueSize": 3,
  "llmStrategy": {
    "enabled": true,
    "maxTokens": 30,
    "temperature": 0.8,
    "cacheExpiry": 3600000
  },
  "triggers": {
    "viewChange": { "enabled": true, "cooldown": 180000 },
    "thoughtState": { "enabled": true, "cooldown": 600000 },
    "noteOpen": { "enabled": true, "cooldown": 300000 }
  }
}
```

## Example Scenarios

### Scenario 1: Unfinished Thoughts
**Trigger:** User opens ThoughtsView with 3 unfinished thoughts
**Context:**
```typescript
{
  trigger: 'view-change',
  view: 'thoughts',
  metadata: {
    thoughtCount: 3,
    hasUnfinishedThoughts: true,
    timeOfDay: 'morning'
  }
}
```
**Static Message:** "You have 3 thoughts waiting. Let's triage them!"
**LLM Message:** "C'mon Sarah... finish those 3 thoughts! 🎯"

### Scenario 2: Opening a Note
**Trigger:** User opens note "My Writing Goals"
**Context:**
```typescript
{
  trigger: 'note-open',
  view: 'notes',
  metadata: {
    selectedNote: {
      title: 'My Writing Goals',
      wordCount: 847,
      lastModified: '2026-04-10'
    }
  }
}
```
**LLM Message:** "Solid goals here. Time to make them happen?"

### Scenario 3: Inbox Zero
**Trigger:** User triages last thought
**Context:**
```typescript
{
  trigger: 'achievement',
  view: 'thoughts',
  metadata: {
    thoughtCount: 0,
    previousCount: 1,
    achievement: 'inbox-zero'
  }
}
```
**LLM Message:** "Inbox zero! Your mind must feel lighter. ✨"

## Extension Points

### Custom Triggers
Developers can add new triggers by extending `BaseTrigger`:

```typescript
class CustomTrigger extends BaseTrigger {
  evaluate(context: GreetingContext): boolean {
    // Custom logic
  }
}
```

### Custom Message Strategies
New generation strategies via interface:

```typescript
interface MessageStrategy {
  generate(context: GreetingContext): Promise<string>
  canHandle(context: GreetingContext): boolean
}
```

### Plugin System (Future)
Allow third-party greeting plugins:
- Custom triggers
- Custom message generators
- Custom UI components

## Testing Strategy

### Unit Tests
- Trigger condition evaluation
- Message generation strategies
- Cooldown logic
- Context analysis

### Integration Tests
- IPC communication flow
- End-to-end greeting display
- LLM integration with mocks

### User Testing
- A/B test message variations
- Track dismissal rates
- Measure engagement with interactive greetings

## Security & Privacy

- **No PII in LLM Prompts:** Sanitize sensitive data
- **Local-First:** All processing in main process
- **Opt-Out:** User preference to disable greetings
- **Rate Limiting:** Prevent excessive LLM API calls

## Migration Path

1. **Phase 1:** Add new system alongside existing static greeting
2. **Phase 2:** Feature flag to enable dynamic greetings
3. **Phase 3:** Gradual rollout with monitoring
4. **Phase 4:** Deprecate old static system

## Success Metrics

- **User Engagement:** Click-through rate on greeting actions
- **Dismissal Rate:** < 30% dismissal rate indicates good relevance
- **Session Quality:** Increased time spent on productive actions
- **User Feedback:** Qualitative feedback on agent personality

## Future Enhancements

1. **Multi-Modal Greetings:** Voice, animations, visual effects
2. **Conversation Memory:** Remember past interactions
3. **Proactive Suggestions:** "You haven't written in 3 days..."
4. **Collaborative Features:** "Your team added 5 new notes"
5. **Learning System:** Improve messages based on user responses
6. **Emotion Detection:** Adapt tone based on content sentiment

## File Structure

```
src/main/agent/
├── greeting/
│   ├── AgentGreetingService.ts
│   ├── GreetingContextAnalyzer.ts
│   ├── GreetingStateManager.ts
│   ├── MessageGenerator.ts
│   ├── greeting-prompts.ts
│   ├── greeting-config.json
│   ├── strategies/
│   │   ├── StaticMessageStrategy.ts
│   │   ├── TemplateMessageStrategy.ts
│   │   └── LLMMessageStrategy.ts
│   └── triggers/
│       ├── BaseTrigger.ts
│       ├── ViewChangeTrigger.ts
│       ├── ThoughtStateTrigger.ts
│       ├── NoteOpenTrigger.ts
│       ├── IdleTimeTrigger.ts
│       └── AchievementTrigger.ts
│
src/main/ipc/
└── greeting-handlers.ts

src/renderer/src/
├── components/shell/
│   └── AgentFAB.tsx (enhanced)
├── hooks/
│   └── useGreetingQueue.ts
└── types/
    └── greeting.ts
```

## Dependencies

**New:**
- None (uses existing LLMClient)

**Existing:**
- `zustand` (state management)
- Existing LLM infrastructure
- IPC system

## Estimated Effort

- **Phase 1:** 2-3 days
- **Phase 2:** 2-3 days
- **Phase 3:** 3-4 days
- **Phase 4:** 2-3 days
- **Phase 5:** 4-5 days

**Total:** ~15-20 days for full implementation

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| LLM latency affects UX | High | Aggressive caching, fallback to static |
| Greetings feel spammy | Medium | Smart cooldowns, user preferences |
| LLM costs increase | Medium | Rate limiting, caching, local models option |
| Context gathering impacts performance | Low | Async processing, debouncing |
| Messages feel generic | Medium | Better prompts, user feedback loop |

## Conclusion

This implementation plan provides a solid foundation for creating a dynamic, context-aware agent greeting system that can grow with the application. The phased approach allows for incremental development and testing, while the extensible architecture ensures future enhancements can be added easily.

The system will make the agent feel more alive and engaged with the user's work, enhancing the overall experience of using ThinkPod.
