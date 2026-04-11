import { useState, useEffect } from 'react'
import { EditorSettings, DEFAULT_EDITOR_SETTINGS } from '../types/editorSettings.js'

const STORAGE_KEY = 'scriptorium-editor-settings'

export function useEditorSettings() {
  const [settings, setSettings] = useState<EditorSettings>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        return { ...DEFAULT_EDITOR_SETTINGS, ...parsed }
      }
    } catch (err) {
      console.error('Failed to load editor settings:', err)
    }
    return DEFAULT_EDITOR_SETTINGS
  })

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    } catch (err) {
      console.error('Failed to save editor settings:', err)
    }
  }, [settings])

  const updateSettings = (partial: Partial<EditorSettings>) => {
    setSettings((prev) => ({ ...prev, ...partial }))
  }

  const resetSettings = () => {
    setSettings(DEFAULT_EDITOR_SETTINGS)
  }

  return { settings, updateSettings, resetSettings }
}
