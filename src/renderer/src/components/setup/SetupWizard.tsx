import { useState } from 'react'
import { StepWelcome } from './StepWelcome.js'
import { StepAbbey } from './StepAbbey.js'
import { StepLLM } from './StepLLM.js'
import { StepVoice } from './StepVoice.js'
import { useAppStore } from '../../store/appStore.js'
import wilfredAvatar from '../../assets/avatar01.png'

interface SetupWizardProps {
  onComplete: () => void
}

type SetupStep = 'welcome' | 'abbey' | 'llm' | 'voice'

const STEPS: SetupStep[] = ['welcome', 'abbey', 'llm', 'voice']

export function SetupWizard({ onComplete }: SetupWizardProps) {
  const [currentStep, setCurrentStep] = useState<SetupStep>('welcome')
  const [selectedAbbeyPath, setSelectedAbbeyPath] = useState<string | null>(null)
  const [abbeyError, setAbbeyError] = useState<string | null>(null)
  const [abbeyNeedsInit, setAbbeyNeedsInit] = useState(false)
  const { setAbbey, setLLMConfig } = useAppStore()

  const handleStepComplete = () => {
    switch (currentStep) {
      case 'welcome': setCurrentStep('abbey'); break
      case 'abbey':   setCurrentStep('llm');   break
      case 'llm':     setCurrentStep('voice'); break
      case 'voice':   onComplete();            break
    }
  }

  const handleStepBack = () => {
    switch (currentStep) {
      case 'abbey': setCurrentStep('welcome'); break
      case 'llm':   setCurrentStep('abbey');   break
      case 'voice': setCurrentStep('llm');     break
    }
  }

  const handleAbbeySelected = async (path: string, isExisting: boolean) => {
    setSelectedAbbeyPath(path)
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

  const currentStepIndex = STEPS.indexOf(currentStep)

  return (
    <div className="w-full h-screen bg-parchment-base flex items-center justify-center p-8">
      <div className="flex items-end gap-5 w-full max-w-3xl">

        {/* Wilfred avatar */}
        <div className="flex-shrink-0 flex flex-col items-center gap-2 mb-2">
          <div className="w-20 h-20 rounded-full overflow-hidden shadow-lg ring-4 ring-accent/20 animate-breathe">
            <img src={wilfredAvatar} alt="Wilfred" className="w-full h-full object-cover" />
          </div>
          <span className="text-xs text-ink-muted font-medium tracking-wide">Wilfred</span>
        </div>

        {/* Chat bubble */}
        <div className="relative flex-1">
          {/* Speech bubble tail (left-pointing triangle) */}
          <div
            className="absolute left-0 bottom-10 -translate-x-[11px]"
            style={{
              width: 0,
              height: 0,
              borderTop: '10px solid transparent',
              borderBottom: '10px solid transparent',
              borderRight: '12px solid var(--color-parchment-card)',
            }}
          />

          {/* Card */}
          <div className="bg-parchment-card rounded-2xl shadow-lg p-10 min-h-[500px] flex flex-col">
            {/* Step indicator */}
            <div className="flex justify-end mb-8">
              <div className="flex gap-2">
                {STEPS.map((step, index) => (
                  <div
                    key={step}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      step === currentStep
                        ? 'bg-accent'
                        : currentStepIndex > index
                        ? 'bg-ink-muted'
                        : 'bg-parchment-dark'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Step content */}
            <div className="flex-1">
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
              {currentStep === 'voice' && (
                <StepVoice
                  onContinue={handleStepComplete}
                  onBack={handleStepBack}
                  onSkip={onComplete}
                />
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
