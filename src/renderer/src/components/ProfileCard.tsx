import type { Profile } from '../../../shared/types'

interface ProfileUsage {
  conversations: number
  lastUsed: string | null
  tokensThisMonth: number
  messages: number
  projects: number
}

interface ProfileCardProps {
  profile: Profile
  usage: ProfileUsage | null
  isOnly: boolean
  onFilter: () => void
  onEdit: () => void
  onDelete: () => void
}

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function formatLastUsed(iso: string | null): string {
  if (!iso) return 'Never used'
  const date = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffH = Math.floor(diffMs / (1000 * 60 * 60))
  const diffD = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (diffH < 1) return 'Just now'
  if (diffH < 24) return `${diffH}h ago`
  if (diffD === 1) return 'Yesterday'
  if (diffD < 7) return `${diffD}d ago`
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

interface StatBoxProps {
  label: string
  value: string
  icon: React.ReactNode
}

function StatBox({ label, value, icon }: StatBoxProps): JSX.Element {
  return (
    <div className="bg-neutral-800/60 rounded-lg px-3 py-2.5 flex flex-col gap-1 min-w-0">
      <div className="flex items-center gap-1.5 text-neutral-500">
        {icon}
        <span className="text-[10px] uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-lg font-semibold text-neutral-200 leading-none">{value}</div>
    </div>
  )
}

export default function ProfileCard({ profile, usage, isOnly, onFilter, onEdit, onDelete }: ProfileCardProps): JSX.Element {
  return (
    <div className="bg-neutral-900 border border-neutral-700 rounded-xl p-4 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{profile.emoji}</span>
          <div>
            <div className="text-sm font-semibold text-neutral-200">{profile.label}</div>
            <div className="text-[10px] font-mono text-neutral-600 mt-0.5 truncate max-w-[200px]" title={profile.configDir}>
              {profile.configDir}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={onEdit}
            className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors px-2 py-1 border border-neutral-700 hover:border-neutral-500 rounded"
          >
            Edit
          </button>
          <button
            onClick={onDelete}
            disabled={isOnly}
            title={isOnly ? 'Must have at least one profile' : 'Delete profile'}
            className="text-xs text-neutral-500 hover:text-red-400 transition-colors px-2 py-1 border border-neutral-700 hover:border-red-800 rounded disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:text-neutral-500 disabled:hover:border-neutral-700"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Stats grid */}
      {usage ? (
        <div className="grid grid-cols-2 gap-2">
          <StatBox
            label="Projects"
            value={formatNum(usage.projects)}
            icon={
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
              </svg>
            }
          />
          <StatBox
            label="Sessions"
            value={formatNum(usage.conversations)}
            icon={
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            }
          />
          <StatBox
            label="Messages"
            value={formatNum(usage.messages)}
            icon={
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h6m-6 4h4" />
              </svg>
            }
          />
          <StatBox
            label="Tokens / mo"
            value={usage.tokensThisMonth > 0 ? formatNum(usage.tokensThisMonth) : '—'}
            icon={
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="bg-neutral-800/60 rounded-lg px-3 py-2.5 h-14 animate-pulse" />
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-neutral-800 pt-3">
        <span className="text-[11px] text-neutral-600">
          {usage ? formatLastUsed(usage.lastUsed) : '—'}
        </span>
        <button
          onClick={onFilter}
          className="text-xs text-claude-orange hover:text-orange-300 transition-colors"
        >
          Filter conversations →
        </button>
      </div>
    </div>
  )
}
