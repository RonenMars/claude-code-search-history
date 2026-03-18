import { useState, useCallback, type JSX } from 'react'
import ProfilesPanel from './ProfilesPanel'
import SystemStats from './SystemStats'
import type { AppSettings, Profile } from '../../../shared/types'

interface SettingsModalProps {
  settings: AppSettings
  onSave: (settings: Partial<AppSettings>) => void
  profiles: Profile[]
  onFilterByProfile: (profileId: string | null) => void
  onProfilesSaved: (profiles: Profile[]) => Promise<void>
  onClose: () => void
  defaultProfileId: string | null
  onClearDefaultProfile: () => void
}

export default function SettingsModal({ settings, onSave, profiles, onFilterByProfile, onProfilesSaved, onClose, defaultProfileId, onClearDefaultProfile }: SettingsModalProps): JSX.Element {
  const [maxChatInstances, setMaxChatInstances] = useState(settings.maxChatInstances)
  const [profilesDir, setProfilesDir] = useState(settings.profilesDir ?? '')

  const handleMaxChange = useCallback((value: number) => {
    const clamped = Math.min(10, Math.max(1, value))
    setMaxChatInstances(clamped)
    onSave({ maxChatInstances: clamped })
  }, [onSave])

  const defaultProfile = defaultProfileId ? profiles.find((p) => p.id === defaultProfileId) : null

  return (
    <div className="bg-claude-darker h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-800 px-8 py-6">
        <h2 className="text-sm font-semibold text-neutral-200">Settings</h2>
        <button
          onClick={onClose}
          className="text-neutral-500 transition-colors hover:text-neutral-300"
          title="Close settings"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Chat section */}
      <div className="border-b border-neutral-800 px-8 py-5">
        <h3 className="mb-4 text-xs font-semibold tracking-wider text-neutral-400 uppercase">Chat</h3>
        <div className="mb-4 flex max-w-xl items-center justify-between">
          <div>
            <p className="text-sm text-neutral-200">Max simultaneous instances</p>
            <p className="mt-0.5 text-xs text-neutral-500">How many Claude Code sessions can run at once</p>
          </div>
          <input
            type="number"
            min={1}
            max={10}
            value={maxChatInstances}
            onChange={(e) => handleMaxChange(parseInt(e.target.value, 10) || 1)}
            className="focus:border-claude-orange w-16 rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-center text-sm text-neutral-200 focus:outline-none"
          />
        </div>
        <div className="flex max-w-xl items-center justify-between">
          <div>
            <p className="text-sm text-neutral-200">Default chat profile</p>
            <p className="mt-0.5 text-xs text-neutral-500">Skip the profile picker and always use this profile</p>
          </div>
          {defaultProfile ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-neutral-300">{defaultProfile.emoji} {defaultProfile.label}</span>
              <button
                onClick={onClearDefaultProfile}
                className="text-xs text-neutral-500 transition-colors hover:text-red-400"
                title="Clear default profile"
              >
                Clear
              </button>
            </div>
          ) : (
            <span className="text-xs text-neutral-600">None — picker shown each time</span>
          )}
        </div>
      </div>

      {/* Storage section */}
      <div className="border-b border-neutral-800 px-8 py-5">
        <h3 className="mb-4 text-xs font-semibold tracking-wider text-neutral-400 uppercase">Storage</h3>
        <div className="flex max-w-xl items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-sm text-neutral-200">Profiles folder</p>
            <p className="mt-0.5 text-xs text-neutral-500">Folder containing <code className="text-neutral-400">profiles.json</code>. Shared across all Claude Code apps.</p>
            <p className="mt-1 text-xs text-neutral-600">Default: ~/.config/threadbase</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <input
              type="text"
              readOnly
              value={profilesDir}
              placeholder="~/.config/threadbase"
              className="w-52 cursor-default truncate rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-xs text-neutral-400 focus:outline-none"
              title={profilesDir || '~/.config/threadbase'}
            />
            <button
              onClick={async () => {
                const dir = await window.electronAPI.selectDirectory()
                if (dir) {
                  setProfilesDir(dir)
                  onSave({ profilesDir: dir })
                }
              }}
              className="rounded-md border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-xs whitespace-nowrap text-neutral-300 transition-colors hover:bg-neutral-700"
            >
              Browse…
            </button>
            {profilesDir && (
              <button
                onClick={() => {
                  setProfilesDir('')
                  onSave({ profilesDir: '' })
                }}
                className="text-xs text-neutral-600 transition-colors hover:text-red-400"
                title="Reset to default"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* System Stats section */}
      <div className="border-b border-neutral-800 px-8 py-5">
        <h3 className="mb-4 text-xs font-semibold tracking-wider text-neutral-400 uppercase">System Stats</h3>
        <SystemStats />
      </div>

      {/* Profiles section */}
      <div>
        <ProfilesPanel
          profiles={profiles}
          onFilterByProfile={onFilterByProfile}
          onProfilesSaved={onProfilesSaved}
        />
      </div>
    </div>
  )
}
