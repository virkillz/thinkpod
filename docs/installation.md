# Installation & Setup

Get ThinkPod running on your machine in a few minutes.

## Prerequisites

Before installing ThinkPod, you'll need:

1. **Node.js 20+** - [Download from nodejs.org](https://nodejs.org)
2. **An AI provider** - Choose one:
   - **Local**: [Ollama](https://ollama.com) (recommended for beginners)
   - **Cloud**: OpenAI, OpenRouter, or any OpenAI-compatible API

## Installation

### Option 1: Download Pre-built Binary (Coming Soon)

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

When you first launch ThinkPod, the setup wizard will guide you through:

### 1. Choose Your Vault Location

Your **Vault** is the folder where ThinkPod stores your notes.

- Click **Browse** to select a folder
- Or create a new folder (e.g., `~/Documents/ThinkPod Vault`)
- ThinkPod will create the necessary structure inside

**Important**: Choose a location you can easily back up!

### 2. Configure Your AI Provider

You'll need to set up an AI provider for Wilfred to work.

#### Option A: Local (Ollama - Recommended)

1. Install Ollama from [ollama.com](https://ollama.com)
2. Download a model:
   ```bash
   ollama pull llama3.2
   ```
3. In ThinkPod setup:
   - **Base URL**: `http://localhost:11434/v1`
   - **Model**: `llama3.2`
   - **API Key**: Leave blank

#### Option B: Cloud (OpenAI, OpenRouter, etc.)

1. Get an API key from your chosen provider
2. In ThinkPod setup:
   - **Base URL**: Your provider's endpoint (e.g., `https://api.openai.com/v1`)
   - **Model**: Model name (e.g., `gpt-4o-mini`)
   - **API Key**: Your API key

See [AI Providers Guide](./ai-providers.md) for more options.

### 3. Voice Capture (Optional)

If you want to use voice dictation:

1. Enable **Voice Capture** in the setup
2. ThinkPod will download Whisper models (this may take a few minutes)
3. Choose your preferred language

You can skip this and enable it later in Settings.

## Verifying Installation

After setup, verify everything works:

1. **Create a note**: Press `Cmd+N` (Mac) or `Ctrl+N` (Windows/Linux)
2. **Test Wilfred**: Press `Cmd+J` and type "Hello"
3. **Check voice** (if enabled): Click the microphone icon and speak

If all three work, you're ready to go!

## Post-Installation

### Recommended: Set Up Keyboard Shortcuts

ThinkPod is keyboard-first. Learn the essential shortcuts:
- `Cmd+N` - New thought
- `Cmd+J` - Toggle Wilfred chat
- `Cmd+B` - Toggle sidebar
- `Cmd+S` - Save current document

See [Keyboard Shortcuts](./shortcuts.md) for the full list.

### Recommended: Configure Backup

Your notes are stored as plain markdown files in your Vault. Set up automatic backups:

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

## Troubleshooting Installation

### "Node.js not found"

Install Node.js 20+ from [nodejs.org](https://nodejs.org)

### "npm install" fails

1. Delete `node_modules` and `package-lock.json`
2. Run `npm install` again
3. If still failing, check your Node.js version: `node --version`

### "Cannot connect to AI provider"

- **Local (Ollama)**: Make sure Ollama is running: `ollama serve`
- **Cloud**: Check your API key and internet connection
- **Both**: Verify the Base URL is correct

### "Voice capture not working"

1. Check microphone permissions in your OS settings
2. Ensure Whisper models downloaded successfully
3. Try a different microphone input

### "Vault folder not accessible"

1. Check folder permissions
2. Ensure the path exists and is writable
3. Try choosing a different location

## Getting Help

- **Documentation**: You're reading it! Check the [index](./index.md)
- **FAQ**: [Common questions](./faq.md)
- **GitHub Issues**: [Report a bug](https://github.com/virkillz/thinkpod/issues)

## Next Steps

- [Quick Start Guide](./quick-start.md) - Learn the basics
- [Wilfred Guide](./wilfred.md) - Meet your AI agent
- [Keyboard Shortcuts](./shortcuts.md) - Work faster
