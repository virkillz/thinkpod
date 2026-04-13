import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { AlignLeft, Tag, Calendar } from 'lucide-react'

interface MarkdownPreviewProps {
  content: string
}

// ─── Frontmatter parser ───────────────────────────────────────────────────────

type FmValue = string | string[] | null

function parseFrontmatter(content: string): { fm: Record<string, FmValue>; body: string } | null {
  if (!content.startsWith('---\n') && !content.startsWith('---\r\n')) return null

  const fmEnd = content.indexOf('\n---', 4)
  if (fmEnd === -1) return null

  const fmText = content.slice(4, fmEnd)
  const body = content.slice(fmEnd + 4).replace(/^\r?\n/, '')

  const fm: Record<string, FmValue> = {}
  const lines = fmText.split('\n')
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const colonIdx = line.indexOf(':')
    if (colonIdx > 0) {
      const key = line.slice(0, colonIdx).trim()
      const val = line.slice(colonIdx + 1).trim()
      if (!val) {
        const items: string[] = []
        while (i + 1 < lines.length && /^\s+-\s/.test(lines[i + 1])) {
          i++
          items.push(lines[i].replace(/^\s+-\s*/, '').trim())
        }
        fm[key] = items.length > 0 ? items : null
      } else if (val.startsWith('[') && val.endsWith(']')) {
        fm[key] = val.slice(1, -1).split(',').map((s) => s.trim()).filter(Boolean)
      } else {
        fm[key] = val
      }
    }
    i++
  }

  return { fm, body }
}

// ─── PropertiesPanel ──────────────────────────────────────────────────────────

function fieldIcon(key: string) {
  if (key === 'tags') return <Tag className="w-3.5 h-3.5" />
  if (key === 'created' || key === 'date' || key === 'updated') return <Calendar className="w-3.5 h-3.5" />
  return <AlignLeft className="w-3.5 h-3.5" />
}

function PropertiesPanel({ fm }: { fm: Record<string, FmValue> }) {
  const entries = Object.entries(fm).filter(([, v]) => v !== null && v !== undefined && v !== '')

  if (entries.length === 0) return null

  return (
    <div className="mb-8 rounded-xl border border-parchment-dark/20 bg-parchment-card/60 overflow-hidden">
      <div className="px-4 py-2.5 border-b border-parchment-dark/20">
        <span className="text-xs font-medium text-ink-muted uppercase tracking-wider">Properties</span>
      </div>
      <div className="divide-y divide-parchment-dark/20">
        {entries.map(([key, value]) => (
          <div key={key} className="flex items-start gap-3 px-4 py-2.5">
            <span className="text-ink-light mt-0.5 flex-shrink-0">{fieldIcon(key)}</span>
            <span className="text-sm text-ink-muted w-24 flex-shrink-0 capitalize">{key}</span>
            <div className="flex-1 min-w-0">
              {Array.isArray(value) ? (
                <div className="flex flex-wrap gap-1.5">
                  {value.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-accent/10 text-accent rounded-full text-xs font-medium"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-sm text-ink-primary">{value}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── MarkdownPreview ──────────────────────────────────────────────────────────

export function MarkdownPreview({ content }: MarkdownPreviewProps) {
  const parsed = parseFrontmatter(content)
  const body = parsed ? parsed.body : content
  const fm = parsed ? parsed.fm : null

  return (
    <div className="markdown-preview font-serif leading-relaxed text-ink-primary break-words">
      {fm && <PropertiesPanel fm={fm} />}
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h1 className="text-3xl font-serif font-bold text-ink-primary mt-8 mb-4 pb-2 border-b border-parchment-dark">{children}</h1>,
          h2: ({ children }) => <h2 className="text-2xl font-serif font-semibold text-ink-primary mt-6 mb-3">{children}</h2>,
          h3: ({ children }) => <h3 className="text-xl font-serif font-semibold text-ink-primary mt-5 mb-2">{children}</h3>,
          h4: ({ children }) => <h4 className="text-lg font-serif font-medium text-ink-primary mt-4 mb-2">{children}</h4>,
          p: ({ children }) => <p className="text-ink-primary leading-relaxed mb-4">{children}</p>,
          a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-accent underline hover:text-accent/80 transition-colors">{children}</a>,
          strong: ({ children }) => <strong className="font-bold text-ink-primary">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          ul: ({ children }) => <ul className="list-disc list-outside ml-6 mb-4 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal list-outside ml-6 mb-4 space-y-1">{children}</ol>,
          li: ({ children }) => <li className="text-ink-primary leading-relaxed">{children}</li>,
          blockquote: ({ children }) => <blockquote className="border-l-4 border-accent/40 pl-4 my-4 text-ink-secondary italic">{children}</blockquote>,
          code: ({ children, className }) =>
            className
              ? <code className={`block font-mono text-sm leading-relaxed ${className}`}>{children}</code>
              : <code className="font-mono text-sm bg-parchment-dark/60 text-ink-primary px-1.5 py-0.5 rounded">{children}</code>,
          pre: ({ children }) => <pre className="bg-parchment-dark/40 border border-parchment-dark rounded-lg p-4 overflow-x-auto mb-4 font-mono text-sm whitespace-pre-wrap break-words">{children}</pre>,
          hr: () => <hr className="border-parchment-dark my-6" />,
          table: ({ children }) => <div className="overflow-x-auto mb-4"><table className="w-full border-collapse text-sm">{children}</table></div>,
          thead: ({ children }) => <thead className="bg-parchment-dark/40">{children}</thead>,
          th: ({ children }) => <th className="border border-parchment-dark px-3 py-2 text-left font-semibold text-ink-primary">{children}</th>,
          td: ({ children }) => <td className="border border-parchment-dark px-3 py-2 text-ink-secondary">{children}</td>,
          input: ({ checked, ...props }) => (
            <input type="checkbox" checked={checked} readOnly className="mr-2 accent-accent" {...props} />
          ),
        }}
      >
        {body}
      </ReactMarkdown>
    </div>
  )
}
