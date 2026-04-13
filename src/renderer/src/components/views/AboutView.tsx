import { useState, useEffect } from 'react'
import { Info, HelpCircle, Server, Github, ExternalLink, BookOpen, MessageCircle, Brain, Shield, Zap, Cloud, Laptop, Copy, Check, Keyboard, BarChart2 } from 'lucide-react'

type AboutTab = 'about' | 'faq' | 'providers' | 'shortcuts' | 'stats'

const TABS: { id: AboutTab; label: string; icon: React.ElementType }[] = [
  { id: 'about', label: 'About', icon: Info },
  { id: 'faq', label: 'FAQ', icon: HelpCircle },
  { id: 'providers', label: 'Providers', icon: Server },
  { id: 'shortcuts', label: 'Shortcuts', icon: Keyboard },
  { id: 'stats', label: 'Stats', icon: BarChart2 },
]

function AboutTab() {
  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center gap-3">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" className="text-accent">
            <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5">
              <path d="M7 14a3 3 0 1 0 1 5.83"/>
              <path d="M4.264 15.605a4 4 0 0 1-.874-6.636m.03-.081A2.5 2.5 0 0 1 7 5.5m.238.065A2.5 2.5 0 1 1 12 4.5V20m-4 0a2 2 0 1 0 4 0m0-13a3 3 0 0 0 3 3m2 4a3 3 0 1 1-1 5.83"/>
              <path d="M19.736 15.605a4 4 0 0 0 .874-6.636m-.03-.081A2.5 2.5 0 0 0 17 5.5m-5-1a2.5 2.5 0 1 1 4.762 1.065M16 20a2 2 0 1 1-4 0"/>
            </g>
          </svg>
          <h1 className="text-4xl font-serif font-bold text-ink-primary">ThinkPod</h1>
        </div>
        <p className="text-lg text-ink-muted">An IDE for your thoughts, not your code. 100% Local.</p>
        <p className="text-sm text-ink-faint">Version 0.1.0 • by <span className="text-accent">virkillz</span></p>
      </div>

      <a href="https://github.com/virkillz/thinkpod" target="_blank" rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 p-4 rounded-xl border border-parchment-dark bg-parchment-card hover:border-accent transition-colors group">
        <Github className="w-5 h-5 text-ink-muted group-hover:text-accent" />
        <span className="text-ink-primary">github.com/virkillz/thinkpod</span>
        <ExternalLink className="w-4 h-4 text-ink-faint" />
      </a>

      <section className="space-y-4">
        <h2 className="text-xl font-serif font-semibold text-ink-primary flex items-center gap-2">
          <Brain className="w-5 h-5 text-accent" /> Core Philosophy
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-parchment-card border border-parchment-dark">
            <Shield className="w-6 h-6 text-accent mb-2" />
            <h3 className="font-medium text-ink-primary mb-1">Local-first</h3>
            <p className="text-sm text-ink-muted">All your notes and AI processing run on your machine. No cloud, no subscription, no privacy trade-off.</p>
          </div>
          <div className="p-4 rounded-xl bg-parchment-card border border-parchment-dark">
            <MessageCircle className="w-6 h-6 text-accent mb-2" />
            <h3 className="font-medium text-ink-primary mb-1">Agent-native</h3>
            <p className="text-sm text-ink-muted">Wilfred is not a chatbot bolted on top — he lives inside the app and participates in your writing lifecycle.</p>
          </div>
          <div className="p-4 rounded-xl bg-parchment-card border border-parchment-dark">
            <Zap className="w-6 h-6 text-accent mb-2" />
            <h3 className="font-medium text-ink-primary mb-1">Fast capture</h3>
            <p className="text-sm text-ink-muted">Ideas are fleeting. ThinkPod makes it quick and frictionless to get thoughts down, then helps improve them.</p>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-serif font-semibold text-ink-primary flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-accent" /> What is ThinkPod?
        </h2>
        <div className="text-ink-secondary space-y-4 text-sm leading-relaxed">
          <p>ThinkPod is a <strong>fully local, AI-powered personal knowledge base</strong> built as a desktop app. It is a note-taking app at its core — but the goal goes beyond that. The vision is to make you feel like there is a <strong>smart, sentient being living inside your notes</strong>: an entity that reads what you write, understands your thinking, asks the right questions, and helps you connect ideas you would have otherwise missed.</p>
          <p>At its foundation, ThinkPod embeds an AI agent — <strong>Wilfred</strong> — deeply into every part of the document lifecycle: capturing, organizing, reviewing, and generating insight from your notes. Together, you and Wilfred become more than the sum of your parts — a unified system for unleashing your knowledge.</p>
        </div>
      </section>

      <section className="p-6 rounded-xl bg-accent/5 border border-accent/20">
        <h2 className="text-lg font-serif font-semibold text-ink-primary mb-3">The Core Differentiator</h2>
        <p className="text-ink-secondary text-sm leading-relaxed">Most note-taking apps treat AI as a <em>reactive</em> tool — you ask, it answers. ThinkPod flips this: the agent is <em>proactive</em>, running continuously, building its own understanding of your vault over time. This is not just a feature difference. It&apos;s a philosophical one. Imagine a brilliant research assistant who lives in your library, reads everything you&apos;ve written, thinks about it while you sleep, and leaves you notes in the morning.</p>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-serif font-semibold text-ink-primary">Tech Stack</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
          <div className="p-3 rounded-lg bg-parchment-card border border-parchment-dark">
            <span className="text-ink-faint">Shell</span>
            <p className="text-ink-primary font-medium">Electron</p>
          </div>
          <div className="p-3 rounded-lg bg-parchment-card border border-parchment-dark">
            <span className="text-ink-faint">UI</span>
            <p className="text-ink-primary font-medium">React 19 + Tailwind</p>
          </div>
          <div className="p-3 rounded-lg bg-parchment-card border border-parchment-dark">
            <span className="text-ink-faint">Build</span>
            <p className="text-ink-primary font-medium">Vite</p>
          </div>
          <div className="p-3 rounded-lg bg-parchment-card border border-parchment-dark">
            <span className="text-ink-faint">Database</span>
            <p className="text-ink-primary font-medium">SQLite</p>
          </div>
          <div className="p-3 rounded-lg bg-parchment-card border border-parchment-dark">
            <span className="text-ink-faint">Voice</span>
            <p className="text-ink-primary font-medium">Whisper</p>
          </div>
          <div className="p-3 rounded-lg bg-parchment-card border border-parchment-dark">
            <span className="text-ink-faint">AI Runtime</span>
            <p className="text-ink-primary font-medium">OpenAI-compatible</p>
          </div>
        </div>
      </section>
    </div>
  )
}

function FAQTab() {
  const faqs = [
    { q: 'Is ThinkPod really 100% local?', a: 'Yes! All your notes are stored locally as markdown files, all settings stored in SQLite. The AI runs through a local model server like Ollama or LM Studio. Your data never leaves your machine unless you explicitly configure a cloud provider.' },
    { q: 'What hardware do I need?', a: 'ThinkPod works with any OpenAI-compatible API, including cloud providers. For local models, we recommend at least 8GB RAM for smaller models (3B-4B parameters).' },
    { q: 'Can I use my own AI models?', a: 'Absolutely! ThinkPod uses the OpenAI API format, so any compatible provider works — local (Ollama, LM Studio) or cloud (OpenRouter, Together AI, Groq, etc.).' },
    { q: 'Where are my notes stored?', a: 'Your notes are stored in a local folder you choose during setup (your Vault). Everything is plain Markdown files you own, plus metadata in a local SQLite database.' },
    { q: 'Is there a mobile app?', a: 'Not yet. ThinkPod is currently desktop-only (macOS, Windows, Linux).' },
    { q: 'How does Wilfred differ from ChatGPT?', a: 'Wilfred is proactive, not just reactive. He runs continuously, reads your notes, and surfaces insights without you asking. He has memory across sessions and understands your entire vault context.' },
    { q: 'Is there a subscription fee?', a: 'No. ThinkPod is free and open source. You only pay if you choose to use a cloud AI provider.' },
    { q: 'Can I export my notes?', a: 'Yes! Your notes are plain Markdown files in your Vault folder. You can access, move, or back them up anytime. No lock-in.' },
  ]

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-serif font-semibold text-ink-primary">Frequently Asked Questions</h2>
        <p className="text-ink-muted">Everything you need to know about ThinkPod</p>
      </div>
      <div className="space-y-4">
        {faqs.map((faq, i) => (
          <div key={i} className="p-5 rounded-xl bg-parchment-card border border-parchment-dark hover:border-accent/30 transition-colors">
            <h3 className="font-medium text-ink-primary mb-2 flex items-start gap-2">
              <HelpCircle className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" /> {faq.q}
            </h3>
            <p className="text-sm text-ink-secondary leading-relaxed pl-7">{faq.a}</p>
          </div>
        ))}
      </div>
      <div className="text-center p-6 rounded-xl bg-accent/5 border border-accent/20">
        <p className="text-ink-secondary text-sm">Still have questions? Visit our <a href="https://github.com/virkillz/thinkpod" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">GitHub repository</a> to open an issue.</p>
      </div>
    </div>
  )
}

function CopyableUrl({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => { navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000) }
  return (
    <button onClick={copy} className="flex items-center gap-2 text-xs font-mono bg-parchment-base px-2 py-1 rounded hover:bg-parchment-dark transition-colors group" title="Click to copy">
      <span className="text-ink-secondary">{url}</span>
      {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3 text-ink-faint group-hover:text-accent" />}
    </button>
  )
}

function ProvidersTab() {
  const localProviders = [
    { name: 'Ollama', desc: 'The easiest way to run LLMs locally. Download and run models with a single command.', url: 'http://localhost:11434/v1', models: 'llama3.2, gemma2, qwen2.5, mistral, etc.', setup: 'Install from ollama.com, then: ollama pull llama3.2', web: 'https://ollama.com' },
    { name: 'LM Studio', desc: 'Beautiful desktop app for running local LLMs with built-in chat interface.', url: 'http://localhost:1234/v1', models: 'Any GGUF model from HuggingFace', setup: 'Download from lmstudio.ai, start the local server', web: 'https://lmstudio.ai' },
    { name: 'llama.cpp', desc: 'The original C++ implementation. Most efficient for CPU inference.', url: 'http://localhost:8080/v1', models: 'GGUF format models', setup: 'Build from source or download binary, run with --server', web: 'https://github.com/ggerganov/llama.cpp' },
    { name: 'LocalAI', desc: 'Self-hosted OpenAI-compatible API supporting multiple model formats.', url: 'http://localhost:8080/v1', models: 'GGUF, GPTQ, AWQ, and more', setup: 'Run via Docker or binary, configure models/', web: 'https://localai.io' },
  ]

  const cloudProviders = [
    { name: 'OpenRouter', desc: 'Unified API for hundreds of models. Great for trying different options.', url: 'https://openrouter.ai/api/v1', models: 'openai/gpt-4o, anthropic/claude-3.5-sonnet, meta-llama/llama-3.2-70b', key: 'openrouter.ai/keys', web: 'https://openrouter.ai' },
    { name: 'Together AI', desc: 'Fast inference for open-source models with competitive pricing.', url: 'https://api.together.xyz/v1', models: 'meta-llama/Llama-3.2-70B-Instruct-Turbo', key: 'api.together.xyz', web: 'https://www.together.ai' },
    { name: 'Groq', desc: 'Blazing fast inference powered by LPUs. Great for real-time apps.', url: 'https://api.groq.com/openai/v1', models: 'llama-3.2-70b-versatile, mixtral-8x7b-32768', key: 'console.groq.com', web: 'https://groq.com' },
    { name: 'DeepSeek', desc: 'Chinese AI lab with powerful open-source models at great prices.', url: 'https://api.deepseek.com/v1', models: 'deepseek-chat, deepseek-coder', key: 'platform.deepseek.com', web: 'https://deepseek.com' },
    { name: 'Cohere', desc: 'Enterprise-focused with excellent command models and embeddings.', url: 'https://api.cohere.com/v1', models: 'command-r, command-r-plus', key: 'cohere.com/dashboard', web: 'https://cohere.com' },
    { name: 'OpenAI', desc: 'The original GPT models. Most capable but requires API credits.', url: 'https://api.openai.com/v1', models: 'gpt-4o, gpt-4o-mini, o1-preview', key: 'platform.openai.com', web: 'https://openai.com' },
  ]

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-serif font-semibold text-ink-primary">AI Providers</h2>
        <p className="text-ink-muted">ThinkPod works with any OpenAI-compatible API. Choose from local (self-hosted) or cloud providers.</p>
      </div>

      <div className="p-4 rounded-xl bg-accent/5 border border-accent/20">
        <h3 className="font-medium text-ink-primary mb-2">How to Configure</h3>
        <p className="text-sm text-ink-secondary">Go to <strong>Settings → Inference</strong> and enter your provider&apos;s Base URL and Model name. For cloud providers, you&apos;ll also need an API key.</p>
      </div>

      <section className="space-y-4">
        <h3 className="text-lg font-serif font-semibold text-ink-primary flex items-center gap-2">
          <Laptop className="w-5 h-5 text-accent" /> Local / Self-Hosted
        </h3>
        <p className="text-sm text-ink-muted">Run AI on your own machine. No data leaves your computer, no API costs.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {localProviders.map((p) => (
            <div key={p.name} className="p-4 rounded-xl bg-parchment-card border border-parchment-dark hover:border-accent/30 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-ink-primary">{p.name}</h4>
                <a href={p.web} target="_blank" rel="noopener noreferrer" className="text-xs text-accent hover:underline flex items-center gap-1">Website <ExternalLink className="w-3 h-3" /></a>
              </div>
              <p className="text-sm text-ink-muted mb-3">{p.desc}</p>
              <div className="space-y-2">
                <div><span className="text-xs text-ink-faint">Base URL:</span><CopyableUrl url={p.url} /></div>
                <div><span className="text-xs text-ink-faint">Models:</span><p className="text-xs text-ink-secondary font-mono">{p.models}</p></div>
                <div><span className="text-xs text-ink-faint">Quick Start:</span><p className="text-xs text-ink-secondary">{p.setup}</p></div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-lg font-serif font-semibold text-ink-primary flex items-center gap-2">
          <Cloud className="w-5 h-5 text-accent" /> Cloud Providers
        </h3>
        <p className="text-sm text-ink-muted">Use powerful remote models without the hardware requirements. Requires API key and internet connection.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {cloudProviders.map((p) => (
            <div key={p.name} className="p-4 rounded-xl bg-parchment-card border border-parchment-dark hover:border-accent/30 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-ink-primary">{p.name}</h4>
                <a href={p.web} target="_blank" rel="noopener noreferrer" className="text-xs text-accent hover:underline flex items-center gap-1">Website <ExternalLink className="w-3 h-3" /></a>
              </div>
              <p className="text-sm text-ink-muted mb-3">{p.desc}</p>
              <div className="space-y-2">
                <div><span className="text-xs text-ink-faint">Base URL:</span><CopyableUrl url={p.url} /></div>
                <div><span className="text-xs text-ink-faint">Models:</span><p className="text-xs text-ink-secondary font-mono">{p.models}</p></div>
                <div><span className="text-xs text-ink-faint">Get API Key:</span><p className="text-xs text-ink-secondary">{p.key}</p></div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="text-center p-6 rounded-xl bg-parchment-card border border-parchment-dark">
        <p className="text-ink-secondary text-sm">Missing a provider? ThinkPod works with <strong>any</strong> OpenAI-compatible API. Just enter the Base URL and Model name in Settings.</p>
      </div>
    </div>
  )
}

// ─── Shortcuts Tab ───────────────────────────────────────────────────────────

function ShortcutsTab() {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
  const mod = isMac ? '⌘' : 'Ctrl'

  const shortcuts = [
    {
      category: 'Navigation',
      items: [
        { key: `${mod} + N`, description: 'Create new thought' },
        { key: `${mod} + B`, description: 'Toggle sidebar' },
        { key: `${mod} + J`, description: 'Toggle Agent Chat (Wilfred)' },
        { key: `${mod} + H`, description: 'Go to Home' },
        { key: `Esc`, description: 'Close panels / Go back' },
      ]
    },
    {
      category: 'Document Editing',
      items: [
        { key: `${mod} + S`, description: 'Save current document' },
        { key: `${mod} + Enter`, description: 'Save and close (in New Thought)' },
        { key: `${mod} + Enter`, description: 'Send message (in Inbox/Chat)' },
        { key: `${mod} + Z`, description: 'Undo' },
        { key: `${mod} + Shift + Z`, description: 'Redo' },
      ]
    },
    {
      category: 'Agent Chat',
      items: [
        { key: `Enter`, description: 'Send message' },
        { key: `Shift + Enter`, description: 'New line in message' },
        { key: `↑`, description: 'Edit previous message (when input empty)' },
      ]
    },
    {
      category: 'File Tree',
      items: [
        { key: `F2`, description: 'Rename selected file/folder' },
        { key: `Enter`, description: 'Confirm rename' },
        { key: `Esc`, description: 'Cancel rename' },
      ]
    },
  ]

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-serif font-semibold text-ink-primary">Keyboard Shortcuts</h2>
        <p className="text-ink-muted">Work faster with these keyboard shortcuts</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {shortcuts.map((group) => (
          <div key={group.category} className="p-5 rounded-xl bg-parchment-card border border-parchment-dark">
            <h3 className="font-semibold text-ink-primary mb-4 flex items-center gap-2">
              <Keyboard className="w-4 h-4 text-accent" />
              {group.category}
            </h3>
            <div className="space-y-3">
              {group.items.map((item, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-sm text-ink-secondary">{item.description}</span>
                  <kbd className="px-2 py-1 text-xs font-mono bg-parchment-base border border-parchment-dark rounded text-ink-primary whitespace-nowrap">
                    {item.key}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 rounded-xl bg-accent/5 border border-accent/20">
        <p className="text-sm text-ink-secondary">
          <strong>Tip:</strong> On {isMac ? 'macOS' : 'Windows/Linux'}, the primary modifier key is <kbd className="px-1.5 py-0.5 text-xs font-mono bg-parchment-base border border-parchment-dark rounded">{mod}</kbd>. 
          Some shortcuts may vary based on your operating system.
        </p>
      </div>
    </div>
  )
}

// ─── Stats Tab ────────────────────────────────────────────────────────────────

function StatsTab() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<{
    totalDocuments: number
    totalTags: number
    avgTagsPerDoc: number
    topTags: Array<{ tag: string; count: number }>
  } | null>(null)

  useEffect(() => {
    window.electronAPI.getStatsOverview().then((data) => {
      setStats(data)
      setLoading(false)
    })
  }, [])

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto flex items-center justify-center h-48">
        <p className="text-ink-muted text-sm animate-pulse">Loading stats…</p>
      </div>
    )
  }

  if (!stats) return null

  const maxCount = stats.topTags[0]?.count ?? 1

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-serif font-semibold text-ink-primary">Vault Statistics</h2>
        <p className="text-ink-muted">An overview of your knowledge base</p>
      </div>

      {/* Overview cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[
          { label: 'Documents', value: stats.totalDocuments },
          { label: 'Unique Tags', value: stats.totalTags },
          { label: 'Avg Tags / Doc', value: stats.avgTagsPerDoc.toFixed(1) },
        ].map(({ label, value }) => (
          <div key={label} className="p-5 rounded-xl bg-parchment-card border border-parchment-dark text-center">
            <p className="text-3xl font-serif font-bold text-accent">{value}</p>
            <p className="text-sm text-ink-muted mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Top tags */}
      {stats.topTags.length > 0 ? (
        <section className="space-y-4">
          <h3 className="text-lg font-serif font-semibold text-ink-primary flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-accent" /> Top Tags
          </h3>
          <div className="space-y-2">
            {stats.topTags.map(({ tag, count }) => (
              <div key={tag} className="flex items-center gap-3">
                <span className="w-36 text-sm text-ink-secondary truncate text-right">{tag}</span>
                <div className="flex-1 h-2 rounded-full bg-parchment-dark overflow-hidden">
                  <div
                    className="h-full rounded-full bg-accent transition-all"
                    style={{ width: `${(count / maxCount) * 100}%` }}
                  />
                </div>
                <span className="w-8 text-xs text-ink-faint text-right">{count}</span>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <div className="text-center p-8 rounded-xl bg-parchment-card border border-parchment-dark">
          <p className="text-ink-muted text-sm">No tags found. Add <code className="text-accent">tags:</code> frontmatter to your notes.</p>
        </div>
      )}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function AboutView() {
  const [activeTab, setActiveTab] = useState<AboutTab>('about')

  return (
    <div className="h-full flex flex-col bg-parchment-base">
      <header className="px-6 py-4 border-b border-parchment-dark">
        <h1 className="text-xl font-serif font-semibold text-ink-primary">About ThinkPod</h1>
      </header>

      <div className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto">
          <div className="flex gap-1 p-2 border-b border-parchment-dark">
            {TABS.map((tab) => {
              const Icon = tab.icon
              const active = activeTab === tab.id
              return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${active ? 'bg-accent/10 text-accent' : 'text-ink-muted hover:bg-parchment-dark hover:text-ink-primary'}`}>
                  <Icon className="w-4 h-4" /> {tab.label}
                </button>
              )
            })}
          </div>

          <div className="p-6">
            {activeTab === 'about' && <AboutTab />}
            {activeTab === 'faq' && <FAQTab />}
            {activeTab === 'providers' && <ProvidersTab />}
            {activeTab === 'shortcuts' && <ShortcutsTab />}
            {activeTab === 'stats' && <StatsTab />}
          </div>
        </div>
      </div>
    </div>
  )
}