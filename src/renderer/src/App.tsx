import { useEffect, useState } from 'react'
import { useAppStore } from './store/appStore.js'
import { SetupWizard } from './components/setup/SetupWizard.js'
import { MainShell } from './components/shell/MainShell.js'
import { LoadingScreen } from './components/common/LoadingScreen.js'

function App() {
  const [isLoading, setIsLoading] = useState(true)
  const { isSetupComplete, setSetupComplete, setAbbey } = useAppStore()

  useEffect(() => {
    // Check if there's already an abbey configured
    const checkAbbey = async () => {
      try {
        const abbeyInfo = await window.electronAPI.getAbbeyInfo()
        if (abbeyInfo) {
          setAbbey(abbeyInfo)
          setSetupComplete(true)
        }
      } catch (error) {
        console.error('Failed to check abbey:', error)
      } finally {
        setIsLoading(false)
      }
    }

    checkAbbey()
  }, [setAbbey, setSetupComplete])

  if (isLoading) {
    return <LoadingScreen />
  }

  if (!isSetupComplete) {
    return <SetupWizard onComplete={() => setSetupComplete(true)} />
  }

  return <MainShell />
}

export default App