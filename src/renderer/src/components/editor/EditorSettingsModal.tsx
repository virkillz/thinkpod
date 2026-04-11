import { X, RotateCcw } from 'lucide-react'
import { EditorSettings } from '../../types/editorSettings.js'

interface EditorSettingsModalProps {
  isOpen: boolean
  onClose: () => void
  settings: EditorSettings
  onUpdate: (settings: Partial<EditorSettings>) => void
  onReset: () => void
}

export function EditorSettingsModal({
  isOpen,
  onClose,
  settings,
  onUpdate,
  onReset,
}: EditorSettingsModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-parchment-card border border-parchment-dark rounded-2xl shadow-xl w-full max-w-2xl mx-4 max-h-[85vh] overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-parchment-dark">
          <h2 className="font-serif font-medium text-lg text-ink-primary">Editor Settings</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={onReset}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-ink-muted hover:text-accent transition-colors rounded-lg hover:bg-parchment-dark"
              title="Reset to defaults"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </button>
            <button
              onClick={onClose}
              className="text-ink-muted hover:text-ink-primary transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="space-y-6">
            
            {/* Appearance */}
            <section>
              <h3 className="text-sm font-medium text-ink-primary mb-3 uppercase tracking-wide">Appearance</h3>
              <div className="space-y-3">
                <ToggleSetting
                  label="Line numbers"
                  description="Show line numbers in the gutter"
                  checked={settings.lineNumbers}
                  onChange={(checked) => onUpdate({ lineNumbers: checked })}
                />
                <ToggleSetting
                  label="Highlight active line"
                  description="Highlight the line where the cursor is"
                  checked={settings.highlightActiveLine}
                  onChange={(checked) => onUpdate({ highlightActiveLine: checked })}
                />
                <ToggleSetting
                  label="Line wrapping"
                  description="Wrap long lines at the viewport edge"
                  checked={settings.lineWrapping}
                  onChange={(checked) => onUpdate({ lineWrapping: checked })}
                />
                <ToggleSetting
                  label="Show invisible characters"
                  description="Display spaces, tabs, and line breaks"
                  checked={settings.showInvisibles}
                  onChange={(checked) => onUpdate({ showInvisibles: checked })}
                />
              </div>
            </section>

            {/* Typography */}
            <section>
              <h3 className="text-sm font-medium text-ink-primary mb-3 uppercase tracking-wide">Typography</h3>
              <div className="space-y-3">
                <SelectSetting
                  label="Font family"
                  value={settings.fontFamily}
                  options={[
                    { value: 'serif', label: 'Serif (Default)' },
                    { value: 'sans', label: 'Sans-serif' },
                    { value: 'mono', label: 'Monospace' },
                  ]}
                  onChange={(value) => onUpdate({ fontFamily: value as 'serif' | 'sans' | 'mono' })}
                />
                <SliderSetting
                  label="Font size"
                  value={settings.fontSize}
                  min={0.875}
                  max={2}
                  step={0.125}
                  unit="rem"
                  onChange={(value) => onUpdate({ fontSize: value })}
                />
                <SliderSetting
                  label="Line height"
                  value={settings.lineHeight}
                  min={1.2}
                  max={2.5}
                  step={0.05}
                  unit=""
                  onChange={(value) => onUpdate({ lineHeight: value })}
                />
              </div>
            </section>

            {/* Editing */}
            <section>
              <h3 className="text-sm font-medium text-ink-primary mb-3 uppercase tracking-wide">Editing</h3>
              <div className="space-y-3">
                <SliderSetting
                  label="Tab size"
                  value={settings.tabSize}
                  min={2}
                  max={8}
                  step={1}
                  unit="spaces"
                  onChange={(value) => onUpdate({ tabSize: value })}
                />
                <ToggleSetting
                  label="Indent with tabs"
                  description="Use tab character instead of spaces"
                  checked={settings.indentWithTabs}
                  onChange={(checked) => onUpdate({ indentWithTabs: checked })}
                />
                <ToggleSetting
                  label="Auto-close brackets"
                  description="Automatically close brackets and quotes"
                  checked={settings.autoCloseBrackets}
                  onChange={(checked) => onUpdate({ autoCloseBrackets: checked })}
                />
                <ToggleSetting
                  label="Bracket matching"
                  description="Highlight matching brackets"
                  checked={settings.bracketMatching}
                  onChange={(checked) => onUpdate({ bracketMatching: checked })}
                />
              </div>
            </section>

            {/* Features */}
            <section>
              <h3 className="text-sm font-medium text-ink-primary mb-3 uppercase tracking-wide">Features</h3>
              <div className="space-y-3">
                <ToggleSetting
                  label="Spell check"
                  description="Enable browser spell checking"
                  checked={settings.spellCheck}
                  onChange={(checked) => onUpdate({ spellCheck: checked })}
                />
                <ToggleSetting
                  label="Highlight selection matches"
                  description="Highlight other instances of selected text"
                  checked={settings.highlightSelectionMatches}
                  onChange={(checked) => onUpdate({ highlightSelectionMatches: checked })}
                />
                <ToggleSetting
                  label="Focus mode"
                  description="Dim everything except the current paragraph"
                  checked={settings.focusMode}
                  onChange={(checked) => onUpdate({ focusMode: checked })}
                />
                <ToggleSetting
                  label="Typewriter mode"
                  description="Keep cursor centered vertically while typing"
                  checked={settings.typewriterMode}
                  onChange={(checked) => onUpdate({ typewriterMode: checked })}
                />
              </div>
            </section>

          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-parchment-dark bg-parchment-base/50">
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-accent text-white hover:bg-accent/90 transition-colors"
            >
              Done
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}

// Helper components
function ToggleSetting({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1">
        <label className="text-sm text-ink-primary font-medium cursor-pointer">
          {label}
        </label>
        <p className="text-xs text-ink-light mt-0.5">{description}</p>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
          checked ? 'bg-accent' : 'bg-parchment-dark'
        }`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  )
}

function SliderSetting({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  unit: string
  onChange: (value: number) => void
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm text-ink-primary font-medium">{label}</label>
        <span className="text-xs text-ink-muted tabular-nums">
          {value.toFixed(step < 1 ? 2 : 0)}{unit && ` ${unit}`}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 bg-parchment-dark rounded-lg appearance-none cursor-pointer accent-accent"
      />
    </div>
  )
}

function SelectSetting({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
}) {
  return (
    <div>
      <label className="text-sm text-ink-primary font-medium mb-2 block">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg bg-parchment border border-parchment-dark text-ink-primary text-sm focus:outline-none focus:border-accent/50"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  )
}
