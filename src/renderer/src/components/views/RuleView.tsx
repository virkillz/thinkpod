import { Settings, Folder, ExternalLink, Key } from 'lucide-react'
import { useAppStore } from '../../store/appStore.js'

export function RuleView() {
  const { abbey, llmConfig, setLLMConfig } = useAppStore()

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
                  value={llmConfig.baseUrl}
                  onChange={(e) => setLLMConfig({ baseUrl: e.target.value })}
                  className="w-full px-4 py-3 bg-parchment-base border border-parchment-dark rounded-lg focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-primary mb-2">
                  Model Name
                </label>
                <input
                  type="text"
                  value={llmConfig.model}
                  onChange={(e) => setLLMConfig({ model: e.target.value })}
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
                  value={llmConfig.apiKey}
                  onChange={(e) => setLLMConfig({ apiKey: e.target.value })}
                  placeholder="Optional — for cloud providers"
                  className="w-full px-4 py-3 bg-parchment-base border border-parchment-dark rounded-lg focus:outline-none focus:border-accent"
                />
              </div>

              <div className="flex items-center gap-2 pt-4 border-t border-parchment-dark">
                <button className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium transition-colors">
                  <ExternalLink className="w-4 h-4" />
                  Test Connection
                </button>
                <button className="px-4 py-2 text-accent hover:bg-accent/10 rounded-lg text-sm font-medium transition-colors">
                  Reset to Defaults
                </button>
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
