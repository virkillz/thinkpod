import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface MarkdownPreviewProps {
  content: string
}

export function MarkdownPreview({ content }: MarkdownPreviewProps) {
  return (
    <div className="markdown-preview font-serif leading-relaxed text-ink-primary">
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
        pre: ({ children }) => <pre className="bg-parchment-dark/40 border border-parchment-dark rounded-lg p-4 overflow-x-auto mb-4 font-mono text-sm">{children}</pre>,
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
      {content}
    </ReactMarkdown>
    </div>
  )
}
