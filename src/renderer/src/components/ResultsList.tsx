import { useMemo } from 'react'

interface SearchResult {
  id: string
  projectName: string
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
  if (results.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-neutral-500 text-sm">
        {query ? 'No results found' : 'Start typing to search'}
      </div>
    )
  }

  return (
    <div className="divide-y divide-neutral-800">
      {results.map((result) => (
        <ResultItem
          key={result.id}
          result={result}
          isSelected={result.id === selectedId}
          onSelect={() => onSelect(result.id)}
          query={query}
        />
      ))}
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
    if (!query) return result.preview
    return highlightText(result.preview, query)
  }, [result.preview, query])

  const formattedDate = useMemo(() => {
    return formatDate(result.timestamp)
  }, [result.timestamp])

  return (
    <button
      onClick={onSelect}
      className={`w-full text-left p-4 transition-colors hover:bg-neutral-800/50 ${
        isSelected ? 'bg-neutral-800 border-l-2 border-claude-orange' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <span className="text-xs font-medium text-claude-orange truncate max-w-[200px]">
          {result.projectName}
        </span>
        <span className="text-xs text-neutral-500 whitespace-nowrap">{formattedDate}</span>
      </div>
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
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
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
