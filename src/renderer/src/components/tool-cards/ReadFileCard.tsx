import { memo } from 'react'
import type { ReadToolResult } from '../../../../shared/types'

export default memo(function ReadFileCard({ result }: { result: ReadToolResult }) {
  const dirParts = result.filePath.split('/')
  const basename = dirParts.pop() || ''
  const directory = dirParts.join('/') + '/'

  return (
    <div className="tool-card">
      <div className="tool-card-header rounded-lg">
        <div className="flex items-center gap-2 min-w-0">
          <svg className="w-3.5 h-3.5 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          <span className="text-neutral-500 text-xs truncate">{directory}</span>
          <span className="text-neutral-200 text-xs font-semibold">{basename}</span>
        </div>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-900/40 text-emerald-400 border border-emerald-700/40">
          Read
        </span>
      </div>
    </div>
  )
})
