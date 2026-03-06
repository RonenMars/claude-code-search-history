import { contextBridge, ipcRenderer } from 'electron'
import type {
  SearchResult,
  Conversation,
  ExportFormat,
  ExportResult,
  UserPreferences,
  PtySpawnOptions,
  PtyStatus,
  Profile
} from '../shared/types'

export type { SearchResult, Conversation, ExportFormat, ExportResult, UserPreferences, PtySpawnOptions, PtyStatus, Profile }

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
  ptyInput: (data: string) => void
  ptyResize: (cols: number, rows: number) => void
  ptyKill: () => Promise<boolean>
  ptyStatus: () => Promise<PtyStatus>
  onPtyData: (callback: (data: string) => void) => () => void
  onPtyExit: (callback: (code: number) => void) => () => void
  selectDirectory: () => Promise<string | null>
  getProfilesUsage: () => Promise<Record<string, { conversations: number; lastUsed: string | null; tokensThisMonth: number }>>
  getProfiles: () => Promise<Profile[]>
  saveProfiles: (profiles: Profile[]) => Promise<boolean>
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
  ptyInput: (data) => ipcRenderer.send('pty-input', data),
  ptyResize: (cols, rows) => ipcRenderer.send('pty-resize', cols, rows),
  ptyKill: () => ipcRenderer.invoke('pty-kill'),
  ptyStatus: () => ipcRenderer.invoke('pty-status'),
  onPtyData: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, data: string): void => {
      callback(data)
    }
    ipcRenderer.on('pty-data', handler)
    return () => ipcRenderer.removeListener('pty-data', handler)
  },
  onPtyExit: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, code: number): void => {
      callback(code)
    }
    ipcRenderer.on('pty-exit', handler)
    return () => ipcRenderer.removeListener('pty-exit', handler)
  },
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  getProfilesUsage: () => ipcRenderer.invoke('get-profiles-usage'),
  getProfiles: () => ipcRenderer.invoke('get-profiles'),
  saveProfiles: (profiles) => ipcRenderer.invoke('save-profiles', profiles),
}

contextBridge.exposeInMainWorld('electronAPI', api)
