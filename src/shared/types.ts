// ─── Shared Domain Types ────────────────────────────────────────────

export interface ConversationMessage {
  type: 'user' | 'assistant' | 'system'
  content: string
  timestamp: string
  metadata?: MessageMetadata
  lineNumber?: number
  isToolResult?: boolean
}

export interface ConversationMeta {
  id: string
  filePath: string
  projectPath: string
  projectName: string
  sessionId: string
  sessionName: string
  timestamp: string
  messageCount: number
  preview: string
  contentSnippet: string
}

export interface Conversation {
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

export interface SearchResult {
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

export type ExportFormat = 'markdown' | 'json' | 'text'

export interface ExportResult {
  success: boolean
  filePath?: string
  canceled?: boolean
  error?: string
}

export type SortOption = 'recent' | 'oldest' | 'most-messages' | 'least-messages' | 'alphabetical'
export type DateRangeOption = 'all' | 'today' | 'week' | 'month'

export interface UserPreferences {
  sortBy: SortOption
  dateRange: DateRangeOption
  selectedProject: string
}

// ─── Tool Result Types ──────────────────────────────────────────────
// Discriminated union for structured tool results extracted from JSONL

export interface StructuredPatchHunk {
  oldStart: number
  oldLines: number
  newStart: number
  newLines: number
  lines: string[]
}

export interface EditToolResult {
  type: 'edit'
  filePath: string
  oldString: string
  newString: string
  structuredPatch: StructuredPatchHunk[]
  userModified: boolean
  replaceAll: boolean
}

export interface BashToolResult {
  type: 'bash'
  stdout: string
  stderr: string
  interrupted: boolean
}

export interface ReadToolResult {
  type: 'read'
  filePath: string
}

export interface WriteToolResult {
  type: 'write'
  filePath: string
}

export interface GlobToolResult {
  type: 'glob'
  filenames: string[]
  numFiles: number
  truncated: boolean
}

export interface GrepToolResult {
  type: 'grep'
  mode: string
  filenames: string[]
  content: string
  numFiles: number
  numLines: number
}

export interface TaskAgentToolResult {
  type: 'taskAgent'
  status: string
  prompt: string
  agentId: string
}

export interface TaskCreateToolResult {
  type: 'taskCreate'
  taskId: string
  subject: string
}

export interface TaskUpdateToolResult {
  type: 'taskUpdate'
  taskId: string
  updatedFields: string[]
  statusChange?: { from: string; to: string }
}

export interface GenericToolResult {
  type: 'generic'
  toolName: string
  data: Record<string, unknown>
}

export type ToolResult =
  | EditToolResult
  | BashToolResult
  | ReadToolResult
  | WriteToolResult
  | GlobToolResult
  | GrepToolResult
  | TaskAgentToolResult
  | TaskCreateToolResult
  | TaskUpdateToolResult
  | GenericToolResult

// ─── Tool Use Block (from assistant messages) ───────────────────────

export interface ToolUseBlock {
  id: string
  name: string
  input: Record<string, unknown>
}

// ─── Message Metadata ───────────────────────────────────────────────
// Placed after ToolUseBlock and ToolResult since it references them

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
  toolUseBlocks?: ToolUseBlock[]
  toolResults?: ToolResult[]
}
