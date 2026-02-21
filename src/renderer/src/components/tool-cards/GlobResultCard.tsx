import { memo, useState } from 'react'
import type { GlobToolResult } from '../../../../shared/types'

const MAX_VISIBLE = 20

export default memo(function GlobResultCard({ result }: { result: GlobToolResult }) {
  const [showAll, setShowAll] = useState(false)
  const visibleFiles = showAll ? result.filenames : result.filenames.slice(0, MAX_VISIBLE)
  const hasMore = result.filenames.length > MAX_VISIBLE

  return (
    <div className="tool-card">
      <div className="tool-card-header">
        <div className="flex items-center gap-2 min-w-0">
          <svg className="w-3.5 h-3.5 text-purple-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <span className="text-neutral-300 text-xs font-mono">Glob</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-900/40 text-purple-400 border border-purple-700/40">
            {result.numFiles} file{result.numFiles !== 1 ? 's' : ''}
          </span>
          {result.truncated && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-900/40 text-amber-400 border border-amber-700/40">
              truncated
            </span>
          )}
        </div>
      </div>

      {result.filenames.length > 0 && (
        <div className="bg-neutral-950 border border-neutral-800 rounded-b-lg overflow-x-auto">
          <div className="px-3 py-2 font-mono text-xs text-neutral-400 space-y-0.5">
            {visibleFiles.map((f, i) => (
              <div key={i} className="truncate">{f}</div>
            ))}
          </div>
          {hasMore && (
            <button
              onClick={() => setShowAll(!showAll)}
              className="w-full px-3 py-1.5 text-[10px] text-neutral-500 hover:text-neutral-300 bg-neutral-900/30 border-t border-neutral-800/50 transition-colors"
            >
              {showAll ? '▲ Show less' : `▼ Show all ${result.filenames.length} files`}
            </button>
          )}
        </div>
      )}
    </div>
  )
})
