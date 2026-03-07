import { useMemo, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { ClaudeProfile, GitInfo, Profile, SearchResult } from '../../../shared/types'

interface ResultsListProps {
  results: SearchResult[]
  selectedId: string | null
  onSelect: (id: string) => void
  query: string
  gitInfo: Record<string, GitInfo>
  activeCwd: string | null
  activeChatSessionId: string | undefined
  isClaudeTyping: boolean
  activeChatProfile: ClaudeProfile | null
  accountFilter: string | null
  profiles: Profile[]
}

export default function ResultsList({
  results,
  selectedId,
  onSelect,
  query,
  gitInfo,
  activeCwd,
  activeChatSessionId,
  isClaudeTyping,
  activeChatProfile,
  accountFilter,
  profiles
}: ResultsListProps): JSX.Element {
  const enabledProfiles = profiles.filter((p) => p.enabled)
  const showProfileBadge = enabledProfiles.length > 1
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const filteredResults = accountFilter
    ? results.filter((r) => r.account === accountFilter)
    : results

  const virtualizer = useVirtualizer({
    count: filteredResults.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => 100,
    overscan: 3
  })

  if (filteredResults.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-neutral-500 text-sm">
        {query ? 'No results found' : 'Start typing to search'}
      </div>
    )
  }

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
                result={filteredResults[virtualRow.index]}
                isSelected={filteredResults[virtualRow.index].id === selectedId}
                onSelect={() => onSelect(filteredResults[virtualRow.index].id)}
                query={query}
                gitInfo={gitInfo}
                activeCwd={activeCwd}
                activeChatSessionId={activeChatSessionId}
                isClaudeTyping={isClaudeTyping}
                activeChatProfile={activeChatProfile}
                profileBadge={showProfileBadge ? enabledProfiles.find((p) => p.id === filteredResults[virtualRow.index].account) : undefined}
              />
            </div>
          ))}
        </div>
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
  gitInfo: Record<string, GitInfo>
  activeCwd: string | null
  activeChatSessionId: string | undefined
  isClaudeTyping: boolean
  activeChatProfile: ClaudeProfile | null
  profileBadge: Profile | undefined
}

function ResultItem({ result, isSelected, onSelect, query, gitInfo, activeCwd, activeChatSessionId, isClaudeTyping, activeChatProfile, profileBadge }: ResultItemProps): JSX.Element {
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
      className={`w-full text-left p-4 transition-colors hover:bg-neutral-800/50 border-b border-neutral-800 ${isSelected ? 'bg-neutral-800 border-l-2 border-claude-orange' : ''
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
