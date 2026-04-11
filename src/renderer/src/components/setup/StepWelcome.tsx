import { useState } from 'react'

interface StepWelcomeProps {
  onContinue: (name: string) => void
}

export function StepWelcome({ onContinue }: StepWelcomeProps) {
  const [name, setName] = useState('')

  const handleContinue = () => {
    const userName = name.trim() || 'Chief'
    onContinue(userName)
  }

  return (
    <div className="flex flex-col justify-center h-full">
      <h1 className="text-3xl font-serif font-medium text-ink-primary mb-5">
        Welcome to ThinkPod.
      </h1>

      <p className="text-lg text-ink-muted mb-3 leading-relaxed">
        Hello! I'm Wilfred, your thought assistant. I shall help you manage your notes and keep your thoughts in order.
      </p>

      <p className="text-ink-muted mb-6 leading-relaxed">
        Let us take a moment to get everything ready. Shall we?
      </p>

      <div className="mb-10">
        <label className="block text-sm font-medium text-ink-primary mb-2">
          How should I call you?
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleContinue()}
          placeholder="Chief"
          className="w-full px-4 py-3 bg-parchment-base border border-parchment-dark rounded-lg focus:outline-none focus:border-accent text-sm"
          autoFocus
        />
      </div>

      <div>
        <button
          onClick={handleContinue}
          className="px-8 py-3 bg-accent hover:bg-accent-hover text-white rounded-lg font-medium transition-colors"
        >
          Begin →
        </button>
      </div>
    </div>
  )
}
