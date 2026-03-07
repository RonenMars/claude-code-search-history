import { useState, useEffect, useCallback, useRef } from 'react'
import type { SearchResult } from '../../../shared/types'

interface UseSearchReturn {
  query: string
  setQuery: (query: string) => void
  results: SearchResult[]
  searching: boolean
  hasSearched: boolean
  refresh: () => void
}

export function useSearch(projectFilter?: string, enabled = true): UseSearchReturn {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(true)
  const [hasSearched, setHasSearched] = useState(false)
  const debounceRef = useRef<NodeJS.Timeout>()

  const performSearch = useCallback(
    async (searchQuery: string) => {
      setSearching(true)
      try {
        const searchResults = await window.electronAPI.search(searchQuery, {
          project: projectFilter
        })
        setResults(searchResults)
      } catch (err) {
        console.error('Search error:', err)
        setResults([])
      } finally {
        setSearching(false)
        setHasSearched(true)
      }
    },
    [projectFilter]
  )

  // Single debounced effect handles both query and projectFilter changes
  useEffect(() => {
    if (!enabled) return

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
  }, [query, performSearch, enabled])

  const refresh = useCallback(() => {
    performSearch(query)
  }, [performSearch, query])

  return {
    query,
    setQuery,
    results,
    searching,
    hasSearched,
    refresh
  }
}
