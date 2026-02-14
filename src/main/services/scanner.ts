import { readdir, stat } from 'fs/promises'
import { join } from 'path'
import { homedir } from 'os'
import { createReadStream } from 'fs'
import { createInterface } from 'readline'

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

    const fileStream = createReadStream(filePath)
    const rl = createInterface({
      input: fileStream,
      crlfDelay: Infinity
    })

    for await (const line of rl) {
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
          const content = this.extractContent(entry.message?.content)
          if (content && !entry.isMeta) {
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

            const toolUses = this.extractToolUseNames(entry.message?.content)
            if (toolUses.length > 0) metadata.toolUses = toolUses

            messages.push({
              type: entry.type,
              content,
              timestamp: entry.timestamp || '',
              metadata: Object.keys(metadata).length > 0 ? metadata : undefined
            })
            textParts.push(content)
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
