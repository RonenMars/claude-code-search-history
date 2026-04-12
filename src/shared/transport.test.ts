import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getTransport, setTransport, type Transport } from './transport'
import type { SearchResult, Conversation, Profile } from './types'

// ─── Mock Transport ────────────────────────────────────────────────────────

function makeMockTransport(overrides: Partial<Transport> = {}): Transport {
  return {
    listConversations: vi.fn().mockResolvedValue([] as SearchResult[]),
    getConversation: vi.fn().mockResolvedValue(null),
    search: vi.fn().mockResolvedValue([] as SearchResult[]),
    getProfiles: vi.fn().mockResolvedValue([] as Profile[]),
    getActiveSessions: vi.fn().mockResolvedValue([]),
    streamTerminal: vi.fn().mockReturnValue(() => {}),
    sendInput: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

beforeEach(() => {
  // Reset singleton between tests
  setTransport(null)
})

describe('getTransport', () => {
  it('returns the injected transport', () => {
    const mock = makeMockTransport()
    setTransport(mock)
    expect(getTransport()).toBe(mock)
  })

  it('returns the same instance on repeated calls', () => {
    const mock = makeMockTransport()
    setTransport(mock)
    expect(getTransport()).toBe(getTransport())
  })
})

describe('MockTransport', () => {
  it('listConversations resolves to an array', async () => {
    const mock = makeMockTransport()
    setTransport(mock)
    const results = await getTransport().listConversations({})
    expect(Array.isArray(results)).toBe(true)
    expect(mock.listConversations).toHaveBeenCalledWith({})
  })

  it('getConversation resolves to null when not found', async () => {
    const mock = makeMockTransport()
    setTransport(mock)
    const conv = await getTransport().getConversation('nonexistent')
    expect(conv).toBeNull()
  })

  it('getConversation resolves to a conversation when found', async () => {
    const fakeConv: Partial<Conversation> = {
      id: 'test-id',
      projectName: 'my-project',
      messages: [],
    }
    const mock = makeMockTransport({
      getConversation: vi.fn().mockResolvedValue(fakeConv as Conversation),
    })
    setTransport(mock)
    const result = await getTransport().getConversation('test-id')
    expect(result?.id).toBe('test-id')
    expect(result?.projectName).toBe('my-project')
  })

  it('search delegates query and filter', async () => {
    const fakeResults: SearchResult[] = [
      {
        id: 'r1',
        projectName: 'proj',
        projectPath: '/proj',
        sessionId: 's1',
        sessionName: '',
        preview: 'hello world',
        timestamp: new Date().toISOString(),
        messageCount: 3,
        score: 1,
        lastMessageSender: 'assistant',
        account: 'default',
      },
    ]
    const mock = makeMockTransport({
      search: vi.fn().mockResolvedValue(fakeResults),
    })
    setTransport(mock)
    const results = await getTransport().search('hello', { limit: 10 })
    expect(results).toHaveLength(1)
    expect(results[0].id).toBe('r1')
    expect(mock.search).toHaveBeenCalledWith('hello', { limit: 10 })
  })

  it('getProfiles returns profile list', async () => {
    const fakeProfiles: Profile[] = [
      { id: 'default', label: 'Default', emoji: '🤖', configDir: '~/.claude', enabled: true },
    ]
    const mock = makeMockTransport({
      getProfiles: vi.fn().mockResolvedValue(fakeProfiles),
    })
    setTransport(mock)
    const profiles = await getTransport().getProfiles()
    expect(profiles).toHaveLength(1)
    expect(profiles[0].id).toBe('default')
  })

  it('streamTerminal returns a cleanup function', () => {
    const cleanup = vi.fn()
    const mock = makeMockTransport({
      streamTerminal: vi.fn().mockReturnValue(cleanup),
    })
    setTransport(mock)
    const unsubscribe = getTransport().streamTerminal('session-1', () => {})
    unsubscribe()
    expect(cleanup).toHaveBeenCalledOnce()
  })

  it('getActiveSessions returns session array', async () => {
    const mock = makeMockTransport()
    setTransport(mock)
    const sessions = await getTransport().getActiveSessions()
    expect(Array.isArray(sessions)).toBe(true)
  })
})
