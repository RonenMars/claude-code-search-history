import { useState, useEffect } from 'react'
import type { Profile } from '../../../shared/types'
import ProfileCard from './ProfileCard'
import ProfileEditModal from './ProfileEditModal'

interface ProfileUsage {
  conversations: number
  lastUsed: string | null
  tokensThisMonth: number
  messages: number
  projects: number
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
    // Prevent disabling the last enabled profile
    const isCurrentlyEnabled = editingProfile !== 'new' && editingProfile?.enabled
    const wouldDisable = isCurrentlyEnabled && !updated.enabled
    const wouldBeZeroEnabled = wouldDisable && enabledCount <= 1
    if (wouldBeZeroEnabled) return  // guard: silently ignore (button is disabled in modal via prop)

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
    <div className="bg-claude-darker">
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
      <div className="p-6">
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
          isOnlyEnabled={editingProfile !== 'new' && editingProfile !== null && enabledCount <= 1 && editingProfile.enabled}
          onSave={handleSaveEdit}
          onCancel={() => setEditingProfile(null)}
        />
      )}
    </div>
  )
}
