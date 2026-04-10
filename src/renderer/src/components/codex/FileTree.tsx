import { useState, useEffect, useCallback } from 'react'
import { Folder, FileText, ChevronRight, ChevronDown } from 'lucide-react'
import { useAppStore } from '../../store/appStore.js'

interface TreeNode {
  name: string
  path: string
  isDirectory: boolean
  children?: TreeNode[]
  isExpanded?: boolean
}

const SYSTEM_NAMES = new Set(['_epistles', '_folios', '.scriptorium'])

export function FileTree() {
  const [tree, setTree] = useState<TreeNode[]>([])
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set(['.']))
  const { selectedFile, setSelectedFile, abbey, showSystemFolders } = useAppStore()

  const loadDirectory = useCallback(async (path: string): Promise<TreeNode[]> => {
    try {
      const entries = await window.electronAPI.listFiles(path)

      const visible = showSystemFolders
        ? entries
        : entries.filter(e => !SYSTEM_NAMES.has(e.name))

      // Sort: directories first, then alphabetically
      const sorted = visible.sort((a, b) => {
        if (a.isDirectory === b.isDirectory) {
          return a.name.localeCompare(b.name)
        }
        return a.isDirectory ? -1 : 1
      })

      return sorted.map(entry => ({
        ...entry,
        isExpanded: expandedPaths.has(entry.path),
      }))
    } catch (error) {
      console.error('Failed to load directory:', error)
      return []
    }
  }, [expandedPaths, showSystemFolders])

  const refreshTree = useCallback(async () => {
    const root = await loadDirectory('.')
    
    // Recursively load expanded directories
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

    const fullTree = await loadExpanded(root)
    setTree(fullTree)
  }, [loadDirectory, expandedPaths])

  useEffect(() => {
    if (abbey) {
      refreshTree()
    }
  }, [abbey, refreshTree])

  const toggleDirectory = async (node: TreeNode) => {
    const newExpanded = new Set(expandedPaths)
    
    if (newExpanded.has(node.path)) {
      newExpanded.delete(node.path)
    } else {
      newExpanded.add(node.path)
    }
    
    setExpandedPaths(newExpanded)
  }

  const handleSelect = (node: TreeNode) => {
    if (node.isDirectory) {
      toggleDirectory(node)
    } else {
      setSelectedFile(node.path)
    }
  }

  const renderNode = (node: TreeNode, depth: number = 0) => {
    const isExpanded = expandedPaths.has(node.path)
    const isSelected = selectedFile === node.path

    return (
      <div key={node.path}>
        <button
          onClick={() => handleSelect(node)}
          className={`w-full flex items-center gap-2 px-2 py-1.5 text-left text-sm rounded-md transition-colors ${
            isSelected
              ? 'bg-accent/10 text-accent'
              : 'text-ink-muted hover:bg-parchment-dark hover:text-ink-primary'
          }`}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          {node.isDirectory && (
            <span className="flex-shrink-0">
              {isExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </span>
          )}
          
          {!node.isDirectory && <span className="w-4" />}
          
          {node.isDirectory ? (
            <Folder className={`w-4 h-4 flex-shrink-0 ${isExpanded ? 'text-accent' : ''}`} />
          ) : (
            <FileText className="w-4 h-4 flex-shrink-0" />
          )}
          
          <span className="truncate">{node.name}</span>
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
    </div>
  )
}
