import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import SearchBar from './components/SearchBar'
import ResultsList from './components/ResultsList'
import ConversationView from './components/ConversationView'
import FilterPanel from './components/FilterPanel'
import ErrorBoundary from './components/ErrorBoundary'
import ChatTerminal from './components/ChatTerminal'
import { useSearch } from './hooks/useSearch'
import ProfilePickerModal from './components/ProfilePickerModal'
import SettingsModal from './components/SettingsModal'
import ProfilesPanel from './components/ProfilesPanel'
import ActiveChatList from './components/ActiveChatList'
import type { Conversation, SortOption, DateRangeOption, Profile } from '../../shared/types'
import type { ChatInstance, AppSettings } from '../../shared/types'
import { v4 as uuidv4 } from 'uuid'

type RightPanelView = 'conversation' | 'profiles' | 'settings' | 'empty'


export default function App(): JSX.Element {
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [selectedProject, setSelectedProject] = useState<string>('')
  const [sortBy, setSortBy] = useState<SortOption>('recent')
  const [dateRange, setDateRange] = useState<DateRangeOption>('all')
  const [projects, setProjects] = useState<string[]>([])
  const [stats, setStats] = useState({ conversations: 0, projects: 0 })
  const [isLoading, setIsLoading] = useState(true)
  const [isIndexing, setIsIndexing] = useState(true)
  const [scanProgress, setScanProgress] = useState<{ scanned: number; total: number } | null>(null)
  const prefsDebounceRef = useRef<NodeJS.Timeout>()

  // Multi-instance chat state
  const [chatInstances, setChatInstances] = useState<ChatInstance[]>([])
  const [activeChatInstanceId, setActiveChatInstanceId] = useState<string | null>(null)
  const [appSettings, setAppSettings] = useState<AppSettings>({ maxChatInstances: 3 })
  const typingTimers = useRef<Map<string, NodeJS.Timeout>>(new Map())

  // Profile picker state
  const [pendingChatConfig, setPendingChatConfig] = useState<{
    cwd: string | null
    resumeSessionId?: string
  } | null>(null)
  const [rightPanel, setRightPanel] = useState<RightPanelView>('empty')
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [accountFilter, setAccountFilter] = useState<string | null>(null)
  const [defaultProfileId, setDefaultProfileId] = useState<string | null>(null)

  const { query, setQuery, results, searching, refresh } = useSearch(selectedProject)

  useEffect(() => {
    const loadData = async (): Promise<void> => {
      try {
        const [projectList, statsData, prefs, profileList, settings] = await Promise.all([
          window.electronAPI.getProjects(),
          window.electronAPI.getStats(),
          window.electronAPI.getPreferences(),
          window.electronAPI.getProfiles(),
          window.electronAPI.getSettings()
        ])
        setProjects(projectList)
        setStats(statsData)
        setProfiles(profileList)
        setAppSettings(settings)

        // Restore saved preferences
        if (prefs.sortBy) setSortBy(prefs.sortBy)
        if (prefs.dateRange) setDateRange(prefs.dateRange)
        if (prefs.selectedProject) setSelectedProject(prefs.selectedProject)
        if (prefs.defaultProfileId) setDefaultProfileId(prefs.defaultProfileId)
      } catch (err) {
        console.error('Failed to initialize:', err)
      } finally {
        setIsLoading(false)
      }
    }

    loadData()

    // Listen for index ready (fires once)
    window.electronAPI.onIndexReady(() => {
      setIsIndexing(false)
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

  useEffect(() => {
    const cleanup = window.electronAPI.onPtyData((instanceId) => {
      setChatInstances((prev) =>
        prev.map((inst) =>
          inst.instanceId === instanceId ? { ...inst, isClaudeTyping: true } : inst
        )
      )
      const existing = typingTimers.current.get(instanceId)
      if (existing) clearTimeout(existing)
      const timer = setTimeout(() => {
        setChatInstances((prev) =>
          prev.map((inst) =>
            inst.instanceId === instanceId ? { ...inst, isClaudeTyping: false } : inst
          )
        )
        typingTimers.current.delete(instanceId)
      }, 1500)
      typingTimers.current.set(instanceId, timer)
    })

    return () => {
      cleanup()
      for (const t of typingTimers.current.values()) clearTimeout(t)
      typingTimers.current.clear()
    }
  }, [])

  useEffect(() => {
    const cleanup = window.electronAPI.onPtyExit((instanceId, code) => {
      setChatInstances((prev) =>
        prev.map((inst) =>
          inst.instanceId === instanceId
            ? { ...inst, status: 'exited', exitCode: code, isClaudeTyping: false }
            : inst
        )
      )
    })
    return cleanup
  }, [])

  const handleSelectResult = useCallback(async (id: string) => {
    try {
      const conversation = await window.electronAPI.getConversation(id)
      setSelectedConversation(conversation)
      setRightPanel(conversation ? 'conversation' : 'empty')
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

  const startChat = useCallback(async (config: { cwd: string | null; resumeSessionId?: string }, profile: Profile) => {
    let cwd = config.cwd
    if (cwd === null) {
      const dir = await window.electronAPI.selectDirectory()
      if (!dir) return
      cwd = dir
    }

    const instanceId = uuidv4()
    const newInstance: ChatInstance = {
      instanceId,
      cwd,
      profile: profile.id as ChatInstance['profile'],
      status: 'active',
      exitCode: null,
      resumeSessionId: config.resumeSessionId,
      isClaudeTyping: false,
    }
    setChatInstances((prev) => [...prev, newInstance])
    setActiveChatInstanceId(instanceId)
    setSelectedConversation(null)
  }, [])

  const handleNewChat = useCallback(async () => {
    const activeCount = chatInstances.filter((i) => i.status === 'active').length
    if (activeCount >= appSettings.maxChatInstances) {
      window.alert(`Maximum of ${appSettings.maxChatInstances} active chats reached. Close one to start a new session.`)
      return
    }
    const defaultProfile = defaultProfileId ? profiles.find((p) => p.id === defaultProfileId && p.enabled) : null
    if (defaultProfile) {
      await startChat({ cwd: null }, defaultProfile)
    } else {
      setPendingChatConfig({ cwd: null, resumeSessionId: undefined })
    }
  }, [chatInstances, appSettings.maxChatInstances, defaultProfileId, profiles, startChat])

  const handleChatInProject = useCallback(async (projectPath: string) => {
    const activeCount = chatInstances.filter((i) => i.status === 'active').length
    if (activeCount >= appSettings.maxChatInstances) {
      window.alert(`Maximum of ${appSettings.maxChatInstances} active chats reached. Close one to start a new session.`)
      return
    }
    const defaultProfile = defaultProfileId ? profiles.find((p) => p.id === defaultProfileId && p.enabled) : null
    if (defaultProfile) {
      await startChat({ cwd: projectPath }, defaultProfile)
    } else {
      setPendingChatConfig({ cwd: projectPath, resumeSessionId: undefined })
    }
  }, [chatInstances, appSettings.maxChatInstances, defaultProfileId, profiles, startChat])

  const handleContinueChat = useCallback(async (projectPath: string, sessionId: string) => {
    const activeCount = chatInstances.filter((i) => i.status === 'active').length
    if (activeCount >= appSettings.maxChatInstances) {
      window.alert(`Maximum of ${appSettings.maxChatInstances} active chats reached. Close one to start a new session.`)
      return
    }
    const defaultProfile = defaultProfileId ? profiles.find((p) => p.id === defaultProfileId && p.enabled) : null
    if (defaultProfile) {
      await startChat({ cwd: projectPath, resumeSessionId: sessionId }, defaultProfile)
    } else {
      setPendingChatConfig({ cwd: projectPath, resumeSessionId: sessionId })
    }
  }, [chatInstances, appSettings.maxChatInstances, defaultProfileId, profiles, startChat])

  const handleProfileSelected = useCallback(async (profile: Profile, remember: boolean) => {
    const pending = pendingChatConfig
    setPendingChatConfig(null)
    if (!pending) return

    if (remember) {
      setDefaultProfileId(profile.id)
      await window.electronAPI.setPreferences({ defaultProfileId: profile.id })
    }

    await startChat(pending, profile)
  }, [pendingChatConfig, startChat])

  const handleClearDefaultProfile = useCallback(async () => {
    setDefaultProfileId(null)
    await window.electronAPI.setPreferences({ defaultProfileId: undefined })
  }, [])

  const handleProfilePickerCancel = useCallback(() => {
    setPendingChatConfig(null)
  }, [])

  const handleFocusInstance = useCallback((instanceId: string) => {
    setActiveChatInstanceId(instanceId)
    setSelectedConversation(null)
  }, [])

  const handleCloseInstance = useCallback(async (instanceId: string) => {
    const instance = chatInstances.find((i) => i.instanceId === instanceId)
    if (instance?.status === 'active') {
      await window.electronAPI.ptyKill(instanceId)
    }
    setChatInstances((prev) => prev.filter((i) => i.instanceId !== instanceId))
    setActiveChatInstanceId((prev) => (prev === instanceId ? null : prev))
  }, [chatInstances])

  const handleFilterByProfile = useCallback((profileId: string | null) => {
    setAccountFilter(profileId)
    setRightPanel(selectedConversation ? 'conversation' : 'empty')
  }, [selectedConversation])

  const handleSaveSettings = useCallback(async (partial: Partial<AppSettings>) => {
    const updated = { ...appSettings, ...partial }
    setAppSettings(updated)
    await window.electronAPI.setSettings(partial)
  }, [appSettings])

  const handleProfilesSaved = useCallback(async (updated: Profile[]) => {
    setProfiles(updated)
    await window.electronAPI.saveProfiles(updated)
    // Refresh project list and stats since index was rebuilt
    const [projectList, statsData] = await Promise.all([
      window.electronAPI.getProjects(),
      window.electronAPI.getStats()
    ])
    setProjects(projectList)
    setStats(statsData)
    refresh()
  }, [refresh])

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
          <button
            onClick={() => setRightPanel('settings')}
            className="hover:text-neutral-300 transition-colors"
            title="Settings"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
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
          <ActiveChatList
            instances={chatInstances}
            activeChatInstanceId={activeChatInstanceId}
            onFocus={handleFocusInstance}
            onClose={handleCloseInstance}
          />
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
              {sortedResults.length === results.length ? (
                <>Showing <span className="font-medium text-neutral-400">{sortedResults.length}</span> conversations</>
              ) : (
                <>Showing <span className="font-medium text-neutral-400">{sortedResults.length}</span> of{' '}
                <span className="font-medium text-neutral-400">{results.length}</span> conversations</>
              )}
            </div>
          </div>

          {/* Results */}
          <div className="flex-1 overflow-hidden">
            {(isLoading || isIndexing) ? (
              <div className="flex items-center justify-center h-32">
                <div className="text-center">
                  <div className="text-neutral-500 animate-pulse mb-2">
                    {scanProgress
                      ? `Scanning... ${scanProgress.scanned}/${scanProgress.total} files`
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
                activeCwd={chatInstances.find(i => i.instanceId === activeChatInstanceId)?.cwd ?? null}
                activeChatSessionId={chatInstances.find(i => i.instanceId === activeChatInstanceId)?.resumeSessionId}
                isClaudeTyping={chatInstances.some(i => i.isClaudeTyping)}
                activeChatProfile={chatInstances.find(i => i.instanceId === activeChatInstanceId)?.profile ?? null}
                accountFilter={accountFilter}
                onClearAccountFilter={() => setAccountFilter(null)}
              />
            )}
          </div>
        </div>

        {/* Right panel: Chat, Profiles, Conversation, or empty */}
        <div className="flex-1 overflow-hidden">
          {(() => {
            const activeInstance = chatInstances.find((i) => i.instanceId === activeChatInstanceId)
            if (activeInstance) {
              return (
                <ChatTerminal
                  key={activeInstance.instanceId}
                  instanceId={activeInstance.instanceId}
                  cwd={activeInstance.cwd}
                  resumeSessionId={activeInstance.resumeSessionId}
                  profile={activeInstance.profile ?? undefined}
                  onExit={() => { /* handled by global onPtyExit effect */ }}
                />
              )
            }
            if (rightPanel === 'settings') {
              return (
                <SettingsModal
                  settings={appSettings}
                  onSave={handleSaveSettings}
                  profiles={profiles}
                  onFilterByProfile={handleFilterByProfile}
                  onProfilesSaved={handleProfilesSaved}
                  onClose={() => setRightPanel(selectedConversation ? 'conversation' : 'empty')}
                  defaultProfileId={defaultProfileId}
                  onClearDefaultProfile={handleClearDefaultProfile}
                />
              )
            }
            if (rightPanel === 'profiles') {
              return (
                <ProfilesPanel
                  profiles={profiles}
                  onFilterByProfile={handleFilterByProfile}
                  onProfilesSaved={handleProfilesSaved}
                />
              )
            }
            if (selectedConversation) {
              return (
                <ErrorBoundary>
                  <ConversationView conversation={selectedConversation} query={query} onContinueChat={handleContinueChat} />
                </ErrorBoundary>
              )
            }
            return (
              <div className="flex items-center justify-center h-full text-neutral-500">
                <div className="text-center">
                  <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
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
            )
          })()}
        </div>
      </div>

      {pendingChatConfig !== null && (
        <ProfilePickerModal
          profiles={profiles}
          onSelect={handleProfileSelected}
          onCancel={handleProfilePickerCancel}
        />
      )}
    </div>
  )
}
