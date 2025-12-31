import { useMemo, useRef, useEffect, useState } from 'react'

interface ConversationMessage {
  type: string
  content: string
  timestamp: string
}

interface Conversation {
  id: string
  filePath: string
  projectPath: string
  projectName: string
  sessionId: string
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
          <MessageBubble key={index} message={message} query={query} />
        ))}
        <div ref={messagesEndRef} />
      </div>
    </div>
  )
}

interface MessageBubbleProps {
  message: ConversationMessage
  query: string
}

function MessageBubble({ message, query }: MessageBubbleProps): JSX.Element {
  const isUser = message.type === 'user'
  const [copied, setCopied] = useState(false)

  const highlightedContent = useMemo(() => {
    const content = message.content
    if (!query) return escapeHtml(content)
    return highlightText(content, query)
  }, [message.content, query])

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-lg px-4 py-3 ${
          isUser
            ? 'bg-claude-orange/20 text-neutral-200 border border-claude-orange/30'
            : 'bg-neutral-800 text-neutral-300 border border-neutral-700'
        }`}
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
                // no-op; clipboard may be unavailable
              }
            }}
            className={`ml-auto inline-flex items-center justify-center rounded-md border transition-colors ${
              isUser
                ? 'border-claude-orange/30 text-claude-orange hover:bg-claude-orange/20'
                : 'border-neutral-700 text-neutral-400 hover:bg-neutral-700'
            } px-2 py-1`}
          >
            {copied ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                className="w-3.5 h-3.5"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                className="w-3.5 h-3.5"
              >
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" strokeWidth="2" />
                <rect x="3" y="3" width="13" height="13" rx="2" ry="2" strokeWidth="2" />
              </svg>
            )}
          </button>
        </div>
        <div
          className="text-sm whitespace-pre-wrap break-words prose prose-invert prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: highlightedContent }}
        />
      </div>
    </div>
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
