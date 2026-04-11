# Voice Capture

Dictate notes using local speech-to-text powered by OpenAI's Whisper.

## What is Voice Capture?

Voice Capture lets you:
- **Dictate notes** instead of typing
- **Transcribe meetings** or conversations
- **Capture thoughts** while walking, driving, or away from keyboard
- **Convert audio to text** completely offline

All processing happens **locally on your machine** — audio never leaves your computer.

---

## Setup

### First-Time Configuration

1. Go to **Settings → Voice**
2. Enable **Voice Capture**
3. Choose your **language** (default: English)
4. Select **Whisper model size**:
   - **Tiny**: Fastest, least accurate (~75MB)
   - **Base**: Good balance (~142MB) — **Recommended**
   - **Small**: Better accuracy (~466MB)
   - **Medium**: Very accurate (~1.5GB)
   - **Large**: Best accuracy (~2.9GB)
5. Click **Download Model**

The first download may take a few minutes depending on model size.

### Microphone Permissions

On first use, your OS will ask for microphone access:
- **macOS**: System Preferences → Security & Privacy → Microphone
- **Windows**: Settings → Privacy → Microphone
- **Linux**: Usually no permission needed

Grant ThinkPod access to use voice capture.

---

## Using Voice Capture

### Quick Dictation

1. Click the **microphone icon** in the toolbar
2. **Speak** your thought clearly
3. Click **stop** when finished
4. Review and edit the transcribed text
5. Save with `Cmd+S`

### During a Meeting

1. Start voice capture at the beginning
2. Let it run for the entire meeting
3. Stop when done
4. ThinkPod transcribes everything heard
5. Edit and organize the transcript

### Voice Commands (Coming Soon)

Future versions will support:
- "New note" to create a note
- "Save" to save current note
- "Open Wilfred" to start agent chat

---

## Tips for Better Accuracy

### Speak Clearly

- **Enunciate** words
- **Moderate pace** (not too fast or slow)
- **Minimize background noise**
- **Use a good microphone** (headset > laptop mic)

### Punctuation

Whisper automatically adds punctuation, but you can help:
- **Pause** at sentence boundaries
- **Speak naturally** with normal rhythm
- **Avoid filler words** (um, uh, like)

### Language

Whisper supports 99+ languages:
- English (best accuracy)
- Spanish, French, German, Italian
- Chinese, Japanese, Korean
- Arabic, Hindi, Russian
- And many more

Set your language in Settings → Voice.

### Model Size

Larger models are more accurate but slower:

| Model | Size | Speed | Accuracy | Use Case |
|-------|------|-------|----------|----------|
| Tiny | 75MB | Very fast | ~70% | Quick notes, testing |
| Base | 142MB | Fast | ~80% | Daily use (recommended) |
| Small | 466MB | Medium | ~85% | Important transcriptions |
| Medium | 1.5GB | Slow | ~90% | Professional use |
| Large | 2.9GB | Very slow | ~95% | Maximum accuracy |

Start with **Base** and upgrade if needed.

---

## Editing Transcriptions

Whisper is good but not perfect. Always review:

### Common Errors

- **Homophones**: "their" vs "there"
- **Proper nouns**: Names, places
- **Technical terms**: Jargon, acronyms
- **Punctuation**: May need adjustment

### Quick Edits

After transcription:
1. Read through the text
2. Fix obvious errors
3. Add formatting (headings, lists)
4. Save

You can also ask Wilfred to clean up:
- `Cmd+J` to open chat
- "Fix grammar and punctuation in this note"

---

## Advanced Features

### Custom Vocabulary (Coming Soon)

Train Whisper on your specific terms:
- Names of people/places
- Technical jargon
- Domain-specific vocabulary

### Speaker Diarization (Coming Soon)

Identify different speakers in a conversation:
- "Speaker 1: ..."
- "Speaker 2: ..."

Useful for meeting transcripts.

### Timestamps (Coming Soon)

Add timestamps to transcriptions:
- [00:00] Introduction
- [05:30] Main discussion
- [15:00] Conclusion

---

## Privacy

### Local Processing

- **Audio stays on your machine** — never uploaded
- **Whisper runs locally** via nodejs-whisper
- **No internet required** for transcription
- **No third-party services** involved

### Audio Storage

- **Not saved by default** — only the transcription is kept
- **Temporary files** deleted after processing
- **You control** what gets saved

---

## Troubleshooting

### "Microphone not detected"

1. Check microphone is connected
2. Verify OS permissions granted
3. Try a different microphone
4. Restart ThinkPod

### "Poor transcription quality"

1. **Upgrade model**: Try Small or Medium
2. **Better audio**: Use headset microphone
3. **Reduce noise**: Find quieter environment
4. **Speak clearly**: Enunciate, moderate pace

### "Transcription is slow"

1. **Use smaller model**: Tiny or Base
2. **Shorter clips**: Transcribe in chunks
3. **Better hardware**: Faster CPU/GPU helps
4. **Close other apps**: Free up resources

### "Wrong language detected"

1. Set language explicitly in Settings
2. Ensure you're speaking the selected language
3. Try a larger model (better language detection)

### "Model download failed"

1. Check internet connection
2. Verify disk space available
3. Try downloading again
4. Check firewall/antivirus settings

---

## Hardware Requirements

### Minimum

- **CPU**: Dual-core processor
- **RAM**: 4GB
- **Disk**: 500MB for models
- **Microphone**: Any USB or built-in mic

### Recommended

- **CPU**: Quad-core processor
- **RAM**: 8GB
- **Disk**: 2GB for larger models
- **Microphone**: USB headset or external mic

### Optimal

- **CPU**: 8+ cores or Apple Silicon
- **RAM**: 16GB+
- **GPU**: Dedicated GPU (CUDA/Metal support coming)
- **Microphone**: Professional USB microphone

---

## Comparison with Cloud Services

| Feature | ThinkPod (Local) | Cloud Services |
|---------|------------------|----------------|
| **Privacy** | 100% local | Audio uploaded |
| **Cost** | Free | Pay per minute |
| **Internet** | Not required | Required |
| **Speed** | Depends on hardware | Usually fast |
| **Accuracy** | Good (80-95%) | Excellent (95%+) |
| **Languages** | 99+ | Varies |

ThinkPod prioritizes privacy and cost over maximum accuracy.

---

## Use Cases

### Daily Journaling

Dictate your morning pages:
- Faster than typing
- More natural flow
- Capture stream of consciousness

### Meeting Notes

Record and transcribe meetings:
- Focus on discussion, not note-taking
- Get full transcript
- Review and summarize later

### Brainstorming

Capture ideas as they come:
- Voice is faster than typing
- Don't lose thoughts
- Refine later with Wilfred

### Accessibility

For users who:
- Have difficulty typing
- Prefer speaking to writing
- Need hands-free input

---

## Next Steps

- [Quick Start Guide](./quick-start.md) - Learn the basics
- [Wilfred Guide](./wilfred.md) - Use AI to improve transcriptions
- [Settings Reference](./settings.md) - Configure voice options
