import { useMemo, useRef, useEffect } from 'react'

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

export default function ConversationView({
  conversation,
  query
}: ConversationViewProps): JSX.Element {
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Scroll to first match when query changes
  useEffect(() => {
    if (query) {
      const highlight = document.querySelector('.highlight')
      highlight?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [query, conversation.id])

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
          <div className="text-right text-xs text-neutral-500">
            <div>{formatFullDate(conversation.timestamp)}</div>
            <div className="mt-1">{conversation.messageCount} messages</div>
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
