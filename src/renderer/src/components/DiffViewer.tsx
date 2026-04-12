// ─── DiffViewer ───────────────────────────────────────────────────────────────
// Purpose-built touch-optimized diff viewer component (Phase 2 Milestone 4).
//
// Props:
//   hunks    — array of StructuredPatchHunk from the shared types
//   filename — file being modified (used in header)
//   language — optional hint for future syntax highlighting
//
// Features:
//   - Line numbers + red deletions / green additions
//   - Collapse at >50 lines, expand with "Show N more lines"
//   - Copy button per hunk
//   - Horizontal scroll for long lines (no text wrap in diff)
//   - Pinch-to-zoom via CSS touch-action: manipulation
//   - File summary: added/removed line counts

import { memo, useState, useCallback, type JSX } from 'react'
import type { StructuredPatchHunk } from '../../../shared/types'

const COLLAPSE_THRESHOLD = 50

export interface DiffViewerProps {
  hunks: StructuredPatchHunk[]
  filename: string
  language?: string
}

export default memo(function DiffViewer({ hunks, filename }: DiffViewerProps): JSX.Element {
  const allLines = hunks.flatMap((h) => h.lines)
  const shouldCollapse = allLines.length > COLLAPSE_THRESHOLD
  const [expanded, setExpanded] = useState(!shouldCollapse)

  const addedCount = allLines.filter((l) => l.startsWith('+')).length
  const removedCount = allLines.filter((l) => l.startsWith('-')).length

  const dirParts = filename.split('/')
  const base = dirParts.pop() ?? ''
  const dir = dirParts.length > 0 ? `${dirParts.join('/')}/` : ''

  return (
    <div
      className="overflow-hidden rounded-lg border border-neutral-800 bg-neutral-950"
      style={{ touchAction: 'manipulation' }}
    >
      {/* Filename header */}
      <div className="flex items-center justify-between gap-2 border-b border-neutral-800 bg-neutral-900/70 px-3 py-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <FileEditIcon />
          <span className="truncate text-[11px] text-neutral-500">{dir}</span>
          <span className="text-[11px] font-semibold text-neutral-200">{base}</span>
        </div>
        <div className="flex shrink-0 items-center gap-2 text-[10px]">
          {addedCount > 0 && <span className="text-green-400">+{addedCount}</span>}
          {removedCount > 0 && <span className="text-red-400">−{removedCount}</span>}
        </div>
      </div>

      {/* Hunks */}
      <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
        {hunks.map((hunk, hi) => (
          <HunkBlock
            key={hi}
            hunk={hunk}
            hunkIndex={hi}
            expanded={expanded}
            isFirst={hi === 0}
          />
        ))}
      </div>

      {/* Expand / collapse toggle */}
      {shouldCollapse && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full border-t border-neutral-800/50 bg-neutral-900/50 px-3 py-1.5 text-[10px] text-neutral-500 transition-colors hover:text-neutral-300"
        >
          {expanded
            ? '▲ Collapse'
            : `▼ Show all ${allLines.length} lines`}
        </button>
      )}
    </div>
  )
})

// ─── HunkBlock ────────────────────────────────────────────────────────────────

interface HunkBlockProps {
  hunk: StructuredPatchHunk
  hunkIndex: number
  expanded: boolean
  isFirst: boolean
}

const HunkBlock = memo(function HunkBlock({ hunk, hunkIndex, expanded, isFirst }: HunkBlockProps): JSX.Element {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    const text = hunk.lines.join('\n')
    await navigator.clipboard.writeText(text).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }, [hunk.lines])

  const lines = expanded ? hunk.lines : (isFirst ? hunk.lines.slice(0, COLLAPSE_THRESHOLD) : [])

  let oldLine = hunk.oldStart
  let newLine = hunk.newStart

  return (
    <div className="relative font-mono text-xs leading-5">
      {/* Hunk header (shown between hunks when expanded) */}
      {hunkIndex > 0 && expanded && (
        <div className="diff-hunk-header flex items-center justify-between border-y border-neutral-800/50 bg-neutral-900/50 px-3 py-0.5">
          <span className="text-[10px] text-neutral-500">
            @@ -{hunk.oldStart},{hunk.oldLines} +{hunk.newStart},{hunk.newLines} @@
          </span>
          <button
            onClick={handleCopy}
            className="ml-2 text-[10px] text-neutral-600 transition-colors hover:text-neutral-300"
            title="Copy hunk"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      )}

      {/* Copy button for first hunk (sits top-right) */}
      {hunkIndex === 0 && lines.length > 0 && (
        <button
          onClick={handleCopy}
          className="absolute top-0.5 right-2 z-10 text-[10px] text-neutral-600 transition-colors hover:text-neutral-300"
          title="Copy hunk"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      )}

      {lines.map((line, li) => {
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
          <div key={`${hunkIndex}-${li}`} className={`flex ${cls}`}>
            <span className="diff-line-num w-10 shrink-0 pr-2 text-right text-neutral-600 select-none">
              {lineNum}
            </span>
            <span className="diff-line-prefix w-4 shrink-0 text-center select-none">{prefix}</span>
            <span className="diff-line-content pr-3 whitespace-pre">{line.slice(1)}</span>
          </div>
        )
      })}
    </div>
  )
})

function FileEditIcon(): JSX.Element {
  return (
    <svg className="h-3.5 w-3.5 shrink-0 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  )
}
