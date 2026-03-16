import { useMemo, useRef, useState, useCallback } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { ClaudeProfile, DisplayMode, GitInfo, Profile, SearchResult } from '../../../shared/types'
import SpeedSearch from './SpeedSearch'

interface ContextMenuData {
  id: string
  sessionId: string
  sessionPath: string
  title: string
  projectPath: string
  account?: string
}

interface ResultsListProps {
  results: SearchResult[]
  selectedId: string | null
  onSelect: (id: string) => void
  onNewChat: (projectPath: string) => void
  onContextMenu: (data: ContextMenuData) => void
  query: string
  gitInfo: Record<string, GitInfo>
  activeCwd: string | null
  activeChatSessionId: string | undefined
  isClaudeTyping: boolean
  activeChatProfile: ClaudeProfile | null
  accountFilter: string | null
  profiles: Profile[]
  displayMode: DisplayMode
}

export default function ResultsList({
  results,
  selectedId,
  onSelect,
  onNewChat,
  onContextMenu,
  query,
  gitInfo,
  activeCwd,
  activeChatSessionId,
  isClaudeTyping,
  activeChatProfile,
  accountFilter,
  profiles,
  displayMode
}: ResultsListProps): JSX.Element {
  const enabledProfiles = profiles.filter((p) => p.enabled)
  const showProfileBadge = enabledProfiles.length > 1

  const [speedSearchQuery, setSpeedSearchQuery] = useState('')
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const resetDismissTimer = useCallback(() => {
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current)
    dismissTimerRef.current = setTimeout(() => {
      setSpeedSearchQuery('')
    }, 1500)
  }, [])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    // Do not intercept Cmd/Ctrl+* or Alt+* combinations
    if (e.metaKey || e.ctrlKey || e.altKey) return
    // Do not intercept function keys
    if (e.key.startsWith('F') && e.key.length >= 2 && !isNaN(Number(e.key.slice(1)))) return
    // Do not intercept navigation keys (reserved for list navigation)
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Tab'].includes(e.key)) return

    if (e.key === 'Escape') {
      e.preventDefault()
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current)
      setSpeedSearchQuery('')
      return
    }

    if (e.key === 'Backspace') {
      e.preventDefault()
      setSpeedSearchQuery((prev) => {
        const next = prev.slice(0, -1)
        if (next.length > 0) resetDismissTimer()
        else if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current)
        return next
      })
      return
    }

    // Printable character
    if (e.key.length === 1) {
      e.preventDefault()
      setSpeedSearchQuery((prev) => prev + e.key)
      resetDismissTimer()
    }
  }, [resetDismissTimer])

  const accountFiltered = accountFilter
    ? results.filter((r) => r.account === accountFilter)
    : results

  const filteredResults = speedSearchQuery
    ? accountFiltered.filter((r) =>
        (r.sessionName || r.projectName).toLowerCase().includes(speedSearchQuery.toLowerCase())
      )
    : accountFiltered

  const isEmpty = filteredResults.length === 0

  return (
    <div
      className="flex flex-col h-full relative outline-none"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      {isEmpty ? (
        <div className="flex items-center justify-center h-32 text-neutral-500 text-sm">
          {speedSearchQuery
            ? `No results for "${speedSearchQuery}"`
            : query
              ? 'No results found'
              : 'Start typing to search'}
        </div>
      ) : (
        (() => {
          const internalProps: InternalListProps = {
            results: filteredResults,
            selectedId,
            onSelect,
            onNewChat,
            onContextMenu,
            query,
            gitInfo,
            activeCwd,
            activeChatSessionId,
            isClaudeTyping,
            activeChatProfile,
            showProfileBadge,
            enabledProfiles,
          }

          if (displayMode === 'tree') return <FileTreeResultsList {...internalProps} />
          if (displayMode === 'grouped') return <GroupedResultsList {...internalProps} />
          return <FlatResultsList {...internalProps} />
        })()
      )}
      <SpeedSearch
        query={speedSearchQuery}
        onQueryChange={setSpeedSearchQuery}
        onDismiss={() => {
          if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current)
          setSpeedSearchQuery('')
        }}
      />
    </div>
  )
}

// ─── Flat list (original behavior) ──────────────────────────────────

interface InternalListProps {
  results: SearchResult[]
  selectedId: string | null
  onSelect: (id: string) => void
  onNewChat: (projectPath: string) => void
  onContextMenu: (data: ContextMenuData) => void
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
  onContextMenu,
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
                onContextMenu={onContextMenu}
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

type GroupFlatItem =
  | { type: 'header'; group: ProjectGroup }
  | { type: 'conversation'; result: SearchResult }

function GroupedResultsList({
  results,
  selectedId,
  onSelect,
  onNewChat,
  onContextMenu,
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
  const scrollContainerRef = useRef<HTMLDivElement>(null)

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

  const flatItems = useMemo(() => {
    const items: GroupFlatItem[] = []
    for (const group of groups) {
      items.push({ type: 'header', group })
      if (expandedProjects.has(group.projectPath)) {
        for (const result of group.conversations) {
          items.push({ type: 'conversation', result })
        }
      }
    }
    return items
  }, [groups, expandedProjects])

  const virtualizer = useVirtualizer({
    count: flatItems.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: (i) => (flatItems[i].type === 'header' ? 52 : 100),
    overscan: 3,
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
            {virtualItems.map((virtualRow) => {
              const item = flatItems[virtualRow.index]
              return (
                <div key={virtualRow.key} data-index={virtualRow.index} ref={virtualizer.measureElement}>
                  {item.type === 'header' ? (
                    (() => {
                      const { group } = item
                      const isExpanded = expandedProjects.has(group.projectPath)
                      return (
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
                          <GitBadge info={gitInfo[group.projectPath]} />
                          <span className="ml-auto shrink-0 text-[10px] text-neutral-500">
                            {group.conversationCount} {group.conversationCount === 1 ? 'chat' : 'chats'}
                          </span>
                          <span className="shrink-0 text-[10px] text-neutral-600">
                            {formatDate(group.latestTimestamp)}
                          </span>
                        </button>
                      )
                    })()
                  ) : (
                    <div className="pl-4">
                      <ResultItem
                        result={item.result}
                        isSelected={item.result.id === selectedId}
                        onSelect={() => onSelect(item.result.id)}
                        onNewChat={onNewChat}
                        onContextMenu={onContextMenu}
                        query={query}
                        gitInfo={gitInfo}
                        activeCwd={activeCwd}
                        activeChatSessionId={activeChatSessionId}
                        isClaudeTyping={isClaudeTyping}
                        activeChatProfile={activeChatProfile}
                        profileBadge={showProfileBadge ? enabledProfiles.find((p) => p.id === item.result.account) : undefined}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── File tree view ─────────────────────────────────────────────────

interface TreeNode {
  name: string
  fullPath: string
  children: Map<string, TreeNode>
  conversations: SearchResult[]
  totalConversations: number
}

function buildFileTree(results: SearchResult[]): TreeNode {
  const root: TreeNode = {
    name: '',
    fullPath: '',
    children: new Map(),
    conversations: [],
    totalConversations: 0
  }

  for (const result of results) {
    const parts = result.projectPath.split('/').filter(Boolean)
    let current = root
    let pathSoFar = ''

    for (const part of parts) {
      pathSoFar += '/' + part
      if (!current.children.has(part)) {
        current.children.set(part, {
          name: part,
          fullPath: pathSoFar,
          children: new Map(),
          conversations: [],
          totalConversations: 0
        })
      }
      current = current.children.get(part)!
    }

    current.conversations.push(result)
  }

  // Count total conversations per node
  function countConversations(node: TreeNode): number {
    let total = node.conversations.length
    for (const child of node.children.values()) {
      total += countConversations(child)
    }
    node.totalConversations = total
    return total
  }
  countConversations(root)

  return root
}

function compactTree(node: TreeNode): TreeNode {
  // Recursively compact children first
  const compactedChildren = new Map<string, TreeNode>()
  for (const [key, child] of node.children) {
    compactedChildren.set(key, compactTree(child))
  }
  node.children = compactedChildren

  // Compact: if this node has exactly one child and no conversations of its own,
  // merge the child into this node (collapse single-child chains)
  if (node.children.size === 1 && node.conversations.length === 0 && node.name !== '') {
    const [, onlyChild] = Array.from(node.children.entries())[0]
    node.name = node.name + '/' + onlyChild.name
    node.fullPath = onlyChild.fullPath
    node.children = onlyChild.children
    node.conversations = onlyChild.conversations
    node.totalConversations = onlyChild.totalConversations
  }

  return node
}

function flattenVisibleNodes(
  children: Map<string, TreeNode>,
  depth: number,
  expandedDirs: Set<string>
): Array<{ node: TreeNode; depth: number }> {
  const items: Array<{ node: TreeNode; depth: number }> = []
  const sorted = Array.from(children.values()).sort((a, b) => b.totalConversations - a.totalConversations)
  for (const node of sorted) {
    items.push({ node, depth })
    if (expandedDirs.has(node.fullPath) && node.children.size > 0) {
      items.push(...flattenVisibleNodes(node.children, depth + 1, expandedDirs))
    }
  }
  return items
}

function FileTreeResultsList({
  results,
  selectedId,
  onSelect,
  onNewChat,
  onContextMenu,
  query,
  gitInfo,
  activeCwd,
  activeChatSessionId,
  isClaudeTyping,
  activeChatProfile,
  showProfileBadge,
  enabledProfiles
}: InternalListProps): JSX.Element {
  const [selectedDir, setSelectedDir] = useState<string | null>(null)

  const tree = useMemo(() => {
    const raw = buildFileTree(results)
    return compactTree(raw)
  }, [results])

  // Start with root-level children expanded
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(() => {
    const raw = buildFileTree(results)
    const compacted = compactTree(raw)
    return new Set(Array.from(compacted.children.values()).map((n) => n.fullPath))
  })

  const toggleDir = useCallback((path: string) => {
    setExpandedDirs((prev) => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }, [])

  // When a dir is selected, show its conversations
  const dirConversations = useMemo(() => {
    if (!selectedDir) return []
    return results.filter((r) => r.projectPath === selectedDir)
  }, [results, selectedDir])

  // Must be above the conditional return to satisfy Rules of Hooks
  const flatNodes = useMemo(
    () => flattenVisibleNodes(tree.children, 0, expandedDirs),
    [tree, expandedDirs]
  )

  const drillScrollRef = useRef<HTMLDivElement>(null)
  const drillVirtualizer = useVirtualizer({
    count: dirConversations.length,
    getScrollElement: () => drillScrollRef.current,
    estimateSize: () => 100,
    overscan: 3,
  })

  const treeScrollRef = useRef<HTMLDivElement>(null)
  const treeVirtualizer = useVirtualizer({
    count: flatNodes.length,
    getScrollElement: () => treeScrollRef.current,
    estimateSize: () => 40,
    overscan: 5,
  })

  if (selectedDir && dirConversations.length > 0) {
    const drillVirtualItems = drillVirtualizer.getVirtualItems()
    return (
      <div className="flex flex-col h-full">
        {/* Back button */}
        <button
          onClick={() => setSelectedDir(null)}
          className="flex items-center gap-2 px-4 py-2.5 border-b border-neutral-800 text-xs text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span className="truncate font-medium text-claude-orange">{selectedDir.split('/').pop()}</span>
          <span className="text-neutral-600 ml-auto shrink-0">{dirConversations.length} {dirConversations.length === 1 ? 'chat' : 'chats'}</span>
        </button>
        <div ref={drillScrollRef} className="flex-1 overflow-y-auto">
          <div className="relative w-full" style={{ height: drillVirtualizer.getTotalSize() }}>
            <div
              className="absolute top-0 left-0 w-full"
              style={{ transform: `translateY(${drillVirtualItems[0]?.start ?? 0}px)` }}
            >
              {drillVirtualItems.map((virtualRow) => (
                <div key={virtualRow.key} data-index={virtualRow.index} ref={drillVirtualizer.measureElement}>
                  <ResultItem
                    result={dirConversations[virtualRow.index]}
                    isSelected={dirConversations[virtualRow.index].id === selectedId}
                    onSelect={() => onSelect(dirConversations[virtualRow.index].id)}
                    onNewChat={onNewChat}
                    onContextMenu={onContextMenu}
                    query={query}
                    gitInfo={gitInfo}
                    activeCwd={activeCwd}
                    activeChatSessionId={activeChatSessionId}
                    isClaudeTyping={isClaudeTyping}
                    activeChatProfile={activeChatProfile}
                    profileBadge={showProfileBadge ? enabledProfiles.find((p) => p.id === dirConversations[virtualRow.index].account) : undefined}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  const treeVirtualItems = treeVirtualizer.getVirtualItems()

  return (
    <div className="flex flex-col h-full">
      <div ref={treeScrollRef} className="h-full overflow-y-auto">
        <div className="relative w-full" style={{ height: treeVirtualizer.getTotalSize() }}>
          <div
            className="absolute top-0 left-0 w-full"
            style={{ transform: `translateY(${treeVirtualItems[0]?.start ?? 0}px)` }}
          >
            {treeVirtualItems.map((virtualRow) => {
              const { node, depth } = flatNodes[virtualRow.index]
              return (
                <div key={virtualRow.key} data-index={virtualRow.index} ref={treeVirtualizer.measureElement}>
                  <FileTreeRow
                    node={node}
                    depth={depth}
                    expandedDirs={expandedDirs}
                    onToggle={toggleDir}
                    onSelectDir={setSelectedDir}
                  />
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

interface FileTreeRowProps {
  node: TreeNode
  depth: number
  expandedDirs: Set<string>
  onToggle: (path: string) => void
  onSelectDir: (path: string) => void
}

function FileTreeRow({ node, depth, expandedDirs, onToggle, onSelectDir }: FileTreeRowProps): JSX.Element {
  const hasChildren = node.children.size > 0
  const hasConversations = node.conversations.length > 0
  const isLeaf  = !hasChildren && hasConversations
  const isMixed = hasChildren  && hasConversations
  const isExpanded = expandedDirs.has(node.fullPath)

  return (
    <div
      className="group/tree w-full text-left px-4 py-2 border-b border-neutral-800/50 hover:bg-neutral-800/50 transition-colors flex items-center gap-1.5 cursor-pointer"
      style={{ paddingLeft: `${16 + depth * 16}px` }}
      onClick={isLeaf ? () => onSelectDir(node.fullPath) : () => onToggle(node.fullPath)}
    >
      <span className="shrink-0 w-4 flex items-center justify-center text-neutral-500">
        {hasChildren && (
          <svg
            className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        )}
      </span>
      {isLeaf ? (
        <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 16 16" fill="#4CAF50">
          <path d="M14.56 7.44C14.28 7.16 13.9 7 13.5 7H13V4c0-1.1-.9-2-2-2H3c-1.1 0-2 .9-2 2v5c0 1.1.9 2 2 2v1c0 .82.93 1.29 1.59.81L7 11.05v.45A1.499 1.499 0 0 0 8.5 13h1.79l1.86 1.85c.04.05.1.09.16.11.06.03.12.04.19.04s.13-.01.19-.04c.09-.04.17-.1.23-.18.05-.08.08-.18.08-.28V13h.5a1.499 1.499 0 0 0 1.5-1.5v-3c0-.4-.16-.78-.44-1.06ZM6.75 10 4 12v-2H3c-.55 0-1-.45-1-1V4c0-.55.45-1 1-1h8c.55 0 1 .45 1 1v3H8.5A1.499 1.499 0 0 0 7 8.5V10h-.25ZM14 11.5c0 .13-.05.26-.15.35a.47.47 0 0 1-.35.15h-1a.47.47 0 0 0-.35.15.47.47 0 0 0-.15.35v.79l-1.15-1.14a.355.355 0 0 0-.16-.11.406.406 0 0 0-.19-.04h-2a.47.47 0 0 1-.35-.15.47.47 0 0 1-.15-.35v-3c0-.13.05-.26.15-.35.09-.1.22-.15.35-.15h5c.13 0 .26.05.35.15.1.09.15.22.15.35v3Z"/>
        </svg>
      ) : (
        <svg className="w-3.5 h-3.5 shrink-0 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {isExpanded ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h5l2 2h7a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          )}
        </svg>
      )}
      <span className={`text-xs truncate ${hasConversations ? 'text-claude-orange font-medium' : 'text-neutral-300'}`}>
        {node.name}
      </span>
      {isMixed && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onSelectDir(node.fullPath)
          }}
          className="shrink-0 opacity-0 group-hover/tree:opacity-100 text-neutral-500 hover:text-claude-orange transition-all p-0.5"
          title={`Open ${node.conversations.length} conversation${node.conversations.length === 1 ? '' : 's'} in ${node.name}`}
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
            <path d="M14.56 7.44C14.28 7.16 13.9 7 13.5 7H13V4c0-1.1-.9-2-2-2H3c-1.1 0-2 .9-2 2v5c0 1.1.9 2 2 2v1c0 .82.93 1.29 1.59.81L7 11.05v.45A1.499 1.499 0 0 0 8.5 13h1.79l1.86 1.85c.04.05.1.09.16.11.06.03.12.04.19.04s.13-.01.19-.04c.09-.04.17-.1.23-.18.05-.08.08-.18.08-.28V13h.5a1.499 1.499 0 0 0 1.5-1.5v-3c0-.4-.16-.78-.44-1.06ZM6.75 10 4 12v-2H3c-.55 0-1-.45-1-1V4c0-.55.45-1 1-1h8c.55 0 1 .45 1 1v3H8.5A1.499 1.499 0 0 0 7 8.5V10h-.25ZM14 11.5c0 .13-.05.26-.15.35a.47.47 0 0 1-.35.15h-1a.47.47 0 0 0-.35.15.47.47 0 0 0-.15.35v.79l-1.15-1.14a.355.355 0 0 0-.16-.11.406.406 0 0 0-.19-.04h-2a.47.47 0 0 1-.35-.15.47.47 0 0 1-.15-.35v-3c0-.13.05-.26.15-.35.09-.1.22-.15.35-.15h5c.13 0 .26.05.35.15.1.09.15.22.15.35v3Z"/>
          </svg>
        </button>
      )}
      <span className="ml-auto shrink-0 text-[10px] text-neutral-600">
        {node.totalConversations}
      </span>
    </div>
  )
}

// ─── Shared sub-components ──────────────────────────────────────────

interface ResultItemProps {
  result: SearchResult
  isSelected: boolean
  onSelect: () => void
  onNewChat: (projectPath: string) => void
  onContextMenu: (data: ContextMenuData) => void
  query: string
  gitInfo: Record<string, GitInfo>
  activeCwd: string | null
  activeChatSessionId: string | undefined
  isClaudeTyping: boolean
  activeChatProfile: ClaudeProfile | null
  profileBadge: Profile | undefined
}

function ResultItem({ result, isSelected, onSelect, onNewChat, onContextMenu, query, gitInfo, activeCwd, activeChatSessionId, isClaudeTyping, activeChatProfile, profileBadge }: ResultItemProps): JSX.Element {
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
      onContextMenu={(e) => {
        e.preventDefault()
        onContextMenu({
          id: result.id,
          sessionId: result.sessionId,
          sessionPath: result.id,
          title: result.sessionName || result.projectName,
          projectPath: result.projectPath,
          account: result.account,
        })
      }}
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
