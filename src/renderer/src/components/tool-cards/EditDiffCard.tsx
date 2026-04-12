import { memo } from 'react'
import DiffViewer from '../DiffViewer'
import type { EditToolResult } from '../../../../shared/types'

export default memo(function EditDiffCard({ result }: { result: EditToolResult }) {
  // Attempt to infer language from file extension for future syntax highlighting
  const ext = result.filePath.split('.').pop()?.toLowerCase()

  // If the structured patch is empty or malformed, fall back to raw strings
  if (!result.structuredPatch || result.structuredPatch.length === 0) {
    return <EditDiffCardRawFallback result={result} />
  }

  return (
    <div className="tool-card">
      <div className="tool-card-header">
        <div className="flex min-w-0 items-center gap-2">
          {/* Header is minimal — DiffViewer renders its own filename header */}
          <span className="text-xs text-neutral-500 truncate">{result.filePath}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {result.userModified && (
            <span className="rounded border border-amber-700/40 bg-amber-900/40 px-1.5 py-0.5 text-[10px] text-amber-400">
              user modified
            </span>
          )}
          <span className="rounded border border-blue-700/40 bg-blue-900/40 px-1.5 py-0.5 text-[10px] text-blue-400">
            Modified
          </span>
        </div>
      </div>

      <DiffViewer
        hunks={result.structuredPatch}
        filename={result.filePath}
        language={ext}
      />
    </div>
  )
})

// Raw fallback for when structured patch is unavailable
function EditDiffCardRawFallback({ result }: { result: EditToolResult }) {
  return (
    <div className="tool-card">
      <div className="tool-card-header">
        <span className="text-xs text-neutral-500 truncate">{result.filePath}</span>
        <span className="rounded border border-neutral-700 px-1.5 py-0.5 text-[10px] text-neutral-500">
          raw
        </span>
      </div>
      <div className="overflow-x-auto rounded-b-lg border border-neutral-800 bg-neutral-950 p-3 font-mono text-xs text-neutral-400 whitespace-pre">
        {result.oldString && (
          <div className="text-red-400/80">- {result.oldString.split('\n').join('\n- ')}</div>
        )}
        {result.newString && (
          <div className="text-green-400/80">+ {result.newString.split('\n').join('\n+ ')}</div>
        )}
      </div>
    </div>
  )
}
