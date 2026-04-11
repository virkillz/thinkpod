# Tech Stack

ThinkPod is built with modern, proven technologies.

## Overview

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Shell** | Electron | Cross-platform desktop app framework |
| **UI** | React 19 + Tailwind CSS | Modern, reactive user interface |
| **Build** | Vite | Fast development and optimized builds |
| **Database** | better-sqlite3 (SQLite) | Local metadata and settings storage |
| **Voice** | nodejs-whisper | Local speech-to-text transcription |
| **AI Runtime** | OpenAI-compatible API | Flexible AI provider integration |

---

## Frontend

### React 19

The latest version of React powers ThinkPod's UI:
- **Concurrent features** for smooth interactions
- **Server Components** (where applicable)
- **Automatic batching** for better performance
- **Hooks** for clean, functional components

### Tailwind CSS

Utility-first CSS framework:
- **Rapid development** with utility classes
- **Consistent design** through design tokens
- **Custom theme** for the parchment aesthetic
- **Responsive** by default

### Lucide Icons

Beautiful, consistent icon set:
- **Tree-shakeable** for small bundle size
- **Customizable** with CSS
- **React components** for easy integration

---

## Backend (Electron Main Process)

### Electron

Cross-platform desktop framework:
- **Node.js** runtime for backend logic
- **Chromium** for rendering UI
- **Native APIs** for file system, OS integration
- **Auto-updater** for seamless updates

### better-sqlite3

Fast, synchronous SQLite library:
- **Local database** for metadata
- **No network dependency**
- **ACID transactions**
- **Full-text search** capabilities

### nodejs-whisper

Local speech-to-text:
- **OpenAI Whisper** models
- **Runs locally** on your machine
- **99+ languages** supported
- **No cloud dependency**

---

## Build System

### Vite

Next-generation frontend tooling:
- **Instant server start** with native ESM
- **Lightning-fast HMR** (Hot Module Replacement)
- **Optimized builds** with Rollup
- **TypeScript support** out of the box

### TypeScript

Type-safe JavaScript:
- **Catch errors** at compile time
- **Better IDE support** with autocomplete
- **Self-documenting** code
- **Refactoring confidence**

---

## AI Integration

### OpenAI-Compatible API

ThinkPod uses the OpenAI API format, enabling:
- **Local models**: Ollama, LM Studio, llama.cpp
- **Cloud providers**: OpenAI, Anthropic, Groq, etc.
- **Flexibility**: Switch providers without code changes
- **Standard interface**: Consistent API across all providers

### Supported Features

- **Chat completions** for conversations
- **Streaming responses** for real-time feedback
- **Function calling** for tool use (coming soon)
- **Embeddings** for semantic search (coming soon)

---

## File System

### Markdown

All notes stored as plain markdown:
- **Human-readable** text format
- **Version control** friendly (Git)
- **Portable** across apps
- **Future-proof** open standard

### SQLite

Metadata storage:
- **Tags** and categories
- **Timestamps** (created, modified)
- **Conversation history** with Wilfred
- **User preferences**

---

## Architecture

### Process Model

Electron uses a multi-process architecture:

```
Main Process (Node.js)
├── File system operations
├── Database queries
├── AI API calls
└── Window management

Renderer Process (Chromium)
├── React UI
├── User interactions
└── IPC with main process
```

### Data Flow

```
User Input
  ↓
React Components
  ↓
IPC (Inter-Process Communication)
  ↓
Main Process
  ↓
File System / Database / AI API
  ↓
IPC Response
  ↓
React State Update
  ↓
UI Re-render
```

---

## Performance

### Optimizations

- **Code splitting** for faster initial load
- **Lazy loading** for large components
- **Virtualized lists** for file tree
- **Debounced saves** to reduce I/O
- **SQLite indexes** for fast queries

### Bundle Size

- **Tree shaking** removes unused code
- **Minification** reduces file size
- **Compression** for production builds

---

## Security

### Electron Security

- **Context isolation** enabled
- **Node integration** disabled in renderer
- **Content Security Policy** enforced
- **IPC validation** for all messages

### Data Security

- **Local-first** by default
- **No telemetry** or tracking
- **User-controlled** AI provider
- **Encrypted storage** via OS features

---

## Platform Support

### Supported Operating Systems

- **macOS** 10.15+ (Catalina and later)
- **Windows** 10/11
- **Linux** (Ubuntu, Fedora, Arch, etc.)

### Architecture

- **x64** (Intel/AMD)
- **arm64** (Apple Silicon, ARM)

---

## Development

### Package Manager

**npm** for dependency management:
- Standard Node.js tooling
- Large ecosystem
- Lock file for reproducible builds

### Code Quality

- **ESLint** for linting
- **Prettier** for formatting (optional)
- **TypeScript** for type checking

### Testing

(Coming soon)
- **Vitest** for unit tests
- **Playwright** for E2E tests

---

## Key Dependencies

```json
{
  "electron": "Latest stable",
  "react": "^19.0.0",
  "tailwindcss": "^3.0.0",
  "better-sqlite3": "Latest",
  "nodejs-whisper": "Latest",
  "lucide-react": "Latest"
}
```

### Why These Choices?

- **Electron**: Mature, cross-platform, large ecosystem
- **React 19**: Latest features, excellent performance
- **Tailwind**: Rapid development, consistent design
- **SQLite**: Fast, reliable, zero-config database
- **Whisper**: State-of-the-art local transcription

---

## Build & Distribution

### Development

```bash
npm run dev
```

Starts Vite dev server + Electron in development mode.

### Production Build

```bash
npm run build
```

Creates optimized builds for all platforms.

### Distribution

- **macOS**: `.dmg` installer
- **Windows**: `.exe` installer
- **Linux**: `.AppImage`, `.deb`, `.rpm`

---

## Resources

- **Electron Docs**: [electronjs.org/docs](https://electronjs.org/docs)
- **React Docs**: [react.dev](https://react.dev)
- **Tailwind Docs**: [tailwindcss.com/docs](https://tailwindcss.com/docs)
- **Vite Docs**: [vitejs.dev](https://vitejs.dev)

---

## Next Steps

- `INSTALLATION.md` - Build from source
- GitHub - Contribute to ThinkPod
