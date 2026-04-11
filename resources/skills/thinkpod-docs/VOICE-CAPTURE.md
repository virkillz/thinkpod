# Voice Capture

Dictate notes using local speech-to-text powered by OpenAI's Whisper.

## What is Voice Capture?

Voice Capture lets you:
- **Dictate notes** instead of typing
- **Transcribe meetings** or conversations
- **Capture thoughts** while walking, driving, or away from keyboard
- **Convert audio to text** completely offline

All processing happens **locally on your machine** — audio never leaves your computer.

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

## Using Voice Capture

1. Click the **microphone icon** in the toolbar
2. **Speak** your thought clearly
3. Click **stop** when finished
4. Review and edit the transcribed text
5. Save with `Cmd+S`

## Tips for Better Accuracy

- **Enunciate** words clearly
- **Moderate pace** (not too fast or slow)
- **Minimize background noise**
- **Use a good microphone** (headset > laptop mic)

## Model Comparison

| Model | Size | Speed | Accuracy | Use Case |
|-------|------|-------|----------|----------|
| Tiny | 75MB | Very fast | ~70% | Quick notes, testing |
| Base | 142MB | Fast | ~80% | Daily use (recommended) |
| Small | 466MB | Medium | ~85% | Important transcriptions |
| Medium | 1.5GB | Slow | ~90% | Professional use |
| Large | 2.9GB | Very slow | ~95% | Maximum accuracy |

## Privacy

- **Audio stays on your machine** — never uploaded
- **Whisper runs locally** via nodejs-whisper
- **No internet required** for transcription
- **No third-party services** involved

## Troubleshooting

### "Microphone not detected"
1. Check microphone is connected
2. Verify OS permissions granted
3. Try a different microphone
4. Restart ThinkPod

### "Poor transcription quality"
1. Upgrade model: Try Small or Medium
2. Better audio: Use headset microphone
3. Reduce noise: Find quieter environment
4. Speak clearly: Enunciate, moderate pace

### "Transcription is slow"
1. Use smaller model: Tiny or Base
2. Shorter clips: Transcribe in chunks
3. Better hardware: Faster CPU/GPU helps
4. Close other apps: Free up resources
