# Implementation Plan: Replicating LM Studio Architecture

**Goal**: Transform ThinkPod's built-in LLM into a production-grade inference engine matching LM Studio's architecture and performance.

**Status**: Phase 1 (Critical Fixes) ✅ Complete | Phase 2-5 Pending

---

## Phase 1: Critical Stability Fixes ✅ COMPLETED

### 1.1 Context Lifecycle Management ✅
- **Status**: Implemented
- **File**: `src/main/agent/LLMProcessManager.ts`
- **Changes**:
  - Persistent context instead of per-request creation
  - Proper disposal order (context → model → llama)
  - Added batch size configuration
- **Impact**: Eliminates crashes from memory fragmentation

### 1.2 GPU Layer Control ✅
- **Status**: Implemented
- **File**: `src/main/agent/LLMProcessManager.ts`
- **Changes**:
  - Added `setGpuLayers(layers: number)` method
  - Configurable GPU offloading (-1 = auto, 0 = CPU, N = N layers)
- **Impact**: Prevents VRAM exhaustion on smaller GPUs

---

## Phase 2: Process Isolation 🔴 HIGH PRIORITY

### 2.1 Architecture Decision
**Goal**: Move inference out of main Electron process to prevent UI freezes on crashes.

**Options**:

#### Option A: Node.js Worker Threads (Recommended)
```
Main Process (Electron)
  ├── Renderer (React UI)
  └── Worker Thread (LLM Inference)
       └── node-llama-cpp
```

**Pros**:
- Shared memory (faster than IPC)
- Native Node.js, no external dependencies
- Easier debugging

**Cons**:
- Still in same process (crash can affect main)
- Limited by Node.js thread model

#### Option B: Child Process (LM Studio Approach)
```
Main Process (Electron)
  ├── Renderer (React UI)
  └── Child Process (LLM Server)
       ├── HTTP Server (port 8765)
       └── node-llama-cpp
```

**Pros**:
- Complete isolation (crash-proof)
- Can restart independently
- Matches LM Studio architecture

**Cons**:
- IPC overhead
- More complex lifecycle management

**Recommendation**: **Option B (Child Process)** - matches LM Studio, provides true isolation.

### 2.2 Implementation Steps

#### Step 1: Create LLM Worker Process
**File**: `src/main/agent/llm-worker.ts` (new)

```typescript
/**
 * Standalone LLM inference server running in child process.
 * Communicates with main process via IPC.
 */
import { parentPort } from 'worker_threads'
import { LLMProcessManager } from './LLMProcessManager.js'

const manager = new LLMProcessManager()

parentPort?.on('message', async (msg) => {
  switch (msg.type) {
    case 'start':
      const result = await manager.start(msg.modelPath)
      parentPort?.postMessage({ type: 'started', url: manager.getUrl() })
      break
    case 'stop':
      manager.stop()
      parentPort?.postMessage({ type: 'stopped' })
      break
  }
})
```

#### Step 2: Update Main Process Manager
**File**: `src/main/agent/LLMProcessManager.ts`

```typescript
import { Worker } from 'worker_threads'

export class LLMProcessManager extends EventEmitter {
  private worker: Worker | null = null
  
  async start(modelPath: string): Promise<boolean> {
    this.worker = new Worker('./llm-worker.js')
    
    return new Promise((resolve) => {
      this.worker!.on('message', (msg) => {
        if (msg.type === 'started') {
          this.serverUrl = msg.url
          resolve(true)
        }
      })
      
      this.worker!.postMessage({ type: 'start', modelPath })
    })
  }
  
  stop(): void {
    this.worker?.postMessage({ type: 'stop' })
    this.worker?.terminate()
    this.worker = null
  }
}
```

#### Step 3: Add Crash Recovery
```typescript
this.worker.on('error', (err) => {
  console.error('[LLM Worker] Error:', err)
  this.emit('error', err.message)
  this.restart() // Auto-restart on crash
})

this.worker.on('exit', (code) => {
  if (code !== 0) {
    console.error('[LLM Worker] Crashed with code:', code)
    this.emit('crashed', code)
    this.restart()
  }
})
```

**Estimated Time**: 2-3 days  
**Testing**: Simulate crashes, verify UI remains responsive

---

## Phase 3: MLX Backend for Apple Silicon 🟡 MEDIUM PRIORITY

### 3.1 Why MLX?
- **2-3x faster** than llama.cpp on Apple Silicon
- Native Apple framework, optimized for Metal
- Better memory efficiency on M1/M2/M3

### 3.2 Architecture
```
Platform Detection
  ├── macOS + ARM64 → MLX Backend
  ├── macOS + x86_64 → llama.cpp Backend
  ├── Windows → llama.cpp Backend (CUDA)
  └── Linux → llama.cpp Backend (CUDA/ROCm)
```

### 3.3 Implementation Steps

#### Step 1: Add MLX Dependencies
**File**: `package.json`

```json
{
  "optionalDependencies": {
    "@mlx-community/mlx-node": "^0.1.0"
  }
}
```

**Note**: MLX requires Python bridge. Consider using child process with Python MLX server.

#### Step 2: Create MLX Backend
**File**: `src/main/agent/backends/MLXBackend.ts` (new)

```typescript
import { spawn } from 'child_process'

export class MLXBackend {
  private pythonProcess: ChildProcess | null = null
  
  async start(modelPath: string): Promise<string> {
    // Start Python MLX server
    this.pythonProcess = spawn('python3', [
      '-m', 'mlx_lm.server',
      '--model', modelPath,
      '--port', '8766'
    ])
    
    // Wait for server ready
    return 'http://127.0.0.1:8766/v1'
  }
}
```

#### Step 3: Create Backend Selector
**File**: `src/main/agent/backends/BackendSelector.ts` (new)

```typescript
import os from 'os'
import { MLXBackend } from './MLXBackend.js'
import { LlamaCppBackend } from './LlamaCppBackend.js'

export class BackendSelector {
  static selectOptimal(): 'mlx' | 'llama.cpp' {
    const platform = os.platform()
    const arch = os.arch()
    
    // Use MLX on Apple Silicon
    if (platform === 'darwin' && arch === 'arm64') {
      return 'mlx'
    }
    
    // Use llama.cpp everywhere else
    return 'llama.cpp'
  }
  
  static createBackend(type: 'mlx' | 'llama.cpp') {
    return type === 'mlx' ? new MLXBackend() : new LlamaCppBackend()
  }
}
```

#### Step 4: Bundle Python MLX Server
**File**: `resources/mlx-server/server.py` (new)

```python
#!/usr/bin/env python3
"""
Standalone MLX inference server.
Bundles: mlx-lm, mlx-vlm, outlines
"""
from mlx_lm import load, generate
from flask import Flask, request, jsonify

app = Flask(__name__)
model = None

@app.route('/v1/chat/completions', methods=['POST'])
def chat_completions():
    data = request.json
    messages = data['messages']
    
    # Convert to MLX format and generate
    response = generate(model, messages)
    
    return jsonify({
        'choices': [{'message': {'content': response}}]
    })

if __name__ == '__main__':
    import sys
    model_path = sys.argv[1]
    model = load(model_path)
    app.run(port=8766)
```

**Estimated Time**: 5-7 days  
**Testing**: Benchmark llama.cpp vs MLX on M1/M2/M3

---

## Phase 4: Context Pooling for Concurrency 🟡 MEDIUM PRIORITY

### 4.1 Problem
Current implementation uses a single context. Multiple concurrent requests will queue, causing delays.

### 4.2 Solution: Context Pool
```
Request 1 → Context A (in use)
Request 2 → Context B (in use)
Request 3 → Context C (in use)
Request 4 → Wait for available context
```

### 4.3 Implementation

#### Step 1: Create Context Pool
**File**: `src/main/agent/ContextPool.ts` (new)

```typescript
import type { LlamaContext, LlamaModel } from 'node-llama-cpp'

interface PooledContext {
  context: LlamaContext
  inUse: boolean
  lastUsed: number
}

export class ContextPool {
  private pool: PooledContext[] = []
  private model: LlamaModel
  private maxSize: number
  private contextSize: number
  
  constructor(model: LlamaModel, maxSize = 3, contextSize = 4096) {
    this.model = model
    this.maxSize = maxSize
    this.contextSize = contextSize
  }
  
  async acquire(): Promise<LlamaContext> {
    // Find available context
    let pooled = this.pool.find(p => !p.inUse)
    
    if (!pooled && this.pool.length < this.maxSize) {
      // Create new context
      const context = await this.model.createContext({
        contextSize: this.contextSize,
        batchSize: 512
      })
      pooled = { context, inUse: true, lastUsed: Date.now() }
      this.pool.push(pooled)
    }
    
    if (!pooled) {
      // Wait for available context
      await this.waitForAvailable()
      return this.acquire()
    }
    
    pooled.inUse = true
    pooled.lastUsed = Date.now()
    return pooled.context
  }
  
  release(context: LlamaContext): void {
    const pooled = this.pool.find(p => p.context === context)
    if (pooled) {
      pooled.inUse = false
    }
  }
  
  async dispose(): Promise<void> {
    for (const pooled of this.pool) {
      await (pooled.context as any).dispose?.()
    }
    this.pool = []
  }
  
  private waitForAvailable(): Promise<void> {
    return new Promise(resolve => {
      const check = setInterval(() => {
        if (this.pool.some(p => !p.inUse)) {
          clearInterval(check)
          resolve()
        }
      }, 100)
    })
  }
}
```

#### Step 2: Update LLMProcessManager
**File**: `src/main/agent/LLMProcessManager.ts`

```typescript
import { ContextPool } from './ContextPool.js'

export class LLMProcessManager extends EventEmitter {
  private contextPool: ContextPool | null = null
  
  async start(modelPath: string): Promise<boolean> {
    // ... load model ...
    
    // Create context pool instead of single context
    this.contextPool = new ContextPool(this.model, 3, 4096)
    
    // ... start server ...
  }
  
  private async runInference(messages: ChatMessage[]): Promise<string> {
    // Acquire context from pool
    const context = await this.contextPool!.acquire()
    
    try {
      const sequence = context.getSequence()
      const session = new LlamaChatSession({ contextSequence: sequence })
      
      // ... inference logic ...
      
      return await session.prompt(lastUser.content)
    } finally {
      // Release back to pool
      this.contextPool!.release(context)
    }
  }
  
  stop(): void {
    this.contextPool?.dispose()
    // ... rest of cleanup ...
  }
}
```

**Estimated Time**: 2-3 days  
**Testing**: Concurrent request load testing (10+ simultaneous requests)

---

## Phase 5: Speculative Decoding 🟢 LOW PRIORITY (Performance)

### 5.1 Concept
```
User Request → Draft Model (fast, small)
              ↓
         Generates 3-5 tokens
              ↓
         Main Model (slow, large)
              ↓
         Validates tokens (parallel)
              ↓
         1.5-3x faster output
```

### 5.2 Implementation

#### Step 1: Add Draft Model Support
**File**: `src/main/agent/LLMModelManager.ts`

```typescript
export const DRAFT_MODELS: GGUFModelInfo[] = [
  {
    quant: 'Q4_K_M',
    label: 'Draft Model',
    description: 'Small model for speculative decoding',
    sizeMb: 500,
    filename: 'gemma-2b-it-Q4_K_M.gguf', // Smaller 2B model
  }
]
```

#### Step 2: Load Draft Model
**File**: `src/main/agent/LLMProcessManager.ts`

```typescript
export class LLMProcessManager extends EventEmitter {
  private model: LlamaModelType | null = null
  private draftModel: LlamaModelType | null = null
  
  async start(modelPath: string, draftModelPath?: string): Promise<boolean> {
    // Load main model
    this.model = await this.llama.loadModel({ 
      modelPath,
      gpuLayers: this.gpuLayers
    })
    
    // Load draft model if provided
    if (draftModelPath) {
      this.draftModel = await this.llama.loadModel({
        modelPath: draftModelPath,
        gpuLayers: -1 // Keep draft model fully on GPU
      })
    }
    
    // ... rest of setup ...
  }
}
```

#### Step 3: Implement Speculative Decoding
```typescript
private async runInferenceWithSpeculation(
  messages: ChatMessage[]
): Promise<string> {
  if (!this.draftModel) {
    return this.runInference(messages) // Fallback to normal
  }
  
  // Draft model generates candidate tokens
  const draftSequence = this.draftModel.createContext()
  const candidates = await this.generateDraftTokens(draftSequence, messages, 5)
  
  // Main model validates in parallel
  const validated = await this.validateTokens(candidates, messages)
  
  return validated
}
```

**Estimated Time**: 4-5 days  
**Testing**: Benchmark with/without speculative decoding

---

## Phase 6: Advanced Features 🟢 LOW PRIORITY

### 6.1 Flash Attention (NVIDIA GPUs)
- **Requires**: Custom llama.cpp build with Flash Attention
- **Impact**: 15% throughput boost on NVIDIA
- **Implementation**: Build flag in electron-builder

### 6.2 CUDA Graphs (NVIDIA GPUs)
- **Requires**: llama.cpp with CUDA graph support
- **Impact**: 35% overhead reduction
- **Implementation**: Runtime flag

### 6.3 Memory Pressure Monitoring
**File**: `src/main/agent/MemoryMonitor.ts` (new)

```typescript
export class MemoryMonitor extends EventEmitter {
  private interval: NodeJS.Timeout | null = null
  
  start(): void {
    this.interval = setInterval(() => {
      const usage = process.memoryUsage()
      const heapPercent = (usage.heapUsed / usage.heapTotal) * 100
      
      if (heapPercent > 85) {
        this.emit('pressure-high', usage)
      } else if (heapPercent > 70) {
        this.emit('pressure-medium', usage)
      }
    }, 10000) // Check every 10s
  }
  
  stop(): void {
    if (this.interval) clearInterval(this.interval)
  }
}
```

### 6.4 Model Warmup
```typescript
async warmup(): Promise<void> {
  // Run dummy inference to initialize GPU kernels
  await this.runInference([
    { role: 'user', content: 'Hello' }
  ])
}
```

---

## Implementation Timeline

### Sprint 1 (Week 1-2): Process Isolation
- [ ] Create worker thread architecture
- [ ] Implement IPC communication
- [ ] Add crash recovery
- [ ] Test isolation and stability

### Sprint 2 (Week 3-4): MLX Backend
- [ ] Platform detection logic
- [ ] Python MLX server
- [ ] Backend selector
- [ ] Benchmark vs llama.cpp

### Sprint 3 (Week 5-6): Context Pooling
- [ ] Implement ContextPool class
- [ ] Update LLMProcessManager
- [ ] Concurrent request testing
- [ ] Performance tuning

### Sprint 4 (Week 7-8): Speculative Decoding
- [ ] Add draft model support
- [ ] Implement speculation logic
- [ ] Benchmark speedup
- [ ] UI for enabling/disabling

### Sprint 5 (Week 9-10): Polish & Optimization
- [ ] Memory monitoring
- [ ] Model warmup
- [ ] Advanced GPU features
- [ ] Documentation

---

## Success Metrics

### Performance Targets
- **Stability**: 0 crashes in 1000 consecutive requests
- **Speed (llama.cpp)**: 20-30 tokens/sec on M2 Pro
- **Speed (MLX)**: 40-60 tokens/sec on M2 Pro
- **Memory**: Stable usage, no leaks
- **Concurrency**: Handle 5+ simultaneous requests

### User Experience
- **UI Responsiveness**: Never freeze on inference crash
- **Startup Time**: < 10 seconds to load model
- **Error Recovery**: Auto-restart on crash within 5 seconds

---

## Testing Strategy

### Unit Tests
```typescript
// test/LLMProcessManager.test.ts
describe('LLMProcessManager', () => {
  it('should survive 100 rapid requests', async () => {
    const manager = new LLMProcessManager()
    await manager.start(modelPath)
    
    const requests = Array(100).fill(null).map(() => 
      manager.runInference([{ role: 'user', content: 'test' }])
    )
    
    await Promise.all(requests)
    expect(manager.isRunning()).toBe(true)
  })
})
```

### Integration Tests
- Load testing with concurrent requests
- Crash recovery simulation
- Memory leak detection (run for 1 hour)
- Platform-specific testing (Mac/Windows/Linux)

### Benchmarking
```bash
# Benchmark script
npm run benchmark:llm -- \
  --model gemma-4-e4b-q4 \
  --requests 100 \
  --concurrent 5 \
  --backend llama.cpp

npm run benchmark:llm -- \
  --model gemma-4-e4b-q4 \
  --requests 100 \
  --concurrent 5 \
  --backend mlx
```

---

## Dependencies

### New Dependencies
```json
{
  "dependencies": {
    "node-llama-cpp": "^3.18.1"  // Already installed
  },
  "optionalDependencies": {
    "@mlx-community/mlx-node": "^0.1.0"  // For MLX backend
  },
  "devDependencies": {
    "@types/node": "^22.14.0"  // Already installed
  }
}
```

### System Requirements
- **macOS MLX**: Python 3.9+, pip, mlx-lm
- **NVIDIA CUDA**: CUDA Toolkit 11.8+
- **AMD ROCm**: ROCm 5.4+

---

## Rollout Strategy

### Phase 1: Beta Testing (Internal)
- Deploy to 5-10 internal users
- Monitor crash reports
- Collect performance metrics

### Phase 2: Opt-in Beta (Public)
- Add "Experimental Features" toggle in settings
- Users can enable new backend
- Fallback to stable version on error

### Phase 3: Gradual Rollout
- 10% of users → MLX backend (Mac only)
- 25% of users → Process isolation
- 50% of users → Context pooling
- 100% of users → Full rollout

### Phase 4: Stable Release
- Mark as stable in release notes
- Remove experimental flags
- Update documentation

---

## Risk Mitigation

### Risk 1: MLX Compatibility Issues
- **Mitigation**: Keep llama.cpp as fallback
- **Detection**: Platform check before enabling MLX
- **Recovery**: Auto-switch to llama.cpp on MLX failure

### Risk 2: Worker Thread Overhead
- **Mitigation**: Benchmark before/after
- **Detection**: Performance regression tests
- **Recovery**: Revert to in-process if slower

### Risk 3: Context Pool Deadlocks
- **Mitigation**: Timeout on acquire (30s max)
- **Detection**: Monitor wait times
- **Recovery**: Force-release stuck contexts

---

## Documentation Updates

### User-Facing Docs
- [ ] Update FAQ with MLX vs llama.cpp comparison
- [ ] Add troubleshooting guide for crashes
- [ ] Document GPU layer configuration
- [ ] Create performance tuning guide

### Developer Docs
- [ ] Architecture diagram (process isolation)
- [ ] Backend selection flowchart
- [ ] Context pool lifecycle
- [ ] Contributing guide for new backends

---

## Monitoring & Observability

### Metrics to Track
```typescript
interface LLMMetrics {
  requestsPerMinute: number
  averageLatency: number
  p95Latency: number
  p99Latency: number
  crashCount: number
  memoryUsageMB: number
  gpuUtilization: number
  activeContexts: number
}
```

### Logging
```typescript
// Structured logging
log.info('[LLM]', {
  event: 'inference_complete',
  duration_ms: 1234,
  tokens: 50,
  backend: 'mlx',
  gpu_layers: 20
})
```

---

## Conclusion

This plan transforms ThinkPod's LLM from a crash-prone prototype into a production-grade inference engine matching LM Studio's architecture. The phased approach allows incremental delivery while maintaining stability.

**Next Steps**:
1. Review and approve this plan
2. Begin Sprint 1 (Process Isolation)
3. Set up testing infrastructure
4. Create tracking issues for each phase
