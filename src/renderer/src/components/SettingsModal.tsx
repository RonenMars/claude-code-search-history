import { useState, useCallback } from 'react'
import type { AppSettings, Profile } from '../../../shared/types'
import ProfilesPanel from './ProfilesPanel'

interface SettingsModalProps {
  settings: AppSettings
  onSave: (settings: Partial<AppSettings>) => void
  profiles: Profile[]
  onFilterByProfile: (profileId: string | null) => void
  onProfilesSaved: (profiles: Profile[]) => Promise<void>
}

export default function SettingsModal({ settings, onSave, profiles, onFilterByProfile, onProfilesSaved }: SettingsModalProps): JSX.Element {
  const [maxChatInstances, setMaxChatInstances] = useState(settings.maxChatInstances)

  const handleMaxChange = useCallback((value: number) => {
    const clamped = Math.min(10, Math.max(1, value))
    setMaxChatInstances(clamped)
    onSave({ maxChatInstances: clamped })
  }, [onSave])

  return (
    <div className="h-full flex flex-col bg-claude-darker">
      {/* Header */}
      <div className="px-8 py-6 border-b border-neutral-800 flex-shrink-0">
        <h2 className="text-sm font-semibold text-neutral-200">Settings</h2>
      </div>

      {/* Chat section */}
      <div className="px-8 py-5 border-b border-neutral-800 flex-shrink-0">
        <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-4">Chat</h3>
        <div className="flex items-center justify-between max-w-xl">
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
      </div>

      {/* Profiles section — fills remaining space */}
      <div className="flex-1 overflow-hidden">
        <ProfilesPanel
          profiles={profiles}
          onFilterByProfile={onFilterByProfile}
          onProfilesSaved={onProfilesSaved}
        />
      </div>
    </div>
  )
}
