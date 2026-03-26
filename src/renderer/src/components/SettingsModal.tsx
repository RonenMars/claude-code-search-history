import { useState, useCallback, useEffect, type JSX } from 'react'
import ProfilesPanel from './ProfilesPanel'
import SystemStats from './SystemStats'
import type { AppSettings, NotificationSettings, Profile } from '../../../shared/types'

const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  session_complete: true,
  waiting_input: true,
  session_failed: true,
  diff_ready: false,
}

interface SettingsModalProps {
  settings: AppSettings
  onSave: (settings: Partial<AppSettings>) => void
  profiles: Profile[]
  onFilterByProfile: (profileId: string | null) => void
  onProfilesSaved: (profiles: Profile[]) => Promise<void>
  onClose: () => void
  defaultProfileId: string | null
  onClearDefaultProfile: () => void
  enabledProviders?: string[]
  availableProviders?: Array<{ id: string; displayName: string; available: boolean }>
  onToggleProvider?: (providerId: string, enabled: boolean) => void
}

export default function SettingsModal({ settings, onSave, profiles, onFilterByProfile, onProfilesSaved, onClose, defaultProfileId, onClearDefaultProfile, enabledProviders, availableProviders, onToggleProvider }: SettingsModalProps): JSX.Element {
  const [maxChatInstances, setMaxChatInstances] = useState(settings.maxChatInstances)
  const [profilesDir, setProfilesDir] = useState(settings.profilesDir ?? '')
  const [notifSettings, setNotifSettings] = useState<NotificationSettings>(
    settings.notifications ?? DEFAULT_NOTIFICATION_SETTINGS
  )
  const [testSent, setTestSent] = useState(false)

  useEffect(() => {
    window.electronAPI.getNotificationSettings().then(setNotifSettings).catch(() => {})
  }, [])

  const handleNotifToggle = useCallback(async (key: keyof NotificationSettings) => {
    const updated = { ...notifSettings, [key]: !notifSettings[key] }
    setNotifSettings(updated)
    await window.electronAPI.setNotificationSettings(updated)
  }, [notifSettings])

  const handleTestNotification = useCallback(async () => {
    await window.electronAPI.testNotification()
    setTestSent(true)
    setTimeout(() => setTestSent(false), 2000)
  }, [])

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

      {/* Notifications section */}
      <div className="border-b border-neutral-800 px-8 py-5">
        <h3 className="mb-4 text-xs font-semibold tracking-wider text-neutral-400 uppercase">Notifications</h3>
        <div className="max-w-xl space-y-3">
          {(
            [
              { key: 'session_complete', label: 'Session complete', desc: 'When a session finishes successfully' },
              { key: 'waiting_input', label: 'Waiting for input', desc: 'When Claude is blocked and needs a response' },
              { key: 'session_failed', label: 'Session failed', desc: 'When a session exits with an error' },
              { key: 'diff_ready', label: 'Diff ready', desc: 'When file changes are detected in a session' },
            ] as { key: keyof NotificationSettings; label: string; desc: string }[]
          ).map(({ key, label, desc }) => (
            <div key={key} className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-neutral-200">{label}</p>
                <p className="mt-0.5 text-xs text-neutral-500">{desc}</p>
              </div>
              <button
                role="switch"
                aria-checked={notifSettings[key]}
                onClick={() => handleNotifToggle(key)}
                className={[
                  'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors',
                  notifSettings[key] ? 'bg-claude-orange' : 'bg-neutral-700',
                ].join(' ')}
              >
                <span
                  className={[
                    'inline-block h-4 w-4 translate-y-0.5 rounded-full bg-white shadow transition-transform',
                    notifSettings[key] ? 'translate-x-4' : 'translate-x-0.5',
                  ].join(' ')}
                />
              </button>
            </div>
          ))}
          <div className="pt-1">
            <button
              onClick={handleTestNotification}
              className="rounded-md border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-xs text-neutral-300 transition-colors hover:bg-neutral-700"
            >
              {testSent ? 'Notification sent!' : 'Test notification'}
            </button>
          </div>
        </div>
      </div>

      {/* System Stats section */}
      <div className="border-b border-neutral-800 px-8 py-5">
        <h3 className="mb-4 text-xs font-semibold tracking-wider text-neutral-400 uppercase">System Stats</h3>
        <SystemStats />
      </div>

      {/* Providers section */}
      {availableProviders && availableProviders.length > 0 && (
        <div className="border-b border-neutral-800 px-8 py-5">
          <h3 className="mb-4 text-xs font-semibold tracking-wider text-neutral-400 uppercase">Providers</h3>
          <div className="space-y-3">
            {availableProviders.map((provider) => {
              const isEnabled = enabledProviders?.includes(provider.id) ?? (provider.id === 'claude')
              return (
                <div key={provider.id} className="flex max-w-xl items-center justify-between">
                  <div>
                    <p className="text-sm text-neutral-200">{provider.displayName}</p>
                    <p className="text-xs text-neutral-500">
                      {provider.available ? 'Detected on this system' : 'Not detected'}
                    </p>
                  </div>
                  <button
                    onClick={() => onToggleProvider?.(provider.id, !isEnabled)}
                    disabled={provider.id === 'claude' || !provider.available}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      isEnabled
                        ? 'bg-claude-orange/20 text-claude-orange hover:bg-claude-orange/30'
                        : 'bg-neutral-800 text-neutral-500 hover:bg-neutral-700 hover:text-neutral-300'
                    } disabled:cursor-not-allowed disabled:opacity-50`}
                  >
                    {isEnabled ? 'Enabled' : 'Enable'}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

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
