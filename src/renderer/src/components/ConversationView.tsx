import { useRef, useEffect, useState, useCallback, useMemo, forwardRef, memo } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import MessageNavigation from './MessageNavigation'
import MessageContent from './MessageContent'
import ToolResultCard from './ToolResultCard'
import ToolInvocationBadge from './ToolInvocationBadge'
import type { ToolResult, ToolUseBlock } from '../../../shared/types'



interface MessageMetadata {
  model?: string
  stopReason?: string | null
  inputTokens?: number
  outputTokens?: number
  cacheReadTokens?: number
  cacheCreationTokens?: number
  gitBranch?: string
  version?: string
  toolUses?: string[]
  toolUseBlocks?: ToolUseBlock[]
  toolResults?: ToolResult[]
}

interface ConversationMessage {
  type: string
  content: string
  timestamp: string
  metadata?: MessageMetadata
  lineNumber?: number
  isToolResult?: boolean
}

interface Conversation {
  id: string
  filePath: string
  projectPath: string
  projectName: string
  sessionId: string
  sessionName: string
  messages: ConversationMessage[]
  fullText: string
  timestamp: string
  messageCount: number
}

interface ConversationViewProps {
  conversation: Conversation
  query: string
}

type ExportFormat = 'markdown' | 'json' | 'text'

export default function ConversationView({
  conversation,
  query
}: ConversationViewProps): JSX.Element {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [exportStatus, setExportStatus] = useState<string | null>(null)
  const exportMenuRef = useRef<HTMLDivElement>(null)

  // Message navigation state
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0)

  // ─── Virtualizer ─────────────────────────────────────────────────
  const virtualizer = useVirtualizer({
    count: conversation.messages.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => 120,
    overscan: 5,
  })

  // Reset virtualizer when conversation changes
  useEffect(() => {
    setCurrentMessageIndex(0)
    virtualizer.scrollToOffset(0)
  }, [conversation.id, virtualizer])

  // ─── In-chat search state ──────────────────────────────────────────
  const [chatSearchOpen, setChatSearchOpen] = useState(false)
  const [chatSearchQuery, setChatSearchQuery] = useState('')
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0)
  const chatSearchInputRef = useRef<HTMLInputElement>(null)

  // Compute which message indices match the in-chat search
  const chatSearchMatches = useMemo(() => {
    if (!chatSearchQuery) return []
    const lower = chatSearchQuery.toLowerCase()
    const matches: number[] = []
    conversation.messages.forEach((msg, i) => {
      if (msg.content.toLowerCase().includes(lower)) {
        matches.push(i)
      }
    })
    return matches
  }, [chatSearchQuery, conversation.messages])

  // The effective highlight query: local search takes priority over global
  const effectiveQuery = chatSearchOpen && chatSearchQuery ? chatSearchQuery : query

  // Reset current match when matches change
  useEffect(() => {
    setCurrentMatchIndex(0)
  }, [chatSearchMatches.length])

  // Scroll to current match
  useEffect(() => {
    if (chatSearchMatches.length === 0) return
    const msgIndex = chatSearchMatches[currentMatchIndex]
    if (msgIndex === undefined) return
    virtualizer.scrollToIndex(msgIndex, { align: 'center' })
    setCurrentMessageIndex(msgIndex)
  }, [currentMatchIndex, chatSearchMatches, virtualizer])

  const handleChatSearchNext = useCallback(() => {
    if (chatSearchMatches.length === 0) return
    setCurrentMatchIndex((prev) => (prev + 1) % chatSearchMatches.length)
  }, [chatSearchMatches.length])

  const handleChatSearchPrev = useCallback(() => {
    if (chatSearchMatches.length === 0) return
    setCurrentMatchIndex((prev) => (prev - 1 + chatSearchMatches.length) % chatSearchMatches.length)
  }, [chatSearchMatches.length])

  const closeChatSearch = useCallback(() => {
    setChatSearchOpen(false)
    setChatSearchQuery('')
    setCurrentMatchIndex(0)
  }, [])

  // Reset in-chat search when conversation changes
  useEffect(() => {
    closeChatSearch()
  }, [conversation.id, closeChatSearch])

  // Keyboard shortcut: Cmd+F to open in-chat search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === 'f') {
        e.preventDefault()
        setChatSearchOpen(true)
        setTimeout(() => chatSearchInputRef.current?.focus(), 0)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // ─── Message navigation ────────────────────────────────────────────

  const scrollToMessage = useCallback((index: number) => {
    virtualizer.scrollToIndex(index, { align: 'center' })
    setCurrentMessageIndex(index)
  }, [virtualizer])

  const handleNavigate = useCallback((index: number) => {
    scrollToMessage(index)
  }, [scrollToMessage])

  const handleJumpToFirst = useCallback(() => {
    virtualizer.scrollToIndex(0, { align: 'start' })
    setCurrentMessageIndex(0)
  }, [virtualizer])

  const handleJumpToLast = useCallback(() => {
    const lastIndex = conversation.messages.length - 1
    virtualizer.scrollToIndex(lastIndex, { align: 'end' })
    setCurrentMessageIndex(lastIndex)
  }, [conversation.messages.length, virtualizer])

  // Keyboard navigation (only when chat search is NOT focused)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (chatSearchOpen && document.activeElement === chatSearchInputRef.current) return

      if (e.key === 'ArrowUp' && currentMessageIndex > 0) {
        e.preventDefault()
        scrollToMessage(currentMessageIndex - 1)
      } else if (e.key === 'ArrowDown' && currentMessageIndex < conversation.messages.length - 1) {
        e.preventDefault()
        scrollToMessage(currentMessageIndex + 1)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentMessageIndex, conversation.messages.length, scrollToMessage, chatSearchOpen])

  // Close export menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent): void {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleExport = async (format: ExportFormat): Promise<void> => {
    setShowExportMenu(false)
    setExportStatus('Exporting...')

    try {
      const result = await window.electronAPI.exportConversation(conversation.id, format)
      if (result.success) {
        setExportStatus('Exported!')
        setTimeout(() => setExportStatus(null), 2000)
      } else if (result.canceled) {
        setExportStatus(null)
      } else {
        setExportStatus('Export failed')
        setTimeout(() => setExportStatus(null), 3000)
      }
    } catch {
      setExportStatus('Export failed')
      setTimeout(() => setExportStatus(null), 3000)
    }
  }

  const virtualItems = virtualizer.getVirtualItems()

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-neutral-800 bg-claude-dark">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-medium text-claude-orange">{conversation.projectName}</h2>
            {conversation.sessionName && (
              <p className="text-xs text-neutral-400 mt-1">{conversation.sessionName}</p>
            )}
            <p className="text-xs text-neutral-500 mt-1 font-mono truncate max-w-xl">
              {conversation.sessionId}
            </p>
          </div>
          <div className="flex items-center gap-4">
            {/* In-chat Search Toggle */}
            <button
              onClick={() => {
                if (chatSearchOpen) {
                  closeChatSearch()
                } else {
                  setChatSearchOpen(true)
                  setTimeout(() => chatSearchInputRef.current?.focus(), 0)
                }
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border rounded-md transition-colors ${
                chatSearchOpen
                  ? 'text-claude-orange bg-claude-orange/10 border-claude-orange/40'
                  : 'text-neutral-300 bg-neutral-800 hover:bg-neutral-700 border-neutral-700'
              }`}
              title="Search in chat (⌘F)"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              Find
            </button>

            {/* Export Button */}
            <div className="relative" ref={exportMenuRef}>
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-300 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-md transition-colors"
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                  />
                </svg>
                {exportStatus || 'Export'}
              </button>

              {showExportMenu && (
                <div className="absolute right-0 mt-1 w-40 bg-neutral-800 border border-neutral-700 rounded-md shadow-lg z-10">
                  <button
                    onClick={() => handleExport('markdown')}
                    className="w-full px-3 py-2 text-left text-xs text-neutral-300 hover:bg-neutral-700 rounded-t-md"
                  >
                    Markdown (.md)
                  </button>
                  <button
                    onClick={() => handleExport('json')}
                    className="w-full px-3 py-2 text-left text-xs text-neutral-300 hover:bg-neutral-700"
                  >
                    JSON (.json)
                  </button>
                  <button
                    onClick={() => handleExport('text')}
                    className="w-full px-3 py-2 text-left text-xs text-neutral-300 hover:bg-neutral-700 rounded-b-md"
                  >
                    Plain Text (.txt)
                  </button>
                </div>
              )}
            </div>

            {/* Message Navigation */}
            <MessageNavigation
              currentIndex={currentMessageIndex}
              totalMessages={conversation.messages.length}
              onNavigate={handleNavigate}
              onJumpToFirst={handleJumpToFirst}
              onJumpToLast={handleJumpToLast}
            />

            <div className="text-right text-xs text-neutral-500">
              <div>{formatFullDate(conversation.timestamp)}</div>
              <div className="mt-1">{conversation.messageCount} messages</div>
            </div>
          </div>
        </div>
      </div>

      {/* In-chat Search Bar */}
      {chatSearchOpen && (
        <ChatSearchBar
          ref={chatSearchInputRef}
          value={chatSearchQuery}
          onChange={setChatSearchQuery}
          matchCount={chatSearchMatches.length}
          currentMatch={chatSearchMatches.length > 0 ? currentMatchIndex + 1 : 0}
          onNext={handleChatSearchNext}
          onPrev={handleChatSearchPrev}
          onClose={closeChatSearch}
        />
      )}

      {/* Virtualized Messages */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto"
        style={{ contain: 'strict' }}
      >
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
                className="px-4 py-2"
              >
                <MessageBubble
                  message={conversation.messages[virtualRow.index]}
                  query={effectiveQuery}
                  filePath={conversation.filePath}
                  isCurrentMessage={virtualRow.index === currentMessageIndex}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── In-Chat Search Bar ────────────────────────────────────────────────

interface ChatSearchBarProps {
  value: string
  onChange: (value: string) => void
  matchCount: number
  currentMatch: number
  onNext: () => void
  onPrev: () => void
  onClose: () => void
}

const ChatSearchBar = forwardRef<HTMLInputElement, ChatSearchBarProps>(
  ({ value, onChange, matchCount, currentMatch, onNext, onPrev, onClose }, ref) => {
    const handleKeyDown = (e: React.KeyboardEvent): void => {
      if (e.key === 'Escape') {
        onClose()
      } else if (e.key === 'Enter') {
        if (e.shiftKey) {
          onPrev()
        } else {
          onNext()
        }
      }
    }

    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-neutral-900/90 border-b border-neutral-700 backdrop-blur-sm">
        <svg className="w-4 h-4 text-neutral-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>

        <input
          ref={ref}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Find in conversation..."
          className="flex-1 bg-transparent text-sm text-neutral-200 placeholder-neutral-500 outline-none"
        />

        {value && (
          <span className="text-xs text-neutral-500 shrink-0 tabular-nums">
            {matchCount > 0 ? (
              <>
                <span className="text-neutral-300">{currentMatch}</span> of{' '}
                <span className="text-neutral-300">{matchCount}</span>
              </>
            ) : (
              'No matches'
            )}
          </span>
        )}

        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={onPrev}
            disabled={matchCount === 0}
            className="p-1 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Previous match (Shift+Enter)"
            aria-label="Previous match"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          </button>
          <button
            onClick={onNext}
            disabled={matchCount === 0}
            className="p-1 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Next match (Enter)"
            aria-label="Next match"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        <button
          onClick={onClose}
          className="p-1 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded transition-colors"
          title="Close (Esc)"
          aria-label="Close search"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    )
  }
)

// ─── Message Bubble (memoized to avoid re-renders during scroll) ────

interface MessageBubbleProps {
  message: ConversationMessage
  query: string
  filePath: string
  isCurrentMessage?: boolean
}

const MessageBubble = memo(function MessageBubble({
  message,
  query,
  filePath,
  isCurrentMessage = false
}: MessageBubbleProps) {
  const isUser = message.type === 'user'
  const isToolResult = message.isToolResult
  const hasToolResults = message.metadata?.toolResults && message.metadata.toolResults.length > 0
  const hasToolUseBlocks = message.metadata?.toolUseBlocks && message.metadata.toolUseBlocks.length > 0
  const [copied, setCopied] = useState(false)
  const [showInfo, setShowInfo] = useState(false)
  const infoRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!showInfo) return
    function handleClick(e: MouseEvent): void {
      if (infoRef.current && !infoRef.current.contains(e.target as Node)) {
        setShowInfo(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showInfo])

  // Determine bubble style based on message type
  let bubbleClass: string
  let labelText: string
  let labelClass: string
  let btnClass: string

  if (isToolResult) {
    // Tool result: neutral dashed border
    bubbleClass = 'bg-neutral-900/50 text-neutral-300 border border-dashed border-neutral-700/50'
    labelText = 'Tool Result'
    labelClass = 'text-neutral-500'
    btnClass = 'inline-flex items-center justify-center rounded-md border border-neutral-700 text-neutral-400 hover:bg-neutral-700 px-2 py-1 transition-colors'
  } else if (isUser) {
    bubbleClass = 'bg-claude-orange/20 text-neutral-200 border border-claude-orange/30'
    labelText = 'You'
    labelClass = 'text-claude-orange'
    btnClass = `inline-flex items-center justify-center rounded-md border transition-colors border-claude-orange/30 text-claude-orange hover:bg-claude-orange/20 px-2 py-1`
  } else {
    bubbleClass = 'bg-neutral-800 text-neutral-300 border border-neutral-700'
    labelText = 'Claude'
    labelClass = 'text-neutral-400'
    btnClass = `inline-flex items-center justify-center rounded-md border transition-colors border-neutral-700 text-neutral-400 hover:bg-neutral-700 px-2 py-1`
  }

  // Tool result messages are centered, not right-aligned
  const alignClass = isToolResult ? 'justify-center' : (isUser ? 'justify-end' : 'justify-start')

  return (
    <div className={`flex ${alignClass}`}>
      <div
        className={`max-w-[85%] rounded-lg px-4 py-3 transition-all ${bubbleClass} ${isCurrentMessage ? 'ring-2 ring-claude-orange/50' : ''}`}
      >
        <div className="flex items-center gap-2 mb-2">
          <span className={`text-xs font-medium ${labelClass}`}>
            {labelText}
          </span>
          {message.timestamp && (
            <span className="text-xs text-neutral-500">{formatTime(message.timestamp)}</span>
          )}
          {!isToolResult && message.metadata?.toolUses && message.metadata.toolUses.length > 0 && (
            <span className="text-[10px] font-mono text-neutral-500 bg-neutral-900 px-1.5 py-0.5 rounded">
              {message.metadata.toolUses.join(', ')}
            </span>
          )}
          <div className="ml-auto flex items-center gap-1">
            <div className="relative" ref={infoRef}>
              <button
                type="button"
                aria-label="Message info"
                onClick={() => setShowInfo(!showInfo)}
                className={btnClass}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-3.5 h-3.5">
                  <circle cx="12" cy="12" r="10" strokeWidth="2" />
                  <path strokeLinecap="round" strokeWidth="2" d="M12 16v-4m0-4h.01" />
                </svg>
              </button>
              {showInfo && (
                <MetadataTooltip metadata={message.metadata} isUser={isUser} filePath={filePath} lineNumber={message.lineNumber} />
              )}
            </div>
            <button
              type="button"
              aria-label={copied ? 'Copied' : 'Copy message'}
              title={copied ? 'Copied!' : 'Copy message'}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(message.content)
                  setCopied(true)
                  setTimeout(() => setCopied(false), 1500)
                } catch {
                  // no-op
                }
              }}
              className={btnClass}
            >
              {copied ? (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-3.5 h-3.5">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-3.5 h-3.5">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" strokeWidth="2" />
                  <rect x="3" y="3" width="13" height="13" rx="2" ry="2" strokeWidth="2" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Tool invocation badges for assistant messages */}
        {hasToolUseBlocks && !isUser && (
          <ToolInvocationBadge blocks={message.metadata!.toolUseBlocks!} />
        )}

        {/* Render tool result cards and/or standard message content */}
        {hasToolResults && (
          <ToolResultCard results={message.metadata!.toolResults!} />
        )}
        {(!hasToolResults || !isToolResult) && message.content && (
          <MessageContent content={message.content} query={query} />
        )}
      </div>
    </div>
  )
})


function MetadataTooltip({ metadata, isUser, filePath, lineNumber }: { metadata?: MessageMetadata; isUser: boolean; filePath: string; lineNumber?: number }): JSX.Element {
  const totalTokens = (metadata?.inputTokens || 0) + (metadata?.outputTokens || 0)
  const [copiedPath, setCopiedPath] = useState(false)

  const handleCopyPath = async (): Promise<void> => {
    try {
      const value = lineNumber ? `${filePath}:${lineNumber}` : filePath
      await navigator.clipboard.writeText(value)
      setCopiedPath(true)
      setTimeout(() => setCopiedPath(false), 1500)
    } catch {
      // no-op
    }
  }

  return (
    <div className={`absolute ${isUser ? 'right-0' : 'left-0'} bottom-full mb-2 w-80 bg-neutral-900 border border-neutral-700 rounded-lg shadow-xl z-20 p-3 text-xs`}>
      <div className="space-y-1.5 text-neutral-300">
        {/* File info */}
        <div className="flex items-start justify-between gap-2">
          <span className="text-neutral-500 shrink-0">File</span>
          <div className="flex items-center gap-1 min-w-0">
            <span className="font-mono truncate text-right text-[10px]" title={filePath}>{filePath}</span>
            <button
              type="button"
              onClick={handleCopyPath}
              className="shrink-0 p-0.5 rounded text-neutral-500 hover:text-neutral-300 hover:bg-neutral-700 transition-colors"
              title={copiedPath ? 'Copied!' : (lineNumber ? `${filePath}:${lineNumber}` : filePath)}
            >
              {copiedPath ? (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-3 h-3">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-3 h-3">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" strokeWidth="2" />
                  <rect x="3" y="3" width="13" height="13" rx="2" ry="2" strokeWidth="2" />
                </svg>
              )}
            </button>
          </div>
        </div>
        {lineNumber !== undefined && <Row label="Line" value={lineNumber} />}

        {/* Metadata section */}
        {metadata && (
          <>
            {(metadata.model || metadata.gitBranch || metadata.stopReason !== undefined || metadata.version || (metadata.toolUses && metadata.toolUses.length > 0)) && (
              <div className="border-t border-neutral-700 my-1.5" />
            )}
            {metadata.model && <Row label="Model" value={metadata.model} />}
            {metadata.gitBranch && <Row label="Branch" value={metadata.gitBranch} />}
            {metadata.stopReason !== undefined && <Row label="Stop" value={metadata.stopReason ?? 'streaming'} />}
            {metadata.version && <Row label="Version" value={metadata.version} />}
            {metadata.toolUses && metadata.toolUses.length > 0 && <Row label="Tools" value={metadata.toolUses.join(', ')} />}
            {totalTokens > 0 && (
              <>
                <div className="border-t border-neutral-700 my-1.5" />
                <div className="text-neutral-400 font-medium mb-1">Tokens</div>
                {metadata.inputTokens !== undefined && <Row label="Input" value={metadata.inputTokens.toLocaleString()} />}
                {metadata.outputTokens !== undefined && <Row label="Output" value={metadata.outputTokens.toLocaleString()} />}
                {metadata.cacheReadTokens !== undefined && metadata.cacheReadTokens > 0 && <Row label="Cache read" value={metadata.cacheReadTokens.toLocaleString()} />}
                {metadata.cacheCreationTokens !== undefined && metadata.cacheCreationTokens > 0 && <Row label="Cache create" value={metadata.cacheCreationTokens.toLocaleString()} />}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string | number }): JSX.Element {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-neutral-500">{label}</span>
      <span className="font-mono truncate text-right">{value}</span>
    </div>
  )
}


function formatFullDate(timestamp: string): string {
  return new Date(timestamp).toLocaleString([], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function formatTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  })
}
