import { useState } from 'react'
import { Settings, Folder, Key, Check, X, Loader2, Save } from 'lucide-react'
import { useAppStore } from '../../store/appStore.js'

type TestStatus = 'idle' | 'testing' | 'success' | 'error'

export function RuleView() {
  const { abbey, llmConfig, setLLMConfig, showSystemFolders, setShowSystemFolders } = useAppStore()

  const [baseUrl, setBaseUrl] = useState(llmConfig.baseUrl)
  const [model, setModel] = useState(llmConfig.model)
  const [apiKey, setApiKey] = useState(llmConfig.apiKey)
  const [testStatus, setTestStatus] = useState<TestStatus>('idle')
  const [testError, setTestError] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved'>('idle')

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
      } else {
        setTestStatus('error')
        setTestError(result.error || 'Connection failed')
      }
    } catch (err) {
      setTestStatus('error')
      setTestError((err as Error).message)
    }
  }

  const handleSave = async () => {
    const config = { baseUrl, model, apiKey }
    setLLMConfig(config)
    await window.electronAPI.setSetting('llmConfig', config)
    setSaveStatus('saved')
    setTimeout(() => setSaveStatus('idle'), 2000)
  }

  const handleInputChange = (setter: (v: string) => void, value: string) => {
    setter(value)
    setTestStatus('idle')
    setTestError(null)
    setSaveStatus('idle')
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-parchment-dark">
        <div className="flex items-center gap-3">
          <Settings className="w-5 h-5 text-accent" />
          <h2 className="font-serif font-medium text-lg text-ink-primary">Rule</h2>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto space-y-8">
          {/* Abbey section */}
          <section>
            <h3 className="text-sm font-medium text-ink-muted uppercase tracking-wide mb-4">
              Abbey
            </h3>
            <div className="bg-white rounded-xl p-6 border border-parchment-dark">
              <div className="flex items-center gap-3 mb-4">
                <Folder className="w-5 h-5 text-accent" />
                <span className="font-medium text-ink-primary">Vault Path</span>
              </div>
              <div className="bg-parchment-sidebar rounded-lg px-4 py-3 font-mono text-sm text-ink-primary break-all">
                {abbey?.path || 'No abbey configured'}
              </div>
              <p className="text-sm text-ink-muted mt-3">
                All your manuscripts are stored here as plain markdown files.
              </p>
            </div>
          </section>

          {/* Inference section */}
          <section>
            <h3 className="text-sm font-medium text-ink-muted uppercase tracking-wide mb-4">
              Inference
            </h3>
            <div className="bg-white rounded-xl p-6 border border-parchment-dark space-y-6">
              <div>
                <label className="block text-sm font-medium text-ink-primary mb-2">
                  Base URL
                </label>
                <input
                  type="text"
                  value={baseUrl}
                  onChange={(e) => handleInputChange(setBaseUrl, e.target.value)}
                  className="w-full px-4 py-3 bg-parchment-base border border-parchment-dark rounded-lg focus:outline-none focus:border-accent"
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
                  className="w-full px-4 py-3 bg-parchment-base border border-parchment-dark rounded-lg focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-ink-primary mb-2">
                  <Key className="w-4 h-4" />
                  API Key
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => handleInputChange(setApiKey, e.target.value)}
                  placeholder="Optional — for cloud providers"
                  className="w-full px-4 py-3 bg-parchment-base border border-parchment-dark rounded-lg focus:outline-none focus:border-accent"
                />
              </div>

              <div className="flex items-center gap-3 pt-4 border-t border-parchment-dark">
                <button
                  onClick={handleTest}
                  disabled={testStatus === 'testing' || !baseUrl || !model}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:cursor-not-allowed ${
                    testStatus === 'success'
                      ? 'bg-green-600 text-white'
                      : testStatus === 'error'
                      ? 'bg-red-600 text-white'
                      : 'border border-accent text-accent hover:bg-accent hover:text-white disabled:border-parchment-dark disabled:text-ink-muted'
                  }`}
                >
                  {testStatus === 'testing' && <Loader2 className="w-4 h-4 animate-spin" />}
                  {testStatus === 'success' && <Check className="w-4 h-4" />}
                  {testStatus === 'error' && <X className="w-4 h-4" />}
                  {testStatus === 'testing' ? 'Testing…' : testStatus === 'success' ? 'Connected' : testStatus === 'error' ? 'Failed' : 'Test Connection'}
                </button>

                <button
                  onClick={handleSave}
                  disabled={!baseUrl || !model}
                  className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover disabled:bg-ink-light disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
                >
                  {saveStatus === 'saved' ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                  {saveStatus === 'saved' ? 'Saved' : 'Save'}
                </button>

                {testError && (
                  <span className="text-sm text-red-600">{testError}</span>
                )}
              </div>
            </div>
          </section>

          {/* Wilfred section */}
          <section>
            <h3 className="text-sm font-medium text-ink-muted uppercase tracking-wide mb-4">
              Wilfred
            </h3>
            <div className="bg-white rounded-xl p-6 border border-parchment-dark">
              <p className="text-sm text-ink-muted mb-4">
                Wilfred's persona and behavior can be customized by editing the
                wilfred.md file in your abbey's .scriptorium folder.
              </p>
              <button className="px-4 py-2 border border-accent text-accent hover:bg-accent hover:text-white rounded-lg text-sm font-medium transition-colors">
                Open wilfred.md
              </button>
            </div>
          </section>

          {/* Codex section */}
          <section>
            <h3 className="text-sm font-medium text-ink-muted uppercase tracking-wide mb-4">
              Codex
            </h3>
            <div className="bg-white rounded-xl p-6 border border-parchment-dark">
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <span className="font-medium text-ink-primary text-sm">Show system folders</span>
                  <p className="text-xs text-ink-muted mt-0.5">
                    Display _epistles, _folios, and .scriptorium in the file tree
                  </p>
                </div>
                <button
                  role="switch"
                  aria-checked={showSystemFolders}
                  onClick={() => setShowSystemFolders(!showSystemFolders)}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
                    showSystemFolders ? 'bg-accent' : 'bg-ink-light'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform duration-200 ${
                      showSystemFolders ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </label>
            </div>
          </section>

          {/* Reliquary section */}
          <section>
            <h3 className="text-sm font-medium text-ink-muted uppercase tracking-wide mb-4">
              Reliquary (Tools)
            </h3>
            <div className="bg-white rounded-xl p-6 border border-parchment-dark">
              <p className="text-sm text-ink-muted">
                Tool management will be available in a future update.
                Currently, Wilfred has access to: read_file, write_file, move_file, 
                list_files, add_comment, write_epistle.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
