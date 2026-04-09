interface StepWelcomeProps {
  onContinue: () => void
}

export function StepWelcome({ onContinue }: StepWelcomeProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center">
      <div className="mb-6">
        <span className="text-6xl">✦</span>
      </div>
      
      <h1 className="text-4xl font-serif font-medium text-ink-primary mb-4">
        Scriptorium
      </h1>
      
      <p className="text-lg text-ink-muted max-w-md mb-8 leading-relaxed">
        Welcome to the Scriptorium.
        <br />
        <span className="text-ink-primary">I am Wilfred</span>, your faithful monk.
        <br />
        I will help you tend your manuscripts
        <br />
        and keep your thoughts in order.
      </p>
      
      <button
        onClick={onContinue}
        className="px-8 py-3 bg-accent hover:bg-accent-hover text-white rounded-lg font-medium transition-colors"
      >
        Begin →
      </button>
    </div>
  )
}
