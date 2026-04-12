import { useState, useEffect } from 'react'
import { FolderOpen, Loader2, Puzzle, RefreshCw } from 'lucide-react'
import { useAppStore } from '../../../store/appStore.js'

interface SkillMeta {
  name: string
  description: string
  dirPath: string
}

export function SkillsTab() {
  const { agentName } = useAppStore()
  const [skills, setSkills] = useState<SkillMeta[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    const { skills: s } = await window.electronAPI.listSkills()
    setSkills(s)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleOpenFolder = async () => {
    await window.electronAPI.openSkillsFolder()
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-ink-muted">
            Skills extend {agentName} with domain-specific knowledge. Drop a{' '}
            <code className="text-xs bg-parchment-sidebar px-1 py-0.5 rounded">SKILL.md</code>{' '}
            directory into the skills folder and {agentName} picks it up automatically.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-4">
          <button
            onClick={load}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-ink-muted hover:text-ink-primary border border-parchment-dark rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleOpenFolder}
            className="flex items-center gap-2 px-3 py-1.5 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium transition-colors"
          >
            <FolderOpen className="w-4 h-4" />
            Open Skills Folder
          </button>
        </div>
      </div>

      {/* Skill list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-ink-muted" />
        </div>
      ) : skills.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
          <Puzzle className="w-8 h-8 text-ink-light" />
          <p className="text-sm font-medium text-ink-primary">No skills installed</p>
          <p className="text-xs text-ink-muted max-w-xs">
            Click "Open Skills Folder" to add your first skill. Each skill is a folder containing a{' '}
            <code className="bg-parchment-sidebar px-1 py-0.5 rounded">SKILL.md</code> file.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {skills.map(skill => (
            <div
              key={skill.name}
              className="bg-parchment-card rounded-xl border border-parchment-dark p-4 flex items-start gap-3"
            >
              <Puzzle className="w-4 h-4 text-accent mt-0.5 shrink-0" />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-ink-primary">{skill.name}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded bg-parchment-sidebar text-ink-muted font-mono">
                    SKILL.md
                  </span>
                </div>
                <p className="text-xs text-ink-muted mt-0.5 leading-relaxed">{skill.description}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Format hint */}
      <div className="rounded-xl border border-parchment-dark bg-parchment-sidebar p-4 text-xs text-ink-muted space-y-1">
        <p className="font-medium text-ink-primary text-sm mb-2">Skill format</p>
        <pre className="font-mono leading-relaxed">{`{vault}/.skills/
  my-skill/
    SKILL.md        ← required (YAML frontmatter + instructions)
    REFERENCE.md    ← optional sub-files
    scripts/        ← optional scripts`}</pre>
        <p className="pt-1">
          <code className="bg-parchment-card px-1 py-0.5 rounded">SKILL.md</code> must start with{' '}
          <code className="bg-parchment-card px-1 py-0.5 rounded">---</code> frontmatter containing{' '}
          <code className="bg-parchment-card px-1 py-0.5 rounded">name</code> and{' '}
          <code className="bg-parchment-card px-1 py-0.5 rounded">description</code> fields.
        </p>
      </div>
    </div>
  )
}
