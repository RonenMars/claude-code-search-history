import { useState } from 'react'
import type { Profile } from '../../../shared/types'

const PRESET_EMOJIS = ['🤖', '💼', '🏠', '🎯', '🔬', '🎨', '⚡', '🌍', '🛠️', '📚', '🚀', '🎮']

interface ProfileEditModalProps {
  profile: Profile | null  // null = creating new
  isOnlyEnabled?: boolean  // when true, disable the enabled toggle
  onSave: (profile: Profile) => void
  onCancel: () => void
}

function generateId(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Math.random().toString(36).slice(2, 6)
}

export default function ProfileEditModal({ profile, isOnlyEnabled, onSave, onCancel }: ProfileEditModalProps): JSX.Element {
  const isNew = profile === null
  const [label, setLabel] = useState(profile?.label ?? '')
  const [emoji, setEmoji] = useState(profile?.emoji ?? '🤖')
  const [configDir, setConfigDir] = useState(profile?.configDir ?? '~/.claude')
  const [enabled, setEnabled] = useState(profile?.enabled ?? true)

  const handleBrowse = async (): Promise<void> => {
    const dir = await window.electronAPI.selectDirectory()
    if (dir) setConfigDir(dir)
  }

  const handleSave = (): void => {
    if (!label.trim()) return
    onSave({
      id: profile?.id ?? generateId(label),
      label: label.trim(),
      emoji,
      configDir: configDir.trim(),
      enabled
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div className="bg-claude-dark border border-neutral-700 rounded-xl shadow-2xl w-[420px] p-6">
        <h2 className="text-sm font-semibold text-neutral-200 mb-4">
          {isNew ? 'Add Profile' : 'Edit Profile'}
        </h2>

        {/* Emoji picker */}
        <div className="mb-4">
          <label className="block text-xs text-neutral-500 mb-2">Emoji</label>
          <div className="flex flex-wrap gap-2">
            {PRESET_EMOJIS.map((e) => (
              <button
                key={e}
                onClick={() => setEmoji(e)}
                className={`text-lg w-9 h-9 flex items-center justify-center rounded border transition-colors ${
                  emoji === e
                    ? 'border-claude-orange bg-claude-orange/10'
                    : 'border-neutral-700 hover:border-neutral-500'
                }`}
              >
                {e}
              </button>
            ))}
          </div>
        </div>

        {/* Label */}
        <div className="mb-4">
          <label className="block text-xs text-neutral-500 mb-1">Label</label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Work, Personal, Freelance"
            className="w-full bg-neutral-900 border border-neutral-700 rounded px-3 py-2 text-sm text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-neutral-500"
          />
        </div>

        {/* Config dir */}
        <div className="mb-4">
          <label className="block text-xs text-neutral-500 mb-1">Config directory (CLAUDE_CONFIG_DIR)</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={configDir}
              onChange={(e) => setConfigDir(e.target.value)}
              placeholder="~/.claude"
              className="flex-1 bg-neutral-900 border border-neutral-700 rounded px-3 py-2 text-sm text-neutral-200 font-mono placeholder-neutral-600 focus:outline-none focus:border-neutral-500"
            />
            <button
              onClick={handleBrowse}
              className="text-xs text-neutral-400 hover:text-neutral-200 border border-neutral-700 hover:border-neutral-500 rounded px-3 py-2 transition-colors"
            >
              Browse…
            </button>
          </div>
        </div>

        {/* Enabled toggle */}
        <div className="mb-6 flex items-center gap-3">
          <button
            onClick={() => !isOnlyEnabled && setEnabled((v) => !v)}
            disabled={isOnlyEnabled}
            className={`w-9 h-5 rounded-full transition-colors ${enabled ? 'bg-claude-orange' : 'bg-neutral-700'} ${isOnlyEnabled ? 'opacity-40 cursor-not-allowed' : ''}`}
            role="switch"
            aria-checked={enabled}
            title={isOnlyEnabled ? 'Cannot disable the only enabled profile' : undefined}
          >
            <span
              className={`block w-3 h-3 bg-white rounded-full m-1 transition-transform ${enabled ? 'translate-x-4' : 'translate-x-0'}`}
            />
          </button>
          <span className="text-xs text-neutral-400">
            Profile enabled{isOnlyEnabled ? ' (required — only active profile)' : ''}
          </span>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors px-3 py-1.5"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!label.trim()}
            className="text-xs text-white bg-claude-orange hover:bg-orange-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors px-4 py-1.5 rounded"
          >
            {isNew ? 'Add Profile' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
