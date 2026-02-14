/// <reference types="vite/client" />

interface SearchResult {
  id: string
  projectName: string
  projectPath: string
  sessionId: string
  sessionName: string
  preview: string
  timestamp: string
  messageCount: number
  score: number
}

interface ConversationMessage {
  type: 'user' | 'assistant' | 'system'
  content: string
  timestamp: string
}

interface Conversation {
  id: string
  filePath: string
  projectPath: string
  projectName: string
  sessionId: string
  sessionName: string
  messages: ConversationMessage[]
  fullText: string
  timestamp: string
  messageCount: number
}

interface ElectronAPI {
  search: (query: string, filters?: { project?: string; limit?: number }) => Promise<SearchResult[]>
  getConversation: (id: string) => Promise<Conversation | null>
  getProjects: () => Promise<string[]>
  getStats: () => Promise<{ conversations: number; projects: number }>
  rebuildIndex: () => Promise<boolean>
  onIndexReady: (callback: () => void) => void
  exportConversation: (id: string, format: 'markdown' | 'json' | 'text') => Promise<{ success: boolean; canceled?: boolean }>
}

interface Window {
  electronAPI: ElectronAPI
}
