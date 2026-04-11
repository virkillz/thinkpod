# Wilfred - Your AI Agent

Wilfred is ThinkPod's integrated AI agent — your always-on thinking partner who lives inside your notes.

## What Makes Wilfred Different?

### Not Just a Chatbot

Most AI assistants are reactive: you ask, they answer, conversation ends. Wilfred is **proactive**:

- **Reads automatically**: When you open a document, Wilfred reads it
- **Thinks continuously**: Runs background tasks while you work or sleep
- **Sends insights**: Proactively messages you with research, summaries, connections
- **Remembers everything**: Builds understanding of your entire vault over time
- **Context-aware**: Knows what you're working on and adapts responses

### The Analogy

Imagine a brilliant research assistant who:
- Lives in your library
- Reads everything you've written
- Thinks about it while you sleep
- Leaves you notes in the morning
- Asks clarifying questions when you're stuck
- Connects ideas you would have missed

That's Wilfred.

## Core Capabilities

### 1. Document Discussion

Open any note and chat with Wilfred about it:
- **Summarize**: "Give me the key points"
- **Critique**: "What's weak about this argument?"
- **Rewrite**: "Make this more concise"
- **Expand**: "Add examples to this section"
- **Question**: "What does this mean?"

Wilfred automatically has the full document context — no need to paste text.

### 2. Vault-Wide Understanding

Wilfred doesn't just see one note at a time:
- Searches across your entire vault
- Finds connections between notes
- Surfaces related ideas from months ago
- Builds a mental model of your knowledge graph

### 3. Proactive Inbox

Wilfred sends you messages without being asked:
- Research summaries on topics you're exploring
- Suggestions for organizing drafts
- Connections between recent notes
- Reminders about unfinished thoughts

Access the inbox via `Cmd+J` or the sidebar.

### 4. Scheduled Tasks

Tell Wilfred to run tasks on a schedule:
- **Triage drafts**: Categorize unfinished notes
- **Research topics**: Investigate questions overnight
- **Summarize journals**: Weekly summaries of your writing
- **Archive old notes**: Move completed projects

### 5. Internet Search

Wilfred can search the web and bring back insights:
- "Research the latest on quantum computing"
- "Find examples of this design pattern"
- "What's the current thinking on this topic?"

Results are summarized and sent to your inbox.

## How to Use Wilfred

### Opening the Agent Chat

- **Keyboard**: `Cmd+J` (Mac) or `Ctrl+J` (Windows/Linux)
- **Sidebar**: Click the chat icon
- **Context**: Wilfred automatically reads the currently open document

### Sending Messages

- **Type** your message in the input box
- **Press Enter** to send
- **Shift+Enter** for a new line without sending
- **Up arrow** (when input is empty) to edit your last message

### Closing the Chat

- **Keyboard**: `Esc`
- **Click** outside the panel
- **Toggle**: `Cmd+J` again

## Wilfred's Personality

Wilfred is designed to be:
- **Thoughtful**: Takes time to give considered responses
- **Curious**: Asks clarifying questions when needed
- **Helpful**: Focuses on making your writing better
- **Respectful**: Suggests, doesn't dictate
- **Honest**: Admits uncertainty rather than guessing

## Privacy & Control

### What Wilfred Can See

- All documents in your vault
- Your chat history with him
- Scheduled tasks and preferences
- Metadata (tags, categories, dates)

### What Wilfred Cannot See

- Files outside your vault
- Browser history or other apps
- System files or personal data
- Anything you don't write in ThinkPod

### Where Wilfred Runs

- **Local models**: Everything stays on your machine
- **Cloud providers**: Only the specific messages/documents you discuss are sent
- **Your choice**: Configure in Settings → Inference

## Configuring Wilfred

### AI Provider

Go to **Settings → Inference** to configure:
- **Base URL**: Where the AI runs (e.g., `http://localhost:11434/v1` for Ollama)
- **Model**: Which model to use (e.g., `llama3.2`, `gpt-4o`)
- **API Key**: Only needed for cloud providers

See [AI Providers](./ai-providers.md) for detailed setup.

### Voice

Wilfred can transcribe voice memos:
- Go to **Settings → Voice**
- Enable local Whisper transcription
- Use the voice capture feature to dictate notes

See [Voice Capture](./voice-capture.md) for details.

## Tips for Working with Wilfred

### Be Specific

Instead of: "Make this better"
Try: "Make this more concise while keeping the key examples"

### Use Context

Wilfred reads the open document automatically, so:
- "Summarize this" works without pasting text
- "What's the main argument here?" refers to the current note
- "Add a conclusion" knows what document to edit

### Iterate

Wilfred's responses are starting points:
- Ask follow-up questions
- Request revisions
- Combine his ideas with yours

### Schedule Recurring Work

For tasks you do regularly:
- Set up a schedule in **Settings → Tasks**
- Wilfred will run them automatically
- Check the inbox for results

## Limitations

Wilfred is powerful but has limits:

- **Model-dependent**: Quality depends on which AI model you use
- **Context window**: Can't process extremely long documents in one go
- **No file system access**: Can't edit files outside the vault
- **No internet by default**: Must explicitly ask for web search
- **Early development**: Some features still in progress

## Troubleshooting

### Wilfred Not Responding

1. Check **Settings → Inference** — is the Base URL correct?
2. Test the connection — can you reach the AI provider?
3. Check the model name — is it spelled correctly?
4. Look for error messages in the chat

### Slow Responses

- **Local models**: Depends on your hardware (CPU/GPU)
- **Cloud providers**: Check your internet connection
- **Large documents**: Try asking about specific sections

### Poor Quality Answers

- **Upgrade the model**: Larger models (70B+) are more capable
- **Be more specific**: Give Wilfred clearer instructions
- **Provide context**: Explain what you're trying to achieve

## Next Steps

- [AI Providers](./ai-providers.md) - Choose and configure your AI
- [Agent Tasks](./agent-tasks.md) - Schedule Wilfred's work
- [FAQ](./faq.md) - Common questions about Wilfred
