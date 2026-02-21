import { memo, useState } from 'react'
import type { EditToolResult } from '../../../../shared/types'

const COLLAPSED_THRESHOLD = 20

export default memo(function EditDiffCard({ result }: { result: EditToolResult }) {
  const allLines = result.structuredPatch.flatMap((hunk) => hunk.lines)
  const shouldCollapse = allLines.length > COLLAPSED_THRESHOLD
  const [expanded, setExpanded] = useState(!shouldCollapse)

  const dirParts = result.filePath.split('/')
  const basename = dirParts.pop() || ''
  const directory = dirParts.join('/') + '/'

  return (
    <div className="tool-card">
      <div className="tool-card-header">
        <div className="flex items-center gap-2 min-w-0">
          <FileIcon />
          <span className="text-neutral-500 text-xs truncate">{directory}</span>
          <span className="text-neutral-200 text-xs font-semibold">{basename}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {result.userModified && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-900/40 text-amber-400 border border-amber-700/40">
              user modified
            </span>
          )}
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-900/40 text-blue-400 border border-blue-700/40">
            Modified
          </span>
        </div>
      </div>

      <div className="bg-neutral-950 border border-neutral-800 rounded-b-lg overflow-x-auto font-mono text-xs leading-5">
        {result.structuredPatch.map((hunk, hi) => {
          // Compute starting lines for this hunk — only used when expanded
          let oldLine = hunk.oldStart
          let newLine = hunk.newStart
          const hunkLines = expanded ? hunk.lines : (hi === 0 ? hunk.lines.slice(0, COLLAPSED_THRESHOLD) : [])

          return (
            <div key={hi}>
              {hi > 0 && expanded && (
                <div className="diff-hunk-header text-neutral-500 text-[10px] px-3 py-0.5 bg-neutral-900/50 border-y border-neutral-800/50">
                  @@ -{hunk.oldStart},{hunk.oldLines} +{hunk.newStart},{hunk.newLines} @@
                </div>
              )}
              {hunkLines.map((line, li) => {
                const prefix = line[0]
                let lineNum = ''
                let cls = ''

                if (prefix === '-') {
                  lineNum = String(oldLine++)
                  cls = 'diff-removed'
                } else if (prefix === '+') {
                  lineNum = String(newLine++)
                  cls = 'diff-added'
                } else {
                  lineNum = String(oldLine++)
                  newLine++
                  cls = 'diff-context'
                }

                return (
                  <div key={`${hi}-${li}`} className={`flex ${cls}`}>
                    <span className="diff-line-num w-10 shrink-0 text-right pr-2 select-none text-neutral-600">
                      {lineNum}
                    </span>
                    <span className="diff-line-prefix w-4 shrink-0 text-center select-none">
                      {prefix}
                    </span>
                    <span className="diff-line-content pr-3 whitespace-pre">{line.slice(1)}</span>
                  </div>
                )
              })}
            </div>
          )
        })}

        {shouldCollapse && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full px-3 py-1.5 text-[10px] text-neutral-500 hover:text-neutral-300 bg-neutral-900/50 border-t border-neutral-800/50 transition-colors"
          >
            {expanded ? '▲ Collapse' : `▼ Show all ${allLines.length} lines`}
          </button>
        )}
      </div>
    </div>
  )
})

function FileIcon() {
  return (
    <svg className="w-3.5 h-3.5 text-blue-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  )
}
