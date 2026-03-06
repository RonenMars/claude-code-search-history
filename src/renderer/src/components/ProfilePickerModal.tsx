import type { Profile } from '../../../shared/types'

interface ProfilePickerModalProps {
  profiles: Profile[]
  onSelect: (profile: Profile) => void
  onCancel: () => void
}

export default function ProfilePickerModal({ profiles, onSelect, onCancel }: ProfilePickerModalProps): JSX.Element {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div className="bg-claude-dark border border-neutral-700 rounded-xl shadow-2xl w-[480px] p-6">
        <h2 className="text-sm font-semibold text-neutral-200 mb-1">Start New Chat</h2>
        <p className="text-xs text-neutral-500 mb-5">Select which Claude profile to use</p>

        <div className="grid grid-cols-2 gap-3 mb-5">
          {profiles.filter((p) => p.enabled).map((profile) => (
            <button
              key={profile.id}
              onClick={() => onSelect(profile)}
              className="flex flex-col items-start text-left p-4 bg-neutral-900 border border-neutral-700 hover:border-claude-orange hover:bg-neutral-800 rounded-lg transition-colors group"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-base">{profile.emoji}</span>
                <span className="text-sm font-medium text-neutral-200 group-hover:text-white">{profile.label}</span>
              </div>
              <div className="text-[10px] font-mono text-neutral-600">{profile.configDir}</div>
            </button>
          ))}
        </div>

        <div className="flex justify-end">
          <button
            onClick={onCancel}
            className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors px-3 py-1.5"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
