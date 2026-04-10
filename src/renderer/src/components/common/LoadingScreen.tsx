export function LoadingScreen() {
  return (
    <div className="w-full h-screen flex items-center justify-center bg-parchment-base">
      <div className="text-center">
        <div className="text-2xl font-serif text-ink-primary mb-4">ThinkPod</div>
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    </div>
  )
}
