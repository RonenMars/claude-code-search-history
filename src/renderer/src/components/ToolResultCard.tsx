import { memo } from 'react'
import type { ToolResult } from '../../../shared/types'
import EditDiffCard from './tool-cards/EditDiffCard'
import BashTerminalCard from './tool-cards/BashTerminalCard'
import ReadFileCard from './tool-cards/ReadFileCard'
import WriteFileCard from './tool-cards/WriteFileCard'
import GlobResultCard from './tool-cards/GlobResultCard'
import GrepResultCard from './tool-cards/GrepResultCard'
import { GenericToolCard, TaskAgentCard, TaskCreateCard, TaskUpdateCard } from './tool-cards/GenericToolCard'

interface ToolResultCardProps {
  results: ToolResult[]
}

export default memo(function ToolResultCard({ results }: ToolResultCardProps) {
  return (
    <div className="space-y-2">
      {results.map((result, i) => (
        <ToolResultDispatch key={i} result={result} />
      ))}
    </div>
  )
})

function ToolResultDispatch({ result }: { result: ToolResult }) {
  switch (result.type) {
    case 'edit':
      return <EditDiffCard result={result} />
    case 'bash':
      return <BashTerminalCard result={result} />
    case 'read':
      return <ReadFileCard result={result} />
    case 'write':
      return <WriteFileCard result={result} />
    case 'glob':
      return <GlobResultCard result={result} />
    case 'grep':
      return <GrepResultCard result={result} />
    case 'taskAgent':
      return <TaskAgentCard result={result} />
    case 'taskCreate':
      return <TaskCreateCard result={result} />
    case 'taskUpdate':
      return <TaskUpdateCard result={result} />
    case 'generic':
      return <GenericToolCard result={result} />
    default:
      return null
  }
}
