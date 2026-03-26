import type { Conversation, ConversationMeta } from '../../shared/types'
import type { AssistantProvider, ProviderInfo, ProviderSession } from './types'

interface RegistrySettings {
  enabledProviders?: string[]
  providerPaths?: Record<string, string[]>
}

export class ProviderRegistry {
  private providers: Map<string, AssistantProvider>
  private settings: RegistrySettings
  private sessionCache: Map<string, ProviderSession> = new Map()
  private discoveryCallback?: (newProviders: ProviderInfo[]) => void

  constructor(providers: AssistantProvider[], settings: RegistrySettings = {}) {
    this.providers = new Map(providers.map((p) => [p.id, p]))
    this.settings = settings
  }

  setDiscoveryCallback(cb: (newProviders: ProviderInfo[]) => void): void {
    this.discoveryCallback = cb
  }

  setProgressCallback(cb: (scanned: number, total: number) => void): void {
    // Pass through to any provider that supports it (e.g. ClaudeProvider)
    for (const provider of this.providers.values()) {
      const p = provider as AssistantProvider & { setProgressCallback?: (cb: (scanned: number, total: number) => void) => void }
      if (typeof p.setProgressCallback === 'function') {
        p.setProgressCallback(cb)
      }
    }
  }

  async scanAll(): Promise<ProviderSession[]> {
    const enabledProviders = this.settings.enabledProviders ?? ['claude']
    const allSessions: ProviderSession[] = []

    for (const providerId of enabledProviders) {
      const provider = this.providers.get(providerId)
      if (!provider) continue

      const paths = this.settings.providerPaths?.[providerId] ?? provider.defaultPaths
      try {
        const sessions = await provider.scanSessions(paths)
        for (const session of sessions) {
          allSessions.push(session)
          this.sessionCache.set(session.id, session)
        }
      } catch (err) {
        console.error(`ProviderRegistry: error scanning provider ${providerId}:`, err)
      }
    }

    allSessions.sort(
      (a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()
    )

    // Check for newly available providers not yet in enabledProviders
    const newlyDiscovered = await this.discoverNewProviders()
    if (newlyDiscovered.length > 0 && this.discoveryCallback) {
      const providerInfos: ProviderInfo[] = newlyDiscovered.map((id) => {
        const provider = this.providers.get(id)
        return { id, displayName: provider?.displayName ?? id, enabled: false, available: true }
      })
      this.discoveryCallback(providerInfos)
    }

    return allSessions
  }

  async discoverNewProviders(): Promise<string[]> {
    const enabledProviders = new Set(this.settings.enabledProviders ?? ['claude'])
    const discovered: string[] = []

    for (const [id, provider] of this.providers.entries()) {
      if (enabledProviders.has(id)) continue
      try {
        const available = await provider.isAvailable()
        if (available) {
          discovered.push(id)
        }
      } catch {
        // Ignore availability check errors
      }
    }

    return discovered
  }

  async getSession(id: string): Promise<ProviderSession | null> {
    const cached = this.sessionCache.get(id)
    if (!cached) return null

    const provider = this.providers.get(cached.provider)
    if (!provider) return null

    try {
      return await provider.loadSession(cached)
    } catch (err) {
      console.error(`ProviderRegistry: error loading session ${id}:`, err)
      return null
    }
  }

  getProjects(): string[] {
    const projectPaths = new Set<string>()
    for (const session of this.sessionCache.values()) {
      if (session.projectPath) {
        projectPaths.add(session.projectPath)
      }
    }
    return Array.from(projectPaths)
  }

  async getConversation(id: string): Promise<Conversation | null> {
    const session = await this.getSession(id)
    if (!session) return null

    return {
      id: session.id,
      filePath: session.id,
      projectPath: session.projectPath,
      projectName: session.projectPath.split('/').pop() ?? '',
      sessionId: session.sessionId ?? session.id,
      sessionName: session.title,
      messages: session.messages.map((m) => ({
        type: m.role === 'user' ? 'user' : 'assistant',
        content: m.content,
        timestamp: session.lastModified,
      })),
      fullText: session.messages.map((m) => m.content).join('\n'),
      timestamp: session.lastModified,
      messageCount: session.messageCount,
      account: session.provider ?? 'default',
    }
  }

  getLatestForProject(projectPath: string): ConversationMeta | null {
    let latest: ProviderSession | null = null
    for (const session of this.sessionCache.values()) {
      if (session.projectPath === projectPath || session.projectPath === `${projectPath}/`) {
        if (!latest || session.lastModified > latest.lastModified) {
          latest = session
        }
      }
    }
    if (!latest) return null
    return {
      id: latest.id,
      filePath: latest.id,
      projectPath: latest.projectPath,
      projectName: latest.projectPath.split('/').pop() ?? '',
      sessionId: latest.sessionId ?? latest.id,
      sessionName: latest.title,
      timestamp: latest.lastModified,
      messageCount: latest.messageCount,
      preview: '',
      contentSnippet: '',
      lastMessageSender: 'assistant',
      account: latest.provider ?? 'default',
      provider: latest.provider,
    }
  }

  async getProviderInfoList(enabledProviders: string[]): Promise<ProviderInfo[]> {
    const enabledSet = new Set(enabledProviders)
    const results: ProviderInfo[] = []

    for (const [id, provider] of this.providers.entries()) {
      let available = false
      try {
        available = await provider.isAvailable()
      } catch {
        available = false
      }
      results.push({
        id,
        displayName: provider.displayName,
        enabled: enabledSet.has(id),
        available,
      })
    }

    return results
  }
}
