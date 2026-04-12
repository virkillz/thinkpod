import { useState, useEffect, useRef, useCallback } from 'react'
import ForceGraph2D from 'react-force-graph-2d'
import { RefreshCw, X, ExternalLink, Tag } from 'lucide-react'
import { useAppStore } from '../../store/appStore.js'

interface GraphNode {
  id: string
  label: string
  tags: string[]
  group: string
  val: number
  // injected by force-graph at runtime
  x?: number
  y?: number
}

interface GraphLink {
  source: string | GraphNode
  target: string | GraphNode
  sharedTags: string[]
  weight: number
}

interface GraphData {
  nodes: GraphNode[]
  links: GraphLink[]
}

// Deterministic color from a tag string
const TAG_COLORS = [
  '#7c6af7', '#f97316', '#10b981', '#f59e0b',
  '#3b82f6', '#ec4899', '#14b8a6', '#8b5cf6',
  '#ef4444', '#06b6d4', '#84cc16', '#a855f7',
]

function tagColor(tag: string): string {
  let hash = 0
  for (let i = 0; i < tag.length; i++) {
    hash = tag.charCodeAt(i) + ((hash << 5) - hash)
  }
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length]
}

export function GraphView() {
  const { setCurrentView, setSelectedFile } = useAppStore()
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] })
  const [loading, setLoading] = useState(true)
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 })
  const containerRef = useRef<HTMLDivElement>(null)
  const graphRef = useRef<{ d3Force: (name: string, force?: unknown) => unknown } | null>(null)

  const loadGraph = useCallback(async () => {
    setLoading(true)
    try {
      const data = await window.electronAPI.getGraphData()
      setGraphData(data as GraphData)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadGraph()
  }, [loadGraph])

  // Track container size for responsive graph
  useEffect(() => {
    if (!containerRef.current) return
    const obs = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      setDimensions({ width, height })
    })
    obs.observe(containerRef.current)
    return () => obs.disconnect()
  }, [])

  const handleNodeClick = useCallback((node: object) => {
    setSelectedNode(node as GraphNode)
  }, [])

  const handleOpenDoc = useCallback(() => {
    if (!selectedNode) return
    setSelectedFile(selectedNode.id)
    setCurrentView('notes')
  }, [selectedNode, setSelectedFile, setCurrentView])

  const nodeCanvasObject = useCallback(
    (node: object, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const n = node as GraphNode
      const label = n.label
      const fontSize = Math.max(10 / globalScale, 3)
      const r = (n.val ?? 5) * 0.8
      const color = n.group === 'untagged' ? '#6b7280' : tagColor(n.group)
      const isSelected = selectedNode?.id === n.id

      // Node circle
      ctx.beginPath()
      ctx.arc(n.x ?? 0, n.y ?? 0, r, 0, 2 * Math.PI)
      ctx.fillStyle = color + (isSelected ? 'ff' : 'cc')
      ctx.fill()

      if (isSelected) {
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 1.5 / globalScale
        ctx.stroke()
      }

      // Label
      if (globalScale >= 1.2) {
        ctx.font = `${fontSize}px sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        ctx.fillStyle = 'rgba(255,255,255,0.85)'
        ctx.fillText(label, n.x ?? 0, (n.y ?? 0) + r + 2 / globalScale)
      }
    },
    [selectedNode]
  )

  const linkColor = useCallback((link: object) => {
    const l = link as GraphLink
    return l.weight > 1 ? 'rgba(139,92,246,0.5)' : 'rgba(107,114,128,0.25)'
  }, [])

  const linkWidth = useCallback((link: object) => {
    return (link as GraphLink).weight * 0.8
  }, [])

  const nodeRelSize = 4

  return (
    <div className="h-full flex bg-parchment-base">
      {/* Graph canvas */}
      <div ref={containerRef} className="flex-1 relative overflow-hidden">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <RefreshCw className="w-6 h-6 text-accent animate-spin" />
          </div>
        ) : graphData.nodes.length === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-ink-muted">
            <Tag className="w-10 h-10 opacity-30" />
            <p className="text-sm">No tagged documents found.</p>
            <p className="text-xs text-ink-faint">Add <code>tags:</code> frontmatter to your notes to see connections.</p>
          </div>
        ) : (
          <ForceGraph2D
            ref={graphRef as React.MutableRefObject<unknown>}
            graphData={graphData}
            width={dimensions.width}
            height={dimensions.height}
            nodeCanvasObject={nodeCanvasObject}
            nodeRelSize={nodeRelSize}
            linkColor={linkColor}
            linkWidth={linkWidth}
            onNodeClick={handleNodeClick}
            backgroundColor="transparent"
            linkDirectionalParticles={0}
            cooldownTicks={100}
            nodeLabel={(node) => {
              const n = node as GraphNode
              return `${n.label}${n.tags.length ? '\n' + n.tags.join(', ') : ''}`
            }}
          />
        )}

        {/* Toolbar */}
        <div className="absolute top-4 right-4 flex gap-2">
          <button
            onClick={loadGraph}
            title="Refresh graph"
            className="p-2 rounded-lg bg-parchment-card border border-parchment-dark hover:border-accent/40 transition-colors"
          >
            <RefreshCw className="w-4 h-4 text-ink-muted" />
          </button>
        </div>

        {/* Stats pill */}
        {!loading && graphData.nodes.length > 0 && (
          <div className="absolute bottom-4 left-4 px-3 py-1.5 rounded-full bg-parchment-card border border-parchment-dark text-xs text-ink-muted">
            {graphData.nodes.length} docs · {graphData.links.length} connections
          </div>
        )}
      </div>

      {/* Side panel */}
      {selectedNode && (
        <aside className="w-72 border-l border-parchment-dark bg-parchment-sidebar flex flex-col">
          <div className="px-4 py-3 border-b border-parchment-dark flex items-center justify-between">
            <h3 className="font-medium text-ink-primary text-sm truncate">{selectedNode.label}</h3>
            <button
              onClick={() => setSelectedNode(null)}
              className="p-1 hover:bg-parchment-dark rounded transition-colors"
            >
              <X className="w-4 h-4 text-ink-muted" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div>
              <p className="text-xs text-ink-faint mb-1.5">Tags</p>
              {selectedNode.tags.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {selectedNode.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 rounded-full text-xs font-medium text-white"
                      style={{ backgroundColor: tagColor(tag) }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-ink-faint italic">No tags</p>
              )}
            </div>

            <div>
              <p className="text-xs text-ink-faint mb-1.5">Path</p>
              <p className="text-xs text-ink-secondary font-mono break-all">{selectedNode.id}</p>
            </div>

            {/* Connected documents */}
            <div>
              <p className="text-xs text-ink-faint mb-1.5">Connected via shared tags</p>
              <div className="space-y-1.5">
                {graphData.links
                  .filter((l) => {
                    const src = typeof l.source === 'string' ? l.source : (l.source as GraphNode).id
                    const tgt = typeof l.target === 'string' ? l.target : (l.target as GraphNode).id
                    return src === selectedNode.id || tgt === selectedNode.id
                  })
                  .slice(0, 10)
                  .map((l, i) => {
                    const src = typeof l.source === 'string' ? l.source : (l.source as GraphNode).id
                    const tgt = typeof l.target === 'string' ? l.target : (l.target as GraphNode).id
                    const otherId = src === selectedNode.id ? tgt : src
                    const otherNode = graphData.nodes.find((n) => n.id === otherId)
                    if (!otherNode) return null
                    return (
                      <button
                        key={i}
                        onClick={() => setSelectedNode(otherNode)}
                        className="w-full text-left px-2.5 py-1.5 rounded-lg bg-parchment-card hover:border-accent/30 border border-parchment-dark transition-colors"
                      >
                        <p className="text-xs text-ink-primary truncate">{otherNode.label}</p>
                        <p className="text-xs text-ink-faint">{l.sharedTags.join(', ')}</p>
                      </button>
                    )
                  })}
              </div>
            </div>
          </div>

          <div className="p-4 border-t border-parchment-dark">
            <button
              onClick={handleOpenDoc}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-accent/10 hover:bg-accent/20 text-accent text-sm font-medium transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Open Document
            </button>
          </div>
        </aside>
      )}
    </div>
  )
}
