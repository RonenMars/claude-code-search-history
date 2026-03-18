import { memo } from 'react'
import type { WriteToolResult } from '../../../../shared/types'

export default memo(function WriteFileCard({ result }: { result: WriteToolResult }) {
  const dirParts = result.filePath.split('/')
  const basename = dirParts.pop() || ''
  const directory = `${dirParts.join('/')  }/`

  return (
    <div className="tool-card">
      <div className="tool-card-header rounded-lg">
        <div className="flex min-w-0 items-center gap-2">
          <svg className="h-3.5 w-3.5 shrink-0 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span className="truncate text-xs text-neutral-500">{directory}</span>
          <span className="text-xs font-semibold text-neutral-200">{basename}</span>
        </div>
        <span className="rounded border border-green-700/40 bg-green-900/40 px-1.5 py-0.5 text-[10px] text-green-400">
          Created
        </span>
      </div>
    </div>
  )
})
