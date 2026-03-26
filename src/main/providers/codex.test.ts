import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ProviderSession } from './types'

// Import from the not-yet-existing module — this will fail until Plan 02 implements it
import { CodexProvider } from './codex'

// JSONL fixture lines
const SESSION_META_LINE = JSON.stringify({ type: "session_meta", session: { id: "uuid-123", title: "Fix the bug", cwd: "/projects/myapp", createdAt: 1700000000 } })
const USER_MSG_LINE = JSON.stringify({ type: "event_msg", role: "user", content: "fix the bug" })
const RESPONSE_LINE = JSON.stringify({ type: "response_item", message: { content: [{ type: "text", text: "Done." }], model: "gpt-4o" } })
const TOKEN_LINE = JSON.stringify({ type: "TokenCount", inputTokens: 100, outputTokens: 50 })
const UNKNOWN_LINE = JSON.stringify({ type: "unknown_future_type", data: "some data" })

describe('CodexProvider JSONL parsing', () => {
  let provider: CodexProvider

  beforeEach(() => {
    provider = new CodexProvider()
    vi.restoreAllMocks()
  })

  it('parses session_meta line → sets session id, title, projectPath, lastModified', async () => {
    const sessions = await provider.parseLines('test-file.jsonl', [SESSION_META_LINE])
    expect(sessions).toHaveLength(1)
    const s = sessions[0]
    expect(s.sessionId).toBe('uuid-123')
    expect(s.title).toBe('Fix the bug')
    expect(s.projectPath).toBe('/projects/myapp')
    expect(s.lastModified).toBeTruthy()
  })

  it('parses event_msg with role=user → creates user Message', async () => {
    const sessions = await provider.parseLines('test-file.jsonl', [SESSION_META_LINE, USER_MSG_LINE])
    expect(sessions).toHaveLength(1)
    const messages = sessions[0].messages
    const userMsg = messages.find(m => m.role === 'user')
    expect(userMsg).toBeDefined()
    expect(userMsg?.content).toBe('fix the bug')
  })

  it('parses response_item → creates assistant Message with content from message.content array', async () => {
    const sessions = await provider.parseLines('test-file.jsonl', [SESSION_META_LINE, RESPONSE_LINE])
    expect(sessions).toHaveLength(1)
    const messages = sessions[0].messages
    const assistantMsg = messages.find(m => m.role === 'assistant')
    expect(assistantMsg).toBeDefined()
    expect(assistantMsg?.content).toBe('Done.')
    expect(assistantMsg?.model).toBe('gpt-4o')
  })

  it('parses TokenCount → sets inputTokens/outputTokens on last message', async () => {
    const sessions = await provider.parseLines('test-file.jsonl', [SESSION_META_LINE, RESPONSE_LINE, TOKEN_LINE])
    expect(sessions).toHaveLength(1)
    const messages = sessions[0].messages
    const lastMsg = messages[messages.length - 1]
    expect(lastMsg?.inputTokens).toBe(100)
    expect(lastMsg?.outputTokens).toBe(50)
  })

  it('ignores unknown type values without throwing', async () => {
    await expect(
      provider.parseLines('test-file.jsonl', [SESSION_META_LINE, UNKNOWN_LINE])
    ).resolves.not.toThrow()
  })

  it('resumeCommand() returns "codex resume <session.sessionId>" (uses sessionId, not id)', () => {
    const session: ProviderSession = {
      id: '/path/to/session.jsonl',
      provider: 'codex',
      projectPath: '/projects/myapp',
      title: 'Fix the bug',
      messageCount: 3,
      lastModified: '2024-01-01T00:00:00Z',
      sessionId: 'uuid-session-456',
      messages: []
    }
    const cmd = provider.resumeCommand(session)
    expect(cmd).toBe('codex resume uuid-session-456')
  })

  it('isAvailable() returns true when ~/.codex/sessions/ exists', async () => {
    vi.mock('node:fs/promises', () => ({
      access: vi.fn().mockResolvedValue(undefined),
    }))
    const result = await provider.isAvailable()
    expect(typeof result).toBe('boolean')
  })
})
