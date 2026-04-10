interface StepWelcomeProps {
  onContinue: () => void
}

export function StepWelcome({ onContinue }: StepWelcomeProps) {
  return (
    <div className="flex flex-col justify-center h-full">
      <h1 className="text-3xl font-serif font-medium text-ink-primary mb-5">
        Welcome to ThinkPod.
      </h1>

      <p className="text-lg text-ink-muted mb-3 leading-relaxed">
        Hi Chief! I'm Wilfred, your thought assistant. I shall help you manage your notes and keep your thoughts in order.
      </p>

      <p className="text-ink-muted mb-10 leading-relaxed">
        Let us take a moment to get everything ready. Shall we?
      </p>

      <div>
        <button
          onClick={onContinue}
          className="px-8 py-3 bg-accent hover:bg-accent-hover text-white rounded-lg font-medium transition-colors"
        >
          Begin →
        </button>
      </div>
    </div>
  )
}
