import { useState, useEffect, useCallback } from 'react'
import { Search, FileText, Folder, Clock, Loader2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

interface SearchResult {
  path: string
  title: string
  folder: string
  modified_at: number
  snippet: string
  rank: number
}

export function SearchView() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const navigate = useNavigate()

  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([])
      setHasSearched(false)
      return
    }

    setIsSearching(true)
    setHasSearched(true)

    try {
      const response = await window.electronAPI.searchFiles(searchQuery)
      if (response.success) {
        setResults(response.results || [])
      } else {
        console.error('Search failed:', response.error)
        setResults([])
      }
    } catch (error) {
      console.error('Search error:', error)
      setResults([])
    } finally {
      setIsSearching(false)
    }
  }, [])

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      performSearch(query)
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [query, performSearch])

  const handleResultClick = (result: SearchResult) => {
    navigate(`/notes?file=${encodeURIComponent(result.path)}`)
  }

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays} days ago`
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`
    return date.toLocaleDateString()
  }

  return (
    <div className="flex flex-col h-full bg-parchment-base">
      {/* Search Header */}
      <div className="flex-shrink-0 border-b border-parchment-dark bg-parchment-sidebar">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-muted" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search your vault..."
              className="w-full pl-12 pr-4 py-3 text-base bg-parchment-card border border-parchment-dark rounded-lg focus:outline-none focus:border-accent text-ink-primary placeholder:text-ink-light"
              autoFocus
            />
            {isSearching && (
              <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-muted animate-spin" />
            )}
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-6">
          {!hasSearched && (
            <div className="text-center py-16">
              <Search className="w-16 h-16 text-ink-light mx-auto mb-4" />
              <h2 className="text-xl font-medium text-ink-primary mb-2">Search your vault</h2>
              <p className="text-ink-muted">
                Search across all your notes. System folders (starting with _ or .) are excluded.
              </p>
            </div>
          )}

          {hasSearched && !isSearching && results.length === 0 && (
            <div className="text-center py-16">
              <FileText className="w-16 h-16 text-ink-light mx-auto mb-4" />
              <h2 className="text-xl font-medium text-ink-primary mb-2">No results found</h2>
              <p className="text-ink-muted">
                Try different keywords or check your spelling
              </p>
            </div>
          )}

          {results.length > 0 && (
            <div className="space-y-1">
              <div className="text-sm text-ink-muted mb-4">
                {results.length} {results.length === 1 ? 'result' : 'results'} found
              </div>
              {results.map((result, index) => (
                <button
                  key={`${result.path}-${index}`}
                  onClick={() => handleResultClick(result)}
                  className="w-full text-left p-4 rounded-lg border border-parchment-dark bg-parchment-card hover:border-accent transition-all group"
                >
                  <div className="flex items-start gap-3">
                    <FileText className="w-5 h-5 text-ink-muted mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-ink-primary mb-1 group-hover:text-accent transition-colors">
                        {result.title}
                      </h3>
                      {result.snippet && (
                        <p 
                          className="text-sm text-ink-secondary mb-2 line-clamp-2"
                          dangerouslySetInnerHTML={{ 
                            __html: result.snippet.replace(
                              /<mark>/g, 
                              '<mark class="bg-yellow-200 font-medium">'
                            )
                          }}
                        />
                      )}
                      <div className="flex items-center gap-3 text-xs text-ink-muted">
                        {result.folder && (
                          <div className="flex items-center gap-1">
                            <Folder className="w-3 h-3" />
                            <span>{result.folder}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>{formatDate(result.modified_at)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
