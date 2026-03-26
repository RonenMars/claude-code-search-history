import type { AssistantProvider, ProviderInfo, ProviderSession } from './types'

interface RegistrySettings {
  enabledProviders?: string[]
  providerPaths?: Record<string, string[]>
}

export class ProviderRegistry {
  private providers: Map<string, AssistantProvider>
  private settings: RegistrySettings
  private sessionCache: Map<string, ProviderSession> = new Map()
  private discoveryCallback?: (newProviders: string[]) => void

  constructor(providers: AssistantProvider[], settings: RegistrySettings = {}) {
    this.providers = new Map(providers.map((p) => [p.id, p]))
    this.settings = settings
  }

  setDiscoveryCallback(cb: (newProviders: string[]) => void): void {
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
      this.discoveryCallback(newlyDiscovered)
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
