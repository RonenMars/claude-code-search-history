import { useState, useCallback, type JSX } from 'react'
import type { AppSettings, Profile } from '../../../shared/types'
import ProfilesPanel from './ProfilesPanel'
import SystemStats from './SystemStats'

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
    <div className="h-full overflow-y-auto bg-claude-darker">
      {/* Header */}
      <div className="px-8 py-6 border-b border-neutral-800 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-neutral-200">Settings</h2>
        <button
          onClick={onClose}
          className="text-neutral-500 hover:text-neutral-300 transition-colors"
          title="Close settings"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Chat section */}
      <div className="px-8 py-5 border-b border-neutral-800">
        <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-4">Chat</h3>
        <div className="flex items-center justify-between max-w-xl mb-4">
          <div>
            <p className="text-sm text-neutral-200">Max simultaneous instances</p>
            <p className="text-xs text-neutral-500 mt-0.5">How many Claude Code sessions can run at once</p>
          </div>
          <input
            type="number"
            min={1}
            max={10}
            value={maxChatInstances}
            onChange={(e) => handleMaxChange(parseInt(e.target.value, 10) || 1)}
            className="w-16 text-center bg-neutral-900 border border-neutral-700 rounded-md px-2 py-1.5 text-sm text-neutral-200 focus:outline-none focus:border-claude-orange"
          />
        </div>
        <div className="flex items-center justify-between max-w-xl">
          <div>
            <p className="text-sm text-neutral-200">Default chat profile</p>
            <p className="text-xs text-neutral-500 mt-0.5">Skip the profile picker and always use this profile</p>
          </div>
          {defaultProfile ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-neutral-300">{defaultProfile.emoji} {defaultProfile.label}</span>
              <button
                onClick={onClearDefaultProfile}
                className="text-xs text-neutral-500 hover:text-red-400 transition-colors"
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
      <div className="px-8 py-5 border-b border-neutral-800">
        <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-4">Storage</h3>
        <div className="flex items-start justify-between max-w-xl gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-sm text-neutral-200">Profiles folder</p>
            <p className="text-xs text-neutral-500 mt-0.5">Folder containing <code className="text-neutral-400">profiles.json</code>. Shared across all Claude Code apps.</p>
            <p className="text-xs text-neutral-600 mt-1">Default: ~/.config/threadbase</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <input
              type="text"
              readOnly
              value={profilesDir}
              placeholder="~/.config/threadbase"
              className="w-52 bg-neutral-900 border border-neutral-700 rounded-md px-2 py-1.5 text-xs text-neutral-400 focus:outline-none cursor-default truncate"
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
              className="px-3 py-1.5 text-xs bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-md text-neutral-300 transition-colors whitespace-nowrap"
            >
              Browse…
            </button>
            {profilesDir && (
              <button
                onClick={() => {
                  setProfilesDir('')
                  onSave({ profilesDir: '' })
                }}
                className="text-xs text-neutral-600 hover:text-red-400 transition-colors"
                title="Reset to default"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* System Stats section */}
      <div className="px-8 py-5 border-b border-neutral-800">
        <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-4">System Stats</h3>
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
