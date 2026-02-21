import { memo } from 'react'
import type { WriteToolResult } from '../../../../shared/types'

export default memo(function WriteFileCard({ result }: { result: WriteToolResult }) {
  const dirParts = result.filePath.split('/')
  const basename = dirParts.pop() || ''
  const directory = dirParts.join('/') + '/'

  return (
    <div className="tool-card">
      <div className="tool-card-header rounded-lg">
        <div className="flex items-center gap-2 min-w-0">
          <svg className="w-3.5 h-3.5 text-green-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span className="text-neutral-500 text-xs truncate">{directory}</span>
          <span className="text-neutral-200 text-xs font-semibold">{basename}</span>
        </div>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-900/40 text-green-400 border border-green-700/40">
          Created
        </span>
      </div>
    </div>
  )
})
