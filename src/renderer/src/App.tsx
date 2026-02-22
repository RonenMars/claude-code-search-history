import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import SearchBar from './components/SearchBar'
import ResultsList from './components/ResultsList'
import ConversationView from './components/ConversationView'
import FilterPanel from './components/FilterPanel'
import ErrorBoundary from './components/ErrorBoundary'
import ChatTerminal from './components/ChatTerminal'
import { useSearch } from './hooks/useSearch'
import type { Conversation, SortOption, DateRangeOption } from '../../shared/types'


export default function App(): JSX.Element {
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [selectedProject, setSelectedProject] = useState<string>('')
  const [sortBy, setSortBy] = useState<SortOption>('recent')
  const [dateRange, setDateRange] = useState<DateRangeOption>('all')
  const [projects, setProjects] = useState<string[]>([])
  const [stats, setStats] = useState({ conversations: 0, projects: 0 })
  const [isLoading, setIsLoading] = useState(true)
  const [scanProgress, setScanProgress] = useState<{ scanned: number; total: number } | null>(null)
  const prefsDebounceRef = useRef<NodeJS.Timeout>()

  // Chat state
  const [chatCwd, setChatCwd] = useState<string | null>(null)
  const [chatKey, setChatKey] = useState(0) // increment to force remount

  const { query, setQuery, results, searching, refresh } = useSearch(selectedProject)

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

  // Filter and sort results
  const sortedResults = useMemo(() => {
    // First, filter by date range
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)

    let filtered = results.filter((result) => {
      if (dateRange === 'all') return true
      const resultDate = new Date(result.timestamp)

      switch (dateRange) {
        case 'today':
          return resultDate >= today
        case 'week':
          return resultDate >= weekAgo
        case 'month':
          return resultDate >= monthAgo
        default:
          return true
      }
    })

    // Then, sort
    const sorted = [...filtered]
    switch (sortBy) {
      case 'recent':
        sorted.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        break
      case 'oldest':
        sorted.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
        break
      case 'most-messages':
        sorted.sort((a, b) => b.messageCount - a.messageCount)
        break
      case 'least-messages':
        sorted.sort((a, b) => a.messageCount - b.messageCount)
        break
      case 'alphabetical':
        sorted.sort((a, b) => a.projectName.localeCompare(b.projectName))
        break
    }

    return sorted
  }, [results, sortBy, dateRange])

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

  const handleSelectResult = useCallback(async (id: string) => {
    try {
      const conversation = await window.electronAPI.getConversation(id)
      setSelectedConversation(conversation)
      setChatCwd(null) // switch back to history view
    } catch (err) {
      console.error('Failed to load conversation:', err)
    }
  }, [])

  const handleRefresh = useCallback(async () => {
    setIsLoading(true)
    try {
      await window.electronAPI.rebuildIndex()
      const [projectList, statsData] = await Promise.all([
        window.electronAPI.getProjects(),
        window.electronAPI.getStats()
      ])
      setProjects(projectList)
      setStats(statsData)
    } catch (err) {
      console.error('Failed to refresh:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // ─── Chat handlers ────────────────────────────────────────────────

  const handleNewChat = useCallback(async () => {
    if (chatCwd) {
      const confirmed = window.confirm('A chat session is active. Start a new one?')
      if (!confirmed) return
      await window.electronAPI.ptyKill()
    }
    const dir = await window.electronAPI.selectDirectory()
    if (dir) {
      setChatCwd(dir)
      setChatKey((k) => k + 1)
      setSelectedConversation(null)
    }
  }, [chatCwd])

  const handleChatInProject = useCallback(async (projectPath: string) => {
    if (chatCwd) {
      const confirmed = window.confirm('A chat session is active. Start a new one?')
      if (!confirmed) return
      await window.electronAPI.ptyKill()
    }
    setChatCwd(projectPath)
    setChatKey((k) => k + 1)
    setSelectedConversation(null)
  }, [chatCwd])

  const handleChatExit = useCallback(() => {
    // Keep the terminal visible with the exit message — don't auto-close
  }, [])

  const handleCloseChat = useCallback(async () => {
    await window.electronAPI.ptyKill()
    setChatCwd(null)
  }, [])

  return (
    <div className="flex flex-col h-screen bg-claude-darker">
      {/* Title bar */}
      <div className="titlebar-drag h-8 flex items-center justify-between pl-20 pr-4 bg-claude-dark border-b border-neutral-800">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-neutral-400">Claude Code Search</span>
        </div>
        <div className="titlebar-no-drag flex items-center gap-3 text-xs text-neutral-500">
          <button
            onClick={handleNewChat}
            className="hover:text-neutral-300 transition-colors flex items-center gap-1"
            title="New Claude Code chat"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Chat
          </button>
          <span>{stats.conversations} conversations</span>
          <span>{stats.projects} projects</span>
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="hover:text-neutral-300 transition-colors disabled:opacity-50"
            title="Refresh index"
          >
            <svg
              className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="w-96 flex flex-col border-r border-neutral-800 bg-claude-dark">
          {/* Search */}
          <div className="p-4 border-b border-neutral-800">
            <SearchBar value={query} onChange={setQuery} isSearching={searching} />
            <FilterPanel
              projects={projects}
              selectedProject={selectedProject}
              onProjectChange={setSelectedProject}
              sortBy={sortBy}
              onSortChange={setSortBy}
              dateRange={dateRange}
              onDateRangeChange={setDateRange}
              onChatInProject={handleChatInProject}
            />
          </div>

          {/* Results Counter */}
          <div className="px-4 py-2 border-b border-neutral-800">
            <div className="text-xs text-neutral-500">
              Showing <span className="font-medium text-neutral-400">{sortedResults.length}</span> of{' '}
              <span className="font-medium text-neutral-400">{results.length}</span> conversations
            </div>
          </div>

          {/* Results */}
          <div className="flex-1 overflow-hidden">
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
              <ResultsList
                results={sortedResults}
                selectedId={selectedConversation?.id || null}
                onSelect={handleSelectResult}
                query={query}
              />
            )}
          </div>
        </div>

        {/* Right panel: Chat terminal or Conversation view */}
        <div className="flex-1 overflow-hidden">
          {chatCwd ? (
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between px-4 py-1 bg-claude-dark border-b border-neutral-700">
                <span className="text-xs text-neutral-500">Live Chat</span>
                <button
                  onClick={handleCloseChat}
                  className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
                  title="Close chat and return to history"
                >
                  Close
                </button>
              </div>
              <div className="flex-1 overflow-hidden">
                <ChatTerminal
                  key={chatKey}
                  cwd={chatCwd}
                  onExit={handleChatExit}
                />
              </div>
            </div>
          ) : selectedConversation ? (
            <ErrorBoundary>
              <ConversationView conversation={selectedConversation} query={query} />
            </ErrorBoundary>
          ) : (
            <div className="flex items-center justify-center h-full text-neutral-500">
              <div className="text-center">
                <svg
                  className="w-16 h-16 mx-auto mb-4 opacity-50"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
                <p>Select a conversation to view</p>
                <button
                  onClick={handleNewChat}
                  className="mt-4 px-4 py-2 text-sm text-claude-orange bg-claude-orange/10 hover:bg-claude-orange/20 border border-claude-orange/30 rounded-lg transition-colors"
                >
                  Start a new chat
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
