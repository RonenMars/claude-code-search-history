import { useState, useEffect, type JSX } from 'react'
import ProfileCard from './ProfileCard'
import ProfileEditModal from './ProfileEditModal'
import type { Profile } from '../../../shared/types'

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
  const scannableCount = profiles.filter((p) => p.enabled && p.scanHistory !== false).length

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
      <div className="flex items-center justify-between border-b border-neutral-800 px-6 py-4">
        <div>
          <h1 className="text-sm font-semibold text-neutral-200">Profiles</h1>
          <p className="mt-0.5 text-xs text-neutral-500">
            Each profile uses a separate CLAUDE_CONFIG_DIR — independent auth, history, and memory.
          </p>
        </div>
        <button
          onClick={() => setEditingProfile('new')}
          className="flex items-center gap-1 rounded border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 transition-colors hover:border-neutral-500 hover:text-white"
        >
          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Profile
        </button>
      </div>

      {/* Cards grid */}
      <div className="p-6">
        {saving && (
          <div className="mb-4 animate-pulse text-xs text-neutral-500">Saving and rebuilding index…</div>
        )}
        {profiles.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-sm text-neutral-600">
            No profiles configured.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
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
          isOnlyScannable={editingProfile !== 'new' && editingProfile !== null && scannableCount <= 1 && editingProfile.scanHistory !== false}
          onSave={handleSaveEdit}
          onCancel={() => setEditingProfile(null)}
        />
      )}
    </div>
  )
}
