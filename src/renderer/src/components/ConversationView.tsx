import { useRef, useEffect, useState, useCallback, forwardRef } from 'react'
import MessageNavigation from './MessageNavigation'
import MessageContent from './MessageContent'



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
}

interface ConversationMessage {
  type: string
  content: string
  timestamp: string
  metadata?: MessageMetadata
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
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [exportStatus, setExportStatus] = useState<string | null>(null)
  const exportMenuRef = useRef<HTMLDivElement>(null)

  // Message navigation state
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0)
  const messageRefs = useRef<(HTMLDivElement | null)[]>([])

  // Initialize message refs array
  useEffect(() => {
    messageRefs.current = messageRefs.current.slice(0, conversation.messages.length)
  }, [conversation.messages.length])

  // Scroll to specific message
  const scrollToMessage = useCallback((index: number) => {
    const messageElement = messageRefs.current[index]
    if (messageElement) {
      messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setCurrentMessageIndex(index)
    }
  }, [])

  // Navigation handlers
  const handleNavigate = useCallback((index: number) => {
    scrollToMessage(index)
  }, [scrollToMessage])

  const handleJumpToFirst = useCallback(() => {
    scrollToMessage(0)
  }, [scrollToMessage])

  const handleJumpToLast = useCallback(() => {
    scrollToMessage(conversation.messages.length - 1)
  }, [scrollToMessage, conversation.messages.length])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
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
  }, [currentMessageIndex, conversation.messages.length, scrollToMessage])


  // Scroll to first match when query changes
  useEffect(() => {
    if (query) {
      const highlight = document.querySelector('.highlight')
      highlight?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [query, conversation.id])

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

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {conversation.messages.map((message, index) => (
          <MessageBubble
            key={index}
            message={message}
            query={query}
            ref={(el) => (messageRefs.current[index] = el)}
            isCurrentMessage={index === currentMessageIndex}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>
    </div>
  )
}

interface MessageBubbleProps {
  message: ConversationMessage
  query: string
  isCurrentMessage?: boolean
}

const MessageBubble = forwardRef<HTMLDivElement, MessageBubbleProps>(
  ({ message, query, isCurrentMessage = false }, ref) => {
    const isUser = message.type === 'user'
    const [copied, setCopied] = useState(false)
    const [showInfo, setShowInfo] = useState(false)
    const infoRef = useRef<HTMLDivElement>(null)

    const hasMetadata = message.metadata && Object.keys(message.metadata).length > 0

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


    const btnClass = `inline-flex items-center justify-center rounded-md border transition-colors ${isUser
      ? 'border-claude-orange/30 text-claude-orange hover:bg-claude-orange/20'
      : 'border-neutral-700 text-neutral-400 hover:bg-neutral-700'
      } px-2 py-1`

    return (
      <div ref={ref} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
        <div
          className={`max-w-[85%] rounded-lg px-4 py-3 transition-all ${isUser
            ? 'bg-claude-orange/20 text-neutral-200 border border-claude-orange/30'
            : 'bg-neutral-800 text-neutral-300 border border-neutral-700'
            } ${isCurrentMessage ? 'ring-2 ring-claude-orange/50' : ''}`}
        >
          <div className="flex items-center gap-2 mb-2">
            <span
              className={`text-xs font-medium ${isUser ? 'text-claude-orange' : 'text-neutral-400'}`}
            >
              {isUser ? 'You' : 'Claude'}
            </span>
            {message.timestamp && (
              <span className="text-xs text-neutral-500">{formatTime(message.timestamp)}</span>
            )}
            {message.metadata?.toolUses && message.metadata.toolUses.length > 0 && (
              <span className="text-[10px] font-mono text-neutral-500 bg-neutral-900 px-1.5 py-0.5 rounded">
                {message.metadata.toolUses.join(', ')}
              </span>
            )}
            <div className="ml-auto flex items-center gap-1">
              {hasMetadata && (
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
                  {showInfo && message.metadata && (
                    <MetadataTooltip metadata={message.metadata} isUser={isUser} />
                  )}
                </div>
              )}
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
          <MessageContent content={message.content} query={query} />
        </div>
      </div>
    )
  }
)


function MetadataTooltip({ metadata, isUser }: { metadata: MessageMetadata; isUser: boolean }): JSX.Element {
  const totalTokens = (metadata.inputTokens || 0) + (metadata.outputTokens || 0)

  return (
    <div className={`absolute ${isUser ? 'right-0' : 'left-0'} bottom-full mb-2 w-64 bg-neutral-900 border border-neutral-700 rounded-lg shadow-xl z-20 p-3 text-xs`}>
      <div className="space-y-1.5 text-neutral-300">
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
