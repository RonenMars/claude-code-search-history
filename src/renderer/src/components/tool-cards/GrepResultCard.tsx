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
        <div className="flex items-center gap-2 min-w-0">
          <svg className="w-3.5 h-3.5 text-cyan-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <span className="text-neutral-300 text-xs font-mono">Grep</span>
          <span className="text-neutral-500 text-xs">({result.mode})</span>
        </div>
        <div className="flex items-center gap-1.5">
          {result.numFiles > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-900/40 text-cyan-400 border border-cyan-700/40">
              {result.numFiles} file{result.numFiles !== 1 ? 's' : ''}
            </span>
          )}
          {result.numLines > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400 border border-neutral-700">
              {result.numLines} line{result.numLines !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {visibleContent && (
        <div className="bg-neutral-950 border border-neutral-800 rounded-b-lg overflow-x-auto">
          <pre className="px-3 py-2 font-mono text-xs text-neutral-400 whitespace-pre-wrap break-all leading-5">
            {visibleContent}
          </pre>
          {shouldCollapse && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="w-full px-3 py-1.5 text-[10px] text-neutral-500 hover:text-neutral-300 bg-neutral-900/30 border-t border-neutral-800/50 transition-colors"
            >
              {expanded ? '▲ Collapse' : `▼ Show all ${contentLines.length} lines`}
            </button>
          )}
        </div>
      )}
    </div>
  )
})
