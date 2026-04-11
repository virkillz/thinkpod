import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { EditorView, keymap, placeholder, lineNumbers, highlightActiveLine, highlightSpecialChars, drawSelection, rectangularSelection, crosshairCursor } from '@codemirror/view'
import { EditorState, Compartment } from '@codemirror/state'
import { markdown } from '@codemirror/lang-markdown'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { bracketMatching } from '@codemirror/language'
import { closeBrackets } from '@codemirror/autocomplete'
import { highlightSelectionMatches } from '@codemirror/search'
import { EditorSettings, FONT_FAMILIES } from '../../types/editorSettings.js'

export interface WritingCanvasHandle {
  appendText(text: string): void
  replaceContent(content: string): void
  /** Replaces content and clears undo history (use when switching files) */
  reinitialize(content: string): void
  focus(): void
}

interface WritingCanvasProps {
  initialContent: string
  onChange(content: string): void
  onCmdEnter?(): void
  onEscape?(): void
  placeholderText?: string
  autoFocus?: boolean
  settings?: EditorSettings
}

export const WritingCanvas = forwardRef<WritingCanvasHandle, WritingCanvasProps>(
  function WritingCanvas(
    { initialContent, onChange, onCmdEnter, onEscape, placeholderText, autoFocus, settings },
    ref
  ) {
    const containerRef = useRef<HTMLDivElement>(null)
    const viewRef = useRef<EditorView | null>(null)
    const extensionsCompartment = useRef(new Compartment())

    // Stable refs so keymap closures always call the latest callbacks
    const onChangeRef = useRef(onChange)
    const onCmdEnterRef = useRef(onCmdEnter)
    const onEscapeRef = useRef(onEscape)
    useEffect(() => { onChangeRef.current = onChange }, [onChange])
    useEffect(() => { onCmdEnterRef.current = onCmdEnter }, [onCmdEnter])
    useEffect(() => { onEscapeRef.current = onEscape }, [onEscape])

    // buildExtensions is recreated each render so reinitialize always picks up
    // the latest placeholderText and settings — other values are accessed via stable refs.
    function buildExtensions() {
      return extensionsCompartment.current.of([
        markdown(),
        history(),
        drawSelection(),
        highlightSpecialChars(),
        rectangularSelection(),
        crosshairCursor(),
        keymap.of([
          { key: 'Mod-Enter', run: () => { onCmdEnterRef.current?.(); return true } },
          { key: 'Escape', run: () => { onEscapeRef.current?.(); return false } },
          { key: 'Mod-s', run: () => true }, // prevent browser save dialog
          ...(settings?.indentWithTabs ? [indentWithTab] : []),
          ...defaultKeymap,
          ...historyKeymap,
        ]),
        EditorView.theme({
          // Override the global .cm-editor background set in index.css
          '&': { backgroundColor: 'transparent !important', height: 'auto' },
          '&.cm-focused': { outline: 'none' },
          // overflow:visible lets the parent container scroll instead of CM
          '.cm-scroller': { 
            fontFamily: settings ? FONT_FAMILIES[settings.fontFamily] : 'var(--font-editor)',
            overflow: 'visible',
          },
          '.cm-content': {
            fontFamily: settings ? FONT_FAMILIES[settings.fontFamily] : 'var(--font-editor)',
            fontSize: `${settings?.fontSize ?? 1.25}rem`,
            lineHeight: `${settings?.lineHeight ?? 1.85}`,
            color: 'var(--color-ink-primary)',
            caretColor: 'rgb(var(--color-accent-rgb))',
            padding: '0',
            minHeight: '45vh',
            wordWrap: 'break-word',
            overflowWrap: 'break-word',
          },
          '.cm-line': { 
            padding: '0',
            wordWrap: 'break-word',
            overflowWrap: 'break-word',
          },
          '.cm-cursor': { borderLeftColor: 'rgb(var(--color-accent-rgb))' },
          '.cm-placeholder': {
            color: 'var(--color-ink-light)',
            opacity: '0.6',
            fontFamily: settings ? FONT_FAMILIES[settings.fontFamily] : 'var(--font-editor)',
            fontSize: `${settings?.fontSize ?? 1.25}rem`,
          },
          '.cm-selectionBackground': {
            backgroundColor: 'rgb(var(--color-accent-rgb) / 0.2)',
          },
          '&.cm-focused .cm-selectionBackground': {
            backgroundColor: 'rgb(var(--color-accent-rgb) / 0.25)',
          },
          '.cm-activeLine': {
            backgroundColor: settings?.highlightActiveLine ? 'rgb(var(--color-accent-rgb) / 0.05)' : 'transparent',
          },
        }),
        ...(placeholderText ? [placeholder(placeholderText)] : []),
        ...(settings?.lineNumbers ? [lineNumbers()] : []),
        ...(settings?.highlightActiveLine ? [highlightActiveLine()] : []),
        ...(settings?.lineWrapping ? [EditorView.lineWrapping] : []),
        ...(settings?.bracketMatching ? [bracketMatching()] : []),
        ...(settings?.autoCloseBrackets ? [closeBrackets()] : []),
        ...(settings?.highlightSelectionMatches ? [highlightSelectionMatches()] : []),
        EditorState.tabSize.of(settings?.tabSize ?? 2),
        EditorView.contentAttributes.of({
          spellcheck: settings?.spellCheck ? 'true' : 'false',
        }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) onChangeRef.current(update.state.doc.toString())
        }),
      ])
    }

    function buildCoreExtensions() {
      const extensions = [
        buildExtensions()
      ]
      return extensions
    }

    // Mount once — file switching uses reinitialize() instead of remounting
    useEffect(() => {
      if (!containerRef.current) return
      const view = new EditorView({
        state: EditorState.create({ doc: initialContent, extensions: buildCoreExtensions() }),
        parent: containerRef.current,
      })
      viewRef.current = view
      if (autoFocus) requestAnimationFrame(() => view.focus())
      return () => { view.destroy(); viewRef.current = null }
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    // Update extensions when settings change
    useEffect(() => {
      const view = viewRef.current
      if (!view) return
      view.dispatch({
        effects: extensionsCompartment.current.reconfigure([
          markdown(),
          history(),
          drawSelection(),
          highlightSpecialChars(),
          rectangularSelection(),
          crosshairCursor(),
          keymap.of([
            { key: 'Mod-Enter', run: () => { onCmdEnterRef.current?.(); return true } },
            { key: 'Escape', run: () => { onEscapeRef.current?.(); return false } },
            { key: 'Mod-s', run: () => true },
            ...(settings?.indentWithTabs ? [indentWithTab] : []),
            ...defaultKeymap,
            ...historyKeymap,
          ]),
          EditorView.theme({
            '&': { backgroundColor: 'transparent !important', height: 'auto' },
            '&.cm-focused': { outline: 'none' },
            '.cm-scroller': { 
              fontFamily: settings ? FONT_FAMILIES[settings.fontFamily] : 'var(--font-editor)',
              overflow: 'visible',
            },
            '.cm-content': {
              fontFamily: settings ? FONT_FAMILIES[settings.fontFamily] : 'var(--font-editor)',
              fontSize: `${settings?.fontSize ?? 1.25}rem`,
              lineHeight: `${settings?.lineHeight ?? 1.85}`,
              color: 'var(--color-ink-primary)',
              caretColor: 'rgb(var(--color-accent-rgb))',
              padding: '0',
              minHeight: '45vh',
              wordWrap: 'break-word',
              overflowWrap: 'break-word',
            },
            '.cm-line': { 
              padding: '0',
              wordWrap: 'break-word',
              overflowWrap: 'break-word',
            },
            '.cm-cursor': { borderLeftColor: 'rgb(var(--color-accent-rgb))' },
            '.cm-placeholder': {
              color: 'var(--color-ink-light)',
              opacity: '0.6',
              fontFamily: settings ? FONT_FAMILIES[settings.fontFamily] : 'var(--font-editor)',
              fontSize: `${settings?.fontSize ?? 1.25}rem`,
            },
            '.cm-selectionBackground': {
              backgroundColor: 'rgb(var(--color-accent-rgb) / 0.2)',
            },
            '&.cm-focused .cm-selectionBackground': {
              backgroundColor: 'rgb(var(--color-accent-rgb) / 0.25)',
            },
            '.cm-activeLine': {
              backgroundColor: settings?.highlightActiveLine ? 'rgb(var(--color-accent-rgb) / 0.05)' : 'transparent',
            },
          }),
          ...(placeholderText ? [placeholder(placeholderText)] : []),
          ...(settings?.lineNumbers ? [lineNumbers()] : []),
          ...(settings?.highlightActiveLine ? [highlightActiveLine()] : []),
          ...(settings?.lineWrapping ? [EditorView.lineWrapping] : []),
          ...(settings?.bracketMatching ? [bracketMatching()] : []),
          ...(settings?.autoCloseBrackets ? [closeBrackets()] : []),
          ...(settings?.highlightSelectionMatches ? [highlightSelectionMatches()] : []),
          EditorState.tabSize.of(settings?.tabSize ?? 2),
          EditorView.contentAttributes.of({
            spellcheck: settings?.spellCheck ? 'true' : 'false',
          }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) onChangeRef.current(update.state.doc.toString())
          }),
        ])
      })
    }, [settings]) // eslint-disable-line react-hooks/exhaustive-deps

    useImperativeHandle(ref, () => ({
      appendText(text) {
        const view = viewRef.current
        if (!view) return
        const len = view.state.doc.length
        const insert = len > 0 ? ' ' + text : text
        view.dispatch({
          changes: { from: len, insert },
          selection: { anchor: len + insert.length },
        })
      },
      replaceContent(content) {
        const view = viewRef.current
        if (!view) return
        view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: content } })
      },
      reinitialize(content) {
        const view = viewRef.current
        if (!view) return
        // Creates fresh state — clears undo history intentionally
        view.setState(EditorState.create({ doc: content, extensions: buildCoreExtensions() }))
      },
      focus() { viewRef.current?.focus() },
    }))

    return <div ref={containerRef} />
  }
)
