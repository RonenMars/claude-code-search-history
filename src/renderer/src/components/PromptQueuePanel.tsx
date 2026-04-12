import { useState, useEffect, useCallback, type JSX } from 'react'
import type { QueuedPrompt, SessionQueue } from '../../../shared/types'

interface PromptQueuePanelProps {
  sessionId: string
  onSendNow?: () => void
}

const STATUS_COLORS: Record<QueuedPrompt['status'], string> = {
  pending: 'text-neutral-400 bg-neutral-800 border-neutral-700',
  running: 'text-claude-orange bg-claude-orange/10 border-claude-orange/30',
  completed: 'text-green-400 bg-green-900/20 border-green-700/30',
  cancelled: 'text-neutral-600 bg-neutral-900 border-neutral-800',
}

export default function PromptQueuePanel({ sessionId, onSendNow }: PromptQueuePanelProps): JSX.Element {
  const [queue, setQueue] = useState<SessionQueue>({ sessionId, prompts: [], paused: false })
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  const reload = useCallback(async () => {
    const q = await window.electronAPI.queueLoad(sessionId)
    setQueue(q)
  }, [sessionId])

  useEffect(() => { reload() }, [reload])

  const handleAdd = useCallback(async () => {
    const text = input.trim()
    if (!text) return
    setLoading(true)
    const updated = await window.electronAPI.queueAdd(sessionId, text)
    setQueue(updated)
    setInput('')
    setLoading(false)
  }, [sessionId, input])

  const handleRemove = useCallback(async (promptId: string) => {
    const updated = await window.electronAPI.queueRemove(sessionId, promptId)
    setQueue(updated)
  }, [sessionId])

  const handleClear = useCallback(async () => {
    const updated = await window.electronAPI.queueClear(sessionId)
    setQueue(updated)
  }, [sessionId])

  const handleTogglePause = useCallback(async () => {
    const updated = await window.electronAPI.queueSetPaused(sessionId, !queue.paused)
    setQueue(updated)
  }, [sessionId, queue.paused])

  const handleRunNext = useCallback(async () => {
    await window.electronAPI.queueSendNext(sessionId)
    await reload()
    onSendNow?.()
  }, [sessionId, reload, onSendNow])

  const pendingCount = queue.prompts.filter((p) => p.status === 'pending').length

  return (
    <div className="flex h-full flex-col border-l border-neutral-800 bg-neutral-950">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-800 px-3 py-2">
        <span className="text-xs font-semibold text-neutral-300">
          Prompt Queue
          {pendingCount > 0 && (
            <span className="ml-1.5 rounded-full bg-claude-orange/20 px-1.5 py-0.5 text-[10px] text-claude-orange">
              {pendingCount}
            </span>
          )}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={handleRunNext}
            disabled={pendingCount === 0}
            className="rounded px-2 py-1 text-[10px] text-neutral-400 transition-colors hover:text-neutral-200 disabled:pointer-events-none disabled:opacity-40"
            title="Send next prompt"
          >
            ▶ Run Next
          </button>
          <button
            onClick={handleTogglePause}
            className={`rounded px-2 py-1 text-[10px] transition-colors ${queue.paused ? 'text-claude-orange' : 'text-neutral-500 hover:text-neutral-300'}`}
            title={queue.paused ? 'Resume queue' : 'Pause queue'}
          >
            {queue.paused ? '⏸ Paused' : '⏸ Pause'}
          </button>
          {queue.prompts.length > 0 && (
            <button
              onClick={handleClear}
              className="rounded px-2 py-1 text-[10px] text-neutral-600 transition-colors hover:text-red-400"
              title="Clear all"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Prompt list */}
      <div className="flex-1 overflow-y-auto">
        {queue.prompts.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs text-neutral-600">
            No prompts queued
          </div>
        ) : (
          <div className="divide-y divide-neutral-800/50">
            {queue.prompts.map((prompt, i) => (
              <div key={prompt.id} className="group flex items-start gap-2 px-3 py-2.5">
                <span className="mt-0.5 shrink-0 text-[10px] text-neutral-700">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className={`text-xs leading-relaxed ${prompt.status === 'cancelled' ? 'line-through opacity-50' : 'text-neutral-300'}`}>
                    {prompt.text}
                  </p>
                  <span className={`mt-1 inline-flex items-center rounded border px-1 py-0.5 text-[10px] ${STATUS_COLORS[prompt.status]}`}>
                    {prompt.status}
                  </span>
                </div>
                {prompt.status === 'pending' && (
                  <button
                    onClick={() => handleRemove(prompt.id)}
                    className="shrink-0 text-[10px] text-neutral-700 opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-400"
                    title="Remove"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-neutral-800 p-2">
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleAdd()
            }}
            placeholder="Add prompt to queue… (⌘↵ to add)"
            rows={2}
            className="flex-1 resize-none rounded border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-xs text-neutral-300 placeholder-neutral-600 focus:border-neutral-600 focus:outline-none"
          />
          <button
            onClick={handleAdd}
            disabled={!input.trim() || loading}
            className="shrink-0 rounded border border-neutral-700 bg-neutral-800 px-3 text-xs text-neutral-300 transition-colors hover:bg-neutral-700 disabled:pointer-events-none disabled:opacity-40"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  )
}
