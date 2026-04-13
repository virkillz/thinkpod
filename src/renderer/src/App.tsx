import { useEffect, useState } from 'react'
import { useAppStore } from './store/appStore.js'
import { SetupWizard } from './components/setup/SetupWizard.js'
import { MainShell } from './components/shell/MainShell.js'
import { LoadingScreen } from './components/common/LoadingScreen.js'

function App() {
  const [isLoading, setIsLoading] = useState(true)
  const { isSetupComplete, setSetupComplete, setVault, setLLMStorage, setUserProfile } = useAppStore()

  useEffect(() => {
    const checkVault = async () => {
      try {
        const vaultInfo = await window.electronAPI.getVaultInfo()
        if (vaultInfo) {
          setVault(vaultInfo)
          setSetupComplete(true)

          // Restore persisted LLM profiles
          const saved = await window.electronAPI.getSetting('llmConfig') as {
            profiles?: unknown[]; activeId?: string | null
          } | null
          if (saved?.profiles) {
            setLLMStorage(saved.profiles as Parameters<typeof setLLMStorage>[0], saved.activeId ?? null)
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
        console.error('Failed to check vault:', error)
      } finally {
        setIsLoading(false)
      }
    }

    checkVault()
  }, [setVault, setSetupComplete, setLLMStorage, setUserProfile])

  if (isLoading) {
    return <LoadingScreen />
  }

  if (!isSetupComplete) {
    return <SetupWizard onComplete={() => setSetupComplete(true)} />
  }

  return <MainShell />
}

export default App