// ─── Notification Service ─────────────────────────────────────────────
// Platform-agnostic interface for firing notifications. Two implementations:
//   ElectronNotificationService  — uses Electron's native Notification API
//   WebPushNotificationService   — uses Web Push VAPID subscriptions
// Sessions that complete in <5s are suppressed (likely errored early).

import { Notification } from 'electron'

export type NotificationEvent =
  | { type: 'session_complete'; sessionId: string; project: string; durationMs: number }
  | { type: 'waiting_input'; sessionId: string; project: string; lastPrompt: string }
  | { type: 'session_failed'; sessionId: string; project: string; error: string }
  | { type: 'diff_ready'; sessionId: string; project: string; filesChanged: number }

export interface NotificationSettings {
  session_complete: boolean
  waiting_input: boolean
  session_failed: boolean
  diff_ready: boolean
}

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  session_complete: true,
  waiting_input: true,
  session_failed: true,
  diff_ready: false,
}

export interface NotificationService {
  notify(event: NotificationEvent): void
  setSettings(settings: NotificationSettings): void
}

// ─── Grouping buffer ──────────────────────────────────────────────────

const GROUP_WINDOW_MS = 5_000

interface PendingGroup {
  type: NotificationEvent['type']
  projects: string[]
  timer: NodeJS.Timeout
}

// ─── Electron Implementation ──────────────────────────────────────────

export class ElectronNotificationService implements NotificationService {
  private settings: NotificationSettings = { ...DEFAULT_NOTIFICATION_SETTINGS }
  private groups = new Map<string, PendingGroup>()

  setSettings(settings: NotificationSettings): void {
    this.settings = settings
  }

  notify(event: NotificationEvent): void {
    // Debounce: skip sessions that complete in <5s
    if (event.type === 'session_complete' && event.durationMs < 5_000) return

    if (!this.settings[event.type]) return

    this.enqueue(event)
  }

  private enqueue(event: NotificationEvent): void {
    const key = event.type
    const existing = this.groups.get(key)

    if (existing) {
      existing.projects.push(event.project)
      clearTimeout(existing.timer)
      existing.timer = setTimeout(() => this.flush(key), GROUP_WINDOW_MS)
    } else {
      const group: PendingGroup = {
        type: event.type,
        projects: [event.project],
        timer: setTimeout(() => this.flush(key), GROUP_WINDOW_MS),
      }
      this.groups.set(key, group)
    }
  }

  private flush(key: string): void {
    const group = this.groups.get(key)
    if (!group) return
    this.groups.delete(key)

    const { title, body } = buildNotificationText(group.type, group.projects)
    if (!Notification.isSupported()) return
    new Notification({ title, body }).show()
  }
}

// ─── Web Push Implementation ──────────────────────────────────────────
// Sends notifications to registered push subscriptions via the cch serve server.
// The server holds the subscriptions; this class talks to the /api/push/notify
// internal endpoint (loopback only, no auth needed from within the process).

export class WebPushNotificationService implements NotificationService {
  private settings: NotificationSettings = { ...DEFAULT_NOTIFICATION_SETTINGS }
  private readonly serverBaseUrl: string
  private groups = new Map<string, PendingGroup>()

  constructor(serverBaseUrl: string) {
    this.serverBaseUrl = serverBaseUrl
  }

  setSettings(settings: NotificationSettings): void {
    this.settings = settings
  }

  notify(event: NotificationEvent): void {
    if (event.type === 'session_complete' && event.durationMs < 5_000) return
    if (!this.settings[event.type]) return
    this.enqueue(event)
  }

  private enqueue(event: NotificationEvent): void {
    const key = event.type
    const existing = this.groups.get(key)

    if (existing) {
      existing.projects.push(event.project)
      clearTimeout(existing.timer)
      existing.timer = setTimeout(() => this.flush(key), GROUP_WINDOW_MS)
    } else {
      const group: PendingGroup = {
        type: event.type,
        projects: [event.project],
        timer: setTimeout(() => this.flush(key), GROUP_WINDOW_MS),
      }
      this.groups.set(key, group)
    }
  }

  private flush(key: string): void {
    const group = this.groups.get(key)
    if (!group) return
    this.groups.delete(key)

    const { title, body } = buildNotificationText(group.type, group.projects)
    const payload = JSON.stringify({ title, body, type: group.type })

    fetch(`${this.serverBaseUrl}/api/push/notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
    }).catch((err) => console.warn('[WebPushNotificationService] push failed:', err))
  }
}

// ─── Shared helpers ───────────────────────────────────────────────────

function buildNotificationText(
  type: NotificationEvent['type'],
  projects: string[],
): { title: string; body: string } {
  const count = projects.length
  const list = count === 1
    ? projects[0]
    : `${projects.slice(0, 3).join(', ')}${count > 3 ? ` +${count - 3} more` : ''}`

  switch (type) {
    case 'session_complete':
      return {
        title: count === 1 ? 'Session complete' : `${count} sessions completed`,
        body: list,
      }
    case 'waiting_input':
      return {
        title: count === 1 ? 'Waiting for input' : `${count} sessions need input`,
        body: list,
      }
    case 'session_failed':
      return {
        title: count === 1 ? 'Session failed' : `${count} sessions failed`,
        body: list,
      }
    case 'diff_ready':
      return {
        title: 'Diff ready',
        body: list,
      }
  }
}
