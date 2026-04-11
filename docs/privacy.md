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

## Who Has Access to Your Data

### ThinkPod Application

- **Full access** to your Vault folder
- **Read/write** permissions for notes
- **Local database** access for metadata
- **No network** access by default (except when configured)

### Wilfred (Local AI)

- **Reads** notes when you open them
- **Searches** vault when you ask
- **Processes** locally on your machine
- **No external** communication

### Wilfred (Cloud AI)

- **Sees** only the notes you explicitly discuss
- **Sends** messages to configured AI provider
- **Receives** responses from provider
- **Subject to** provider's privacy policy

### Other Applications

- **No access** unless you grant it
- Your Vault is just a folder — standard OS permissions apply
- You can open notes in other apps if you choose

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

This encrypts your entire drive, including ThinkPod data.

#### Folder Encryption
- Use OS-specific folder encryption
- Encrypt just your Vault folder
- ThinkPod works with encrypted folders

### In Transit

- **Local AI**: No network transmission
- **Cloud AI**: HTTPS encryption for API calls
- **Internet search**: HTTPS for web requests

---

## Privacy by Provider

### Local Providers (Ollama, LM Studio, etc.)

✅ **Complete privacy**
- No data leaves your machine
- No accounts required
- No tracking

### Cloud Providers

Privacy depends on the provider. Check their policies:

| Provider | Data Retention | Training Use | Privacy Policy |
|----------|----------------|--------------|----------------|
| OpenAI | 30 days (API) | Opt-out available | [Link](https://openai.com/privacy) |
| Anthropic | Not used for training | No | [Link](https://www.anthropic.com/privacy) |
| OpenRouter | Varies by model | Varies | [Link](https://openrouter.ai/privacy) |
| Groq | Not disclosed | Not disclosed | [Link](https://groq.com/privacy-policy) |

**Recommendation**: Use local models for sensitive content.

---

## What ThinkPod Knows About You

### Locally

ThinkPod knows:
- What notes you've written
- When you created/modified them
- Your conversations with Wilfred
- Your preferences and settings

This is **necessary** for the app to function.

### Remotely

ThinkPod sends **nothing** to any server unless:
1. You configure a cloud AI provider (sends messages only)
2. You ask Wilfred to search the web (sends queries only)
3. You manually check for updates (version check only)

---

## Compliance

### GDPR (EU)

ThinkPod is GDPR-compliant by design:
- **Data minimization**: Only stores what's necessary
- **User control**: You own and control all data
- **Right to erasure**: Delete your Vault anytime
- **No profiling**: No automated decision-making
- **Transparency**: Open source, auditable code

### CCPA (California)

- **No sale of data**: ThinkPod doesn't sell data
- **No sharing**: Data not shared with third parties
- **User rights**: Full control over your data

### Other Regulations

ThinkPod's local-first design makes it compliant with most privacy regulations worldwide.

---

## Threat Model

### What ThinkPod Protects Against

✅ **Cloud provider access** (use local AI)
✅ **Data breaches** (no central server to breach)
✅ **Unauthorized access** (OS-level permissions)
✅ **Vendor lock-in** (plain markdown files)

### What ThinkPod Does NOT Protect Against

❌ **Physical access** to your computer
❌ **Malware** on your system
❌ **OS-level vulnerabilities**
❌ **User error** (accidental deletion, etc.)

**Recommendation**: Use full disk encryption and strong passwords.

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

## Data Portability

### Export Your Data

Your data is already portable:
- **Notes**: Plain markdown files
- **Metadata**: SQLite database (can be exported)
- **Settings**: JSON configuration files

### Switch to Another App

To migrate from ThinkPod:
1. Your notes are in your Vault folder
2. Copy them to another app's folder
3. Import into Obsidian, Notion, etc.

No conversion needed — they're standard markdown.

---

## Questions?

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

- [AI Providers](./ai-providers.md) - Choose local vs cloud
- [The Vault](./vault.md) - Understand data storage
- [FAQ](./faq.md) - More questions answered
