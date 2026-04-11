# AI Providers Guide

ThinkPod works with any OpenAI-compatible API. Choose from local (self-hosted) or cloud providers.

## How to Configure

Go to **Settings → Inference** and enter:
- **Base URL**: Your provider's API endpoint
- **Model**: The model name to use
- **API Key**: Only needed for cloud providers (leave blank for local)

---

## Local / Self-Hosted Providers

Run AI on your own machine. No data leaves your computer, no API costs.

### Ollama

**The easiest way to run LLMs locally.**

- **Website**: [ollama.com](https://ollama.com)
- **Base URL**: `http://localhost:11434/v1`
- **Models**: `llama3.2`, `gemma2`, `qwen2.5`, `mistral`, etc.
- **Quick Start**:
  ```bash
  # Install from ollama.com, then:
  ollama pull llama3.2
  ollama serve
  ```

**Recommended for**: Beginners, macOS users, ease of use

---

### LM Studio

**Beautiful desktop app for running local LLMs with built-in chat interface.**

- **Website**: [lmstudio.ai](https://lmstudio.ai)
- **Base URL**: `http://localhost:1234/v1`
- **Models**: Any GGUF model from HuggingFace
- **Quick Start**:
  1. Download from lmstudio.ai
  2. Browse and download a model
  3. Start the local server

**Recommended for**: Users who want a GUI, Windows users

---

### llama.cpp

**The original C++ implementation. Most efficient for CPU inference.**

- **Website**: [github.com/ggerganov/llama.cpp](https://github.com/ggerganov/llama.cpp)
- **Base URL**: `http://localhost:8080/v1`
- **Models**: GGUF format models
- **Quick Start**:
  ```bash
  # Build from source or download binary
  ./server --model ./models/llama-3.2-3b.gguf --port 8080
  ```

**Recommended for**: Advanced users, maximum performance, custom setups

---

### LocalAI

**Self-hosted OpenAI-compatible API supporting multiple model formats.**

- **Website**: [localai.io](https://localai.io)
- **Base URL**: `http://localhost:8080/v1`
- **Models**: GGUF, GPTQ, AWQ, and more
- **Quick Start**:
  ```bash
  # Run via Docker
  docker run -p 8080:8080 localai/localai
  ```

**Recommended for**: Docker users, multi-model setups, advanced features

---

## Cloud Providers

Use powerful remote models without the hardware requirements. Requires API key and internet connection.

### OpenRouter

**Unified API for hundreds of models. Great for trying different options.**

- **Website**: [openrouter.ai](https://openrouter.ai)
- **Base URL**: `https://openrouter.ai/api/v1`
- **Models**: 
  - `openai/gpt-4o`
  - `anthropic/claude-3.5-sonnet`
  - `meta-llama/llama-3.2-70b`
  - [Full list](https://openrouter.ai/models)
- **Get API Key**: [openrouter.ai/keys](https://openrouter.ai/keys)

**Recommended for**: Trying different models, flexibility, pay-per-use

---

### Together AI

**Fast inference for open-source models with competitive pricing.**

- **Website**: [together.ai](https://www.together.ai)
- **Base URL**: `https://api.together.xyz/v1`
- **Models**: 
  - `meta-llama/Llama-3.2-70B-Instruct-Turbo`
  - `mistralai/Mixtral-8x7B-Instruct-v0.1`
  - `Qwen/Qwen2.5-72B-Instruct-Turbo`
- **Get API Key**: [api.together.xyz](https://api.together.xyz)

**Recommended for**: Open-source models, good pricing, fast inference

---

### Groq

**Blazing fast inference powered by LPUs. Great for real-time apps.**

- **Website**: [groq.com](https://groq.com)
- **Base URL**: `https://api.groq.com/openai/v1`
- **Models**: 
  - `llama-3.2-70b-versatile`
  - `mixtral-8x7b-32768`
  - `gemma2-9b-it`
- **Get API Key**: [console.groq.com](https://console.groq.com)

**Recommended for**: Speed, real-time responses, free tier

---

### DeepSeek

**Chinese AI lab with powerful open-source models at great prices.**

- **Website**: [deepseek.com](https://deepseek.com)
- **Base URL**: `https://api.deepseek.com/v1`
- **Models**: 
  - `deepseek-chat`
  - `deepseek-coder`
- **Get API Key**: [platform.deepseek.com](https://platform.deepseek.com)

**Recommended for**: Low cost, coding tasks, Chinese language

---

### Cohere

**Enterprise-focused with excellent command models and embeddings.**

- **Website**: [cohere.com](https://cohere.com)
- **Base URL**: `https://api.cohere.com/v1`
- **Models**: 
  - `command-r`
  - `command-r-plus`
- **Get API Key**: [cohere.com/dashboard](https://cohere.com/dashboard)

**Recommended for**: Enterprise use, RAG applications, embeddings

---

### OpenAI

**The original GPT models. Most capable but requires API credits.**

- **Website**: [openai.com](https://openai.com)
- **Base URL**: `https://api.openai.com/v1`
- **Models**: 
  - `gpt-4o`
  - `gpt-4o-mini`
  - `o1-preview`
- **Get API Key**: [platform.openai.com](https://platform.openai.com)

**Recommended for**: Maximum capability, production use, latest features

---

## Choosing a Provider

### For Privacy & Cost Savings
→ **Local providers** (Ollama, LM Studio)

### For Maximum Quality
→ **OpenAI** (`gpt-4o`) or **Anthropic** (via OpenRouter)

### For Speed
→ **Groq** (fastest inference)

### For Experimentation
→ **OpenRouter** (access to many models)

### For Budget
→ **DeepSeek** or **Together AI** (cheapest cloud options)

---

## Hardware Requirements (Local)

| Model Size | RAM Needed | Speed | Quality |
|------------|------------|-------|---------|
| 3B-4B | 8GB | Fast | Good for simple tasks |
| 7B-8B | 16GB | Medium | Good for most tasks |
| 13B-14B | 24GB | Slower | Very good |
| 70B+ | 64GB+ | Slow | Excellent |

**Recommended starter**: `llama3.2:3b` on Ollama (runs on most laptops)

---

## Testing Your Configuration

After configuring a provider:

1. Open ThinkPod
2. Press `Cmd+J` to open Wilfred
3. Type: "Hello, are you working?"
4. Press Enter

If Wilfred responds, your configuration is correct!

---

## Troubleshooting

### "Connection failed"
- Check the Base URL is correct
- Ensure the server is running (for local providers)
- Test the URL in your browser

### "Invalid API key"
- Verify the key is correct (no extra spaces)
- Check the key hasn't expired
- Ensure you have credits (for paid providers)

### "Model not found"
- Check the model name spelling
- Verify the model is available for your provider
- For Ollama: run `ollama list` to see downloaded models

### Slow responses
- **Local**: Upgrade to a faster model or better hardware
- **Cloud**: Check your internet connection
- **Both**: Try a smaller model

---

## Next Steps

- [Wilfred Guide](./wilfred.md) - Learn to work with your AI agent
- [Settings Reference](./settings.md) - All configuration options
- [FAQ](./faq.md) - Common questions
