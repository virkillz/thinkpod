import { useState } from 'react'
import { StepWelcome } from './StepWelcome.js'
import { StepAbbey } from './StepAbbey.js'
import { StepLLM } from './StepLLM.js'
import { useAppStore } from '../../store/appStore.js'

interface SetupWizardProps {
  onComplete: () => void
}

type SetupStep = 'welcome' | 'abbey' | 'llm'

export function SetupWizard({ onComplete }: SetupWizardProps) {
  const [currentStep, setCurrentStep] = useState<SetupStep>('welcome')
  const [selectedAbbeyPath, setSelectedAbbeyPath] = useState<string | null>(null)
  const [isExistingAbbey, setIsExistingAbbey] = useState(false)
  const [abbeyError, setAbbeyError] = useState<string | null>(null)
  const [abbeyNeedsInit, setAbbeyNeedsInit] = useState(false)
  const { setAbbey, setLLMConfig } = useAppStore()

  const handleStepComplete = () => {
    switch (currentStep) {
      case 'welcome':
        setCurrentStep('abbey')
        break
      case 'abbey':
        setCurrentStep('llm')
        break
      case 'llm':
        onComplete()
        break
    }
  }

  const handleStepBack = () => {
    switch (currentStep) {
      case 'abbey':
        setCurrentStep('welcome')
        break
      case 'llm':
        setCurrentStep('abbey')
        break
    }
  }

  const handleAbbeySelected = async (path: string, isExisting: boolean) => {
    setSelectedAbbeyPath(path)
    setIsExistingAbbey(isExisting)
    setAbbeyError(null)
    setAbbeyNeedsInit(false)

    try {
      if (isExisting) {
        const result = await window.electronAPI.openAbbey(path)
        if (result.success && result.path) {
          setAbbey({ path: result.path, name: path.split('/').pop() || 'Abbey' })
        } else if (result.needsInit) {
          setAbbeyNeedsInit(true)
          return
        } else {
          throw new Error(result.error || 'Failed to open abbey')
        }
      } else {
        const result = await window.electronAPI.createAbbey(path)
        if (result.success && result.path) {
          setAbbey({ path: result.path, name: path.split('/').pop() || 'Abbey' })
        } else {
          throw new Error(result.error || 'Failed to create abbey')
        }
      }
      handleStepComplete()
    } catch (error) {
      setAbbeyError((error as Error).message ?? 'Something went wrong setting up the abbey')
    }
  }

  const handleConfirmInit = async () => {
    if (!selectedAbbeyPath) return
    setAbbeyNeedsInit(false)
    setAbbeyError(null)

    try {
      const result = await window.electronAPI.initAbbey(selectedAbbeyPath)
      if (result.success && result.path) {
        setAbbey({ path: result.path, name: selectedAbbeyPath.split('/').pop() || 'Abbey' })
        handleStepComplete()
      } else {
        throw new Error(result.error || 'Failed to initialise abbey')
      }
    } catch (error) {
      setAbbeyError((error as Error).message ?? 'Something went wrong initialising the abbey')
    }
  }

  const handleLLMConfigured = (config: { baseUrl: string; model: string; apiKey: string }) => {
    setLLMConfig(config)
    window.electronAPI.setSetting('llmConfig', config)
    handleStepComplete()
  }

  return (
    <div className="w-full h-screen bg-parchment-base flex items-center justify-center p-8">
      <div className="w-full max-w-2xl">
        {/* Step indicator */}
        <div className="flex justify-end mb-8">
          <div className="flex gap-2">
            {(['welcome', 'abbey', 'llm'] as const).map((step, index) => (
              <div
                key={step}
                className={`w-2 h-2 rounded-full transition-colors ${
                  step === currentStep
                    ? 'bg-accent'
                    : ['welcome', 'abbey', 'llm'].indexOf(currentStep) > index
                    ? 'bg-ink-muted'
                    : 'bg-parchment-dark'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Step content */}
        <div className="bg-white rounded-2xl shadow-lg p-12 min-h-[500px]">
          {currentStep === 'welcome' && (
            <StepWelcome onContinue={handleStepComplete} />
          )}
          {currentStep === 'abbey' && (
            <StepAbbey
              onContinue={handleAbbeySelected}
              onBack={handleStepBack}
              error={abbeyError}
              needsInit={abbeyNeedsInit}
              onConfirmInit={handleConfirmInit}
            />
          )}
          {currentStep === 'llm' && (
            <StepLLM
              onContinue={handleLLMConfigured}
              onBack={handleStepBack}
            />
          )}
        </div>

        {/* Wilfred avatar (decorative) */}
        <div className="fixed bottom-8 right-8 flex items-end gap-4">
          {currentStep === 'welcome' && (
            <div className="bg-white rounded-xl rounded-br-none shadow-lg p-4 max-w-xs text-sm text-ink-muted animate-breathe">
              "Welcome to the Scriptorium. I am Wilfred, your faithful monk."
            </div>
          )}
          {currentStep === 'abbey' && selectedAbbeyPath && (
            <div className="bg-white rounded-xl rounded-br-none shadow-lg p-4 max-w-xs text-sm text-ink-muted">
              "A fine choice."
            </div>
          )}
          {currentStep === 'llm' && (
            <div className="bg-white rounded-xl rounded-br-none shadow-lg p-4 max-w-xs text-sm text-ink-muted">
              "Tell me where to find the words."
            </div>
          )}
          <div className="w-14 h-14 bg-accent rounded-full flex items-center justify-center shadow-lg animate-breathe">
            <span className="text-2xl">🖋</span>
          </div>
        </div>
      </div>
    </div>
  )
}
