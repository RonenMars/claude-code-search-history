import { readdir, readFile, stat } from 'fs/promises'
import { join } from 'path'
import { homedir } from 'os'
import { createReadStream } from 'fs'
import { createInterface } from 'readline'

export interface ConversationMessage {
  type: 'user' | 'assistant' | 'system'
  content: string
  timestamp: string
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

        const projectName = this.decodeProjectName(projectDir)
        this.projects.add(projectName)

        try {
          const files = await readdir(projectPath)
          const jsonlFiles = files.filter((f) => f.endsWith('.jsonl'))

          for (const file of jsonlFiles) {
            const filePath = join(projectPath, file)
            const fileStats = await stat(filePath)

            // Skip empty files
            if (fileStats.size === 0) continue

            try {
              const conversation = await this.parseConversation(filePath, projectName)
              if (conversation && conversation.messages.length > 0) {
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

  private decodeProjectName(encoded: string): string {
    // Convert -Users-ronenmars-Desktop-dev-ak-chatbot to /Users/ronenmars/Desktop/dev/ak/chatbot
    return encoded.replace(/^-/, '/').replace(/-/g, '/')
  }

  private async parseConversation(filePath: string, projectName: string): Promise<Conversation | null> {
    const messages: ConversationMessage[] = []
    let sessionId = ''
    let latestTimestamp = ''
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

        if (entry.sessionId && !sessionId) {
          sessionId = entry.sessionId
        }

        if (entry.timestamp) {
          if (!latestTimestamp || entry.timestamp > latestTimestamp) {
            latestTimestamp = entry.timestamp
          }
        }

        if (entry.type === 'user' || entry.type === 'assistant') {
          const content = this.extractContent(entry.message?.content)
          if (content && !entry.isMeta) {
            messages.push({
              type: entry.type,
              content,
              timestamp: entry.timestamp || ''
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

    return {
      id,
      filePath,
      projectPath: projectName,
      projectName: this.getShortProjectName(projectName),
      sessionId: sessionId || filePath.split('/').pop()?.replace('.jsonl', '') || '',
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

  private cleanContent(text: string): string {
    // Remove command tags and other noise
    return text
      .replace(/<command-name>.*?<\/command-name>/gs, '')
      .replace(/<command-message>.*?<\/command-message>/gs, '')
      .replace(/<command-args>.*?<\/command-args>/gs, '')
      .replace(/<ide_selection>.*?<\/ide_selection>/gs, '')
      .replace(/<system-reminder>.*?<\/system-reminder>/gs, '')
      .replace(/\s+/g, ' ')
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
