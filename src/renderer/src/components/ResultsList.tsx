import { useMemo, useRef, useState, useCallback } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { ClaudeProfile, GitInfo, Profile, SearchResult } from '../../../shared/types'

interface ResultsListProps {
  results: SearchResult[]
  selectedId: string | null
  onSelect: (id: string) => void
  onNewChat: (projectPath: string) => void
  query: string
  gitInfo: Record<string, GitInfo>
  activeCwd: string | null
  activeChatSessionId: string | undefined
  isClaudeTyping: boolean
  activeChatProfile: ClaudeProfile | null
  accountFilter: string | null
  profiles: Profile[]
  groupByProject: boolean
}

export default function ResultsList({
  results,
  selectedId,
  onSelect,
  onNewChat,
  query,
  gitInfo,
  activeCwd,
  activeChatSessionId,
  isClaudeTyping,
  activeChatProfile,
  accountFilter,
  profiles,
  groupByProject
}: ResultsListProps): JSX.Element {
  const enabledProfiles = profiles.filter((p) => p.enabled)
  const showProfileBadge = enabledProfiles.length > 1

  const filteredResults = accountFilter
    ? results.filter((r) => r.account === accountFilter)
    : results

  if (filteredResults.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-neutral-500 text-sm">
        {query ? 'No results found' : 'Start typing to search'}
      </div>
    )
  }

  if (groupByProject) {
    return (
      <GroupedResultsList
        results={filteredResults}
        selectedId={selectedId}
        onSelect={onSelect}
        onNewChat={onNewChat}
        query={query}
        gitInfo={gitInfo}
        activeCwd={activeCwd}
        activeChatSessionId={activeChatSessionId}
        isClaudeTyping={isClaudeTyping}
        activeChatProfile={activeChatProfile}
        showProfileBadge={showProfileBadge}
        enabledProfiles={enabledProfiles}
      />
    )
  }

  return (
    <FlatResultsList
      results={filteredResults}
      selectedId={selectedId}
      onSelect={onSelect}
      onNewChat={onNewChat}
      query={query}
      gitInfo={gitInfo}
      activeCwd={activeCwd}
      activeChatSessionId={activeChatSessionId}
      isClaudeTyping={isClaudeTyping}
      activeChatProfile={activeChatProfile}
      showProfileBadge={showProfileBadge}
      enabledProfiles={enabledProfiles}
    />
  )
}

// ─── Flat list (original behavior) ──────────────────────────────────

interface InternalListProps {
  results: SearchResult[]
  selectedId: string | null
  onSelect: (id: string) => void
  onNewChat: (projectPath: string) => void
  query: string
  gitInfo: Record<string, GitInfo>
  activeCwd: string | null
  activeChatSessionId: string | undefined
  isClaudeTyping: boolean
  activeChatProfile: ClaudeProfile | null
  showProfileBadge: boolean
  enabledProfiles: Profile[]
}

function FlatResultsList({
  results,
  selectedId,
  onSelect,
  onNewChat,
  query,
  gitInfo,
  activeCwd,
  activeChatSessionId,
  isClaudeTyping,
  activeChatProfile,
  showProfileBadge,
  enabledProfiles
}: InternalListProps): JSX.Element {
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: results.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => 100,
    overscan: 3
  })

  const virtualItems = virtualizer.getVirtualItems()

  return (
    <div className="flex flex-col h-full">
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
                onNewChat={onNewChat}
                query={query}
                gitInfo={gitInfo}
                activeCwd={activeCwd}
                activeChatSessionId={activeChatSessionId}
                isClaudeTyping={isClaudeTyping}
                activeChatProfile={activeChatProfile}
                profileBadge={showProfileBadge ? enabledProfiles.find((p) => p.id === results[virtualRow.index].account) : undefined}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
    </div>
  )
}

// ─── Grouped list (accordion by project) ────────────────────────────

interface ProjectGroup {
  projectPath: string
  projectName: string
  latestTimestamp: string
  conversationCount: number
  conversations: SearchResult[]
}

function GroupedResultsList({
  results,
  selectedId,
  onSelect,
  onNewChat,
  query,
  gitInfo,
  activeCwd,
  activeChatSessionId,
  isClaudeTyping,
  activeChatProfile,
  showProfileBadge,
  enabledProfiles
}: InternalListProps): JSX.Element {
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set())

  const groups = useMemo(() => {
    const groupMap = new Map<string, ProjectGroup>()

    for (const result of results) {
      const existing = groupMap.get(result.projectPath)
      if (existing) {
        existing.conversations.push(result)
        existing.conversationCount++
        if (result.timestamp > existing.latestTimestamp) {
          existing.latestTimestamp = result.timestamp
        }
      } else {
        groupMap.set(result.projectPath, {
          projectPath: result.projectPath,
          projectName: result.projectName,
          latestTimestamp: result.timestamp,
          conversationCount: 1,
          conversations: [result]
        })
      }
    }

    // Sort groups by latest timestamp (most recent first)
    const sorted = Array.from(groupMap.values()).sort(
      (a, b) => new Date(b.latestTimestamp).getTime() - new Date(a.latestTimestamp).getTime()
    )

    // Sort conversations within each group by timestamp (most recent first)
    for (const group of sorted) {
      group.conversations.sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )
    }

    return sorted
  }, [results])

  const toggleProject = useCallback((projectPath: string) => {
    setExpandedProjects((prev) => {
      const next = new Set(prev)
      if (next.has(projectPath)) {
        next.delete(projectPath)
      } else {
        next.add(projectPath)
      }
      return next
    })
  }, [])

  return (
    <div className="flex flex-col h-full">
      <div className="h-full overflow-y-auto">
        {groups.map((group) => {
          const isExpanded = expandedProjects.has(group.projectPath)
          const groupGitInfo = gitInfo[group.projectPath]

          return (
            <div key={group.projectPath}>
              {/* Project header */}
              <button
                onClick={() => toggleProject(group.projectPath)}
                className="w-full text-left px-4 py-3 border-b border-neutral-800 hover:bg-neutral-800/50 transition-colors flex items-center gap-2"
              >
                <svg
                  className={`w-3 h-3 text-neutral-500 shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <span className="text-xs font-medium text-claude-orange truncate">
                  {group.projectName}
                </span>
                <GitBadge info={groupGitInfo} />
                <span className="ml-auto shrink-0 text-[10px] text-neutral-500">
                  {group.conversationCount} {group.conversationCount === 1 ? 'chat' : 'chats'}
                </span>
                <span className="shrink-0 text-[10px] text-neutral-600">
                  {formatDate(group.latestTimestamp)}
                </span>
              </button>

              {/* Expanded conversations */}
              {isExpanded && group.conversations.map((result) => (
                <div key={result.id} className="pl-4">
                  <ResultItem
                    result={result}
                    isSelected={result.id === selectedId}
                    onSelect={() => onSelect(result.id)}
                    onNewChat={onNewChat}
                    query={query}
                    gitInfo={gitInfo}
                    activeCwd={activeCwd}
                    activeChatSessionId={activeChatSessionId}
                    isClaudeTyping={isClaudeTyping}
                    activeChatProfile={activeChatProfile}
                    profileBadge={showProfileBadge ? enabledProfiles.find((p) => p.id === result.account) : undefined}
                  />
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Shared sub-components ──────────────────────────────────────────

interface ResultItemProps {
  result: SearchResult
  isSelected: boolean
  onSelect: () => void
  onNewChat: (projectPath: string) => void
  query: string
  gitInfo: Record<string, GitInfo>
  activeCwd: string | null
  activeChatSessionId: string | undefined
  isClaudeTyping: boolean
  activeChatProfile: ClaudeProfile | null
  profileBadge: Profile | undefined
}

function ResultItem({ result, isSelected, onSelect, onNewChat, query, gitInfo, activeCwd, activeChatSessionId, isClaudeTyping, activeChatProfile, profileBadge }: ResultItemProps): JSX.Element {
  // Note: dangerouslySetInnerHTML is safe here — content passes through
  // escapeHtml() which sanitizes all HTML entities before highlightText()
  // wraps matched terms in <span> tags using the escaped content.
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

  const isActive = activeCwd === result.projectPath &&
    (activeChatSessionId === undefined || result.sessionId === activeChatSessionId)
  const isTyping = isActive && isClaudeTyping
  const isAwaitingReply = !isActive && result.lastMessageSender === 'assistant'

  return (
    <button
      onClick={onSelect}
      className={`group/item w-full text-left p-4 transition-colors hover:bg-neutral-800/50 border-b border-neutral-800 ${isSelected ? 'bg-neutral-800 border-l-2 border-claude-orange' : ''
        }`}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-xs font-medium text-claude-orange truncate max-w-[200px]">
            {result.projectName}
          </span>
          <GitBadge info={gitInfo[result.projectPath]} />
          {profileBadge && (
            <span className="shrink-0 text-[10px] text-neutral-500" title={profileBadge.label}>
              {profileBadge.emoji}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {isTyping ? (
            <TypingIndicator />
          ) : isActive ? (
            <LiveBadge />
          ) : isAwaitingReply ? (
            <AwaitingReplyBadge />
          ) : null}
          {isActive && activeChatProfile && <LiveProfileBadge profile={activeChatProfile} />}
          <span className="text-xs text-neutral-500 whitespace-nowrap">{formattedDate}</span>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onNewChat(result.projectPath)
            }}
            className="opacity-0 group-hover/item:opacity-100 text-neutral-500 hover:text-claude-orange transition-all p-0.5"
            title={`New chat in ${result.projectName}`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
        </div>
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

function LiveProfileBadge({ profile }: { profile: ClaudeProfile }): JSX.Element {
  const emoji = profile === 'work' ? '💼' : '🏠'
  return (
    <span className="text-[9px] font-medium text-neutral-400">
      {emoji}
    </span>
  )
}

function LiveBadge(): JSX.Element {
  return (
    <span className="flex items-center gap-1 text-[10px] font-medium text-green-400">
      <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
      Live
    </span>
  )
}

function TypingIndicator(): JSX.Element {
  return (
    <span className="flex items-center gap-1 text-[10px] font-medium text-claude-orange">
      <span className="flex gap-0.5">
        <span className="w-1 h-1 rounded-full bg-claude-orange animate-bounce" />
        <span className="w-1 h-1 rounded-full bg-claude-orange animate-bounce [animation-delay:150ms]" />
        <span className="w-1 h-1 rounded-full bg-claude-orange animate-bounce [animation-delay:300ms]" />
      </span>
      Typing…
    </span>
  )
}

function AwaitingReplyBadge(): JSX.Element {
  return (
    <span className="flex items-center gap-1 text-[10px] font-medium text-amber-400">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
      Awaiting reply
    </span>
  )
}

function GitBadge({ info }: { info: GitInfo | undefined }): JSX.Element | null {
  if (!info || info.type === 'none') return null
  if (info.type === 'worktree') {
    return (
      <span className="shrink-0" title={`Worktree: ${info.branch || 'unknown'}`}>
        <svg className="w-3 h-3 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle cx="6" cy="6" r="2" strokeWidth={2} />
          <circle cx="6" cy="18" r="2" strokeWidth={2} />
          <circle cx="18" cy="6" r="2" strokeWidth={2} />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 8v8M8 6h4a4 4 0 014 4v0" />
        </svg>
      </span>
    )
  }
  return (
    <span className="shrink-0" title="Git repo">
      <svg className="w-3 h-3 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 3v12M18 9a6 6 0 01-6 6H6" />
        <circle cx="6" cy="18" r="3" strokeWidth={2} />
        <circle cx="6" cy="3" r="3" strokeWidth={2} />
        <circle cx="18" cy="9" r="3" strokeWidth={2} />
      </svg>
    </span>
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
