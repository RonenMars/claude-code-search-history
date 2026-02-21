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
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-green-500 font-mono text-xs shrink-0">$</span>
          <span className="text-neutral-300 font-mono text-xs truncate">{getCommandPreview(result)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {result.interrupted && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-900/40 text-red-400 border border-red-700/40">
              interrupted
            </span>
          )}
        </div>
      </div>

      <div className="terminal-body bg-[#0c0c0c] border border-neutral-800 rounded-b-lg overflow-x-auto">
        {visibleStdout && (
          <pre className="px-3 py-2 font-mono text-xs text-neutral-300 whitespace-pre-wrap break-all leading-5">
            {visibleStdout}
          </pre>
        )}

        {result.stderr && !expanded && (
          <div className="px-3 py-1 text-[10px] text-amber-400/70 border-t border-neutral-800/50">
            stderr: {stderrLines.length} line{stderrLines.length !== 1 ? 's' : ''} (expand to view)
          </div>
        )}
        {showStderr && (
          <pre className="px-3 py-2 font-mono text-xs text-amber-400/80 whitespace-pre-wrap break-all leading-5 border-t border-neutral-800/50">
            {result.stderr}
          </pre>
        )}

        {!result.stdout && !result.stderr && (
          <div className="px-3 py-2 text-xs text-neutral-600 italic">No output</div>
        )}

        {shouldCollapse && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full px-3 py-1.5 text-[10px] text-neutral-500 hover:text-neutral-300 bg-neutral-900/30 border-t border-neutral-800/50 transition-colors"
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
  return firstLine.length > 120 ? firstLine.slice(0, 120) + '...' : firstLine || '(no output)'
}
