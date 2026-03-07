// ─── Shared Domain Types ────────────────────────────────────────────

export interface ConversationMessage {
  type: 'user' | 'assistant' | 'system'
  content: string
  timestamp: string
  uuid?: string
  metadata?: MessageMetadata
  lineNumber?: number
  isToolResult?: boolean
}

export type Account = string  // profile id, e.g. "default", "work", custom uuid

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
  lastMessageSender: 'user' | 'assistant'
  account: Account
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
  account: Account
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
  lastMessageSender: 'user' | 'assistant'
  account: Account
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
  defaultProfileId?: string
  sidebarWidth?: number
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

// ─── Profile Types ───────────────────────────────────────────────────

export type ClaudeProfile = 'work' | 'personal'

export interface Profile {
  id: string        // stable slug or uuid, used as Account value
  label: string     // display name, e.g. "Default", "Work"
  emoji: string     // single emoji character
  configDir: string // absolute or ~-prefixed path to CLAUDE_CONFIG_DIR
  enabled: boolean  // soft-disable without deleting
}

export interface ProfilesConfig {
  profiles: Profile[]
}

export interface ProfileUsage {
  conversations: number
  lastUsed: string | null  // ISO timestamp, or null if no conversations
  tokensThisMonth: number
  messages: number
  projects: number
}

export interface ProfilesUsage {
  work: ProfileUsage
  personal: ProfileUsage
}

// ─── Stats Types ─────────────────────────────────────────────────────

export type StatsGranularity = 'day' | 'week' | 'month'

export interface PeriodStat {
  date: string          // YYYY-MM-DD for day/week, YYYY-MM for month
  conversations: number
  messages: number
}

// ─── PTY / Chat Types ────────────────────────────────────────────────

export interface PtySpawnOptions {
  instanceId: string
  cwd: string
  resumeSessionId?: string
  profile?: ClaudeProfile
  configDir?: string
}

export interface PtyStatus {
  active: boolean
  pid?: number
}

export interface ChatInstance {
  instanceId: string
  cwd: string
  profile: ClaudeProfile | null
  status: 'active' | 'exited'
  exitCode: number | null
  resumeSessionId?: string
  configDir?: string
  isClaudeTyping: boolean
}

export interface AppSettings {
  maxChatInstances: number
  groupByProject: boolean
}

// ─── Git Worktree Types ──────────────────────────────────────────────

export interface Worktree {
  path: string        // absolute path to the worktree directory
  head: string        // short SHA (first 7 characters of HEAD commit)
  branch: string      // display name: "feature-foo", "main", or "(detached)"
  isMain: boolean     // true = main worktree (first in git output), false = linked
  projectPath: string // absolute path of the main worktree (root project)
  projectName: string // basename(projectPath) — used for display grouping
}

// ─── Git Info Types (for conversation list badges) ──────────────────

export interface GitInfo {
  type: 'none' | 'git' | 'worktree'
  branch?: string           // current branch name
  rootProjectPath?: string  // for worktrees: absolute path to main worktree
  rootProjectName?: string  // basename(rootProjectPath)
}

export interface CreateWorktreeOptions {
  rootPath: string       // cwd for git command (main worktree path)
  worktreePath: string   // absolute path for the new worktree
  branch: string         // new branch name
}

export interface CreateWorktreeResult {
  success: boolean
  error?: string
}
