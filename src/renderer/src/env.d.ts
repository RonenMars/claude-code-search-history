/// <reference types="vite/client" />

interface MessageMetadata {
  model?: string
  stopReason?: string | null
  inputTokens?: number
  outputTokens?: number
  cacheReadTokens?: number
  cacheCreationTokens?: number
  gitBranch?: string
  version?: string
  toolUses?: string[]
  toolUseBlocks?: import('../../shared/types').ToolUseBlock[]
  toolResults?: import('../../shared/types').ToolResult[]
}

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
  metadata?: MessageMetadata
  lineNumber?: number
  isToolResult?: boolean
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
  exportConversation: (id: string, format: 'markdown' | 'json' | 'text') => Promise<{ success: boolean; filePath?: string; canceled?: boolean; error?: string }>
}

interface Window {
  electronAPI: ElectronAPI
}
