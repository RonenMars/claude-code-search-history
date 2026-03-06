import { useState, useCallback } from 'react'
import type { AppSettings } from '../../../shared/types'

interface SettingsModalProps {
  settings: AppSettings
  onSave: (settings: Partial<AppSettings>) => void
  onClose: () => void
}

export default function SettingsModal({ settings, onSave, onClose }: SettingsModalProps): JSX.Element {
  const [maxChatInstances, setMaxChatInstances] = useState(settings.maxChatInstances)

  const handleMaxChange = useCallback((value: number) => {
    const clamped = Math.min(10, Math.max(1, value))
    setMaxChatInstances(clamped)
    onSave({ maxChatInstances: clamped })
  }, [onSave])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-claude-dark border border-neutral-700 rounded-xl shadow-2xl w-[480px] max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-700">
          <h2 className="text-sm font-semibold text-neutral-200">Settings</h2>
          <button
            onClick={onClose}
            className="text-neutral-500 hover:text-neutral-300 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Chat section */}
        <div className="px-6 py-5 border-b border-neutral-800">
          <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-4">Chat</h3>
          <div className="flex items-center justify-between">
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

        {/* Profiles section */}
        <div className="px-6 py-5">
          <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-4">Profiles</h3>
          <p className="text-sm text-neutral-500">Profile management coming soon.</p>
        </div>
      </div>
    </div>
  )
}
