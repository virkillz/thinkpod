# Voice Capture — Implementation Plan

## Decision Record

### Engine: Whisper via whisper.cpp

Whisper remains the best fit for offline, local, Electron-native STT in 2026.

| Option | Verdict |
|---|---|
| **Whisper + whisper.cpp** | ✅ Chosen — native C++, Metal on Apple Silicon, solid Node.js bindings |
| faster-whisper (Python) | ❌ No Metal/MPS on macOS, requires Python subprocess, nightmare in packaged apps |
| @xenova/transformers (WASM) | ❌ 3–5× slower than native, single-threaded |
| Moonshine / Parakeet | ❌ No mature Electron bindings |

**Node.js binding:** `nodejs-whisper` — handles GGML model downloads, native compile, all variants, Metal auto-detected.

### Streaming Strategy: VAD-Chunked Batching

Whisper is not a true streaming model. The streaming UX is achieved by:

```
Renderer AudioWorklet (PCM float32 @ 16kHz, 512-sample chunks)
    │  IPC arraybuffer
    ▼
Main Process — @ricky0123/vad-node (Silero VAD, ~1.8 MB ONNX model)
    │  detects speech/silence segment boundaries
    ▼
Accumulate speech segment (target 5–20 s, hard-split at 30 s)
    │
    ▼
nodejs-whisper → whisper.cpp (Metal-accelerated on Apple Silicon)
    │
    ▼  push:voice-transcript
Renderer — appends segment text to capture textarea
```

Latency per segment: ~380–520 ms on Apple Silicon with small model.

### Models Offered to User

| Tier | Model | GGML Size | Notes |
|---|---|---|---|
| Fast (English) | `whisper-small.en` | 466 MB | Default for English-only users |
| Fast (Multilingual) | `whisper-small` | 466 MB | Default for multilingual |
| Accurate | `whisper-large-v3-turbo` | 805 MB | **Recommended** — distilled Large, near-identical accuracy |
| Custom | All variants | — | Tiny / Base / Medium + .en variants |

Models stored in `app.getPath('userData')/models/whisper/`.

---

## Phase A — Setup & Config  ✅ / 🔄 / ⬜

> Goal: user can pick, download, and manage a Whisper model. Voice mode is gated on this config.

### A1. IPC channels + types  ⬜
- Add to `src/main/ipc/channels.ts`:
  - `WHISPER_GET_CONFIG` → `whisper:get-config`
  - `WHISPER_SET_CONFIG` → `whisper:set-config`
  - `WHISPER_DOWNLOAD_MODEL` → `whisper:download-model`
  - `WHISPER_CANCEL_DOWNLOAD` → `whisper:cancel-download`
  - `WHISPER_DELETE_MODEL` → `whisper:delete-model`
  - `PUSH_VOICE_DOWNLOAD_PROGRESS` → `push:voice-download-progress`
  - `PUSH_VOICE_TRANSCRIPT` → `push:voice-transcript`
- Add `VoiceConfig` type to renderer types

### A2. WhisperManager  ⬜

File: `src/main/whisper/WhisperManager.ts`

Responsibilities:
- `getConfig()` — reads `voiceConfig` from settings DB; returns `VoiceConfig | null`
- `setConfig(config)` — persists to settings DB
- `downloadModel(modelName, onProgress)` — downloads GGML file from Hugging Face to userData dir, emits progress 0–100
- `cancelDownload()` — aborts in-flight download
- `deleteModel(modelName)` — removes GGML file from disk
- `listDownloadedModels()` — returns array of filenames present in userData/models/whisper/
- `getModelPath(modelName)` — returns absolute path for whisper.cpp to load

Model download URL pattern:
```
https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-{modelName}.bin
```

### A3. IPC handlers for whisper  ⬜

Add to `src/main/ipc/handlers.ts`:
- `whisper:get-config` → `whisperManager.getConfig()`
- `whisper:set-config` → `whisperManager.setConfig(config)`
- `whisper:download-model` → starts download, pushes `push:voice-download-progress` events
- `whisper:cancel-download` → cancels download
- `whisper:delete-model` → deletes file

### A4. Preload bridge + electron.d.ts  ⬜

Add to `src/main/preload.ts`:
- `getWhisperConfig()`
- `setWhisperConfig(config)`
- `downloadWhisperModel(modelName)`
- `cancelWhisperDownload()`
- `deleteWhisperModel(modelName)`
- `onVoiceDownloadProgress(cb)` / cleanup
- `onVoiceTranscript(cb)` / cleanup

### A5. StepVoice — Setup Wizard step  ⬜

File: `src/renderer/src/components/setup/StepVoice.tsx`

UI flow:
1. Explanation: "Voice capture lets you dictate folios. Everything runs offline on your Mac."
2. Language toggle: English-only / Multilingual
3. Model picker: Fast (small) / Accurate (turbo) / Skip for now
4. If model selected: Download button → progress bar → ✅ Ready
5. Skip button (bottom-left) → stores `voiceConfig: null`, proceeds to done

Wire into `SetupWizard.tsx`:
- Add `'voice'` to `SetupStep` union
- Steps: `welcome → abbey → llm → voice → done`
- Step indicator gets a 4th dot

### A6. Voice section in RuleView  ⬜

New section "Voice" between Inference and Wilfred:
- If configured: shows model name, size, language; "Change Model" inline picker + re-download; "Remove" button
- If not configured: brief description + "Set Up Voice" button (opens inline picker + download flow)
- Download in progress: shows progress bar, Cancel button

---

## Phase B — Audio Capture & Streaming Transcription  ⬜

> Goal: mic button in CaptureSheet starts real-time streaming transcription.

### B1. VAD + audio pipeline — VoiceCaptureService  ⬜

File: `src/main/whisper/VoiceCaptureService.ts`

- Receives raw PCM float32 chunks from renderer via IPC
- Pipes through `@ricky0123/vad-node` Silero VAD
- On speech-end event: sends accumulated segment to `nodejs-whisper`
- Pushes `push:voice-transcript` `{ text, isFinal }` to renderer
- `start()` / `stop()` lifecycle

IPC additions:
- `WHISPER_START_CAPTURE` → `whisper:start-capture`
- `WHISPER_STOP_CAPTURE` → `whisper:stop-capture`
- `WHISPER_AUDIO_CHUNK` → `whisper:audio-chunk`

### B2. Renderer AudioWorklet  ⬜

File: `src/renderer/src/audio/captureWorklet.ts`

- `getUserMedia({ audio: true })`; sample rate 16 kHz
- `AudioWorkletProcessor` sends 512-sample PCM float32 chunks
- Main thread forwards chunks to main process via `window.electronAPI.sendAudioChunk(buffer)`

### B3. CaptureSheet voice mode  ⬜

State machine inside `CaptureSheet`:
```
idle → listening → (transcribing segments) → stopped
```

- **idle** (voice not configured): mic button disabled, tooltip "Set up voice in Rule → Voice"
- **idle** (voice configured): mic button active
- **listening**: mic button turns red/pulsing, waveform amplitude bar shown, streaming text appends to textarea
- **stopped**: transcript is editable text in textarea; user reviews + saves as folio

UI additions to CaptureSheet:
- `VoiceBar` sub-component: simple amplitude visualizer (16 bars, Web Audio AnalyserNode)
- Streaming text appends with a blinking cursor effect at the tail

---

## Phase C — Polish  ⬜

- Interim "partial" label while a segment is being transcribed (spinner next to last line)
- Background transcription: if user closes sheet while voice is active, capture continues and result is auto-saved to `_folios/`
- Model warm-up: load model into memory on first voice start (keeps it warm for session duration)
- Detect Apple Silicon and show "Metal-accelerated" badge in model picker

---

## File Map

```
src/
├── main/
│   ├── whisper/
│   │   ├── WhisperManager.ts          # A2 — model download/config
│   │   └── VoiceCaptureService.ts     # B1 — VAD + transcription pipeline
│   └── ipc/
│       ├── channels.ts                # A1 — new channel constants
│       └── handlers.ts                # A3 — new IPC handlers
│
└── renderer/src/
    ├── audio/
    │   └── captureWorklet.ts          # B2 — AudioWorklet processor
    ├── components/
    │   ├── setup/
    │   │   ├── StepVoice.tsx          # A5 — setup wizard step
    │   │   └── SetupWizard.tsx        # A5 — wire new step in
    │   ├── shell/
    │   │   └── CaptureSheet.tsx       # B3 — voice mode UI
    │   └── views/
    │       └── RuleView.tsx           # A6 — voice settings section
    └── types/
        └── electron.d.ts              # A4 — new API surface types
```

---

## Progress Tracker

| Task | Status |
|---|---|
| A1 — IPC channels + VoiceConfig type | ✅ |
| A2 — WhisperManager | ✅ |
| A3 — IPC handlers | ✅ |
| A4 — Preload bridge + types | ✅ |
| A5 — StepVoice + SetupWizard wiring | ✅ |
| A6 — RuleView Voice section | ✅ |
| B1 — VoiceCaptureService (VAD + whisper) | ✅ |
| B2 — Renderer AudioWorklet | ✅ |
| B3 — CaptureSheet voice mode | ✅ |
| C — Polish | ⬜ |
