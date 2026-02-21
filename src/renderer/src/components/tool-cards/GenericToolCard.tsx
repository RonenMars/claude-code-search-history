import { memo, useState, useMemo, useCallback } from 'react'
import type { GenericToolResult, TaskAgentToolResult, TaskCreateToolResult, TaskUpdateToolResult } from '../../../../shared/types'

export const GenericToolCard = memo(function GenericToolCard({ result }: { result: GenericToolResult }) {
  const [collapsed, setCollapsed] = useState(true)
  const [copied, setCopied] = useState(false)

  const formatted = useMemo(() => {
    try {
      return JSON.stringify(result.data, null, 2)
    } catch {
      return String(result.data)
    }
  }, [result.data])

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(formatted)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* no-op */ }
  }, [formatted])

  const displayName = result.toolName !== 'unknown' ? result.toolName : 'Tool Result'

  return (
    <div className="tool-card">
      <div className="tool-card-header rounded-t-lg">
        <div className="flex items-center gap-2">
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400 border border-neutral-700 font-mono">
            {displayName}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="text-[10px] text-neutral-500 hover:text-neutral-300 transition-colors"
          >
            {collapsed ? '▶ Expand' : '▼ Collapse'}
          </button>
          <button
            onClick={handleCopy}
            className="text-[10px] text-neutral-500 hover:text-neutral-300 transition-colors"
          >
            {copied ? '✓' : 'Copy'}
          </button>
        </div>
      </div>

      {!collapsed && (
        <pre className="bg-neutral-950 border border-neutral-800 rounded-b-lg p-3 overflow-x-auto max-h-64 overflow-y-auto font-mono text-xs text-neutral-400">
          {formatted}
        </pre>
      )}
    </div>
  )
})

export const TaskAgentCard = memo(function TaskAgentCard({ result }: { result: TaskAgentToolResult }) {
  return (
    <div className="tool-card">
      <div className="tool-card-header rounded-lg">
        <div className="flex items-center gap-2 min-w-0">
          <svg className="w-3.5 h-3.5 text-indigo-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span className="text-neutral-300 text-xs">Sub-agent</span>
          <span className="text-neutral-500 text-[10px] font-mono">{result.agentId}</span>
        </div>
        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
          result.status === 'completed'
            ? 'bg-green-900/40 text-green-400 border-green-700/40'
            : 'bg-amber-900/40 text-amber-400 border-amber-700/40'
        }`}>
          {result.status}
        </span>
      </div>
    </div>
  )
})

export const TaskCreateCard = memo(function TaskCreateCard({ result }: { result: TaskCreateToolResult }) {
  return (
    <div className="tool-card">
      <div className="tool-card-header rounded-lg">
        <div className="flex items-center gap-2 min-w-0">
          <svg className="w-3.5 h-3.5 text-green-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <span className="text-neutral-300 text-xs">Task #{result.taskId}</span>
          <span className="text-neutral-400 text-xs truncate">{result.subject}</span>
        </div>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-900/40 text-green-400 border border-green-700/40">
          Created
        </span>
      </div>
    </div>
  )
})

export const TaskUpdateCard = memo(function TaskUpdateCard({ result }: { result: TaskUpdateToolResult }) {
  return (
    <div className="tool-card">
      <div className="tool-card-header rounded-lg">
        <div className="flex items-center gap-2 min-w-0">
          <svg className="w-3.5 h-3.5 text-blue-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <span className="text-neutral-300 text-xs">Task #{result.taskId}</span>
          {result.statusChange && (
            <span className="text-neutral-500 text-xs">
              {result.statusChange.from} → {result.statusChange.to}
            </span>
          )}
        </div>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-900/40 text-blue-400 border border-blue-700/40">
          Updated
        </span>
      </div>
    </div>
  )
})
