import { describe, it, expect, vi } from 'vitest'
import type { AssistantProvider, ProviderSession } from './types'

// Import from the not-yet-existing module — this will fail until Plan 02 implements it
import { ProviderRegistry } from './registry'

// Fixture helpers
function makeSession(overrides: Partial<ProviderSession>): ProviderSession {
  return {
    id: '/path/to/session.jsonl',
    provider: 'claude',
    projectPath: '/projects/myapp',
    title: 'Session',
    messageCount: 1,
    lastModified: '2024-01-01T00:00:00Z',
    messages: [],
    ...overrides
  }
}

function makeProvider(id: string, sessions: ProviderSession[]): AssistantProvider {
  return {
    id,
    displayName: id,
    defaultPaths: [],
    isAvailable: vi.fn().mockResolvedValue(true),
    scanSessions: vi.fn().mockResolvedValue(sessions),
    loadSession: vi.fn().mockImplementation(async (s) => s),
    resumeCommand: vi.fn().mockReturnValue(null)
  }
}

describe('ProviderRegistry', () => {
  it('scanAll() merges sessions from two providers, sorted by lastModified desc', async () => {
    const claudeSession = makeSession({
      id: '/claude/session1.jsonl',
      provider: 'claude',
      lastModified: '2024-01-02T00:00:00Z'
    })
    const codexSession = makeSession({
      id: '/codex/session1.jsonl',
      provider: 'codex',
      lastModified: '2024-01-03T00:00:00Z'
    })

    const claudeProvider = makeProvider('claude', [claudeSession])
    const codexProvider = makeProvider('codex', [codexSession])

    const registry = new ProviderRegistry(
      [claudeProvider, codexProvider],
      { enabledProviders: ['claude', 'codex'] }
    )

    const sessions = await registry.scanAll()
    expect(sessions).toHaveLength(2)
    // sorted desc by lastModified
    expect(sessions[0].id).toBe('/codex/session1.jsonl')
    expect(sessions[1].id).toBe('/claude/session1.jsonl')
  })

  it('scanAll() excludes sessions from a disabled provider (not in enabledProviders setting)', async () => {
    const claudeSession = makeSession({ id: '/claude/s.jsonl', provider: 'claude' })
    const codexSession = makeSession({ id: '/codex/s.jsonl', provider: 'codex' })

    const claudeProvider = makeProvider('claude', [claudeSession])
    const codexProvider = makeProvider('codex', [codexSession])

    const registry = new ProviderRegistry(
      [claudeProvider, codexProvider],
      { enabledProviders: ['claude'] }
    )

    const sessions = await registry.scanAll()
    expect(sessions.every(s => s.provider === 'claude')).toBe(true)
    expect(sessions.some(s => s.provider === 'codex')).toBe(false)
  })

  it('scanAll() returns only Claude sessions when Codex is disabled', async () => {
    const claudeSession1 = makeSession({ id: '/claude/s1.jsonl', provider: 'claude', lastModified: '2024-01-01T00:00:00Z' })
    const claudeSession2 = makeSession({ id: '/claude/s2.jsonl', provider: 'claude', lastModified: '2024-01-02T00:00:00Z' })
    const codexSession = makeSession({ id: '/codex/s.jsonl', provider: 'codex' })

    const claudeProvider = makeProvider('claude', [claudeSession1, claudeSession2])
    const codexProvider = makeProvider('codex', [codexSession])

    const registry = new ProviderRegistry(
      [claudeProvider, codexProvider],
      { enabledProviders: ['claude'] }
    )

    const sessions = await registry.scanAll()
    expect(sessions).toHaveLength(2)
    sessions.forEach(s => expect(s.provider).toBe('claude'))
  })

  it('auto-discovers available providers not yet in enabledProviders; returns newly found list', async () => {
    const codexSession = makeSession({ id: '/codex/s.jsonl', provider: 'codex' })
    const claudeProvider = makeProvider('claude', [])
    const codexProvider = makeProvider('codex', [codexSession])

    const registry = new ProviderRegistry(
      [claudeProvider, codexProvider],
      { enabledProviders: ['claude'] }
    )

    const discovered = await registry.discoverNewProviders()
    expect(Array.isArray(discovered)).toBe(true)
    expect(discovered).toContain('codex')
  })

  it('getSession(id) routes to the provider that owns that session id', async () => {
    const codexSession = makeSession({
      id: '/codex/session.jsonl',
      provider: 'codex',
      sessionId: 'codex-uuid'
    })
    const codexProvider = makeProvider('codex', [codexSession])

    const registry = new ProviderRegistry(
      [codexProvider],
      { enabledProviders: ['codex'] }
    )

    await registry.scanAll()
    const session = await registry.getSession('/codex/session.jsonl')
    expect(session).not.toBeNull()
    expect(session?.provider).toBe('codex')
  })

  it('getProjects() returns union of project paths from all active providers', async () => {
    const s1 = makeSession({ id: '/c/s1.jsonl', provider: 'claude', projectPath: '/projects/app-a' })
    const s2 = makeSession({ id: '/x/s2.jsonl', provider: 'codex', projectPath: '/projects/app-b' })
    const s3 = makeSession({ id: '/c/s3.jsonl', provider: 'claude', projectPath: '/projects/app-a' }) // duplicate

    const claudeProvider = makeProvider('claude', [s1, s3])
    const codexProvider = makeProvider('codex', [s2])

    const registry = new ProviderRegistry(
      [claudeProvider, codexProvider],
      { enabledProviders: ['claude', 'codex'] }
    )

    await registry.scanAll()
    const projects = registry.getProjects()
    expect(projects).toContain('/projects/app-a')
    expect(projects).toContain('/projects/app-b')
    // No duplicates
    expect(projects.filter(p => p === '/projects/app-a')).toHaveLength(1)
  })
})
