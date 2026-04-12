import { memo, useMemo, type JSX } from 'react'
import type { ActiveSession, SessionStatus } from '../../../shared/types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function basename(p: string): string {
  return p.replace(/\\/g, '/').split('/').filter(Boolean).pop() ?? p
}

function formatElapsed(ms: number): string {
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`
  return `${(ms / 3_600_000).toFixed(1)}h`
}

// ─── Column config ────────────────────────────────────────────────────────────

interface Column {
  status: SessionStatus
  label: string
  emptyText: string
  headerClass: string
  dotClass: string
}

const COLUMNS: Column[] = [
  {
    status: 'running',
    label: 'Running',
    emptyText: 'No sessions currently running.',
    headerClass: 'text-green-400 border-green-500/30',
    dotClass: 'bg-green-500 animate-pulse',
  },
  {
    status: 'waiting_input',
    label: 'Waiting for Input',
    emptyText: 'No sessions awaiting input.',
    headerClass: 'text-claude-orange border-claude-orange/30',
    dotClass: 'bg-claude-orange animate-pulse',
  },
  {
    status: 'completed',
    label: 'Completed',
    emptyText: 'No completed sessions yet.',
    headerClass: 'text-neutral-400 border-neutral-600',
    dotClass: 'bg-neutral-500',
  },
  {
    status: 'failed',
    label: 'Failed',
    emptyText: 'No failed sessions.',
    headerClass: 'text-red-400 border-red-500/30',
    dotClass: 'bg-red-500',
  },
]

// ─── SessionCard ──────────────────────────────────────────────────────────────

interface SessionCardProps {
  session: ActiveSession
  isWaiting: boolean
  onClick: (sessionId: string) => void
}

const SessionCard = memo(function SessionCard({ session, isWaiting, onClick }: SessionCardProps): JSX.Element {
  const projectName = basename(session.projectPath)

  return (
    <button
      type="button"
      onClick={() => onClick(session.instanceId)}
      className={[
        'w-full rounded-lg border bg-neutral-900 p-3 text-left transition-all',
        'min-h-[64px] touch-manipulation',
        'hover:bg-neutral-800 active:scale-[0.98]',
        isWaiting
          ? 'border-claude-orange/60 shadow-[0_0_0_1px_rgba(var(--color-claude-orange),0.2)]'
          : 'border-neutral-700/60',
      ].join(' ')}
    >
      {/* Header row: project name + badges */}
      <div className="flex items-start justify-between gap-2">
        <span className="truncate font-mono text-sm font-medium text-neutral-200" title={session.projectPath}>
          {projectName}
        </span>
        <div className="flex shrink-0 items-center gap-1">
          {session.branch && (
            <span className="rounded bg-neutral-800 px-1.5 py-0.5 font-mono text-[10px] text-neutral-400 border border-neutral-700">
              {session.branch}
            </span>
          )}
          {session.machineName && (
            <span className="rounded bg-blue-900/30 px-1.5 py-0.5 text-[10px] text-blue-400 border border-blue-700/30">
              {session.machineName}
            </span>
          )}
        </div>
      </div>

      {/* Last output snippet */}
      {session.lastOutput && (
        <p className="mt-1.5 line-clamp-2 font-mono text-[11px] text-neutral-500 leading-relaxed">
          {session.lastOutput}
        </p>
      )}

      {/* Footer row: elapsed + prompt count */}
      <div className="mt-2 flex items-center gap-3 text-[10px] text-neutral-600">
        <span title="Elapsed time">{formatElapsed(session.elapsedMs)}</span>
        {session.promptCount > 0 && (
          <span title="Prompt count">{session.promptCount} prompts</span>
        )}
        {isWaiting && (
          <span className="text-claude-orange ml-auto font-medium">Needs input</span>
        )}
      </div>
    </button>
  )
})

// ─── KanbanColumn ─────────────────────────────────────────────────────────────

interface KanbanColumnProps {
  column: Column
  sessions: ActiveSession[]
  onCardClick: (sessionId: string) => void
}

const KanbanColumn = memo(function KanbanColumn({ column, sessions, onCardClick }: KanbanColumnProps): JSX.Element {
  const isWaiting = column.status === 'waiting_input'

  return (
    <div className="flex min-w-[260px] flex-1 flex-col snap-start">
      {/* Column header */}
      <div className={`flex items-center gap-2 border-b px-1 pb-2 mb-3 ${column.headerClass}`}>
        <div className={`h-2 w-2 rounded-full ${column.dotClass}`} />
        <span className="text-xs font-semibold uppercase tracking-wide">
          {column.label}
        </span>
        <span className="ml-auto text-xs font-mono text-neutral-600">
          {sessions.length}
        </span>
      </div>

      {/* Cards */}
      <div className="flex flex-col gap-2 overflow-y-auto">
        {sessions.length === 0 ? (
          <div className="rounded-lg border border-dashed border-neutral-800 p-4 text-center text-xs text-neutral-600">
            {column.emptyText}
          </div>
        ) : (
          sessions.map((s) => (
            <SessionCard
              key={s.instanceId}
              session={s}
              isWaiting={isWaiting}
              onClick={onCardClick}
            />
          ))
        )}
      </div>
    </div>
  )
})

// ─── KanbanBoard ──────────────────────────────────────────────────────────────

export interface KanbanBoardProps {
  sessions: ActiveSession[]
  onSelectSession: (instanceId: string) => void
}

export default function KanbanBoard({ sessions, onSelectSession }: KanbanBoardProps): JSX.Element {
  const byStatus = useMemo(() => {
    const map: Record<SessionStatus, ActiveSession[]> = {
      running: [],
      waiting_input: [],
      completed: [],
      failed: [],
      idle: [],
    }
    for (const s of sessions) {
      const bucket = map[s.status]
      if (bucket) bucket.push(s)
    }
    return map
  }, [sessions])

  return (
    <div
      className={[
        'h-full overflow-x-auto overflow-y-hidden',
        // Mobile: horizontal scroll snapping
        'flex snap-x snap-mandatory gap-4 p-4',
        // Tablet+: wrap into a proper grid
        'md:snap-none md:overflow-x-visible md:overflow-y-auto',
        'md:grid md:grid-cols-2 lg:grid-cols-4 md:flex-none',
      ].join(' ')}
    >
      {COLUMNS.map((col) => (
        <KanbanColumn
          key={col.status}
          column={col}
          sessions={col.status === 'idle' ? [] : byStatus[col.status]}
          onCardClick={onSelectSession}
        />
      ))}
    </div>
  )
}
