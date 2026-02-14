import { contextBridge, ipcRenderer } from 'electron'

export interface SearchResult {
  id: string
  projectName: string
  projectPath: string
  sessionId: string
  preview: string
  timestamp: string
  messageCount: number
  score: number
}

export interface MessageMetadata {
  model?: string
  stopReason?: string | null
  inputTokens?: number
  outputTokens?: number
  cacheReadTokens?: number
  cacheCreationTokens?: number
  gitBranch?: string
  version?: string
  toolUses?: string[]
}

export interface ConversationMessage {
  type: 'user' | 'assistant' | 'system'
  content: string
  timestamp: string
  metadata?: MessageMetadata
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
  onIndexReady: (callback: () => void) => void
}

const api: ElectronAPI = {
  search: (query, filters) => ipcRenderer.invoke('search', query, filters),
  getConversation: (id) => ipcRenderer.invoke('get-conversation', id),
  getProjects: () => ipcRenderer.invoke('get-projects'),
  getStats: () => ipcRenderer.invoke('get-stats'),
  rebuildIndex: () => ipcRenderer.invoke('rebuild-index'),
  exportConversation: (id, format) => ipcRenderer.invoke('export-conversation', id, format),
  onIndexReady: (callback) => ipcRenderer.on('index-ready', callback)
}

contextBridge.exposeInMainWorld('electronAPI', api)
