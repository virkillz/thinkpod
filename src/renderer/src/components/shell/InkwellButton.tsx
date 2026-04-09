import { useState } from 'react'
import { PenLine } from 'lucide-react'
import { CaptureSheet } from './CaptureSheet.js'

interface InkwellButtonProps {
  compact?: boolean
}

export function InkwellButton({ compact }: InkwellButtonProps) {
  const [isCaptureOpen, setIsCaptureOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setIsCaptureOpen(true)}
        className={`w-full flex items-center justify-center gap-2 px-4 py-3 bg-accent hover:bg-accent-hover text-white rounded-lg font-medium transition-all shadow-sm hover:shadow-md ${
          compact ? 'px-2' : ''
        }`}
      >
        <PenLine className="w-5 h-5" />
        {!compact && <span>New Folio</span>}
      </button>

      <CaptureSheet 
        isOpen={isCaptureOpen} 
        onClose={() => setIsCaptureOpen(false)} 
      />
    </>
  )
}
