import { memo, useState } from 'react'
import type { GrepToolResult } from '../../../../shared/types'

const COLLAPSED_THRESHOLD = 15

export default memo(function GrepResultCard({ result }: { result: GrepToolResult }) {
  const contentLines = result.content ? result.content.split('\n') : []
  const shouldCollapse = contentLines.length > COLLAPSED_THRESHOLD
  const [expanded, setExpanded] = useState(!shouldCollapse)
  const visibleContent = expanded ? result.content : contentLines.slice(0, COLLAPSED_THRESHOLD).join('\n')

  return (
    <div className="tool-card">
      <div className="tool-card-header">
        <div className="flex min-w-0 items-center gap-2">
          <svg className="h-3.5 w-3.5 shrink-0 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <span className="font-mono text-xs text-neutral-300">Grep</span>
          <span className="text-xs text-neutral-500">({result.mode})</span>
        </div>
        <div className="flex items-center gap-1.5">
          {result.numFiles > 0 && (
            <span className="rounded border border-cyan-700/40 bg-cyan-900/40 px-1.5 py-0.5 text-[10px] text-cyan-400">
              {result.numFiles} file{result.numFiles !== 1 ? 's' : ''}
            </span>
          )}
          {result.numLines > 0 && (
            <span className="rounded border border-neutral-700 bg-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-400">
              {result.numLines} line{result.numLines !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {visibleContent && (
        <div className="overflow-x-auto rounded-b-lg border border-neutral-800 bg-neutral-950">
          <pre className="px-3 py-2 font-mono text-xs leading-5 break-all whitespace-pre-wrap text-neutral-400">
            {visibleContent}
          </pre>
          {shouldCollapse && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="w-full border-t border-neutral-800/50 bg-neutral-900/30 px-3 py-1.5 text-[10px] text-neutral-500 transition-colors hover:text-neutral-300"
            >
              {expanded ? '▲ Collapse' : `▼ Show all ${contentLines.length} lines`}
            </button>
          )}
        </div>
      )}
    </div>
  )
})
