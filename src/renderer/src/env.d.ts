/// <reference types="vite/client" />

interface SearchResult {
  id: string
  projectName: string
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
}

interface Window {
  electronAPI: ElectronAPI
}
