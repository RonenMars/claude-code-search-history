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
