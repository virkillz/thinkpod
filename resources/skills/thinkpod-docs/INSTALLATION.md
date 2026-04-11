# Installation & Setup

Complete guide for installing ThinkPod and getting it running.

## Prerequisites

Before installing:
1. **Node.js 20+** - [Download from nodejs.org](https://nodejs.org)
2. **AI provider** - Choose one:
   - **Local**: [Ollama](https://ollama.com) (recommended for beginners)
   - **Cloud**: OpenAI, OpenRouter, or any OpenAI-compatible API

## Installation Options

### Option 1: Pre-built Binary (Coming Soon)
Pre-built installers for macOS, Windows, and Linux will be available soon.

### Option 2: Build from Source

```bash
# Clone the repository
git clone https://github.com/virkillz/thinkpod.git
cd thinkpod

# Install dependencies
npm install

# Run in development mode
npm run dev

# Or build for production
npm run build
```

## First Launch Setup

The setup wizard guides you through three steps:

### 1. Choose Vault Location
- Click **Browse** to select a folder
- Or create new (e.g., `~/Documents/ThinkPod Vault`)
- ThinkPod creates the necessary structure inside
- **Important**: Choose a location you can easily back up!

### 2. Configure AI Provider

#### Option A: Local (Ollama - Recommended)
1. Install Ollama from [ollama.com](https://ollama.com)
2. Download a model: `ollama pull llama3.2`
3. In ThinkPod setup:
   - **Base URL**: `http://localhost:11434/v1`
   - **Model**: `llama3.2`
   - **API Key**: Leave blank

#### Option B: Cloud (OpenAI, OpenRouter, etc.)
1. Get API key from your provider
2. In ThinkPod setup:
   - **Base URL**: Provider's endpoint (e.g., `https://api.openai.com/v1`)
   - **Model**: Model name (e.g., `gpt-4o-mini`)
   - **API Key**: Your API key

See `AI-PROVIDERS.md` for more options.

### 3. Voice Capture (Optional)
1. Enable **Voice Capture** in setup
2. ThinkPod downloads Whisper models (may take a few minutes)
3. Choose your preferred language
4. Can skip and enable later in Settings

## Verifying Installation

After setup, verify everything works:
1. **Create a note**: Press `Cmd+N` (Mac) or `Ctrl+N` (Windows/Linux)
2. **Test Wilfred**: Press `Cmd+J` and type "Hello"
3. **Check voice** (if enabled): Click microphone icon and speak

## Post-Installation

### Recommended: Learn Keyboard Shortcuts
- `Cmd+N` - New thought
- `Cmd+J` - Toggle Wilfred chat
- `Cmd+B` - Toggle sidebar
- `Cmd+S` - Save current document

See `SHORTCUTS.md` for full list.

### Recommended: Configure Backup
Your notes are plain markdown files. Set up automatic backups:
- **macOS**: Time Machine
- **Windows**: File History or OneDrive
- **Linux**: rsync, Timeshift, or cloud sync
- **Cross-platform**: Git, Dropbox, or any file sync service

### Optional: Customize Settings
Explore **Settings** to customize:
- **Appearance**: Theme, font size, editor preferences
- **Inference**: AI provider, model, temperature
- **Voice**: Language, model size
- **Shortcuts**: Customize keyboard shortcuts

## Updating ThinkPod

### From Source
```bash
cd thinkpod
git pull
npm install
npm run build
```

### Pre-built Binary (Coming Soon)
ThinkPod will notify you when updates are available.

## Uninstalling

To remove ThinkPod:
1. **Your notes are safe**: They're just markdown files in your Vault folder
2. **Delete the app**: Remove the ThinkPod application
3. **Optional**: Delete the database:
   - macOS: `~/Library/Application Support/ThinkPod/`
   - Windows: `%APPDATA%/ThinkPod/`
   - Linux: `~/.config/ThinkPod/`

Your Vault folder is **never** automatically deleted.

## Troubleshooting

### "Node.js not found"
Install Node.js 20+ from [nodejs.org](https://nodejs.org)

### "npm install" fails
1. Delete `node_modules` and `package-lock.json`
2. Run `npm install` again
3. If still failing, check Node.js version: `node --version`

### "Cannot connect to AI provider"
- **Local (Ollama)**: Make sure Ollama is running: `ollama serve`
- **Cloud**: Check API key and internet connection
- **Both**: Verify Base URL is correct

### "Voice capture not working"
1. Check microphone permissions in OS settings
2. Ensure Whisper models downloaded successfully
3. Try different microphone input

### "Vault folder not accessible"
1. Check folder permissions
2. Ensure path exists and is writable
3. Try choosing different location

## Getting Help
- **Documentation**: Check other skill files
- **FAQ**: See `FAQ.md`
- **GitHub Issues**: [Report a bug](https://github.com/virkillz/thinkpod/issues)

## Next Steps
- `QUICK-START.md` - Learn the basics
- `WILFRED.md` - Meet your AI agent
- `SHORTCUTS.md` - Work faster
