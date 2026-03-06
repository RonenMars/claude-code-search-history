import { useState, useEffect } from 'react'
import type { Profile } from '../../../shared/types'
import ProfileCard from './ProfileCard'
import ProfileEditModal from './ProfileEditModal'

interface ProfileUsage {
  conversations: number
  lastUsed: string | null
  tokensThisMonth: number
}

interface ProfilesPanelProps {
  profiles: Profile[]
  onFilterByProfile: (profileId: string | null) => void
  onProfilesSaved: (profiles: Profile[]) => Promise<void>
}

export default function ProfilesPanel({ profiles, onFilterByProfile, onProfilesSaved }: ProfilesPanelProps): JSX.Element {
  const [usage, setUsage] = useState<Record<string, ProfileUsage>>({})
  const [editingProfile, setEditingProfile] = useState<Profile | null | 'new'>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    window.electronAPI.getProfilesUsage()
      .then(setUsage)
      .catch(() => {})
  }, [profiles])

  const enabledCount = profiles.filter((p) => p.enabled).length

  const handleSaveEdit = async (updated: Profile): Promise<void> => {
    setSaving(true)
    let next: Profile[]
    if (editingProfile === 'new') {
      next = [...profiles, updated]
    } else {
      next = profiles.map((p) => (p.id === updated.id ? updated : p))
    }
    setEditingProfile(null)
    await onProfilesSaved(next)
    setSaving(false)
  }

  const handleDelete = async (profileId: string): Promise<void> => {
    const next = profiles.filter((p) => p.id !== profileId)
    await onProfilesSaved(next)
  }

  return (
    <div className="flex flex-col h-full bg-claude-darker">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800">
        <div>
          <h1 className="text-sm font-semibold text-neutral-200">Profiles</h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            Each profile uses a separate CLAUDE_CONFIG_DIR — independent auth, history, and memory.
          </p>
        </div>
        <button
          onClick={() => setEditingProfile('new')}
          className="text-xs text-neutral-300 hover:text-white border border-neutral-700 hover:border-neutral-500 rounded px-3 py-1.5 transition-colors flex items-center gap-1"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Profile
        </button>
      </div>

      {/* Cards grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {saving && (
          <div className="text-xs text-neutral-500 animate-pulse mb-4">Saving and rebuilding index…</div>
        )}
        {profiles.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-neutral-600 text-sm">
            No profiles configured.
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {profiles.map((profile) => (
              <ProfileCard
                key={profile.id}
                profile={profile}
                usage={usage[profile.id] ?? null}
                isOnly={enabledCount <= 1 && profile.enabled}
                onFilter={() => onFilterByProfile(profile.id)}
                onEdit={() => setEditingProfile(profile)}
                onDelete={() => handleDelete(profile.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Edit/Add modal */}
      {editingProfile !== null && (
        <ProfileEditModal
          profile={editingProfile === 'new' ? null : editingProfile}
          onSave={handleSaveEdit}
          onCancel={() => setEditingProfile(null)}
        />
      )}
    </div>
  )
}
