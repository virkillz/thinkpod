import { useEffect, useState } from 'react'
import { useAppStore } from './store/appStore.js'
import { SetupWizard } from './components/setup/SetupWizard.js'
import { MainShell } from './components/shell/MainShell.js'
import { LoadingScreen } from './components/common/LoadingScreen.js'

function App() {
  const [isLoading, setIsLoading] = useState(true)
  const { isSetupComplete, setSetupComplete, setAbbey, setLLMConfig, setUserProfile } = useAppStore()

  useEffect(() => {
    const checkAbbey = async () => {
      try {
        const abbeyInfo = await window.electronAPI.getAbbeyInfo()
        if (abbeyInfo) {
          setAbbey(abbeyInfo)
          setSetupComplete(true)

          // Restore persisted LLM config
          const saved = await window.electronAPI.getSetting('llmConfig') as {
            baseUrl?: string; model?: string; apiKey?: string
          } | null
          if (saved?.baseUrl) {
            setLLMConfig({
              baseUrl: saved.baseUrl,
              model: saved.model ?? '',
              apiKey: saved.apiKey ?? '',
            })
          }

          // Restore persisted user profile
          const savedProfile = await window.electronAPI.getSetting('userProfile') as {
            name?: string; bio?: string; avatarDataUrl?: string | null
          } | null
          if (savedProfile) {
            setUserProfile({
              name: savedProfile.name ?? 'Chief',
              bio: savedProfile.bio ?? '',
              avatarDataUrl: savedProfile.avatarDataUrl ?? null,
            })
          }
        }
      } catch (error) {
        console.error('Failed to check abbey:', error)
      } finally {
        setIsLoading(false)
      }
    }

    checkAbbey()
  }, [setAbbey, setSetupComplete, setLLMConfig, setUserProfile])

  if (isLoading) {
    return <LoadingScreen />
  }

  if (!isSetupComplete) {
    return <SetupWizard onComplete={() => setSetupComplete(true)} />
  }

  return <MainShell />
}

export default App