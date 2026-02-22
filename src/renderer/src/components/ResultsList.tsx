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
  lastMessageSender: 'user' | 'assistant'
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
