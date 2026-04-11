# Frequently Asked Questions

## General

### Is ThinkPod really 100% local?

Yes! All your notes are stored locally as markdown files, all settings stored in SQLite. The AI runs through a local model server like Ollama or LM Studio. Your data never leaves your machine unless you explicitly configure a cloud provider.

### Is there a subscription fee?

No. ThinkPod is free and open source. You only pay if you choose to use a cloud AI provider.

### Where are my notes stored?

Your notes are stored in a local folder you choose during setup (your Vault). Everything is plain Markdown files you own, plus metadata in a local SQLite database.

### Can I export my notes?

Yes! Your notes are plain Markdown files in your Vault folder. You can access, move, or back them up anytime. No lock-in.

### Is there a mobile app?

Not yet. ThinkPod is currently desktop-only (macOS, Windows, Linux).

## AI & Wilfred

### How does Wilfred differ from ChatGPT?

Wilfred is proactive, not just reactive. He runs continuously, reads your notes, and surfaces insights without you asking. He has memory across sessions and understands your entire vault context.

ChatGPT is a standalone chat interface — you ask, it answers, conversation ends. Wilfred is integrated into your writing workflow.

### Can I use my own AI models?

Absolutely! ThinkPod uses the OpenAI API format, so any compatible provider works — local (Ollama, LM Studio) or cloud (OpenRouter, Together AI, Groq, etc.).

See [AI Providers Guide](./ai-providers.md) for setup instructions.

### What hardware do I need?

ThinkPod works with any OpenAI-compatible API, including cloud providers. For local models, we recommend:
- **Minimum**: 8GB RAM for smaller models (3B-4B parameters)
- **Recommended**: 16GB RAM for better models (7B-8B parameters)
- **Optimal**: 32GB+ RAM for large models (70B+ parameters)

### Does Wilfred have access to the internet?

Only when you explicitly ask him to search. By default, Wilfred only has access to your vault. When you request web search, he'll fetch information and summarize it for you.

### Can I use multiple AI providers?

Currently, ThinkPod uses one provider at a time. You can switch between providers in Settings, but you can't use multiple simultaneously.

## Privacy & Security

### What data does ThinkPod collect?

None. ThinkPod has no telemetry, no tracking, no analytics. Everything stays on your machine.

### Is my data encrypted?

Your notes are plain markdown files stored on your disk. Use your operating system's encryption features (FileVault on macOS, BitLocker on Windows) to encrypt your entire drive.

### Can ThinkPod access my other files?

No. ThinkPod only has access to:
- Your Vault folder (notes)
- Its own application data folder (settings, database)

It cannot access files outside these locations.

### What happens if I use a cloud AI provider?

When you use a cloud provider (OpenAI, Anthropic, etc.):
- Only the specific messages/documents you discuss with Wilfred are sent
- Your entire vault is NOT uploaded
- The provider's privacy policy applies to that data
- You can switch back to local models anytime

## Features

### Can I use ThinkPod with Obsidian?

Yes! Point ThinkPod's Vault to your Obsidian vault folder. Both apps can work with the same markdown files. However, some features may conflict (e.g., metadata formats).

### Does ThinkPod support plugins?

Not yet. Plugin support is planned for future releases.

### Can I customize the theme?

Basic theme customization is available in Settings → Appearance. More advanced theming support is planned.

### Does ThinkPod support collaboration?

Not currently. ThinkPod is designed for personal knowledge management. Collaboration features may be added in the future.

### Can I sync across devices?

ThinkPod doesn't have built-in sync. However, since your notes are plain files, you can use:
- Git (version control)
- Dropbox, Google Drive, OneDrive (cloud sync)
- Syncthing (peer-to-peer sync)
- Any file synchronization tool

Just point ThinkPod to the synced folder on each device.

## Voice Capture

### Is voice capture really local?

Yes! ThinkPod uses [Whisper](https://github.com/openai/whisper) running locally on your machine. Audio never leaves your computer.

### What languages are supported?

Whisper supports 99+ languages. Configure your preferred language in Settings → Voice.

### How accurate is the transcription?

Accuracy depends on:
- Audio quality (clear speech works best)
- Whisper model size (larger = more accurate)
- Language (English has best accuracy)

Expect 90-95% accuracy for clear English speech with the base model.

### Can I use an external microphone?

Yes! Select your preferred microphone in Settings → Voice.

## Technical

### What's the tech stack?

- **Shell**: Electron
- **UI**: React 19 + Tailwind CSS
- **Build**: Vite
- **Database**: better-sqlite3 (SQLite)
- **Voice**: nodejs-whisper (local Whisper)
- **AI Runtime**: OpenAI-compatible API

See [Tech Stack](./tech-stack.md) for details.

### Is ThinkPod open source?

Yes! ThinkPod is open source under the MIT license. View the code at [github.com/virkillz/thinkpod](https://github.com/virkillz/thinkpod).

### Can I contribute?

Absolutely! Contributions are welcome:
- Report bugs via [GitHub Issues](https://github.com/virkillz/thinkpod/issues)
- Submit pull requests
- Improve documentation
- Share feedback

### What's the project status?

ThinkPod is in early development (v0.1.0). Core features work:
- Note-taking and document management ✅
- Agent chat (Wilfred) ✅
- Voice capture ✅

In progress:
- Persistent conversation history per document
- Task and schedule management UI
- Vault index auto-generated by Wilfred
- Agent personal vault
- Document lifecycle automation

## Troubleshooting

### Wilfred isn't responding

1. Check Settings → Inference — is the Base URL correct?
2. For local models: Is the server running? (e.g., `ollama serve`)
3. For cloud: Is your API key valid? Do you have credits?
4. Test the connection in Settings

### Voice capture isn't working

1. Check microphone permissions in your OS settings
2. Ensure Whisper models downloaded successfully
3. Try a different microphone input
4. Check Settings → Voice for configuration

### My notes aren't saving

1. Check that the Vault folder is writable
2. Look for error messages in the app
3. Verify you have disk space
4. Try saving to a different location

### ThinkPod is slow

1. **Local AI**: Upgrade to a faster model or better hardware
2. **Large vault**: Index building may slow things down initially
3. **Voice**: Larger Whisper models are slower but more accurate
4. Check CPU/RAM usage in your system monitor

### I found a bug

Please report it! [Open an issue on GitHub](https://github.com/virkillz/thinkpod/issues) with:
- Description of the problem
- Steps to reproduce
- Your OS and ThinkPod version
- Screenshots if applicable

## Still Have Questions?

- Check the [full documentation](./index.md)
- Visit the [GitHub repository](https://github.com/virkillz/thinkpod)
- Open an [issue](https://github.com/virkillz/thinkpod/issues)
