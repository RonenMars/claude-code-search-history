import { contextBridge, ipcRenderer } from 'electron'

export interface SearchResult {
  id: string
  projectName: string
  preview: string
  timestamp: string
  messageCount: number
  score: number
}

export interface ConversationMessage {
  type: 'user' | 'assistant' | 'system'
  content: string
  timestamp: string
}

export interface Conversation {
  id: string
  filePath: string
  projectPath: string
  projectName: string
  sessionId: string
  messages: ConversationMessage[]
  fullText: string
  timestamp: string
  messageCount: number
}

export type ExportFormat = 'markdown' | 'json' | 'text'

export interface ExportResult {
  success: boolean
  filePath?: string
  canceled?: boolean
  error?: string
}

export interface ElectronAPI {
  search: (query: string, filters?: { project?: string; limit?: number }) => Promise<SearchResult[]>
  getConversation: (id: string) => Promise<Conversation | null>
  getProjects: () => Promise<string[]>
  getStats: () => Promise<{ conversations: number; projects: number }>
  rebuildIndex: () => Promise<boolean>
  exportConversation: (id: string, format: ExportFormat) => Promise<ExportResult>
}

const api: ElectronAPI = {
  search: (query, filters) => ipcRenderer.invoke('search', query, filters),
  getConversation: (id) => ipcRenderer.invoke('get-conversation', id),
  getProjects: () => ipcRenderer.invoke('get-projects'),
  getStats: () => ipcRenderer.invoke('get-stats'),
  rebuildIndex: () => ipcRenderer.invoke('rebuild-index'),
  exportConversation: (id, format) => ipcRenderer.invoke('export-conversation', id, format)
}

contextBridge.exposeInMainWorld('electronAPI', api)
