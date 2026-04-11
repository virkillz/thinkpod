export interface EditorSettings {
  // Appearance
  lineNumbers: boolean
  highlightActiveLine: boolean
  lineWrapping: boolean
  
  // Typography
  fontSize: number  // in rem
  lineHeight: number
  fontFamily: 'serif' | 'sans' | 'mono'
  
  // Editing
  tabSize: number
  indentWithTabs: boolean
  autoCloseBrackets: boolean
  bracketMatching: boolean
  
  // Features
  spellCheck: boolean
  focusMode: boolean  // dim everything except current paragraph
  typewriterMode: boolean  // keep cursor centered
  
  // Advanced
  showInvisibles: boolean  // show spaces, tabs, line breaks
  highlightSelectionMatches: boolean
}

export const DEFAULT_EDITOR_SETTINGS: EditorSettings = {
  lineNumbers: false,
  highlightActiveLine: true,
  lineWrapping: true,
  fontSize: 1.25,
  lineHeight: 1.85,
  fontFamily: 'serif',
  tabSize: 2,
  indentWithTabs: false,
  autoCloseBrackets: true,
  bracketMatching: true,
  spellCheck: true,
  focusMode: false,
  typewriterMode: false,
  showInvisibles: false,
  highlightSelectionMatches: false,
}

export const FONT_FAMILIES = {
  serif: 'var(--font-editor)',
  sans: 'system-ui, -apple-system, sans-serif',
  mono: 'ui-monospace, monospace',
}
