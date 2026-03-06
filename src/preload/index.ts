import { contextBridge, ipcRenderer } from 'electron'
import type {
  SearchResult,
  Conversation,
  ExportFormat,
  ExportResult,
  UserPreferences,
  PtySpawnOptions,
  PtyStatus,
  Profile,
  AppSettings,
  StatsGranularity,
  PeriodStat,
  Worktree,
  GitInfo,
  CreateWorktreeOptions,
  CreateWorktreeResult
} from '../shared/types'

export type { SearchResult, Conversation, ExportFormat, ExportResult, UserPreferences, PtySpawnOptions, PtyStatus, Profile, AppSettings, StatsGranularity, PeriodStat, Worktree, GitInfo, CreateWorktreeOptions, CreateWorktreeResult }

export interface ElectronAPI {
  search: (query: string, filters?: { project?: string; limit?: number }) => Promise<SearchResult[]>
  getConversation: (id: string) => Promise<Conversation | null>
  getProjects: () => Promise<string[]>
  getStats: () => Promise<{ conversations: number; projects: number }>
  rebuildIndex: () => Promise<boolean>
  getLatestConversation: (projectPath: string) => Promise<Conversation | null>
  exportConversation: (id: string, format: ExportFormat) => Promise<ExportResult>
  getPreferences: () => Promise<Partial<UserPreferences>>
  setPreferences: (prefs: Partial<UserPreferences>) => Promise<boolean>
  onIndexReady: (callback: () => void) => void
  onScanProgress: (callback: (progress: { scanned: number; total: number }) => void) => (() => void)
  // PTY
  ptySpawn: (options: PtySpawnOptions) => Promise<{ success: boolean; error?: string }>
  ptyInput: (instanceId: string, data: string) => void
  ptyResize: (instanceId: string, cols: number, rows: number) => void
  ptyKill: (instanceId: string) => Promise<boolean>
  ptyStatus: (instanceId: string) => Promise<PtyStatus>
  onPtyData: (callback: (instanceId: string, data: string) => void) => () => void
  onPtyExit: (callback: (instanceId: string, code: number) => void) => () => void
  // Settings
  getSettings: () => Promise<AppSettings>
  setSettings: (settings: Partial<AppSettings>) => Promise<boolean>
  selectDirectory: () => Promise<string | null>
  getDailyStats: (granularity: StatsGranularity, limit: number) => Promise<PeriodStat[]>
  getProfilesUsage: () => Promise<Record<string, { conversations: number; lastUsed: string | null; tokensThisMonth: number }>>
  getProfiles: () => Promise<Profile[]>
  saveProfiles: (profiles: Profile[]) => Promise<boolean>
  getWorktrees: () => Promise<Worktree[]>
  openInFinder: (path: string) => Promise<void>
  isIndexReady: () => Promise<boolean>
  getGitInfo: () => Promise<Record<string, GitInfo>>
  createWorktree: (options: CreateWorktreeOptions) => Promise<CreateWorktreeResult>
}

const api: ElectronAPI = {
  search: (query, filters) => ipcRenderer.invoke('search', query, filters),
  getConversation: (id) => ipcRenderer.invoke('get-conversation', id),
  getProjects: () => ipcRenderer.invoke('get-projects'),
  getStats: () => ipcRenderer.invoke('get-stats'),
  rebuildIndex: () => ipcRenderer.invoke('rebuild-index'),
  getLatestConversation: (projectPath) => ipcRenderer.invoke('get-latest-conversation', projectPath),
  exportConversation: (id, format) => ipcRenderer.invoke('export-conversation', id, format),
  getPreferences: () => ipcRenderer.invoke('get-preferences'),
  setPreferences: (prefs) => ipcRenderer.invoke('set-preferences', prefs),
  onIndexReady: (callback) => ipcRenderer.once('index-ready', callback),
  onScanProgress: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, progress: { scanned: number; total: number }): void => {
      callback(progress)
    }
    ipcRenderer.on('scan-progress', handler)
    return () => ipcRenderer.removeListener('scan-progress', handler)
  },
  // PTY
  ptySpawn: (options) => ipcRenderer.invoke('pty-spawn', options),
  ptyInput: (instanceId, data) => ipcRenderer.send('pty-input', { instanceId, data }),
  ptyResize: (instanceId, cols, rows) => ipcRenderer.send('pty-resize', { instanceId, cols, rows }),
  ptyKill: (instanceId) => ipcRenderer.invoke('pty-kill', instanceId),
  ptyStatus: (instanceId) => ipcRenderer.invoke('pty-status', instanceId),
  onPtyData: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: { instanceId: string; data: string }): void => {
      callback(payload.instanceId, payload.data)
    }
    ipcRenderer.on('pty-data', handler)
    return () => ipcRenderer.removeListener('pty-data', handler)
  },
  onPtyExit: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: { instanceId: string; code: number }): void => {
      callback(payload.instanceId, payload.code)
    }
    ipcRenderer.on('pty-exit', handler)
    return () => ipcRenderer.removeListener('pty-exit', handler)
  },
  // Settings
  getSettings: () => ipcRenderer.invoke('get-settings'),
  setSettings: (settings) => ipcRenderer.invoke('set-settings', settings),
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  getDailyStats: (granularity, limit) => ipcRenderer.invoke('get-daily-stats', granularity, limit),
  getProfilesUsage: () => ipcRenderer.invoke('get-profiles-usage'),
  getProfiles: () => ipcRenderer.invoke('get-profiles'),
  saveProfiles: (profiles) => ipcRenderer.invoke('save-profiles', profiles),
  getWorktrees: () => ipcRenderer.invoke('get-worktrees'),
  openInFinder: (path) => ipcRenderer.invoke('open-in-finder', path),
  isIndexReady: () => ipcRenderer.invoke('is-index-ready'),
  getGitInfo: () => ipcRenderer.invoke('get-git-info'),
  createWorktree: (options) => ipcRenderer.invoke('create-worktree', options),
}

contextBridge.exposeInMainWorld('electronAPI', api)
