# P0/P1 Improvements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix memory bloat, speed up startup, consolidate types, and add UX polish (state persistence, virtualized results, progress indicator, error boundary, bug fixes).

**Architecture:** Two-tier storage (metadata in memory, full conversations lazy-loaded from disk with LRU cache). Parallel file scanning. All shared types in one file. Preferences persisted to JSON.

**Tech Stack:** Electron 28, React 18, TypeScript, @tanstack/react-virtual, FlexSearch, Tailwind CSS

---

### Task 1: Consolidate Shared Types

All domain types are duplicated across 5+ files. Consolidate them into `src/shared/types.ts` so every layer imports from one place.

**Files:**
- Modify: `src/shared/types.ts`

**Step 1: Add all shared domain types to `src/shared/types.ts`**

Add the following types ABOVE the existing tool-result types (which stay in place):

```typescript
// ─── Shared Domain Types ────────────────────────────────────────────

export interface MessageMetadata {
  model?: string
  stopReason?: string | null
  inputTokens?: number
  outputTokens?: number
  cacheReadTokens?: number
  cacheCreationTokens?: number
  gitBranch?: string
  version?: string
  toolUses?: string[]
  toolUseBlocks?: ToolUseBlock[]
  toolResults?: ToolResult[]
}

export interface ConversationMessage {
  type: 'user' | 'assistant' | 'system'
  content: string
  timestamp: string
  metadata?: MessageMetadata
  lineNumber?: number
  isToolResult?: boolean
}

export interface ConversationMeta {
  id: string
  filePath: string
  projectPath: string
  projectName: string
  sessionId: string
  sessionName: string
  timestamp: string
  messageCount: number
  preview: string
  contentSnippet: string
}

export interface Conversation {
  id: string
  filePath: string
  projectPath: string
  projectName: string
  sessionId: string
  sessionName: string
  messages: ConversationMessage[]
  fullText: string
  timestamp: string
  messageCount: number
}

export interface SearchResult {
  id: string
  projectName: string
  projectPath: string
  sessionId: string
  sessionName: string
  preview: string
  timestamp: string
  messageCount: number
  score: number
}

export type ExportFormat = 'markdown' | 'json' | 'text'

export interface ExportResult {
  success: boolean
  filePath?: string
  canceled?: boolean
  error?: string
}

export type SortOption = 'recent' | 'oldest' | 'most-messages' | 'least-messages' | 'alphabetical'
export type DateRangeOption = 'all' | 'today' | 'week' | 'month'

export interface UserPreferences {
  sortBy: SortOption
  dateRange: DateRangeOption
  selectedProject: string
}
```

Note: `ToolUseBlock` and `ToolResult` (plus all the specific tool result interfaces) already exist in this file — keep them. The `MessageMetadata` type references them, so it must appear after them OR move it below. The simplest approach: place the new domain types at the TOP of the file, but move `MessageMetadata` to AFTER the `ToolResult` and `ToolUseBlock` types since it references them.

**Step 2: Verify the file compiles**

Run: `npx tsc --noEmit --project tsconfig.json 2>&1 | head -20`

If there's no tsconfig at root, try: `npx electron-vite build 2>&1 | tail -20`

**Step 3: Commit**

```bash
git add src/shared/types.ts
git commit -m "refactor: consolidate all shared domain types into src/shared/types.ts"
```

---

### Task 2: Update Scanner to Two-Tier Storage + Parallel Scanning

Replace the in-memory conversation cache with metadata-only storage and lazy loading with an LRU cache.

**Files:**
- Modify: `src/main/services/scanner.ts`

**Step 1: Replace imports and class fields**

At the top of `scanner.ts`, update the import to use shared types:

```typescript
import type { ConversationMeta, Conversation, ConversationMessage, MessageMetadata, ToolResult, ToolUseBlock } from '../../shared/types'
```

Remove the local `MessageMetadata`, `ConversationMessage`, `Conversation`, `ConversationPreview` interfaces — they are now imported.

Replace the class fields:

```typescript
export class ConversationScanner {
  private claudeDir: string
  private projectsDir: string
  private metadataCache: Map<string, ConversationMeta> = new Map()
  private conversationLRU: Map<string, Conversation> = new Map()
  private readonly LRU_MAX = 5
  private projects: Set<string> = new Set()
  private onProgress?: (scanned: number, total: number) => void
```

**Step 2: Add `setProgressCallback` and LRU helper**

Add these methods to the class:

```typescript
  setProgressCallback(cb: (scanned: number, total: number) => void): void {
    this.onProgress = cb
  }

  private addToLRU(id: string, conversation: Conversation): void {
    // Delete first so re-insertion moves it to the end (most recent)
    this.conversationLRU.delete(id)
    this.conversationLRU.set(id, conversation)
    // Evict oldest if over limit
    if (this.conversationLRU.size > this.LRU_MAX) {
      const oldest = this.conversationLRU.keys().next().value
      if (oldest) this.conversationLRU.delete(oldest)
    }
  }
```

**Step 3: Replace `scanAll()` with `scanAllMeta()`**

Replace the entire `scanAll` method with:

```typescript
  async scanAllMeta(): Promise<ConversationMeta[]> {
    const metas: ConversationMeta[] = []
    this.metadataCache.clear()
    this.conversationLRU.clear()
    this.projects.clear()

    try {
      const projectDirs = await readdir(this.projectsDir)
      // Collect all file paths first
      const fileTasks: { filePath: string; fallbackName: string }[] = []

      for (const projectDir of projectDirs) {
        if (projectDir.startsWith('.')) continue
        const projectPath = join(this.projectsDir, projectDir)
        const stats = await stat(projectPath)
        if (!stats.isDirectory()) continue

        const fallbackName = this.decodeProjectName(projectDir)
        const jsonlFiles = await this.findJsonlFiles(projectPath)

        for (const filePath of jsonlFiles) {
          const fileStats = await stat(filePath)
          if (fileStats.size === 0) continue
          fileTasks.push({ filePath, fallbackName })
        }
      }

      // Process in parallel batches of 10
      const BATCH_SIZE = 10
      let scanned = 0
      const total = fileTasks.length

      for (let i = 0; i < fileTasks.length; i += BATCH_SIZE) {
        const batch = fileTasks.slice(i, i + BATCH_SIZE)
        const results = await Promise.all(
          batch.map(({ filePath, fallbackName }) =>
            this.parseConversationMeta(filePath, fallbackName).catch((err) => {
              console.error(`Error parsing ${filePath}:`, err)
              return null
            })
          )
        )

        for (const meta of results) {
          if (meta && meta.messageCount > 0) {
            this.projects.add(meta.projectPath)
            metas.push(meta)
            this.metadataCache.set(meta.id, meta)
          }
        }

        scanned += batch.length
        this.onProgress?.(scanned, total)
      }
    } catch (err) {
      console.error('Error scanning claude projects:', err)
    }

    metas.sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )

    return metas
  }
```

**Step 4: Add `parseConversationMeta()` method**

This is a lightweight version of `parseConversation` that extracts metadata only (no full message array):

```typescript
  private async parseConversationMeta(filePath: string, fallbackProjectName: string): Promise<ConversationMeta | null> {
    let sessionId = ''
    let sessionName = ''
    let latestTimestamp = ''
    let cwd = ''
    let messageCount = 0
    const previewParts: string[] = []
    const snippetParts: string[] = []
    let snippetLength = 0
    const SNIPPET_MAX = 5000
    const PREVIEW_MAX = 200

    const fileStream = createReadStream(filePath)
    const rl = createInterface({ input: fileStream, crlfDelay: Infinity })

    for await (const line of rl) {
      if (!line.trim()) continue

      try {
        const entry = JSON.parse(line)

        if (entry.cwd && !cwd) cwd = entry.cwd
        if (entry.sessionId && !sessionId) sessionId = entry.sessionId
        if (entry.slug && !sessionName) sessionName = entry.slug
        if (entry.timestamp && (!latestTimestamp || entry.timestamp > latestTimestamp)) {
          latestTimestamp = entry.timestamp
        }

        if ((entry.type === 'user' || entry.type === 'assistant') && !entry.isMeta) {
          const content = this.extractContent(entry.message?.content)
          if (content) {
            messageCount++

            // Build preview from first meaningful content
            if (previewParts.join(' ').length < PREVIEW_MAX) {
              previewParts.push(content)
            }

            // Build search snippet up to limit
            if (snippetLength < SNIPPET_MAX) {
              const remaining = SNIPPET_MAX - snippetLength
              const chunk = content.length > remaining ? content.slice(0, remaining) : content
              snippetParts.push(chunk)
              snippetLength += chunk.length
            }
          } else if (entry.toolUseResult || this.isOnlyToolResult(entry.message?.content)) {
            messageCount++
          }
        }
      } catch {
        // Skip malformed JSON lines
      }
    }

    if (messageCount === 0) return null

    const projectPath = cwd || fallbackProjectName
    const preview = previewParts.join(' ').slice(0, PREVIEW_MAX)

    return {
      id: filePath,
      filePath,
      projectPath,
      projectName: this.getShortProjectName(projectPath),
      sessionId: sessionId || filePath.split('/').pop()?.replace('.jsonl', '') || '',
      sessionName: sessionName || '',
      timestamp: latestTimestamp || new Date().toISOString(),
      messageCount,
      preview,
      contentSnippet: snippetParts.join(' ')
    }
  }
```

**Step 5: Update `getConversation()` to use LRU + re-parse**

Replace the existing `getConversation` method:

```typescript
  async getConversation(id: string): Promise<Conversation | null> {
    // Check LRU cache first
    const cached = this.conversationLRU.get(id)
    if (cached) {
      // Move to end (most recently used)
      this.addToLRU(id, cached)
      return cached
    }

    // Re-parse from disk
    const meta = this.metadataCache.get(id)
    if (!meta) return null

    try {
      const conversation = await this.parseConversation(meta.filePath, meta.projectName)
      if (conversation) {
        this.addToLRU(id, conversation)
      }
      return conversation
    } catch (err) {
      console.error(`Error re-parsing conversation ${id}:`, err)
      return null
    }
  }
```

The existing `parseConversation` method stays as-is — it's used for on-demand full parsing.

**Step 6: Remove the `EditStructuredPatch` type alias at the bottom**

It's now in `shared/types.ts` as `StructuredPatchHunk`. Update the reference in `classifyToolResult` to use the imported type.

**Step 7: Verify compilation**

Run: `npx electron-vite build 2>&1 | tail -20`

**Step 8: Commit**

```bash
git add src/main/services/scanner.ts
git commit -m "perf: two-tier storage with metadata-only scanning and LRU cache"
```

---

### Task 3: Update Indexer for Metadata-Only Input

The indexer should accept `ConversationMeta[]` and index the truncated `contentSnippet` field.

**Files:**
- Modify: `src/main/services/indexer.ts`

**Step 1: Update imports and types**

Replace the imports at top:

```typescript
import FlexSearch from 'flexsearch'
import type { ConversationMeta, SearchResult } from '../../shared/types'
```

Remove the local `SearchResult` and `IndexedDocument` interfaces. Replace `IndexedDocument` with:

```typescript
interface IndexedDocument {
  id: string
  projectName: string
  projectPath: string
  sessionId: string
  sessionName: string
  content: string
  timestamp: string
  messageCount: number
  preview: string
}
```

**Step 2: Update `buildIndex` to accept `ConversationMeta[]`**

```typescript
  async buildIndex(metas: ConversationMeta[]): Promise<void> {
    this.documents.clear()

    for (const meta of metas) {
      const doc: IndexedDocument = {
        id: meta.id,
        projectName: meta.projectName,
        projectPath: meta.projectPath,
        sessionId: meta.sessionId,
        sessionName: meta.sessionName,
        content: meta.contentSnippet,
        timestamp: meta.timestamp,
        messageCount: meta.messageCount,
        preview: meta.preview
      }

      this.documents.set(meta.id, doc)
      this.index.add(doc)
    }
  }
```

**Step 3: Update `getRecent` to use stored preview**

In the `getRecent` method, change:

```typescript
      preview: this.truncateText(doc.content, 200),
```

to:

```typescript
      preview: doc.preview || this.truncateText(doc.content, 200),
```

**Step 4: Verify compilation and commit**

```bash
npx electron-vite build 2>&1 | tail -20
git add src/main/services/indexer.ts
git commit -m "perf: index metadata snippets instead of full conversation text"
```

---

### Task 4: Update Main Process (IPC Handlers + Preferences + Progress)

Wire up the new scanner API, add preference persistence, and forward progress events.

**Files:**
- Modify: `src/main/index.ts`

**Step 1: Add preference helpers and update imports**

Add at the top of the file:

```typescript
import { readFile, writeFile, mkdir } from 'fs/promises'
```

(Replace the existing `import { writeFile } from 'fs/promises'` line.)

Add a preferences helper after the global variables:

```typescript
function getPrefsPath(): string {
  return join(app.getPath('userData'), 'preferences.json')
}

async function loadPreferences(): Promise<Record<string, unknown>> {
  try {
    const data = await readFile(getPrefsPath(), 'utf-8')
    return JSON.parse(data)
  } catch {
    return {}
  }
}

async function savePreferences(prefs: Record<string, unknown>): Promise<void> {
  const dir = app.getPath('userData')
  await mkdir(dir, { recursive: true })
  await writeFile(getPrefsPath(), JSON.stringify(prefs, null, 2), 'utf-8')
}
```

**Step 2: Update `initializeSearch` to use `scanAllMeta`**

```typescript
async function initializeSearch(): Promise<void> {
  scanner = new ConversationScanner()
  indexer = new SearchIndexer()

  scanner.setProgressCallback((scanned, total) => {
    mainWindow?.webContents.send('scan-progress', { scanned, total })
  })

  console.log('Scanning for conversations...')
  const metas = await scanner.scanAllMeta()
  console.log(`Found ${metas.length} conversations`)

  console.log('Building search index...')
  await indexer.buildIndex(metas)
  console.log('Search index ready')
}
```

**Step 3: Add new IPC handlers**

Inside `setupIpcHandlers()`, add:

```typescript
  ipcMain.handle('get-preferences', async () => {
    return loadPreferences()
  })

  ipcMain.handle('set-preferences', async (_event, prefs: Record<string, unknown>) => {
    await savePreferences(prefs)
    return true
  })
```

**Step 4: Update the `get-conversation` handler**

The scanner's `getConversation` is now async (re-parses from disk). It's already called with `await`, so no change needed to the handler itself — just verify it still works.

**Step 5: Remove the local `ConversationForExport` interface**

Import `Conversation` from shared types instead:

```typescript
import type { Conversation } from './services/scanner'
```

Change the `formatAsMarkdown` and `formatAsText` function signatures to use `Conversation` instead of `ConversationForExport`. Remove the `ConversationForExport` interface.

**Step 6: Verify and commit**

```bash
npx electron-vite build 2>&1 | tail -20
git add src/main/index.ts
git commit -m "feat: add preferences persistence and scan progress IPC"
```

---

### Task 5: Update Preload Bridge

Add new API methods and fix the listener leak.

**Files:**
- Modify: `src/preload/index.ts`

**Step 1: Replace the entire file**

```typescript
import { contextBridge, ipcRenderer } from 'electron'
import type {
  SearchResult,
  Conversation,
  ExportFormat,
  ExportResult,
  UserPreferences
} from '../shared/types'

export type { SearchResult, Conversation, ExportFormat, ExportResult, UserPreferences }

export interface ElectronAPI {
  search: (query: string, filters?: { project?: string; limit?: number }) => Promise<SearchResult[]>
  getConversation: (id: string) => Promise<Conversation | null>
  getProjects: () => Promise<string[]>
  getStats: () => Promise<{ conversations: number; projects: number }>
  rebuildIndex: () => Promise<boolean>
  exportConversation: (id: string, format: ExportFormat) => Promise<ExportResult>
  getPreferences: () => Promise<Partial<UserPreferences>>
  setPreferences: (prefs: Partial<UserPreferences>) => Promise<boolean>
  onIndexReady: (callback: () => void) => void
  onScanProgress: (callback: (progress: { scanned: number; total: number }) => void) => (() => void)
}

const api: ElectronAPI = {
  search: (query, filters) => ipcRenderer.invoke('search', query, filters),
  getConversation: (id) => ipcRenderer.invoke('get-conversation', id),
  getProjects: () => ipcRenderer.invoke('get-projects'),
  getStats: () => ipcRenderer.invoke('get-stats'),
  rebuildIndex: () => ipcRenderer.invoke('rebuild-index'),
  exportConversation: (id, format) => ipcRenderer.invoke('export-conversation', id, format),
  getPreferences: () => ipcRenderer.invoke('get-preferences'),
  setPreferences: (prefs) => ipcRenderer.invoke('set-preferences', prefs),
  onIndexReady: (callback) => ipcRenderer.once('index-ready', callback),
  onScanProgress: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, progress: { scanned: number; total: number }): void => {
      callback(progress)
    }
    ipcRenderer.on('scan-progress', handler)
    return () => ipcRenderer.removeListener('scan-progress', handler)
  }
}

contextBridge.exposeInMainWorld('electronAPI', api)
```

Key changes: `onIndexReady` uses `once` (fixes leak), new `onScanProgress` returns cleanup function, new `getPreferences`/`setPreferences`, all types imported from shared.

**Step 2: Update `src/renderer/src/env.d.ts`**

This file declares the `window.electronAPI` type for the renderer. Update it to import from preload:

```typescript
import type { ElectronAPI } from '../../preload/index'

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
```

**Step 3: Verify and commit**

```bash
npx electron-vite build 2>&1 | tail -20
git add src/preload/index.ts src/renderer/src/env.d.ts
git commit -m "refactor: update preload bridge with shared types, fix listener leak"
```

---

### Task 6: Create Error Boundary Component

**Files:**
- Create: `src/renderer/src/components/ErrorBoundary.tsx`

**Step 1: Create the component**

```typescript
import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('ErrorBoundary caught:', error, info.componentStack)
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div className="flex items-center justify-center h-full text-neutral-400">
          <div className="text-center max-w-md">
            <svg className="w-12 h-12 mx-auto mb-3 text-red-500/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm mb-1">Something went wrong rendering this view.</p>
            <p className="text-xs text-neutral-500 mb-4 font-mono">{this.state.error?.message}</p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="px-4 py-2 text-xs font-medium bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-md transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
```

**Step 2: Commit**

```bash
git add src/renderer/src/components/ErrorBoundary.tsx
git commit -m "feat: add ErrorBoundary component for graceful crash recovery"
```

---

### Task 7: Fix Bug - Double Search in useSearch

**Files:**
- Modify: `src/renderer/src/hooks/useSearch.ts`

**Step 1: Update imports and remove duplicate effect**

Replace the entire file:

```typescript
import { useState, useEffect, useCallback, useRef } from 'react'
import type { SearchResult } from '../../../shared/types'

interface UseSearchReturn {
  query: string
  setQuery: (query: string) => void
  results: SearchResult[]
  searching: boolean
  refresh: () => void
}

export function useSearch(projectFilter?: string): UseSearchReturn {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const debounceRef = useRef<NodeJS.Timeout>()

  const performSearch = useCallback(
    async (searchQuery: string) => {
      setSearching(true)
      try {
        const searchResults = await window.electronAPI.search(searchQuery, {
          project: projectFilter,
          limit: 100
        })
        setResults(searchResults)
      } catch (err) {
        console.error('Search error:', err)
        setResults([])
      } finally {
        setSearching(false)
      }
    },
    [projectFilter]
  )

  // Single debounced effect handles both query and projectFilter changes
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    debounceRef.current = setTimeout(() => {
      performSearch(query)
    }, 150)

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [query, performSearch])

  const refresh = useCallback(() => {
    performSearch(query)
  }, [performSearch, query])

  return {
    query,
    setQuery,
    results,
    searching,
    refresh
  }
}
```

The key change: removed the separate `useEffect` for `projectFilter`. Since `performSearch` already depends on `projectFilter` via `useCallback`, the debounced effect re-runs when `projectFilter` changes.

**Step 2: Commit**

```bash
git add src/renderer/src/hooks/useSearch.ts
git commit -m "fix: remove double-search triggered by project filter change"
```

---

### Task 8: Fix Bug - DOM-based escapeHtml in ResultsList

**Files:**
- Modify: `src/renderer/src/components/ResultsList.tsx`

**Step 1: Replace the `escapeHtml` function**

Find the `escapeHtml` function at the bottom of `ResultsList.tsx`:

```typescript
function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}
```

Replace with:

```typescript
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
```

**Step 2: Commit**

```bash
git add src/renderer/src/components/ResultsList.tsx
git commit -m "fix: replace DOM-based escapeHtml with string-based version"
```

---

### Task 9: Virtualize ResultsList

**Files:**
- Modify: `src/renderer/src/components/ResultsList.tsx`
- Modify: `src/renderer/src/App.tsx`

**Step 1: Update ResultsList to use virtualization**

Replace the entire `ResultsList.tsx` file:

```typescript
import { useMemo, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'

interface SearchResult {
  id: string
  projectName: string
  projectPath: string
  sessionId: string
  sessionName: string
  preview: string
  timestamp: string
  messageCount: number
  score: number
}

interface ResultsListProps {
  results: SearchResult[]
  selectedId: string | null
  onSelect: (id: string) => void
  query: string
}

export default function ResultsList({
  results,
  selectedId,
  onSelect,
  query
}: ResultsListProps): JSX.Element {
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: results.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => 100,
    overscan: 3
  })

  if (results.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-neutral-500 text-sm">
        {query ? 'No results found' : 'Start typing to search'}
      </div>
    )
  }

  const virtualItems = virtualizer.getVirtualItems()

  return (
    <div ref={scrollContainerRef} className="h-full overflow-y-auto">
      <div
        className="relative w-full"
        style={{ height: virtualizer.getTotalSize() }}
      >
        <div
          className="absolute top-0 left-0 w-full"
          style={{ transform: `translateY(${virtualItems[0]?.start ?? 0}px)` }}
        >
          {virtualItems.map((virtualRow) => (
            <div
              key={virtualRow.key}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
            >
              <ResultItem
                result={results[virtualRow.index]}
                isSelected={results[virtualRow.index].id === selectedId}
                onSelect={() => onSelect(results[virtualRow.index].id)}
                query={query}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

interface ResultItemProps {
  result: SearchResult
  isSelected: boolean
  onSelect: () => void
  query: string
}

function ResultItem({ result, isSelected, onSelect, query }: ResultItemProps): JSX.Element {
  const highlightedPreview = useMemo(() => {
    if (!query) return escapeHtml(result.preview)
    return highlightText(result.preview, query)
  }, [result.preview, query])

  const highlightedSessionId = useMemo(() => {
    const short = result.sessionId?.slice(0, 8) || ''
    if (!query || !short) return escapeHtml(short)
    return highlightText(short, query)
  }, [result.sessionId, query])

  const formattedDate = useMemo(() => {
    return formatDate(result.timestamp)
  }, [result.timestamp])

  return (
    <button
      onClick={onSelect}
      className={`w-full text-left p-4 transition-colors hover:bg-neutral-800/50 border-b border-neutral-800 ${isSelected ? 'bg-neutral-800 border-l-2 border-claude-orange' : ''
        }`}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <span className="text-xs font-medium text-claude-orange truncate max-w-[200px]">
          {result.projectName}
        </span>
        <span className="text-xs text-neutral-500 whitespace-nowrap">{formattedDate}</span>
      </div>
      {result.sessionName && (
        <p className="text-xs text-neutral-400 mb-1 truncate">{result.sessionName}</p>
      )}
      {result.sessionId && (
        <p
          className="text-[10px] font-mono text-neutral-500 mb-1 truncate"
          dangerouslySetInnerHTML={{ __html: highlightedSessionId }}
        />
      )}
      <p
        className="text-sm text-neutral-300 line-clamp-2"
        dangerouslySetInnerHTML={{ __html: highlightedPreview }}
      />
      <div className="mt-2 text-xs text-neutral-500">{result.messageCount} messages</div>
    </button>
  )
}

function highlightText(text: string, query: string): string {
  if (!query) return escapeHtml(text)

  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`(${escapedQuery})`, 'gi')
  const parts = text.split(regex)

  return parts
    .map((part) =>
      part.toLowerCase() === query.toLowerCase()
        ? `<span class="highlight">${escapeHtml(part)}</span>`
        : escapeHtml(part)
    )
    .join('')
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function formatDate(timestamp: string): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } else if (diffDays === 1) {
    return 'Yesterday'
  } else if (diffDays < 7) {
    return date.toLocaleDateString([], { weekday: 'short' })
  } else {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
  }
}
```

Key changes: added `useVirtualizer`, `scrollContainerRef`, virtual item rendering. Moved border from parent `divide-y` to individual items (`border-b`).

**Step 2: Update App.tsx sidebar results container**

In `App.tsx`, change the results container from:

```tsx
          <div className="flex-1 overflow-y-auto">
```

to:

```tsx
          <div className="flex-1 overflow-hidden">
```

The `ResultsList` now manages its own scrolling internally.

**Step 3: Verify and commit**

```bash
npx electron-vite build 2>&1 | tail -20
git add src/renderer/src/components/ResultsList.tsx src/renderer/src/App.tsx
git commit -m "perf: virtualize ResultsList with @tanstack/react-virtual"
```

---

### Task 10: Update App.tsx - Shared Types, Preferences, Progress, Error Boundary

This is the final integration task that wires everything together in the main renderer component.

**Files:**
- Modify: `src/renderer/src/App.tsx`

**Step 1: Update imports**

Replace the imports at the top:

```typescript
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import SearchBar from './components/SearchBar'
import ResultsList from './components/ResultsList'
import ConversationView from './components/ConversationView'
import FilterPanel from './components/FilterPanel'
import ErrorBoundary from './components/ErrorBoundary'
import { useSearch } from './hooks/useSearch'
import type { Conversation, SortOption, DateRangeOption } from '../../shared/types'
```

Remove the local `Conversation` interface and the `import type { SortOption, DateRangeOption } from './components/FilterPanel'` line.

**Step 2: Remove `SortOption` and `DateRangeOption` from FilterPanel**

In `src/renderer/src/components/FilterPanel.tsx`, replace the local type definitions:

```typescript
import type { SortOption, DateRangeOption } from '../../../shared/types'
```

Remove the two `export type` lines at the top of the file.

**Step 3: Add progress and preference state to App**

Inside the `App` function, add after the existing state declarations:

```typescript
  const [scanProgress, setScanProgress] = useState<{ scanned: number; total: number } | null>(null)
  const prefsDebounceRef = useRef<NodeJS.Timeout>()
```

**Step 4: Load preferences on mount**

Update the `useEffect` that calls `loadData`:

```typescript
  useEffect(() => {
    const loadData = async (): Promise<void> => {
      try {
        const [projectList, statsData, prefs] = await Promise.all([
          window.electronAPI.getProjects(),
          window.electronAPI.getStats(),
          window.electronAPI.getPreferences()
        ])
        setProjects(projectList)
        setStats(statsData)

        // Restore saved preferences
        if (prefs.sortBy) setSortBy(prefs.sortBy)
        if (prefs.dateRange) setDateRange(prefs.dateRange)
        if (prefs.selectedProject) setSelectedProject(prefs.selectedProject)
      } catch (err) {
        console.error('Failed to initialize:', err)
      } finally {
        setIsLoading(false)
      }
    }

    loadData()

    // Listen for index ready (fires once)
    window.electronAPI.onIndexReady(() => {
      loadData()
      refresh()
    })

    // Listen for scan progress
    const cleanupProgress = window.electronAPI.onScanProgress((progress) => {
      setScanProgress(progress)
    })

    return cleanupProgress
  }, [])
```

Remove the separate `indexVersion` state and its effect — the `onIndexReady` callback now calls `refresh()` directly.

**Step 5: Save preferences on change**

Add a new effect after the existing ones:

```typescript
  // Persist preferences on change (debounced)
  useEffect(() => {
    if (prefsDebounceRef.current) {
      clearTimeout(prefsDebounceRef.current)
    }
    prefsDebounceRef.current = setTimeout(() => {
      window.electronAPI.setPreferences({ sortBy, dateRange, selectedProject })
    }, 500)

    return () => {
      if (prefsDebounceRef.current) {
        clearTimeout(prefsDebounceRef.current)
      }
    }
  }, [sortBy, dateRange, selectedProject])
```

**Step 6: Update loading indicator to show progress**

Replace the loading state in the JSX:

```tsx
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <div className="text-center">
                  <div className="text-neutral-500 animate-pulse mb-2">
                    {scanProgress
                      ? `Scanning... ${scanProgress.scanned}/${scanProgress.total} conversations`
                      : 'Loading conversations...'}
                  </div>
                  {scanProgress && scanProgress.total > 0 && (
                    <div className="w-48 mx-auto h-1 bg-neutral-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-claude-orange transition-all duration-300"
                        style={{ width: `${(scanProgress.scanned / scanProgress.total) * 100}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>
            ) : (
```

**Step 7: Wrap ConversationView in ErrorBoundary**

Replace:

```tsx
            <ConversationView conversation={selectedConversation} query={query} />
```

with:

```tsx
            <ErrorBoundary>
              <ConversationView conversation={selectedConversation} query={query} />
            </ErrorBoundary>
```

**Step 8: Update ConversationView imports**

In `src/renderer/src/components/ConversationView.tsx`, replace local interfaces with imports from shared types:

```typescript
import type { Conversation, ConversationMessage, MessageMetadata } from '../../../shared/types'
```

Remove the local `MessageMetadata`, `ConversationMessage`, and `Conversation` interfaces from that file. Keep the `ConversationViewProps` and `ExportFormat` type (or import ExportFormat too).

**Step 9: Full build and test**

```bash
npx electron-vite build 2>&1 | tail -30
```

Fix any remaining type errors, then:

```bash
npm run dev
```

Verify: app launches, shows progress during scan, results are virtualized (scroll smoothly with 100+ items), selecting a conversation loads it, preferences persist after restart.

**Step 10: Commit**

```bash
git add -A
git commit -m "feat: integrate preferences, progress indicator, error boundary, and shared types"
```

---

### Task 11: Final Verification

**Step 1: Clean build**

```bash
rm -rf out/ dist/
npx electron-vite build
```

**Step 2: Test all features**

1. Launch with `npm run dev`
2. Verify progress bar shows during initial scan
3. Search for a term — results should be virtualized (inspect DOM: only ~10 items rendered)
4. Select a conversation — should load from disk
5. Go back and forth between 2-3 conversations — LRU cache makes revisits instant
6. Change sort/filter preferences, quit and relaunch — preferences should persist
7. Open a conversation with malformed content (if possible) — error boundary should catch it

**Step 3: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address issues found during final verification"
```
