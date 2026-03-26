// Provider-level message model (distinct from ConversationMessage in shared/types.ts)
export interface Message {
  role: 'user' | 'assistant'
  content: string
  toolUse?: unknown
  toolResult?: unknown
  inputTokens?: number
  outputTokens?: number
  model?: string
}

// Unified session model returned by all providers
export interface ProviderSession {
  id: string               // file path — stable unique key (NOT the provider-native UUID)
  provider: string         // provider id: "claude" | "codex" | ...
  projectPath: string
  title: string
  messageCount: number
  lastModified: string     // ISO timestamp
  model?: string
  gitBranch?: string
  sessionId?: string       // provider-native session UUID (used for resumeCommand)
  messages: Message[]      // empty until loadSession() is called
}

// All providers must implement this interface
export interface AssistantProvider {
  id: string
  displayName: string
  defaultPaths: string[]
  isAvailable(): Promise<boolean>
  scanSessions(paths: string[]): Promise<ProviderSession[]>
  loadSession(session: ProviderSession): Promise<ProviderSession>
  resumeCommand(session: ProviderSession): string | null
}

// Shape returned by get-providers IPC
export interface ProviderInfo {
  id: string
  displayName: string
  enabled: boolean
  available: boolean
}
