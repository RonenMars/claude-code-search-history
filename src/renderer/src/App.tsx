import { useState, useEffect, useCallback } from 'react'
import SearchBar from './components/SearchBar'
import ResultsList from './components/ResultsList'
import ConversationView from './components/ConversationView'
import FilterPanel from './components/FilterPanel'
import { useSearch } from './hooks/useSearch'

interface Conversation {
  id: string
  filePath: string
  projectPath: string
  projectName: string
  sessionId: string
  messages: { type: string; content: string; timestamp: string }[]
  fullText: string
  timestamp: string
  messageCount: number
}

export default function App(): JSX.Element {
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [selectedProject, setSelectedProject] = useState<string>('')
  const [projects, setProjects] = useState<string[]>([])
  const [stats, setStats] = useState({ conversations: 0, projects: 0 })
  const [isLoading, setIsLoading] = useState(true)

  const { query, setQuery, results, searching } = useSearch(selectedProject)

  useEffect(() => {
    const init = async (): Promise<void> => {
      try {
        const [projectList, statsData] = await Promise.all([
          window.electronAPI.getProjects(),
          window.electronAPI.getStats()
        ])
        setProjects(projectList)
        setStats(statsData)
      } catch (err) {
        console.error('Failed to initialize:', err)
      } finally {
        setIsLoading(false)
      }
    }

    init()
  }, [])

  const handleSelectResult = useCallback(async (id: string) => {
    try {
      const conversation = await window.electronAPI.getConversation(id)
      setSelectedConversation(conversation)
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

  return (
    <div className="flex flex-col h-screen bg-claude-darker">
      {/* Title bar */}
      <div className="titlebar-drag h-8 flex items-center justify-between px-4 bg-claude-dark border-b border-neutral-800">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-neutral-400">Claude Code Search</span>
        </div>
        <div className="titlebar-no-drag flex items-center gap-3 text-xs text-neutral-500">
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
            />
          </div>

          {/* Results */}
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <div className="text-neutral-500 animate-pulse">Loading conversations...</div>
              </div>
            ) : (
              <ResultsList
                results={results}
                selectedId={selectedConversation?.id || null}
                onSelect={handleSelectResult}
                query={query}
              />
            )}
          </div>
        </div>

        {/* Conversation view */}
        <div className="flex-1 overflow-hidden">
          {selectedConversation ? (
            <ConversationView conversation={selectedConversation} query={query} />
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
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
