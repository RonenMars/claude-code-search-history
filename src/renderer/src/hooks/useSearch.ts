import { useState, useEffect, useCallback, useRef } from 'react'

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

  useEffect(() => {
    // Clear previous timeout
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    // Debounce search
    debounceRef.current = setTimeout(() => {
      performSearch(query)
    }, 150)

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [query, performSearch])

  // Re-search when project filter changes
  useEffect(() => {
    performSearch(query)
  }, [projectFilter])

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
