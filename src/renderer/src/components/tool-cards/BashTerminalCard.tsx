import { memo, useState } from 'react'
import type { BashToolResult } from '../../../../shared/types'

const COLLAPSED_THRESHOLD = 15

export default memo(function BashTerminalCard({ result }: { result: BashToolResult }) {
  const stdoutLines = result.stdout ? result.stdout.split('\n') : []
  const stderrLines = result.stderr ? result.stderr.split('\n') : []
  const totalLines = stdoutLines.length + stderrLines.length
  const shouldCollapse = totalLines > COLLAPSED_THRESHOLD
  const [expanded, setExpanded] = useState(!shouldCollapse)

  const visibleStdout = expanded ? result.stdout : stdoutLines.slice(0, COLLAPSED_THRESHOLD).join('\n')
  const showStderr = expanded && result.stderr

  return (
    <div className="tool-card">
      <div className="tool-card-header bg-neutral-900">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="shrink-0 font-mono text-xs text-green-500">$</span>
          <span className="truncate font-mono text-xs text-neutral-300">{getCommandPreview(result)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {result.interrupted && (
            <span className="rounded border border-red-700/40 bg-red-900/40 px-1.5 py-0.5 text-[10px] text-red-400">
              interrupted
            </span>
          )}
        </div>
      </div>

      <div className="terminal-body overflow-x-auto rounded-b-lg border border-neutral-800 bg-[#0c0c0c]">
        {visibleStdout && (
          <pre className="px-3 py-2 font-mono text-xs leading-5 break-all whitespace-pre-wrap text-neutral-300">
            {visibleStdout}
          </pre>
        )}

        {result.stderr && !expanded && (
          <div className="border-t border-neutral-800/50 px-3 py-1 text-[10px] text-amber-400/70">
            stderr: {stderrLines.length} line{stderrLines.length !== 1 ? 's' : ''} (expand to view)
          </div>
        )}
        {showStderr && (
          <pre className="border-t border-neutral-800/50 px-3 py-2 font-mono text-xs leading-5 break-all whitespace-pre-wrap text-amber-400/80">
            {result.stderr}
          </pre>
        )}

        {!result.stdout && !result.stderr && (
          <div className="px-3 py-2 text-xs text-neutral-600 italic">No output</div>
        )}

        {shouldCollapse && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full border-t border-neutral-800/50 bg-neutral-900/30 px-3 py-1.5 text-[10px] text-neutral-500 transition-colors hover:text-neutral-300"
          >
            {expanded ? '▲ Collapse' : `▼ Show all (${totalLines} lines)`}
          </button>
        )}
      </div>
    </div>
  )
})

function getCommandPreview(result: BashToolResult): string {
  // Bash results don't store the command directly — we show first line of stdout as a fallback
  // The command will be shown via ToolInvocationBadge on the assistant message
  const firstLine = result.stdout?.split('\n')[0] || result.stderr?.split('\n')[0] || ''
  return firstLine.length > 120 ? `${firstLine.slice(0, 120)  }...` : firstLine || '(no output)'
}
