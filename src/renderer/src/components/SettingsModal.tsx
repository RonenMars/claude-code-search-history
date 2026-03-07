import { useState, useCallback } from 'react'
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
  const [groupByProject, setGroupByProject] = useState(settings.groupByProject)

  const handleMaxChange = useCallback((value: number) => {
    const clamped = Math.min(10, Math.max(1, value))
    setMaxChatInstances(clamped)
    onSave({ maxChatInstances: clamped })
  }, [onSave])

  const handleGroupByProjectChange = useCallback((checked: boolean) => {
    setGroupByProject(checked)
    onSave({ groupByProject: checked })
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

      {/* Display section */}
      <div className="px-8 py-5 border-b border-neutral-800">
        <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-4">Display</h3>
        <div className="flex items-center justify-between max-w-xl">
          <div>
            <p className="text-sm text-neutral-200">Group conversations by project</p>
            <p className="text-xs text-neutral-500 mt-0.5">Show conversations grouped under their project path</p>
          </div>
          <button
            role="switch"
            aria-checked={groupByProject}
            onClick={() => handleGroupByProjectChange(!groupByProject)}
            className={`relative inline-flex h-6 w-10 shrink-0 items-center rounded-full transition-colors ${groupByProject ? 'bg-claude-orange' : 'bg-neutral-700'}`}
          >
            <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${groupByProject ? 'translate-x-5' : 'translate-x-1.5'}`} />
          </button>
        </div>
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
