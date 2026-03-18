import { useState, type JSX } from 'react'
import type { Profile } from '../../../shared/types'

const PRESET_EMOJIS = ['🤖', '💼', '🏠', '🎯', '🔬', '🎨', '⚡', '🌍', '🛠️', '📚', '🚀', '🎮']

interface ProfileEditModalProps {
  profile: Profile | null  // null = creating new
  isOnlyEnabled?: boolean  // when true, disable the enabled toggle
  isOnlyScannable?: boolean  // when true, disable the scan history checkbox
  onSave: (profile: Profile) => void
  onCancel: () => void
}

function generateId(label: string): string {
  return `${label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')  }-${  Math.random().toString(36).slice(2, 6)}`
}

export default function ProfileEditModal({ profile, isOnlyEnabled, isOnlyScannable, onSave, onCancel }: ProfileEditModalProps): JSX.Element {
  const isNew = profile === null
  const [label, setLabel] = useState(profile?.label ?? '')
  const [emoji, setEmoji] = useState(profile?.emoji ?? '🤖')
  const [configDir, setConfigDir] = useState(profile?.configDir ?? '~/.claude')
  const [enabled, setEnabled] = useState(profile?.enabled ?? true)
  const [scanHistory, setScanHistory] = useState(profile?.scanHistory ?? true)

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
      enabled,
      scanHistory
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div className="bg-claude-dark w-105 rounded-xl border border-neutral-700 p-6 shadow-2xl">
        <h2 className="mb-4 text-sm font-semibold text-neutral-200">
          {isNew ? 'Add Profile' : 'Edit Profile'}
        </h2>

        {/* Emoji picker */}
        <div className="mb-4">
          <label className="mb-2 block text-xs text-neutral-500">Emoji</label>
          <div className="flex flex-wrap gap-2">
            {PRESET_EMOJIS.map((e) => (
              <button
                key={e}
                onClick={() => setEmoji(e)}
                className={`flex h-9 w-9 items-center justify-center rounded border text-lg transition-colors ${
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
          <label className="mb-1 block text-xs text-neutral-500">Label</label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Work, Personal, Freelance"
            className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-200 placeholder-neutral-600 focus:border-neutral-500 focus:outline-none"
          />
        </div>

        {/* Config dir */}
        <div className="mb-4">
          <label className="mb-1 block text-xs text-neutral-500">Config directory (CLAUDE_CONFIG_DIR)</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={configDir}
              onChange={(e) => setConfigDir(e.target.value)}
              placeholder="~/.claude"
              className="flex-1 rounded border border-neutral-700 bg-neutral-900 px-3 py-2 font-mono text-sm text-neutral-200 placeholder-neutral-600 focus:border-neutral-500 focus:outline-none"
            />
            <button
              onClick={handleBrowse}
              className="rounded border border-neutral-700 px-3 py-2 text-xs text-neutral-400 transition-colors hover:border-neutral-500 hover:text-neutral-200"
            >
              Browse…
            </button>
          </div>
        </div>

        {/* Enabled toggle */}
        <div className="mb-3 flex items-center gap-3">
          <button
            onClick={() => !isOnlyEnabled && setEnabled((v) => !v)}
            disabled={isOnlyEnabled}
            className={`h-5 w-9 rounded-full transition-colors ${enabled ? 'bg-claude-orange' : 'bg-neutral-700'} ${isOnlyEnabled ? 'cursor-not-allowed opacity-40' : ''}`}
            role="switch"
            aria-checked={enabled}
            title={isOnlyEnabled ? 'Cannot disable the only enabled profile' : undefined}
          >
            <span
              className={`m-1 block h-3 w-3 rounded-full bg-white transition-transform ${enabled ? 'translate-x-4' : 'translate-x-0'}`}
            />
          </button>
          <span className="text-xs text-neutral-400">
            Profile enabled{isOnlyEnabled ? ' (required — only active profile)' : ''}
          </span>
        </div>

        {/* Scan history checkbox */}
        <div className="mb-6 flex items-center gap-3">
          <input
            type="checkbox"
            id="scan-history"
            checked={scanHistory}
            onChange={(e) => !isOnlyScannable && setScanHistory(e.target.checked)}
            disabled={isOnlyScannable}
            className={`accent-claude-orange h-4 w-4 rounded border border-neutral-700 bg-neutral-900 ${isOnlyScannable ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'}`}
          />
          <label htmlFor="scan-history" className={`text-xs text-neutral-400 select-none ${isOnlyScannable ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
            Scan chat history for search{isOnlyScannable ? ' (required — only scannable profile)' : ''}
          </label>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-xs text-neutral-500 transition-colors hover:text-neutral-300"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!label.trim()}
            className="bg-claude-orange rounded px-4 py-1.5 text-xs text-white transition-colors hover:bg-orange-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isNew ? 'Add Profile' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
