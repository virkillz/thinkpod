# Privacy & Security

ThinkPod is designed with privacy as a core principle.

## Privacy Philosophy

**Your data belongs to you. Period.**

ThinkPod follows these principles:
1. **Local-first**: Data stays on your machine by default
2. **No telemetry**: Zero tracking, analytics, or data collection
3. **User control**: You choose what (if anything) leaves your computer
4. **Transparency**: Open source code you can audit
5. **No lock-in**: Plain files you can move anytime

---

## What Data ThinkPod Stores

### On Your Machine

#### 1. Your Notes
- **Location**: Your Vault folder (you choose)
- **Format**: Plain markdown files
- **Access**: Only ThinkPod and apps you authorize

#### 2. Metadata Database
- **Location**: 
  - macOS: `~/Library/Application Support/ThinkPod/`
  - Windows: `%APPDATA%/ThinkPod/`
  - Linux: `~/.config/ThinkPod/`
- **Contents**:
  - Note metadata (tags, categories, timestamps)
  - Conversation history with Wilfred
  - User preferences and settings
- **Format**: SQLite database

#### 3. Application Settings
- **Location**: Same as metadata database
- **Contents**:
  - AI provider configuration
  - UI preferences
  - Keyboard shortcuts
  - Voice settings

### What ThinkPod Does NOT Store

- ❌ Your notes on any server
- ❌ Usage analytics or telemetry
- ❌ Personal information
- ❌ Browsing history
- ❌ System files outside the Vault

---

## What Leaves Your Computer

### Local AI (Default)

When using local models (Ollama, LM Studio):
- **Nothing** leaves your computer
- All processing happens locally
- No internet connection required
- Complete privacy

### Cloud AI (Optional)

When using cloud providers (OpenAI, Anthropic, etc.):
- **Only** the specific messages/documents you discuss with Wilfred are sent
- Your **entire vault** is NOT uploaded
- The provider's privacy policy applies to that data
- You can switch back to local anytime

### Voice Capture

- **Audio never leaves** your machine
- Whisper runs locally
- Only the transcribed text is stored
- No cloud processing

### Internet Search

When you ask Wilfred to search the web:
- **Search queries** are sent to search engines
- **Results** are fetched and summarized
- Your **notes** are NOT sent
- You control when this happens

---

## Security Measures

### Application Security

- **Electron security** best practices:
  - Context isolation enabled
  - Node integration disabled in renderer
  - Content Security Policy enforced
  - IPC message validation
- **No remote code** execution
- **Sandboxed** renderer process

### Data Security

- **Local storage**: Files on your disk
- **No cloud sync**: Unless you configure it
- **Encryption**: Use OS-level encryption (FileVault, BitLocker)
- **Backups**: You control backup strategy

### API Key Security

If using cloud AI:
- **Keys stored** in local database
- **Never logged** or transmitted elsewhere
- **Encrypted** at rest (OS keychain integration coming)
- **You manage** key rotation

---

## Encryption

### At Rest

ThinkPod stores data unencrypted by default. To encrypt:

#### Full Disk Encryption
- **macOS**: Enable FileVault
- **Windows**: Enable BitLocker
- **Linux**: Use LUKS or eCryptfs

This encrypts your entire drive, including the Vault.

#### Folder-Level Encryption
- **macOS**: Encrypted disk images
- **Windows**: EFS (Encrypted File System)
- **Linux**: eCryptfs, gocryptfs

Encrypts only the Vault folder.

### In Transit

- **Local AI**: No network transmission
- **Cloud AI**: HTTPS encryption to provider
- **Web search**: HTTPS to search engines

---

## Best Practices

### For Maximum Privacy

1. **Use local AI** (Ollama, LM Studio)
2. **Enable disk encryption** (FileVault, BitLocker)
3. **Disable internet search** if not needed
4. **Regular backups** to encrypted storage
5. **Strong OS password**

### For Cloud AI Users

1. **Read provider privacy policies**
2. **Use API keys** with limited permissions
3. **Avoid discussing** highly sensitive topics
4. **Rotate API keys** regularly
5. **Monitor usage** for unexpected activity

### For Shared Computers

1. **Use OS user accounts** (don't share)
2. **Lock screen** when away
3. **Encrypt Vault** folder
4. **Clear conversation history** if needed

---

## Transparency

### Open Source

ThinkPod is open source:
- **Code**: [github.com/virkillz/thinkpod](https://github.com/virkillz/thinkpod)
- **License**: MIT
- **Auditable**: Anyone can review the code
- **Community-driven**: Contributions welcome

### No Telemetry

ThinkPod collects **zero** telemetry:
- No usage analytics
- No crash reports (unless you manually submit)
- No version tracking
- No feature usage stats

We don't know:
- How many users we have
- How you use the app
- What features are popular

This is intentional.

---

## Common Questions

### "Can ThinkPod access my other files?"
No. ThinkPod only accesses:
- Your Vault folder
- Its own application data folder

### "What if I use a cloud AI provider?"
Only the specific messages you send to Wilfred are transmitted. Your entire vault is not uploaded.

### "Can I use ThinkPod for sensitive information?"
Yes, if you use local AI. For maximum security:
- Use Ollama or LM Studio
- Enable disk encryption
- Avoid cloud providers

### "How do I delete all my data?"
1. Delete your Vault folder
2. Delete ThinkPod's application data folder
3. Uninstall ThinkPod

Your data is gone (unless backed up elsewhere).

---

## Next Steps

- `AI-PROVIDERS.md` - Choose local vs cloud
- `VAULT.md` - Understand data storage
- `FAQ.md` - More questions answered
