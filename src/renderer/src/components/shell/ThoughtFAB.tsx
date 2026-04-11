import { useState } from 'react'
import { useAppStore } from '../../store/appStore.js'
import { PenLine } from 'lucide-react'

export function ThoughtFAB() {
  const { currentView, setCurrentView } = useAppStore()
  const [isAnimating, setIsAnimating] = useState(false)

  if (currentView === 'newthought') return null

  const handleNewThought = () => {
    setIsAnimating(true)
    setCurrentView('newthought')
    setTimeout(() => setIsAnimating(false), 300)
  }

  return (
    <div className="fixed bottom-28 right-6 z-40">
      <button
        onClick={handleNewThought}
        className={`
          relative w-14 h-14 bg-accent/80 rounded-full flex items-center justify-center
          shadow-lg hover:shadow-xl transition-all duration-300 ease-out
          hover:scale-105 hover:bg-accent
          ${isAnimating ? 'scale-90' : 'scale-100'}
          group
        `}
        title="Capture new thought"
      >
        <span
          className={`
            absolute inset-0 rounded-full bg-accent/20
            transition-all duration-500 ease-out
            ${isAnimating ? 'scale-[2.5] opacity-0' : 'scale-100 opacity-0'}
          `}
        />
        <PenLine 
          className={`
            w-6 h-6 text-white transition-transform duration-300 ease-out
            ${isAnimating ? 'rotate-12' : 'rotate-0'}
            group-hover:scale-110
          `}
        />
      </button>
    </div>
  )
}
