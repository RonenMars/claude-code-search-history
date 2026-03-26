import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { AssistantProvider, ProviderSession } from './types'

// Import from the not-yet-existing module — this will fail until Plan 02 implements it
import { ClaudeProvider } from './claude'

describe('ClaudeProvider', () => {
  let provider: ClaudeProvider

  beforeEach(() => {
    provider = new ClaudeProvider([])
    vi.restoreAllMocks()
  })

  it('implements the AssistantProvider interface', () => {
    const p = provider as AssistantProvider
    expect(typeof p.id).toBe('string')
    expect(typeof p.displayName).toBe('string')
    expect(Array.isArray(p.defaultPaths)).toBe(true)
    expect(typeof p.isAvailable).toBe('function')
    expect(typeof p.scanSessions).toBe('function')
    expect(typeof p.loadSession).toBe('function')
    expect(typeof p.resumeCommand).toBe('function')
  })

  it('scanSessions() returns ProviderSession[] with provider === "claude" on each session', async () => {
    vi.mock('node:fs/promises', () => ({
      readdir: vi.fn().mockResolvedValue([]),
    }))
    const sessions = await provider.scanSessions([])
    expect(Array.isArray(sessions)).toBe(true)
    sessions.forEach((s: ProviderSession) => {
      expect(s.provider).toBe('claude')
    })
  })

  it('resumeCommand() returns "claude --resume <sessionId>" for a session with a sessionId', () => {
    const session: ProviderSession = {
      id: '/path/to/session.jsonl',
      provider: 'claude',
      projectPath: '/projects/myapp',
      title: 'Fix the bug',
      messageCount: 5,
      lastModified: '2024-01-01T00:00:00Z',
      sessionId: 'abc-123-uuid',
      messages: []
    }
    const cmd = provider.resumeCommand(session)
    expect(cmd).toBe('claude --resume abc-123-uuid')
  })

  it('resumeCommand() returns null when session has no sessionId', () => {
    const session: ProviderSession = {
      id: '/path/to/session.jsonl',
      provider: 'claude',
      projectPath: '/projects/myapp',
      title: 'Fix the bug',
      messageCount: 5,
      lastModified: '2024-01-01T00:00:00Z',
      messages: []
    }
    const cmd = provider.resumeCommand(session)
    expect(cmd).toBeNull()
  })

  it('isAvailable() returns true when ~/.claude/projects/ exists', async () => {
    vi.mock('node:fs/promises', () => ({
      access: vi.fn().mockResolvedValue(undefined),
    }))
    const result = await provider.isAvailable()
    expect(typeof result).toBe('boolean')
  })
})
