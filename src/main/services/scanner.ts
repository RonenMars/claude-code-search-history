import { readdir, stat } from 'fs/promises'
import { join } from 'path'
import { homedir } from 'os'
import { createReadStream } from 'fs'
import { createInterface } from 'readline'
import type { ToolResult, ToolUseBlock } from '../../shared/types'

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

export interface ConversationMessage {
  type: 'user' | 'assistant' | 'system'
  content: string
  timestamp: string
  metadata?: MessageMetadata
  lineNumber?: number
  isToolResult?: boolean
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

export interface ConversationPreview {
  id: string
  projectName: string
  preview: string
  timestamp: string
  messageCount: number
}

export class ConversationScanner {
  private claudeDir: string
  private projectsDir: string
  private conversationsCache: Map<string, Conversation> = new Map()
  private projects: Set<string> = new Set()

  constructor() {
    this.claudeDir = join(homedir(), '.claude')
    this.projectsDir = join(this.claudeDir, 'projects')
  }

  async scanAll(): Promise<Conversation[]> {
    const conversations: Conversation[] = []
    this.conversationsCache.clear()
    this.projects.clear()

    try {
      const projectDirs = await readdir(this.projectsDir)

      for (const projectDir of projectDirs) {
        if (projectDir.startsWith('.')) continue

        const projectPath = join(this.projectsDir, projectDir)
        const stats = await stat(projectPath)
        if (!stats.isDirectory()) continue

        const fallbackName = this.decodeProjectName(projectDir)

        try {
          const jsonlFiles = await this.findJsonlFiles(projectPath)

          for (const filePath of jsonlFiles) {
            const fileStats = await stat(filePath)

            // Skip empty files
            if (fileStats.size === 0) continue

            try {
              const conversation = await this.parseConversation(filePath, fallbackName)
              if (conversation && conversation.messages.length > 0) {
                this.projects.add(conversation.projectPath)
                conversations.push(conversation)
                this.conversationsCache.set(conversation.id, conversation)
              }
            } catch (err) {
              // Skip files that can't be parsed
              console.error(`Error parsing ${filePath}:`, err)
            }
          }
        } catch (err) {
          console.error(`Error reading project dir ${projectPath}:`, err)
        }
      }
    } catch (err) {
      console.error('Error scanning claude projects:', err)
    }

    // Sort by timestamp descending
    conversations.sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )

    return conversations
  }

  private async findJsonlFiles(dir: string): Promise<string[]> {
    const results: string[] = []

    const entries = await readdir(dir)
    for (const entry of entries) {
      if (entry.startsWith('.') || entry === 'memory') continue

      const fullPath = join(dir, entry)
      const stats = await stat(fullPath)

      if (stats.isFile() && entry.endsWith('.jsonl')) {
        results.push(fullPath)
      } else if (stats.isDirectory()) {
        // Recurse into session UUID dirs (skip subagents, tool-results)
        if (entry !== 'subagents' && entry !== 'tool-results') {
          const nested = await this.findJsonlFiles(fullPath)
          results.push(...nested)
        }
      }
    }

    return results
  }

  private decodeProjectName(encoded: string): string {
    // Convert -Users-ronenmars-Desktop-dev-ak-chatbot to /Users/ronenmars/Desktop/dev/ak/chatbot
    return encoded.replace(/^-/, '/').replace(/-/g, '/')
  }

  private async parseConversation(filePath: string, fallbackProjectName: string): Promise<Conversation | null> {
    const messages: ConversationMessage[] = []
    let sessionId = ''
    let sessionName = ''
    let latestTimestamp = ''
    let cwd = ''
    const textParts: string[] = []

    // Track pending tool_use blocks from assistant messages to match with results
    const pendingToolUses = new Map<string, ToolUseBlock>()

    const fileStream = createReadStream(filePath)
    const rl = createInterface({
      input: fileStream,
      crlfDelay: Infinity
    })

    let lineNumber = 0
    for await (const line of rl) {
      lineNumber++
      if (!line.trim()) continue

      try {
        const entry = JSON.parse(line)

        if (entry.cwd && !cwd) {
          cwd = entry.cwd
        }

        if (entry.sessionId && !sessionId) {
          sessionId = entry.sessionId
        }

        if (entry.slug && !sessionName) {
          sessionName = entry.slug
        }

        if (entry.timestamp) {
          if (!latestTimestamp || entry.timestamp > latestTimestamp) {
            latestTimestamp = entry.timestamp
          }
        }

        if (entry.type === 'user' || entry.type === 'assistant') {
          if (entry.isMeta) continue

          // Extract tool_use blocks from assistant messages
          const toolUseBlocks = this.extractToolUseBlocks(entry.message?.content)
          for (const block of toolUseBlocks) {
            pendingToolUses.set(block.id, block)
          }

          // Check if this user message is purely a tool result
          const hasToolUseResult = entry.type === 'user' && entry.toolUseResult
          const isToolResultMessage = hasToolUseResult && this.isOnlyToolResult(entry.message?.content)

          // Classify the tool result if present
          let toolResults: ToolResult[] | undefined
          if (hasToolUseResult) {
            const classified = this.classifyToolResult(entry.toolUseResult, entry.message?.content, pendingToolUses)
            if (classified) {
              toolResults = [classified]
            }
          }

          const content = this.extractContent(entry.message?.content)
          if (content || isToolResultMessage) {
            const metadata: MessageMetadata = {}

            if (entry.message?.model) metadata.model = entry.message.model
            if (entry.message?.stop_reason !== undefined) metadata.stopReason = entry.message.stop_reason
            if (entry.gitBranch) metadata.gitBranch = entry.gitBranch
            if (entry.version) metadata.version = entry.version

            const usage = entry.message?.usage
            if (usage) {
              if (usage.input_tokens) metadata.inputTokens = usage.input_tokens
              if (usage.output_tokens) metadata.outputTokens = usage.output_tokens
              if (usage.cache_read_input_tokens) metadata.cacheReadTokens = usage.cache_read_input_tokens
              if (usage.cache_creation_input_tokens) metadata.cacheCreationTokens = usage.cache_creation_input_tokens
            }

            const toolUseNames = this.extractToolUseNames(entry.message?.content)
            if (toolUseNames.length > 0) metadata.toolUses = toolUseNames
            if (toolUseBlocks.length > 0) metadata.toolUseBlocks = toolUseBlocks
            if (toolResults) metadata.toolResults = toolResults

            messages.push({
              type: entry.type,
              content: content || '',
              timestamp: entry.timestamp || '',
              metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
              lineNumber,
              isToolResult: isToolResultMessage || undefined
            })
            if (content) textParts.push(content)
          }
        }
      } catch {
        // Skip malformed JSON lines
      }
    }

    if (messages.length === 0) return null

    const id = filePath // Use file path as unique ID
    const projectPath = cwd || fallbackProjectName

    return {
      id,
      filePath,
      projectPath,
      projectName: this.getShortProjectName(projectPath),
      sessionId: sessionId || filePath.split('/').pop()?.replace('.jsonl', '') || '',
      sessionName: sessionName || '',
      messages,
      fullText: textParts.join(' '),
      timestamp: latestTimestamp || new Date().toISOString(),
      messageCount: messages.length
    }
  }

  private extractContent(content: unknown): string {
    if (!content) return ''

    if (typeof content === 'string') {
      return this.cleanContent(content)
    }

    if (Array.isArray(content)) {
      return content
        .map((item) => {
          if (typeof item === 'string') return item
          if (item?.type === 'text' && item?.text) return item.text
          if (item?.type === 'tool_result' && item?.content) {
            return typeof item.content === 'string' ? item.content : ''
          }
          return ''
        })
        .filter(Boolean)
        .map(this.cleanContent)
        .join(' ')
    }

    return ''
  }

  private extractToolUseNames(content: unknown): string[] {
    if (!Array.isArray(content)) return []
    return content
      .filter((item) => item?.type === 'tool_use' && item?.name)
      .map((item) => item.name as string)
  }

  private extractToolUseBlocks(content: unknown): ToolUseBlock[] {
    if (!Array.isArray(content)) return []
    return content
      .filter((item) => item?.type === 'tool_use' && item?.name && item?.id)
      .map((item) => ({
        id: item.id as string,
        name: item.name as string,
        input: (item.input as Record<string, unknown>) || {}
      }))
  }

  /**
   * Check if a user message content array consists entirely of tool_result blocks
   * (no human text).
   */
  private isOnlyToolResult(content: unknown): boolean {
    if (!Array.isArray(content)) return false
    return content.length > 0 && content.every(
      (item) => item?.type === 'tool_result'
    )
  }

  /**
   * Classify a toolUseResult object into a typed ToolResult based on its fields.
   * Skip originalFile and Read content to avoid memory bloat.
   */
  private classifyToolResult(
    raw: Record<string, unknown>,
    messageContent: unknown,
    _pendingToolUses: Map<string, ToolUseBlock>
  ): ToolResult | null {
    if (!raw || typeof raw !== 'object') return null

    // Edit: has structuredPatch + oldString + filePath
    if (raw.structuredPatch && raw.oldString !== undefined && raw.filePath) {
      return {
        type: 'edit',
        filePath: raw.filePath as string,
        oldString: raw.oldString as string,
        newString: raw.newString as string,
        structuredPatch: raw.structuredPatch as EditStructuredPatch[],
        userModified: (raw.userModified as boolean) || false,
        replaceAll: (raw.replaceAll as boolean) || false
      }
    }

    // Write: type === 'create' + filePath
    if (raw.type === 'create' && raw.filePath) {
      return {
        type: 'write',
        filePath: raw.filePath as string
      }
    }

    // Read: type === 'text' + file.filePath
    if (raw.type === 'text' && raw.file && typeof raw.file === 'object') {
      const file = raw.file as Record<string, unknown>
      if (file.filePath) {
        return {
          type: 'read',
          filePath: file.filePath as string
        }
      }
    }

    // Bash: has stdout field
    if ('stdout' in raw && 'stderr' in raw) {
      return {
        type: 'bash',
        stdout: raw.stdout as string,
        stderr: raw.stderr as string,
        interrupted: (raw.interrupted as boolean) || false
      }
    }

    // Grep: has mode + content + filenames + numLines
    if ('mode' in raw && 'numLines' in raw && 'filenames' in raw) {
      return {
        type: 'grep',
        mode: raw.mode as string,
        filenames: raw.filenames as string[],
        content: raw.content as string,
        numFiles: (raw.numFiles as number) || 0,
        numLines: (raw.numLines as number) || 0
      }
    }

    // Glob: has filenames + numFiles (but no mode/numLines)
    if ('filenames' in raw && 'numFiles' in raw && !('mode' in raw)) {
      return {
        type: 'glob',
        filenames: raw.filenames as string[],
        numFiles: (raw.numFiles as number) || 0,
        truncated: (raw.truncated as boolean) || false
      }
    }

    // Task agent: has status + prompt + agentId
    if ('status' in raw && 'prompt' in raw && 'agentId' in raw) {
      return {
        type: 'taskAgent',
        status: raw.status as string,
        prompt: raw.prompt as string,
        agentId: raw.agentId as string
      }
    }

    // TaskCreate: has task object with id + subject
    if ('task' in raw && typeof raw.task === 'object' && raw.task !== null) {
      const task = raw.task as Record<string, unknown>
      if (task.id && task.subject) {
        return {
          type: 'taskCreate',
          taskId: task.id as string,
          subject: task.subject as string
        }
      }
    }

    // TaskUpdate: has success + taskId + updatedFields
    if ('taskId' in raw && 'updatedFields' in raw) {
      return {
        type: 'taskUpdate',
        taskId: raw.taskId as string,
        updatedFields: raw.updatedFields as string[],
        statusChange: raw.statusChange as { from: string; to: string } | undefined
      }
    }

    // Generic message (e.g., EnterPlanMode)
    if ('message' in raw && Object.keys(raw).length === 1) {
      // Determine tool name from the content's tool_use_id
      let toolName = 'unknown'
      if (Array.isArray(messageContent)) {
        const toolResultItem = messageContent.find((i: Record<string, unknown>) => i?.type === 'tool_result')
        if (toolResultItem?.tool_use_id) {
          const pending = _pendingToolUses.get(toolResultItem.tool_use_id as string)
          if (pending) toolName = pending.name
        }
      }
      return {
        type: 'generic',
        toolName,
        data: raw
      }
    }

    // Fallback: Generic with best-effort tool name
    let toolName = 'unknown'
    if (Array.isArray(messageContent)) {
      const toolResultItem = messageContent.find((i: Record<string, unknown>) => i?.type === 'tool_result')
      if (toolResultItem?.tool_use_id) {
        const pending = _pendingToolUses.get(toolResultItem.tool_use_id as string)
        if (pending) toolName = pending.name
      }
    }
    return {
      type: 'generic',
      toolName,
      data: raw
    }
  }

  // System tags injected by Claude Code hooks, IDE integrations, and the runtime.
  // Single regex with backreference ensures matched open/close pairs in one pass.
  private static SYSTEM_TAG_RE = new RegExp(
    '<(' +
    [
      'system-reminder',
      'command-name',
      'command-message',
      'command-args',
      'ide_selection',
      'ide_opened_file',
      'local-command-stdout',
      'local-command-caveat',
      'retrieval_status',
      'task_id',
      'task_type',
      'task-id',
      'task-notification',
      'fast_mode_info',
      'persisted-output',
      'tool_use_error',
      'user-prompt-submit-hook',
      'thinking',
      'ask_user'
    ].join('|') +
    ')>[\\s\\S]*?<\\/\\1>',
    'g'
  )

  private cleanContent(text: string): string {
    return text
      .replace(ConversationScanner.SYSTEM_TAG_RE, '')
      // Collapse horizontal whitespace (spaces, tabs) while preserving newlines
      .replace(/[^\S\n]+/g, ' ')
      // Limit consecutive blank lines to at most one
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  }

  private getShortProjectName(fullPath: string): string {
    // Get the last 2-3 meaningful path segments
    const parts = fullPath.split('/').filter(Boolean)
    const lastParts = parts.slice(-3)
    return lastParts.join('/')
  }

  async getConversation(id: string): Promise<Conversation | null> {
    if (this.conversationsCache.has(id)) {
      return this.conversationsCache.get(id) || null
    }
    return null
  }

  getProjects(): string[] {
    return Array.from(this.projects).sort()
  }
}

// Type alias for structured patch (used in classification)
type EditStructuredPatch = {
  oldStart: number
  oldLines: number
  newStart: number
  newLines: number
  lines: string[]
}
