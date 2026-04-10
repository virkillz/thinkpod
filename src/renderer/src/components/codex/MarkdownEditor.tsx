import { useEffect, useRef, useCallback } from 'react'
import { EditorView, keymap, lineNumbers } from '@codemirror/view'
import { EditorState, Extension } from '@codemirror/state'
import { markdown } from '@codemirror/lang-markdown'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'

interface MarkdownEditorProps {
  content: string
  onChange: (content: string) => void
  onSave: (content: string) => void
  filePath: string
}

export function MarkdownEditor({ content, onChange, onSave, filePath }: MarkdownEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)

  // Custom theme for parchment
  const parchmentTheme = EditorView.theme({
    '&': {
      fontSize: '16px',
      fontFamily: "'Lora', Georgia, serif",
      backgroundColor: '#F5F0E8',
    },
    '.cm-content': {
      fontFamily: "'Lora', Georgia, serif",
      lineHeight: '1.7',
      padding: '8px',
      maxWidth: '800px',
      margin: '0 auto',
    },
    '.cm-gutters': {
      backgroundColor: '#EDE8DC',
      borderRight: '1px solid #E5DDD0',
      fontFamily: "'Inter', system-ui, sans-serif",
      fontSize: '12px',
    },
    '.cm-activeLineGutter': {
      backgroundColor: '#D4B89620',
    },
    '.cm-activeLine': {
      backgroundColor: '#D4B89610',
    },
    '.cm-line': {
      padding: '0 4px',
    },
    '.cm-cursor': {
      borderLeftColor: '#8B6914',
    },
    '.cm-selectionBackground': {
      backgroundColor: '#D4B89660',
    },
    '.cm-focused .cm-selectionBackground': {
      backgroundColor: '#D4B89680',
    },
  })

  const saveKeymap = useCallback(() => {
    return keymap.of([
      {
        key: 'Mod-s',
        run: (view) => {
          onSave(view.state.doc.toString())
          return true
        },
      },
      ...defaultKeymap,
      ...historyKeymap,
    ])
  }, [onSave])

  useEffect(() => {
    if (!editorRef.current) return

    const extensions: Extension[] = [
      markdown(),
      history(),
      lineNumbers(),
      parchmentTheme,
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          onChange(update.state.doc.toString())
        }
      }),
      saveKeymap(),
      EditorState.readOnly.of(filePath.startsWith('_epistles/')),
    ]

    const state = EditorState.create({
      doc: content,
      extensions,
    })

    const view = new EditorView({
      state,
      parent: editorRef.current,
    })

    viewRef.current = view

    return () => {
      view.destroy()
      viewRef.current = null
    }
  }, [filePath]) // Recreate editor when file changes

  // Update content when it changes externally
  useEffect(() => {
    const view = viewRef.current
    if (!view || view.state.doc.toString() === content) return

    const transaction = view.state.update({
      changes: { from: 0, to: view.state.doc.length, insert: content },
    })
    view.dispatch(transaction)
  }, [content])

  return (
    <div 
      ref={editorRef} 
      className="h-full"
    />
  )
}
