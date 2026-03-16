interface SpeedSearchProps {
  query: string
  onQueryChange: (q: string) => void
  onDismiss: () => void
}

export default function SpeedSearch({ query, onQueryChange, onDismiss }: SpeedSearchProps): JSX.Element | null {
  if (!query) return null

  return (
    <div className="absolute bottom-2 left-2 right-2 z-20 flex items-center gap-2 px-3 py-1.5 bg-neutral-900 border border-neutral-700 rounded-lg shadow-lg text-sm pointer-events-none">
      <svg className="w-3.5 h-3.5 shrink-0 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
      </svg>
      <span className="text-neutral-300 truncate" data-testid="speed-search-query">
        {query}
      </span>
      <button
        className="ml-auto shrink-0 text-neutral-500 hover:text-neutral-300 transition-colors pointer-events-auto"
        onMouseDown={(e) => {
          e.preventDefault()
          onDismiss()
        }}
        title="Clear speed search (Escape)"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}
