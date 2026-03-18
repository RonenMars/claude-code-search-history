import { useState, type JSX } from 'react'
import type { Profile } from '../../../shared/types'

interface ProfilePickerModalProps {
  profiles: Profile[]
  onSelect: (profile: Profile, remember: boolean) => void
  onCancel: () => void
}

export default function ProfilePickerModal({ profiles, onSelect, onCancel }: ProfilePickerModalProps): JSX.Element {
  const [remember, setRemember] = useState(false)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div className="bg-claude-dark w-120 rounded-xl border border-neutral-700 p-6 shadow-2xl">
        <h2 className="mb-1 text-sm font-semibold text-neutral-200">Start New Chat</h2>
        <p className="mb-5 text-xs text-neutral-500">Select which Claude profile to use</p>

        <div className="mb-5 grid grid-cols-2 gap-3">
          {profiles.filter((p) => p.enabled).map((profile) => (
            <button
              key={profile.id}
              onClick={() => onSelect(profile, remember)}
              className="hover:border-claude-orange group flex flex-col items-start rounded-lg border border-neutral-700 bg-neutral-900 p-4 text-left transition-colors hover:bg-neutral-800"
            >
              <div className="mb-2 flex items-center gap-2">
                <span className="text-base">{profile.emoji}</span>
                <span className="text-sm font-medium text-neutral-200 group-hover:text-white">{profile.label}</span>
              </div>
              <div className="font-mono text-[10px] text-neutral-600">{profile.configDir}</div>
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <label className="flex cursor-pointer items-center gap-2 select-none">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="accent-claude-orange h-3.5 w-3.5 rounded"
            />
            <span className="text-xs text-neutral-500">Remember my choice</span>
          </label>
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-xs text-neutral-500 transition-colors hover:text-neutral-300"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
