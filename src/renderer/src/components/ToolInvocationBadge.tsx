import { memo } from 'react'
import type { ToolUseBlock } from '../../../shared/types'

interface ToolInvocationBadgeProps {
  blocks: ToolUseBlock[]
}

export default memo(function ToolInvocationBadge({ blocks }: ToolInvocationBadgeProps) {
  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
      {blocks.map((block) => (
        <span
          key={block.id}
          className="inline-flex items-center gap-1 rounded border border-neutral-700/60 bg-neutral-800/80 px-1.5 py-0.5 font-mono text-[10px] text-neutral-400"
          title={JSON.stringify(block.input, null, 2)}
        >
          {getToolIcon(block.name)}
          <span className="text-neutral-300">{getShortToolName(block.name)}</span>
          {getKeyParam(block) && (
            <span className="max-w-50 truncate text-neutral-500">{getKeyParam(block)}</span>
          )}
        </span>
      ))}
    </div>
  )
})

function getShortToolName(name: string): string {
  // MCP tools have long names like mcp__plugin_serena_serena__find_symbol
  if (name.startsWith('mcp__')) {
    const parts = name.split('__')
    return parts[parts.length - 1] || name
  }
  return name
}

function getKeyParam(block: ToolUseBlock): string {
  const input = block.input
  const name = block.name

  if (name === 'Edit' || name === 'Read' || name === 'Write') {
    const fp = input.file_path as string | undefined
    if (fp) return basename(fp)
  }

  if (name === 'Bash') {
    const cmd = input.command as string | undefined
    if (cmd) return cmd.length > 40 ? `${cmd.slice(0, 40)  }...` : cmd
  }

  if (name === 'Glob') {
    return (input.pattern as string) || ''
  }

  if (name === 'Grep') {
    return (input.pattern as string) || ''
  }

  if (name === 'Task') {
    return (input.description as string) || ''
  }

  // For MCP tools, try common parameter names
  if (input.relative_path) return basename(input.relative_path as string)
  if (input.name_path_pattern) return input.name_path_pattern as string
  if (input.file_path) return basename(input.file_path as string)

  return ''
}

function basename(path: string): string {
  return path.split('/').pop() || path
}

function getToolIcon(name: string): string {
  switch (name) {
    case 'Edit': return '✏️'
    case 'Read': return '📖'
    case 'Write': return '📝'
    case 'Bash': return '⚡'
    case 'Glob': return '🔍'
    case 'Grep': return '🔎'
    case 'Task': return '🤖'
    case 'TaskCreate': return '📋'
    case 'TaskUpdate': return '✅'
    case 'EnterPlanMode': return '📐'
    case 'ExitPlanMode': return '🚀'
    default:
      if (name.startsWith('mcp__')) return '🔧'
      return '⚙️'
  }
}
