# Graph View Implementation Plan

## Overview
Build a tag-based graph visualization feature to show relationships between documents based on shared tags. This will be the foundation for a more comprehensive graph view (similar to Obsidian) that can later be extended with link-based connections.

---

## 1. Document Parsing & Tag Extraction

### When documents are parsed
Documents should be parsed in **two scenarios**:

1. **Initial vault indexing** - When the app first loads or vault is changed
2. **Real-time updates** - When files are added/modified (via VaultManager file watcher)

### Implementation Location
- **File**: `src/main/vault/VaultManager.ts` (extend existing)
- **New File**: `src/main/vault/MarkdownParser.ts` (create new)

### Parsing Strategy
```typescript
// Use gray-matter library for YAML frontmatter parsing
import matter from 'gray-matter'

interface DocumentMetadata {
  title: string
  tags: string[]
  created?: string
  type?: string
  // ... other frontmatter fields
}

function parseMarkdownFile(filePath: string): DocumentMetadata {
  const content = fs.readFileSync(filePath, 'utf-8')
  const { data } = matter(content)
  
  return {
    title: data.title || path.basename(filePath, '.md'),
    tags: Array.isArray(data.tags) ? data.tags : [],
    created: data.created,
    type: data.type
  }
}
```

### File Watcher Integration
Extend `VaultManager` to parse files on events:
- `fileAdded` → parse and index
- `fileChanged` → re-parse and update index
- `fileRemoved` → remove from index

---

## 2. Database Schema Updates

### Add new table for tags index
```sql
CREATE TABLE IF NOT EXISTS tags (
  tag TEXT PRIMARY KEY,
  count INTEGER DEFAULT 0,
  last_updated INTEGER
)

CREATE TABLE IF NOT EXISTS file_tags (
  file_path TEXT REFERENCES files(path) ON DELETE CASCADE,
  tag TEXT,
  PRIMARY KEY (file_path, tag)
)

CREATE INDEX idx_file_tags_tag ON file_tags(tag)
CREATE INDEX idx_file_tags_file ON file_tags(file_path)
```

### Update DatabaseManager.ts
Add methods:
- `indexFileTags(filePath: string, tags: string[]): void`
- `getTagStats(): Array<{ tag: string, count: number }>`
- `getFilesByTag(tag: string): Array<{ path: string, title: string }>`
- `getSharedTags(filePath1: string, filePath2: string): string[]`
- `getGraphData(): { nodes: Node[], edges: Edge[] }`

### Migration Strategy
Add migration in `createTables()` method to create new tables if they don't exist.

---

## 3. Graph Data Structure

### Node Structure
```typescript
interface GraphNode {
  id: string              // file path
  label: string           // document title
  tags: string[]          // all tags for this document
  group?: string          // primary tag for coloring
  size?: number           // based on word count or connections
}
```

### Edge Structure
```typescript
interface GraphEdge {
  from: string            // file path
  to: string              // file path
  sharedTags: string[]    // tags that connect these documents
  weight: number          // number of shared tags (for thickness)
}
```

### Graph Generation Algorithm
```typescript
function generateGraphData(files: FileMetadata[]): GraphData {
  const nodes: GraphNode[] = files.map(f => ({
    id: f.path,
    label: f.title,
    tags: f.tags,
    group: f.tags[0] || 'untagged',
    size: Math.min(f.tags.length * 5 + 10, 30)
  }))
  
  const edges: GraphEdge[] = []
  
  // Create edges for documents sharing tags
  for (let i = 0; i < files.length; i++) {
    for (let j = i + 1; j < files.length; j++) {
      const sharedTags = files[i].tags.filter(t => 
        files[j].tags.includes(t)
      )
      
      if (sharedTags.length > 0) {
        edges.push({
          from: files[i].path,
          to: files[j].path,
          sharedTags,
          weight: sharedTags.length
        })
      }
    }
  }
  
  return { nodes, edges }
}
```

---

## 4. Graph Visualization Library

### Recommended: react-force-graph-2d

**Why this library:**
- ✅ React-friendly (easy integration)
- ✅ Force-directed layout (automatic positioning)
- ✅ Interactive (zoom, pan, drag nodes)
- ✅ Customizable (colors, sizes, labels)
- ✅ Good performance (handles 1000+ nodes)
- ✅ TypeScript support

**Installation:**
```bash
npm install react-force-graph-2d
npm install --save-dev @types/react-force-graph-2d
```

**Alternative options:**
- `vis-network` - More features but heavier
- `cytoscape` - Very powerful but steeper learning curve
- `d3-force` - Maximum control but requires more code

---

## 5. UI Components

### New View: GraphView.tsx
Location: `src/renderer/src/components/views/GraphView.tsx`

```typescript
import ForceGraph2D from 'react-force-graph-2d'

export function GraphView() {
  const [graphData, setGraphData] = useState({ nodes: [], links: [] })
  const [selectedNode, setSelectedNode] = useState(null)
  
  useEffect(() => {
    // Fetch graph data from main process
    window.electron.getGraphData().then(setGraphData)
  }, [])
  
  return (
    <div className="h-full flex">
      {/* Graph canvas */}
      <div className="flex-1">
        <ForceGraph2D
          graphData={graphData}
          nodeLabel="label"
          nodeColor={node => getColorForTag(node.group)}
          linkWidth={link => link.weight}
          onNodeClick={handleNodeClick}
        />
      </div>
      
      {/* Side panel for selected node */}
      {selectedNode && (
        <div className="w-80 border-l p-4">
          <h3>{selectedNode.label}</h3>
          <div>Tags: {selectedNode.tags.join(', ')}</div>
          <button onClick={() => openDocument(selectedNode.id)}>
            Open Document
          </button>
        </div>
      )}
    </div>
  )
}
```

### Add Stats Tab to AboutView.tsx
Update `@/Users/asani/Projects/node/scriptorium/src/renderer/src/components/views/AboutView.tsx`:

1. Add 'stats' to `AboutTab` type
2. Add Stats icon to TABS array
3. Create `StatsTab()` component showing:
   - Top 20 tags by count
   - Total documents
   - Total tags
   - Average tags per document
   - Tag distribution chart (optional)

---

## 6. IPC Communication

### Add handlers in src/main/ipc/handlers.ts

```typescript
ipcMain.handle('graph:getData', async () => {
  return dbManager.getGraphData()
})

ipcMain.handle('stats:getTags', async () => {
  return dbManager.getTagStats()
})

ipcMain.handle('stats:getOverview', async () => {
  const files = dbManager.getAllFiles()
  const tags = dbManager.getTagStats()
  
  return {
    totalDocuments: files.length,
    totalTags: tags.length,
    totalWords: files.reduce((sum, f) => sum + f.word_count, 0),
    avgTagsPerDoc: files.length > 0 
      ? tags.reduce((sum, t) => sum + t.count, 0) / files.length 
      : 0
  }
})
```

### Update electron.d.ts
```typescript
interface ElectronAPI {
  // ... existing methods
  getGraphData: () => Promise<GraphData>
  getTagStats: () => Promise<TagStats[]>
  getStatsOverview: () => Promise<StatsOverview>
}
```

---

## 7. Implementation Phases

### Phase 1: Data Layer ✅ DONE
- [x] Install `gray-matter` package
- [x] Create `MarkdownParser.ts` with frontmatter parsing (`src/main/vault/MarkdownParser.ts`)
- [x] `buildGraphData()` — scans vault, builds nodes + edges from shared tags
- [x] `buildStatsOverview()` — computes doc count, tag count, avg tags/doc, top 20 tags
- [ ] Update database schema (add tags tables) — *skipped: parsing done at query time, no DB caching yet*
- [ ] Add tag indexing methods to DatabaseManager — *skipped: see above*
- [ ] Integrate parser with VaultManager file watcher — *pending*

### Phase 2: Graph Data Generation ✅ DONE
- [x] Implement graph data generation algorithm (O(n²) shared-tag edge builder)
- [x] Add IPC channels: `graph:get-data`, `stats:get-overview` (`src/main/ipc/channels.ts`)
- [x] Add IPC handlers in `src/main/ipc/handlers.ts`
- [x] Expose via preload: `getGraphData()`, `getStatsOverview()` (`src/main/preload.ts`)
- [x] TypeScript types in `src/renderer/src/types/electron.d.ts`
- [ ] Test with sample documents — *pending user testing*

### Phase 3: Stats Tab ✅ DONE
- [x] Add `stats` tab to `AboutView.tsx`
- [x] Overview cards (total documents, unique tags, avg tags/doc)
- [x] Horizontal bar chart of top 20 tags
- [x] Styled with existing design system (parchment tokens, accent color)

### Phase 4: Graph Visualization ✅ DONE
- [x] Install `react-force-graph-2d`
- [x] Create `GraphView.tsx` (`src/renderer/src/components/views/GraphView.tsx`)
- [x] Force-directed graph rendering with canvas node painter
- [x] Node click handler — opens side panel with doc details
- [x] Color coding by primary tag (deterministic hash → palette)
- [x] Edge thickness scales with shared tag count
- [x] Connected documents list in side panel
- [x] "Open Document" button navigates to Notes view
- [x] Add Graph nav item to Sidebar (GitFork icon)
- [x] Wire `graph` view into `appStore` and `MainShell` router
- [ ] Filtering/search controls — *pending (Phase 5)*

### Phase 5: Polish & Optimization (pending)
- [x] Loading states (spinner while fetching, empty state with instructions)
- [ ] Optimize for large vaults — debounce, lazy loading, edge threshold filter
- [ ] Add graph layout options (force, circular, hierarchical)
- [ ] Add export graph as image
- [ ] Add tooltips showing shared tags on edges (currently shown in side panel only)
- [ ] Real-time updates when files change (VaultManager watcher integration)
- [ ] Tag filter UI to show subgraph for a specific tag

---

## 8. Performance Considerations

### For large vaults (1000+ documents):
1. **Lazy loading** - Only load visible portion of graph
2. **Debounce** - Debounce file watcher updates (batch process)
3. **Indexing** - Use database indexes on tag queries
4. **Caching** - Cache graph data, invalidate on file changes
5. **Filtering** - Allow users to filter by tag/date to reduce nodes

### Memory optimization:
- Don't load full file content, only metadata
- Use SQLite for querying instead of in-memory arrays
- Limit edge creation (only show edges with 2+ shared tags)

---

## 9. Future Enhancements

### Link-based connections (Phase 2)
- Parse `[[wikilinks]]` from markdown content
- Create `links` table in database
- Add link edges to graph (different color/style)
- Backlinks panel

### Advanced features:
- Graph filters (by tag, date range, type)
- Graph layouts (force, hierarchical, circular)
- Community detection (cluster related documents)
- Temporal view (show graph evolution over time)
- Export to formats (JSON, GraphML, DOT)

---

## 10. Dependencies to Install

```bash
npm install gray-matter
npm install react-force-graph-2d
npm install --save-dev @types/react-force-graph-2d
```

---

## Success Metrics

- ✅ Parse 1000+ documents in < 5 seconds
- ✅ Graph renders smoothly with 500+ nodes
- ✅ Real-time updates when files change
- ✅ Stats tab shows accurate tag counts
- ✅ Click node to open document
- ✅ Visual clustering by shared tags
