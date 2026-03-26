import { createReadStream } from 'node:fs'
import { access, readdir, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { createInterface } from 'node:readline'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import type { AssistantProvider, Message, ProviderSession } from './types'

const execAsync = promisify(exec)

export class CodexProvider implements AssistantProvider {
  readonly id = 'codex'
  readonly displayName = 'Codex CLI'
  readonly defaultPaths: string[] = ['~/.codex/sessions']

  async isAvailable(): Promise<boolean> {
    const codexSessionsDir = join(homedir(), '.codex', 'sessions')
    try {
      await access(codexSessionsDir)
      return true
    } catch {
      // Directory doesn't exist — check if binary is in PATH
    }

    try {
      await execAsync('which codex')
      return true
    } catch {
      return false
    }
  }

  async scanSessions(paths: string[]): Promise<ProviderSession[]> {
    const sessions: ProviderSession[] = []

    for (const rawPath of paths) {
      const resolvedPath = rawPath.replace(/^~/, homedir())
      let jsonlFiles: string[]
      try {
        jsonlFiles = await this.findJsonlFiles(resolvedPath)
      } catch {
        continue
      }

      for (const filePath of jsonlFiles) {
        try {
          const session = await this.parseSessionMeta(filePath)
          if (session) {
            sessions.push(session)
          }
        } catch (err) {
          console.error(`CodexProvider: error scanning ${filePath}:`, err)
        }
      }
    }

    return sessions
  }

  async loadSession(session: ProviderSession): Promise<ProviderSession> {
    const sessions = await this.parseLines(session.id, await this.readLines(session.id))
    if (sessions.length === 0) {
      return session
    }
    return { ...session, messages: sessions[0].messages }
  }

  resumeCommand(session: ProviderSession): string | null {
    if (session.sessionId) {
      return `codex resume ${session.sessionId}`
    }
    return null
  }

  // Public for testability — parses an array of JSONL lines into ProviderSession[]
  async parseLines(filePath: string, lines: string[]): Promise<ProviderSession[]> {
    let sessionId: string | undefined
    let title = ''
    let projectPath = ''
    let lastModified = ''
    const messages: Message[] = []

    for (const line of lines) {
      if (!line.trim()) continue
      let entry: Record<string, unknown>
      try {
        entry = JSON.parse(line) as Record<string, unknown>
      } catch {
        console.error(`CodexProvider: malformed JSON line in ${filePath}, skipping`)
        continue
      }

      const type = entry.type as string
      if (type === 'session_meta') {
        const session = entry.session as Record<string, unknown>
        if (session) {
          sessionId = session.id as string
          title = (session.title as string) || ''
          projectPath = (session.cwd as string) || ''
          const createdAt = session.createdAt
          if (typeof createdAt === 'number') {
            lastModified = new Date(createdAt * 1000).toISOString()
          } else if (typeof createdAt === 'string') {
            lastModified = createdAt
          } else {
            lastModified = new Date().toISOString()
          }
        }
      } else if (type === 'event_msg') {
        const role = entry.role as string
        if (role === 'user') {
          messages.push({
            role: 'user',
            content: (entry.content as string) || '',
          })
        }
      } else if (type === 'response_item') {
        const message = entry.message as Record<string, unknown>
        if (message) {
          const contentArray = message.content as Array<Record<string, unknown>>
          let text = ''
          if (Array.isArray(contentArray)) {
            const textItem = contentArray.find((item) => item.type === 'text')
            if (textItem) {
              text = (textItem.text as string) || ''
            }
          }
          messages.push({
            role: 'assistant',
            content: text,
            model: message.model as string | undefined,
          })
        }
      } else if (type === 'TokenCount') {
        if (messages.length > 0) {
          const last = messages[messages.length - 1]
          last.inputTokens = entry.inputTokens as number | undefined
          last.outputTokens = entry.outputTokens as number | undefined
        }
      }
      // Unknown types are ignored silently
    }

    if (!sessionId && title === '' && projectPath === '') {
      return []
    }

    const session: ProviderSession = {
      id: filePath,
      provider: 'codex',
      projectPath,
      title,
      messageCount: messages.length,
      lastModified,
      sessionId,
      messages,
    }

    return [session]
  }

  private async readLines(filePath: string): Promise<string[]> {
    const lines: string[] = []
    const fileStream = createReadStream(filePath)
    const rl = createInterface({ input: fileStream, crlfDelay: Infinity })
    for await (const line of rl) {
      lines.push(line)
    }
    return lines
  }

  private async parseSessionMeta(filePath: string): Promise<ProviderSession | null> {
    let sessionId: string | undefined
    let title = ''
    let projectPath = ''
    let lastModified = ''
    let messageCount = 0
    let foundMeta = false

    const fileStream = createReadStream(filePath)
    const rl = createInterface({ input: fileStream, crlfDelay: Infinity })

    for await (const line of rl) {
      if (!line.trim()) continue
      let entry: Record<string, unknown>
      try {
        entry = JSON.parse(line) as Record<string, unknown>
      } catch {
        continue
      }

      const type = entry.type as string
      if (type === 'session_meta') {
        foundMeta = true
        const session = entry.session as Record<string, unknown>
        if (session) {
          sessionId = session.id as string
          title = (session.title as string) || ''
          projectPath = (session.cwd as string) || ''
          const createdAt = session.createdAt
          if (typeof createdAt === 'number') {
            lastModified = new Date(createdAt * 1000).toISOString()
          } else if (typeof createdAt === 'string') {
            lastModified = createdAt
          } else {
            lastModified = new Date().toISOString()
          }
        }
      } else if (type === 'event_msg' || type === 'response_item') {
        messageCount++
      }
    }

    if (!foundMeta) return null

    return {
      id: filePath,
      provider: 'codex',
      projectPath,
      title,
      messageCount,
      lastModified,
      sessionId,
      messages: [],
    }
  }

  private async findJsonlFiles(dir: string): Promise<string[]> {
    const results: string[] = []

    const entries = await readdir(dir)
    for (const entry of entries) {
      if (entry.startsWith('.')) continue

      const fullPath = join(dir, entry)
      const stats = await stat(fullPath)

      if (stats.isFile() && entry.endsWith('.jsonl')) {
        results.push(fullPath)
      } else if (stats.isDirectory()) {
        if (entry !== 'subagents' && entry !== 'tool-results') {
          const nested = await this.findJsonlFiles(fullPath)
          results.push(...nested)
        }
      }
    }

    return results
  }
}
