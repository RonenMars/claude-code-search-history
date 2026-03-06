import type { Profile } from '../../../shared/types'

interface ProfileUsage {
  conversations: number
  lastUsed: string | null
  tokensThisMonth: number
}

interface ProfileCardProps {
  profile: Profile
  usage: ProfileUsage | null
  isOnly: boolean  // disable delete when true
  onFilter: () => void
  onEdit: () => void
  onDelete: () => void
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
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
  if (diffD < 7) return `${diffD} days ago`
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

export default function ProfileCard({ profile, usage, isOnly, onFilter, onEdit, onDelete }: ProfileCardProps): JSX.Element {
  const tokens = usage?.tokensThisMonth ?? 0

  return (
    <div className="bg-neutral-900 border border-neutral-700 rounded-lg p-4 flex flex-col gap-3">
      {/* Header row */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">{profile.emoji}</span>
          <div>
            <div className="text-sm font-medium text-neutral-200">{profile.label}</div>
            <div className="text-[10px] font-mono text-neutral-600 mt-0.5">{profile.configDir}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
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

      {/* Stats */}
      <div className="border-t border-neutral-800 pt-3 flex flex-col gap-1">
        {usage ? (
          <>
            <div className="text-xs text-neutral-400">
              <span className="font-medium text-neutral-300">{usage.conversations}</span> conversations
            </div>
            <div className="text-xs text-neutral-500">
              Last used: {formatLastUsed(usage.lastUsed)}
            </div>
            {tokens > 0 && (
              <div className="text-xs text-neutral-500">
                This month: <span className="font-medium text-neutral-400">{formatTokens(tokens)}</span> tokens
              </div>
            )}
          </>
        ) : (
          <div className="text-xs text-neutral-600 animate-pulse">Loading stats…</div>
        )}
      </div>

      {/* Filter link */}
      <button
        onClick={onFilter}
        className="text-xs text-claude-orange hover:text-orange-300 transition-colors text-left"
      >
        Filter conversations to this profile →
      </button>
    </div>
  )
}
