import { useState, useEffect, useCallback } from 'react'
import { Folder, FileText, ChevronRight, ChevronDown } from 'lucide-react'
import { useAppStore } from '../../store/appStore.js'

interface TreeNode {
  name: string
  path: string
  isDirectory: boolean
  children?: TreeNode[]
}

interface ContextMenu {
  node: TreeNode
  x: number
  y: number
}

const SYSTEM_NAMES = new Set(['_inbox', '_thoughts', '.thinkpod', '_agent_vault'])

export function FileTree() {
  const [tree, setTree] = useState<TreeNode[]>([])
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set(['.']))
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null)
  const [renamingPath, setRenamingPath] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [draggingPath, setDraggingPath] = useState<string | null>(null)
  const [dragOverPath, setDragOverPath] = useState<string | null>(null)
  const { selectedFile, setSelectedFile, setCurrentView, vault, showSystemFolders } = useAppStore()

  const loadDirectory = useCallback(async (path: string): Promise<TreeNode[]> => {
    try {
      const entries = await window.electronAPI.listFiles(path)

      const visible = showSystemFolders
        ? entries
        : entries.filter(e => !SYSTEM_NAMES.has(e.name))

      return visible.sort((a, b) => {
        if (a.isDirectory === b.isDirectory) return a.name.localeCompare(b.name)
        return a.isDirectory ? -1 : 1
      })
    } catch (error) {
      console.error('Failed to load directory:', error)
      return []
    }
  }, [showSystemFolders])

  const refreshTree = useCallback(async () => {
    const root = await loadDirectory('.')

    const loadExpanded = async (nodes: TreeNode[]): Promise<TreeNode[]> => {
      const result: TreeNode[] = []
      for (const node of nodes) {
        if (node.isDirectory && expandedPaths.has(node.path)) {
          const children = await loadDirectory(node.path)
          result.push({ ...node, children: await loadExpanded(children) })
        } else {
          result.push(node)
        }
      }
      return result
    }

    setTree(await loadExpanded(root))
  }, [loadDirectory, expandedPaths])

  useEffect(() => {
    if (vault) refreshTree()
  }, [vault, refreshTree])

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return
    const close = () => setContextMenu(null)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [contextMenu])

  const toggleDirectory = (node: TreeNode) => {
    const next = new Set(expandedPaths)
    if (next.has(node.path)) next.delete(node.path)
    else next.add(node.path)
    setExpandedPaths(next)
  }

  const handleSelect = (node: TreeNode) => {
    if (node.isDirectory) toggleDirectory(node)
    else {
      setSelectedFile(node.path)
      setCurrentView('notes')
    }
  }

  const handleContextMenu = (e: React.MouseEvent, node: TreeNode) => {
    if (SYSTEM_NAMES.has(node.name)) return
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ node, x: e.clientX, y: e.clientY })
  }

  const startRename = (node: TreeNode) => {
    setContextMenu(null)
    setRenamingPath(node.path)
    setRenameValue(node.name)
  }

  const confirmRename = async (node: TreeNode) => {
    const trimmed = renameValue.trim()
    setRenamingPath(null)
    if (!trimmed || trimmed === node.name) return
    const lastSlash = node.path.lastIndexOf('/')
    const parent = lastSlash >= 0 ? node.path.slice(0, lastSlash) : ''
    const newPath = parent ? `${parent}/${trimmed}` : trimmed
    const result = await window.electronAPI.moveFile(node.path, newPath)
    if (result.success) {
      if (selectedFile === node.path) setSelectedFile(newPath)
      await refreshTree()
    }
  }

  const handleDelete = async (node: TreeNode) => {
    setContextMenu(null)
    const label = node.isDirectory
      ? `folder "${node.name}" and all its contents`
      : `"${node.name}"`
    if (!window.confirm(`Delete ${label}?`)) return
    const result = await window.electronAPI.deleteFile(node.path)
    if (result.success) {
      if (selectedFile === node.path || selectedFile?.startsWith(node.path + '/')) {
        setSelectedFile(null)
      }
      await refreshTree()
    }
  }

  // Drag & drop
  const handleDragStart = (e: React.DragEvent, node: TreeNode) => {
    if (SYSTEM_NAMES.has(node.name)) { e.preventDefault(); return }
    setDraggingPath(node.path)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent, node: TreeNode) => {
    if (!node.isDirectory || !draggingPath) return
    if (draggingPath === node.path) return
    if (node.path.startsWith(draggingPath + '/')) return // can't drop into own child
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverPath(node.path)
  }

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return
    setDragOverPath(null)
  }

  const handleDrop = async (e: React.DragEvent, node: TreeNode) => {
    e.preventDefault()
    const fromPath = draggingPath
    setDragOverPath(null)
    setDraggingPath(null)
    if (!fromPath || !node.isDirectory) return
    if (fromPath === node.path || node.path.startsWith(fromPath + '/')) return

    const fileName = fromPath.split('/').pop()!
    const newPath = `${node.path}/${fileName}`
    if (newPath === fromPath) return

    const result = await window.electronAPI.moveFile(fromPath, newPath)
    if (result.success) {
      if (selectedFile === fromPath) setSelectedFile(newPath)
      else if (selectedFile?.startsWith(fromPath + '/')) {
        setSelectedFile(selectedFile.replace(fromPath + '/', newPath + '/'))
      }
      await refreshTree()
    }
  }

  const handleDragEnd = () => {
    setDraggingPath(null)
    setDragOverPath(null)
  }

  const renderNode = (node: TreeNode, depth: number = 0) => {
    const isExpanded = expandedPaths.has(node.path)
    const isSelected = selectedFile === node.path
    const isRenaming = renamingPath === node.path
    const isDragging = draggingPath === node.path
    const isDragOver = dragOverPath === node.path

    return (
      <div
        key={node.path}
        onDragOver={(e) => handleDragOver(e, node)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, node)}
      >
        <button
          onClick={() => !isRenaming && handleSelect(node)}
          onContextMenu={(e) => handleContextMenu(e, node)}
          draggable={!SYSTEM_NAMES.has(node.name)}
          onDragStart={(e) => handleDragStart(e, node)}
          onDragEnd={handleDragEnd}
          className={`w-full flex items-center gap-2 px-2 py-1.5 text-left text-sm rounded-md transition-colors ${
            isDragOver
              ? 'bg-accent/20 ring-1 ring-accent/50'
              : isSelected
              ? 'bg-accent/10 text-accent'
              : 'text-ink-muted hover:bg-parchment-dark hover:text-ink-primary'
          } ${isDragging ? 'opacity-40' : ''}`}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          {node.isDirectory && (
            <span className="flex-shrink-0">
              {isExpanded
                ? <ChevronDown className="w-4 h-4" />
                : <ChevronRight className="w-4 h-4" />}
            </span>
          )}

          {node.isDirectory
            ? <Folder className={`w-4 h-4 flex-shrink-0 ${isExpanded ? 'text-accent' : ''}`} />
            : <FileText className="w-4 h-4 flex-shrink-0" />}

          {isRenaming ? (
            <input
              autoFocus
              className="flex-1 bg-transparent border-b border-accent outline-none text-sm text-ink-primary min-w-0"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') confirmRename(node)
                if (e.key === 'Escape') setRenamingPath(null)
                e.stopPropagation()
              }}
              onBlur={() => confirmRename(node)}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="truncate">{node.name}</span>
          )}
        </button>

        {node.isDirectory && isExpanded && node.children && (
          <div>
            {node.children.map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-0.5">
      {tree.map(node => renderNode(node))}

      {contextMenu && (
        <div
          className="fixed z-50 bg-parchment-base border border-parchment-dark rounded-md shadow-lg py-1 min-w-[120px]"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            className="w-full text-left px-3 py-1.5 text-sm text-ink-primary hover:bg-parchment-dark transition-colors"
            onClick={() => startRename(contextMenu.node)}
          >
            Rename
          </button>
          <button
            className="w-full text-left px-3 py-1.5 text-sm text-red-500 hover:bg-parchment-dark transition-colors"
            onClick={() => handleDelete(contextMenu.node)}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  )
}
