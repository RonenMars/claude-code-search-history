import { access } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { Profile } from '../../shared/types'
import { ConversationScanner } from '../services/scanner'
import type { AssistantProvider, Message, ProviderSession } from './types'

export class ClaudeProvider implements AssistantProvider {
  readonly id = 'claude'
  readonly displayName = 'Claude Code'
  readonly defaultPaths: string[] = []

  private scanner: ConversationScanner

  constructor(private profiles: Profile[]) {
    this.scanner = new ConversationScanner(profiles)
  }

  setProgressCallback(cb: (scanned: number, total: number) => void): void {
    this.scanner.setProgressCallback(cb)
  }

  async isAvailable(): Promise<boolean> {
    const claudeProjectsDir = join(homedir(), '.claude', 'projects')
    try {
      await access(claudeProjectsDir)
      return true
    } catch {
      return false
    }
  }

  async scanSessions(_paths: string[]): Promise<ProviderSession[]> {
    const metas = await this.scanner.scanAllMeta()
    return metas.map((meta) => ({
      id: meta.id,
      provider: 'claude',
      projectPath: meta.projectPath,
      title: meta.sessionName || meta.sessionId,
      messageCount: meta.messageCount,
      lastModified: meta.timestamp,
      sessionId: meta.sessionId,
      messages: [],
    }))
  }

  async loadSession(session: ProviderSession): Promise<ProviderSession> {
    const conversation = await this.scanner.getConversation(session.id)
    if (!conversation) {
      return session
    }

    const messages: Message[] = conversation.messages.map((m) => ({
      role: m.type === 'user' ? 'user' : 'assistant',
      content: m.content,
    }))

    return { ...session, messages }
  }

  resumeCommand(session: ProviderSession): string | null {
    if (session.sessionId) {
      return `claude --resume ${session.sessionId}`
    }
    return null
  }
}
