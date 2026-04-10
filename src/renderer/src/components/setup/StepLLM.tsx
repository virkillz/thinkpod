import { useState } from 'react'
import { Check, X, Loader2 } from 'lucide-react'
import { useAppStore } from '../../store/appStore.js'

interface StepLLMProps {
  onContinue: (config: { baseUrl: string; model: string; apiKey: string }) => void
  onBack: () => void
}

type TestStatus = 'idle' | 'testing' | 'success' | 'error'

export function StepLLM({ onContinue, onBack }: StepLLMProps) {
  const { llmConfig, setLLMConfig } = useAppStore()
  const [baseUrl, setBaseUrl] = useState(llmConfig.baseUrl)
  const [model, setModel] = useState(llmConfig.model)
  const [apiKey, setApiKey] = useState(llmConfig.apiKey)
  const [testStatus, setTestStatus] = useState<TestStatus>('idle')
  const [testError, setTestError] = useState<string | null>(null)
  const [testedConfig, setTestedConfig] = useState<{ baseUrl: string; model: string } | null>(null)

  const handleTest = async () => {
    setTestStatus('testing')
    setTestError(null)
    
    try {
      const result = await window.electronAPI.testLLMConnection({
        baseUrl,
        model,
        apiKey: apiKey || undefined,
      })
      
      if (result.success) {
        setTestStatus('success')
        setTestedConfig({ baseUrl, model })
      } else {
        setTestStatus('error')
        setTestError(result.error || 'Connection failed')
      }
    } catch (error) {
      setTestStatus('error')
      setTestError((error as Error).message)
    }
  }

  const handleContinue = () => {
    onContinue({ baseUrl, model, apiKey })
  }

  const isConfigChanged = testedConfig?.baseUrl !== baseUrl || testedConfig?.model !== model
  const canFinish = testStatus === 'success' && !isConfigChanged

  const handleInputChange = (
    setter: (value: string) => void,
    value: string
  ) => {
    setter(value)
    if (testedConfig) {
      setTestedConfig(null)
      setTestStatus('idle')
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="text-sm text-ink-muted mb-1">Step 3 of 3</div>
          <h2 className="text-2xl font-serif font-medium text-ink-primary">
            Connect an Inference Server
          </h2>
        </div>
      </div>

      <p className="text-ink-muted mb-8">
        Wilfred thinks through a local language model.
        Point him at your inference server.
      </p>

      {/* Form */}
      <div className="space-y-6 mb-8">
        <div>
          <label className="block text-sm font-medium text-ink-primary mb-2">
            Base URL
          </label>
          <input
            type="text"
            value={baseUrl}
            onChange={(e) => handleInputChange(setBaseUrl, e.target.value)}
            className="w-full px-4 py-3 bg-parchment-card border border-parchment-dark rounded-lg focus:outline-none focus:border-accent text-ink-primary"
            placeholder="http://localhost:8000/v1"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-ink-primary mb-2">
            Model Name
          </label>
          <input
            type="text"
            value={model}
            onChange={(e) => handleInputChange(setModel, e.target.value)}
            className="w-full px-4 py-3 bg-parchment-card border border-parchment-dark rounded-lg focus:outline-none focus:border-accent text-ink-primary"
            placeholder="gemma-4-e4b-it-4bit"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-ink-primary mb-2">
            API Key <span className="text-ink-muted font-normal">(optional)</span>
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => handleInputChange(setApiKey, e.target.value)}
            className="w-full px-4 py-3 bg-parchment-card border border-parchment-dark rounded-lg focus:outline-none focus:border-accent text-ink-primary"
            placeholder=""
          />
        </div>
      </div>

      {/* Test button */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={handleTest}
          disabled={testStatus === 'testing' || !baseUrl || !model}
          className={`px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
            testStatus === 'success' && !isConfigChanged
              ? 'bg-success text-white'
              : testStatus === 'error'
              ? 'bg-error text-white'
              : 'border border-accent text-accent hover:bg-accent hover:text-white disabled:bg-parchment-dark disabled:text-ink-muted disabled:border-transparent'
          }`}
        >
          {testStatus === 'testing' && <Loader2 className="w-4 h-4 animate-spin" />}
          {testStatus === 'success' && !isConfigChanged && <Check className="w-4 h-4" />}
          {testStatus === 'error' && <X className="w-4 h-4" />}
          {testStatus === 'testing'
            ? 'Testing…'
            : testStatus === 'success' && !isConfigChanged
            ? '✓ Connected'
            : testStatus === 'error'
            ? '✗ Failed'
            : 'Test Connection'}
        </button>
        
        {testError && (
          <span className="text-sm text-error">{testError}</span>
        )}
      </div>

      {/* Actions */}
      <div className="mt-auto flex items-center justify-between">
        <button
          onClick={onBack}
          className="px-6 py-2 text-ink-muted hover:text-ink-primary transition-colors"
        >
          ← Back
        </button>
        <button
          onClick={handleContinue}
          disabled={!canFinish}
          className="px-8 py-3 bg-accent hover:bg-accent-hover disabled:bg-ink-light disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
        >
          Finish
        </button>
      </div>
    </div>
  )
}
