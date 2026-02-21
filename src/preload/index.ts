import { contextBridge, ipcRenderer } from 'electron'
import type {
  SearchResult,
  Conversation,
  ExportFormat,
  ExportResult,
  UserPreferences
} from '../shared/types'

export type { SearchResult, Conversation, ExportFormat, ExportResult, UserPreferences }

export interface ElectronAPI {
  search: (query: string, filters?: { project?: string; limit?: number }) => Promise<SearchResult[]>
  getConversation: (id: string) => Promise<Conversation | null>
  getProjects: () => Promise<string[]>
  getStats: () => Promise<{ conversations: number; projects: number }>
  rebuildIndex: () => Promise<boolean>
  exportConversation: (id: string, format: ExportFormat) => Promise<ExportResult>
  getPreferences: () => Promise<Partial<UserPreferences>>
  setPreferences: (prefs: Partial<UserPreferences>) => Promise<boolean>
  onIndexReady: (callback: () => void) => void
  onScanProgress: (callback: (progress: { scanned: number; total: number }) => void) => (() => void)
}

const api: ElectronAPI = {
  search: (query, filters) => ipcRenderer.invoke('search', query, filters),
  getConversation: (id) => ipcRenderer.invoke('get-conversation', id),
  getProjects: () => ipcRenderer.invoke('get-projects'),
  getStats: () => ipcRenderer.invoke('get-stats'),
  rebuildIndex: () => ipcRenderer.invoke('rebuild-index'),
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
  }
}

contextBridge.exposeInMainWorld('electronAPI', api)
