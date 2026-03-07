import { mkdtemp, rm, mkdir, copyFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { ConversationScanner } from './scanner'
import type { Profile } from '../../shared/types'

const FIXTURES_DIR = join(__dirname, '..', '..', 'test', 'fixtures')

function makeProfile(configDir: string, id = 'default'): Profile {
  return {
    id,
    label: id,
    emoji: '🤖',
    configDir,
    enabled: true,
  }
}

/**
 * Creates a temp directory with the expected Claude config layout:
 *   <tmpDir>/projects/<encodedProjectName>/<sessionFile>.jsonl
 *
 * Returns the tmpDir path (to be used as profile.configDir).
 */
async function setupTempConfig(
  files: Array<{ projectDir: string; fileName: string; fixturePath?: string; content?: string }>
): Promise<string> {
  const tmpDir = await mkdtemp(join(tmpdir(), 'scanner-test-'))
  const projectsDir = join(tmpDir, 'projects')
  await mkdir(projectsDir, { recursive: true })

  for (const file of files) {
    const dir = join(projectsDir, file.projectDir)
    await mkdir(dir, { recursive: true })
    const dest = join(dir, file.fileName)
    if (file.fixturePath) {
      await copyFile(file.fixturePath, dest)
    } else if (file.content !== undefined) {
      await writeFile(dest, file.content, 'utf-8')
    }
  }

  return tmpDir
}

let tempDirs: string[] = []

afterEach(async () => {
  for (const dir of tempDirs) {
    await rm(dir, { recursive: true, force: true }).catch(() => {})
  }
  tempDirs = []
})

async function createConfig(
  files: Array<{ projectDir: string; fileName: string; fixturePath?: string; content?: string }>
): Promise<string> {
  const dir = await setupTempConfig(files)
  tempDirs.push(dir)
  return dir
}

// ─── scanAllMeta ──────────────────────────────────────────────────

describe('ConversationScanner', () => {
  describe('scanAllMeta', () => {
    it('parses a valid JSONL file and returns correct ConversationMeta shape', async () => {
      const configDir = await createConfig([
        {
          projectDir: '-Users-test-dev-my-project',
          fileName: 'sess-abc-123.jsonl',
          fixturePath: join(FIXTURES_DIR, 'sample-conversation.jsonl'),
        },
      ])

      const scanner = new ConversationScanner([makeProfile(configDir)])
      const metas = await scanner.scanAllMeta()

      expect(metas).toHaveLength(1)
      const meta = metas[0]

      expect(meta.sessionId).toBe('sess-abc-123')
      expect(meta.sessionName).toBe('fix-login-bug')
      expect(meta.projectPath).toBe('/Users/test/dev/my-project')
      expect(meta.projectName).toBe('test/dev/my-project')
      expect(meta.timestamp).toBe('2025-01-15T10:00:15Z')
      expect(meta.account).toBe('default')
      // 6 lines: 2 assistant text messages, 1 user text, 2 tool result users, 1 final assistant
      // user line 1: content "Can you help me fix the login bug?" => counts
      // assistant line 2: text block => counts
      // user line 3: toolUseResult + isOnlyToolResult => counts (no extractable text but has toolUseResult)
      // assistant line 4: text block => counts
      // user line 5: toolUseResult + isOnlyToolResult => counts
      // assistant line 6: string content => counts
      expect(meta.messageCount).toBe(6)
      expect(meta.lastMessageSender).toBe('assistant')
      expect(meta.preview).toContain('Can you help me fix the login bug?')
      expect(meta.contentSnippet.length).toBeGreaterThan(0)
      expect(meta.filePath).toContain('sess-abc-123.jsonl')
      expect(meta.id).toBe(meta.filePath)
    })

    it('returns metas sorted by timestamp descending', async () => {
      const olderContent = [
        '{"type":"user","cwd":"/a","sessionId":"old","timestamp":"2024-01-01T00:00:00Z","message":{"content":"old"}}',
        '{"type":"assistant","timestamp":"2024-01-01T00:00:01Z","message":{"content":"reply"}}',
      ].join('\n')

      const newerContent = [
        '{"type":"user","cwd":"/b","sessionId":"new","timestamp":"2025-06-01T00:00:00Z","message":{"content":"new"}}',
        '{"type":"assistant","timestamp":"2025-06-01T00:00:01Z","message":{"content":"reply"}}',
      ].join('\n')

      const configDir = await createConfig([
        { projectDir: '-a', fileName: 'old.jsonl', content: olderContent },
        { projectDir: '-b', fileName: 'new.jsonl', content: newerContent },
      ])

      const scanner = new ConversationScanner([makeProfile(configDir)])
      const metas = await scanner.scanAllMeta()

      expect(metas).toHaveLength(2)
      expect(metas[0].sessionId).toBe('new')
      expect(metas[1].sessionId).toBe('old')
    })
  })

  // ─── Malformed JSONL ──────────────────────────────────────────────

  describe('malformed JSONL handling', () => {
    it('skips bad lines and still counts valid messages', async () => {
      const configDir = await createConfig([
        {
          projectDir: '-Users-test-dev-project',
          fileName: 'sess-bad.jsonl',
          fixturePath: join(FIXTURES_DIR, 'malformed.jsonl'),
        },
      ])

      const scanner = new ConversationScanner([makeProfile(configDir)])
      const metas = await scanner.scanAllMeta()

      expect(metas).toHaveLength(1)
      // 3 valid JSON lines with content: line 1, 3, 5
      expect(metas[0].messageCount).toBe(3)
      expect(metas[0].sessionId).toBe('sess-bad')
    })
  })

  // ─── Empty files ──────────────────────────────────────────────────

  describe('empty files', () => {
    it('skips empty files (size 0)', async () => {
      const configDir = await createConfig([
        {
          projectDir: '-Users-test-dev-project',
          fileName: 'empty.jsonl',
          content: '',
        },
      ])

      const scanner = new ConversationScanner([makeProfile(configDir)])
      const metas = await scanner.scanAllMeta()

      expect(metas).toHaveLength(0)
    })
  })

  // ─── Meta-only files ──────────────────────────────────────────────

  describe('meta-only files', () => {
    it('returns no metas when all entries are isMeta', async () => {
      const configDir = await createConfig([
        {
          projectDir: '-Users-test-dev-project',
          fileName: 'meta-only.jsonl',
          fixturePath: join(FIXTURES_DIR, 'meta-only.jsonl'),
        },
      ])

      const scanner = new ConversationScanner([makeProfile(configDir)])
      const metas = await scanner.scanAllMeta()

      expect(metas).toHaveLength(0)
    })
  })

  // ─── System tag cleaning ──────────────────────────────────────────

  describe('system tag cleaning', () => {
    it('strips system-reminder, thinking, and fast_mode_info tags from content', async () => {
      const configDir = await createConfig([
        {
          projectDir: '-Users-test-dev-project',
          fileName: 'sess-tags.jsonl',
          fixturePath: join(FIXTURES_DIR, 'system-tags.jsonl'),
        },
      ])

      const scanner = new ConversationScanner([makeProfile(configDir)])
      const metas = await scanner.scanAllMeta()

      expect(metas).toHaveLength(1)
      // The user message after tag stripping should be "Please help me with my code"
      expect(metas[0].preview).toContain('Please help me with')
      expect(metas[0].preview).toContain('my code')
      expect(metas[0].preview).not.toContain('system-reminder')
      expect(metas[0].preview).not.toContain('<thinking>')
      expect(metas[0].preview).not.toContain('fast_mode_info')
      expect(metas[0].contentSnippet).not.toContain('You are Claude')
      expect(metas[0].contentSnippet).not.toContain('internal thought')
      expect(metas[0].contentSnippet).not.toContain('some info')
    })
  })

  // ─── extractContent (private) ─────────────────────────────────────

  describe('extractContent', () => {
    let scanner: ConversationScanner

    beforeEach(() => {
      scanner = new ConversationScanner([])
    })

    it('returns empty string for falsy content', () => {
      const extract = (scanner as any).extractContent.bind(scanner)
      expect(extract(null)).toBe('')
      expect(extract(undefined)).toBe('')
      expect(extract('')).toBe('')
    })

    it('handles plain string content', () => {
      const extract = (scanner as any).extractContent.bind(scanner)
      expect(extract('Hello world')).toBe('Hello world')
    })

    it('handles array with text blocks', () => {
      const extract = (scanner as any).extractContent.bind(scanner)
      const content = [
        { type: 'text', text: 'First part.' },
        { type: 'text', text: 'Second part.' },
      ]
      expect(extract(content)).toBe('First part. Second part.')
    })

    it('handles array with tool_result blocks containing string content', () => {
      const extract = (scanner as any).extractContent.bind(scanner)
      const content = [
        { type: 'tool_result', content: 'Tool output here' },
      ]
      expect(extract(content)).toBe('Tool output here')
    })

    it('returns empty for tool_result with non-string content', () => {
      const extract = (scanner as any).extractContent.bind(scanner)
      const content = [
        { type: 'tool_result', content: { nested: true } },
      ]
      expect(extract(content)).toBe('')
    })

    it('filters out tool_use blocks (no text)', () => {
      const extract = (scanner as any).extractContent.bind(scanner)
      const content = [
        { type: 'text', text: 'Some text' },
        { type: 'tool_use', id: 'x', name: 'Read', input: {} },
      ]
      expect(extract(content)).toBe('Some text')
    })

    it('returns empty for non-string non-array content', () => {
      const extract = (scanner as any).extractContent.bind(scanner)
      expect(extract(42)).toBe('')
      expect(extract({ type: 'text' })).toBe('')
    })
  })

  // ─── cleanContent (private) ───────────────────────────────────────

  describe('cleanContent', () => {
    let scanner: ConversationScanner

    beforeEach(() => {
      scanner = new ConversationScanner([])
    })

    it('removes system-reminder tags', () => {
      const clean = (scanner as any).cleanContent.bind(scanner)
      expect(clean('<system-reminder>secret</system-reminder>hello')).toBe('hello')
    })

    it('removes thinking tags', () => {
      const clean = (scanner as any).cleanContent.bind(scanner)
      expect(clean('before<thinking>thoughts</thinking>after')).toBe('beforeafter')
    })

    it('removes fast_mode_info tags', () => {
      const clean = (scanner as any).cleanContent.bind(scanner)
      expect(clean('text<fast_mode_info>info</fast_mode_info>more')).toBe('textmore')
    })

    it('removes ide_selection tags', () => {
      const clean = (scanner as any).cleanContent.bind(scanner)
      expect(clean('<ide_selection>code</ide_selection>rest')).toBe('rest')
    })

    it('collapses multiple spaces into one', () => {
      const clean = (scanner as any).cleanContent.bind(scanner)
      expect(clean('a    b     c')).toBe('a b c')
    })

    it('limits consecutive blank lines to one', () => {
      const clean = (scanner as any).cleanContent.bind(scanner)
      expect(clean('a\n\n\n\n\nb')).toBe('a\n\nb')
    })

    it('trims leading and trailing whitespace', () => {
      const clean = (scanner as any).cleanContent.bind(scanner)
      expect(clean('  hello  ')).toBe('hello')
    })

    it('handles nested tags within content', () => {
      const clean = (scanner as any).cleanContent.bind(scanner)
      const input = '<system-reminder>You are Claude\nwith multiline</system-reminder>Please help'
      expect(clean(input)).toBe('Please help')
    })
  })

  // ─── classifyToolResult (private) ──────────────────────────────────

  describe('classifyToolResult', () => {
    let scanner: ConversationScanner
    let classify: (raw: any, messageContent: any, pending: Map<string, any>) => any

    beforeEach(() => {
      scanner = new ConversationScanner([])
      classify = (scanner as any).classifyToolResult.bind(scanner)
    })

    const emptyPending = new Map()

    it('returns null for null/non-object input', () => {
      expect(classify(null, null, emptyPending)).toBeNull()
      expect(classify('string', null, emptyPending)).toBeNull()
    })

    it('classifies edit results', () => {
      const raw = {
        structuredPatch: [{ oldStart: 1, oldLines: 1, newStart: 1, newLines: 1, lines: ['-a', '+b'] }],
        oldString: 'a',
        newString: 'b',
        filePath: '/src/main.ts',
        userModified: false,
        replaceAll: false,
      }
      const result = classify(raw, null, emptyPending)
      expect(result.type).toBe('edit')
      expect(result.filePath).toBe('/src/main.ts')
      expect(result.oldString).toBe('a')
      expect(result.newString).toBe('b')
      expect(result.structuredPatch).toEqual(raw.structuredPatch)
    })

    it('classifies write (create) results', () => {
      const raw = { type: 'create', filePath: '/src/new.ts' }
      const result = classify(raw, null, emptyPending)
      expect(result.type).toBe('write')
      expect(result.filePath).toBe('/src/new.ts')
    })

    it('classifies read results', () => {
      const raw = { type: 'text', file: { filePath: '/src/main.ts' } }
      const result = classify(raw, null, emptyPending)
      expect(result.type).toBe('read')
      expect(result.filePath).toBe('/src/main.ts')
    })

    it('classifies bash results', () => {
      const raw = { stdout: 'output', stderr: '', interrupted: false }
      const result = classify(raw, null, emptyPending)
      expect(result.type).toBe('bash')
      expect(result.stdout).toBe('output')
      expect(result.stderr).toBe('')
      expect(result.interrupted).toBe(false)
    })

    it('classifies grep results', () => {
      const raw = { mode: 'content', numLines: 5, filenames: ['a.ts'], content: 'match', numFiles: 1 }
      const result = classify(raw, null, emptyPending)
      expect(result.type).toBe('grep')
      expect(result.mode).toBe('content')
      expect(result.filenames).toEqual(['a.ts'])
      expect(result.numLines).toBe(5)
    })

    it('classifies glob results', () => {
      const raw = { filenames: ['a.ts', 'b.ts'], numFiles: 2, truncated: false }
      const result = classify(raw, null, emptyPending)
      expect(result.type).toBe('glob')
      expect(result.filenames).toEqual(['a.ts', 'b.ts'])
      expect(result.numFiles).toBe(2)
    })

    it('classifies taskAgent results', () => {
      const raw = { status: 'running', prompt: 'do stuff', agentId: 'agent-1' }
      const result = classify(raw, null, emptyPending)
      expect(result.type).toBe('taskAgent')
      expect(result.status).toBe('running')
      expect(result.prompt).toBe('do stuff')
      expect(result.agentId).toBe('agent-1')
    })

    it('classifies taskCreate results', () => {
      const raw = { task: { id: 'task-1', subject: 'Fix bug' } }
      const result = classify(raw, null, emptyPending)
      expect(result.type).toBe('taskCreate')
      expect(result.taskId).toBe('task-1')
      expect(result.subject).toBe('Fix bug')
    })

    it('classifies taskUpdate results', () => {
      const raw = { taskId: 'task-1', updatedFields: ['status'], statusChange: { from: 'open', to: 'done' } }
      const result = classify(raw, null, emptyPending)
      expect(result.type).toBe('taskUpdate')
      expect(result.taskId).toBe('task-1')
      expect(result.updatedFields).toEqual(['status'])
      expect(result.statusChange).toEqual({ from: 'open', to: 'done' })
    })

    it('classifies generic message results and resolves tool name from pending', () => {
      const pending = new Map([['tool-99', { id: 'tool-99', name: 'EnterPlanMode', input: {} }]])
      const messageContent = [{ type: 'tool_result', tool_use_id: 'tool-99', content: 'ok' }]
      const raw = { message: 'Entered plan mode' }
      const result = classify(raw, messageContent, pending)
      expect(result.type).toBe('generic')
      expect(result.toolName).toBe('EnterPlanMode')
    })

    it('falls back to generic with unknown tool name', () => {
      const raw = { someUnknownField: 'value', anotherField: 123 }
      const result = classify(raw, null, emptyPending)
      expect(result.type).toBe('generic')
      expect(result.toolName).toBe('unknown')
    })
  })

  // ─── decodeProjectName (private) ──────────────────────────────────

  describe('decodeProjectName', () => {
    let scanner: ConversationScanner
    let decode: (encoded: string) => string

    beforeEach(() => {
      scanner = new ConversationScanner([])
      decode = (scanner as any).decodeProjectName.bind(scanner)
    })

    it('converts encoded directory name to path', () => {
      expect(decode('-Users-test-dev-project')).toBe('/Users/test/dev/project')
    })

    it('handles single segment', () => {
      expect(decode('-project')).toBe('/project')
    })

    it('handles deeply nested path', () => {
      expect(decode('-Users-ronenmars-Desktop-dev-ak-chatbot')).toBe('/Users/ronenmars/Desktop/dev/ak/chatbot')
    })
  })

  // ─── getShortProjectName (private) ────────────────────────────────

  describe('getShortProjectName', () => {
    let scanner: ConversationScanner
    let getShort: (path: string) => string

    beforeEach(() => {
      scanner = new ConversationScanner([])
      getShort = (scanner as any).getShortProjectName.bind(scanner)
    })

    it('returns last 3 path segments', () => {
      expect(getShort('/Users/test/dev/my-project')).toBe('test/dev/my-project')
    })

    it('returns all segments if fewer than 3', () => {
      expect(getShort('/dev/project')).toBe('dev/project')
    })

    it('handles single segment', () => {
      expect(getShort('/project')).toBe('project')
    })

    it('handles trailing slash by filtering empty segments', () => {
      expect(getShort('/Users/test/dev/project/')).toBe('test/dev/project')
    })
  })

  // ─── LRU cache ────────────────────────────────────────────────────

  describe('LRU cache', () => {
    it('caches conversation and returns from cache on second call', async () => {
      const configDir = await createConfig([
        {
          projectDir: '-Users-test-dev-my-project',
          fileName: 'sess-abc-123.jsonl',
          fixturePath: join(FIXTURES_DIR, 'sample-conversation.jsonl'),
        },
      ])

      const scanner = new ConversationScanner([makeProfile(configDir)])
      await scanner.scanAllMeta()

      const conv1 = await scanner.getConversation(
        join(configDir, 'projects', '-Users-test-dev-my-project', 'sess-abc-123.jsonl')
      )
      expect(conv1).not.toBeNull()
      expect(conv1!.sessionId).toBe('sess-abc-123')

      // Second call should hit cache
      const conv2 = await scanner.getConversation(
        join(configDir, 'projects', '-Users-test-dev-my-project', 'sess-abc-123.jsonl')
      )
      expect(conv2).not.toBeNull()
      expect(conv2!.sessionId).toBe('sess-abc-123')
    })

    it('evicts oldest entry when LRU_MAX (5) is exceeded', async () => {
      // Create 6 distinct conversation files
      const files = []
      for (let i = 0; i < 6; i++) {
        const content = [
          `{"type":"user","cwd":"/proj${i}","sessionId":"s${i}","timestamp":"2025-01-15T10:00:0${i}Z","message":{"content":"msg ${i}"}}`,
          `{"type":"assistant","timestamp":"2025-01-15T10:00:1${i}Z","message":{"content":"reply ${i}"}}`,
        ].join('\n')
        files.push({ projectDir: `-proj${i}`, fileName: `s${i}.jsonl`, content })
      }

      const configDir = await createConfig(files)
      const scanner = new ConversationScanner([makeProfile(configDir)])
      await scanner.scanAllMeta()

      // Load all 6 conversations into cache (LRU_MAX is 5)
      for (let i = 0; i < 6; i++) {
        const id = join(configDir, 'projects', `-proj${i}`, `s${i}.jsonl`)
        const conv = await scanner.getConversation(id)
        expect(conv).not.toBeNull()
      }

      // The internal LRU map should have exactly 5 entries
      const lru = (scanner as any).conversationLRU as Map<string, unknown>
      expect(lru.size).toBe(5)

      // The first entry (s0) should have been evicted
      const evictedId = join(configDir, 'projects', '-proj0', 's0.jsonl')
      expect(lru.has(evictedId)).toBe(false)

      // The last entry (s5) should still be present
      const lastId = join(configDir, 'projects', '-proj5', 's5.jsonl')
      expect(lru.has(lastId)).toBe(true)
    })
  })

  // ─── Progress callback ────────────────────────────────────────────

  describe('progress callback', () => {
    it('fires during scanning with correct scanned/total values', async () => {
      const files = []
      for (let i = 0; i < 3; i++) {
        const content = [
          `{"type":"user","cwd":"/p","sessionId":"s${i}","timestamp":"2025-01-15T10:00:0${i}Z","message":{"content":"m${i}"}}`,
          `{"type":"assistant","timestamp":"2025-01-15T10:00:1${i}Z","message":{"content":"r${i}"}}`,
        ].join('\n')
        files.push({ projectDir: '-p', fileName: `s${i}.jsonl`, content })
      }

      const configDir = await createConfig(files)
      const scanner = new ConversationScanner([makeProfile(configDir)])

      const progressCalls: Array<{ scanned: number; total: number }> = []
      scanner.setProgressCallback((scanned, total) => {
        progressCalls.push({ scanned, total })
      })

      await scanner.scanAllMeta()

      expect(progressCalls.length).toBeGreaterThanOrEqual(1)
      const lastCall = progressCalls[progressCalls.length - 1]
      expect(lastCall.scanned).toBe(3)
      expect(lastCall.total).toBe(3)
    })
  })

  // ─── getProjects ──────────────────────────────────────────────────

  describe('getProjects', () => {
    it('returns deduplicated, sorted project paths', async () => {
      // Two conversations in the same project (same cwd)
      const content1 = [
        '{"type":"user","cwd":"/Users/dev/b-project","sessionId":"s1","timestamp":"2025-01-15T10:00:00Z","message":{"content":"m1"}}',
        '{"type":"assistant","timestamp":"2025-01-15T10:00:01Z","message":{"content":"r1"}}',
      ].join('\n')
      const content2 = [
        '{"type":"user","cwd":"/Users/dev/a-project","sessionId":"s2","timestamp":"2025-01-15T10:00:00Z","message":{"content":"m2"}}',
        '{"type":"assistant","timestamp":"2025-01-15T10:00:01Z","message":{"content":"r2"}}',
      ].join('\n')
      const content3 = [
        '{"type":"user","cwd":"/Users/dev/b-project","sessionId":"s3","timestamp":"2025-01-15T10:00:00Z","message":{"content":"m3"}}',
        '{"type":"assistant","timestamp":"2025-01-15T10:00:01Z","message":{"content":"r3"}}',
      ].join('\n')

      const configDir = await createConfig([
        { projectDir: '-Users-dev-b-project', fileName: 's1.jsonl', content: content1 },
        { projectDir: '-Users-dev-a-project', fileName: 's2.jsonl', content: content2 },
        { projectDir: '-Users-dev-b-project', fileName: 's3.jsonl', content: content3 },
      ])

      const scanner = new ConversationScanner([makeProfile(configDir)])
      await scanner.scanAllMeta()

      const projects = scanner.getProjects()
      expect(projects).toEqual(['/Users/dev/a-project', '/Users/dev/b-project'])
    })
  })

  // ─── getLatestForProject ──────────────────────────────────────────

  describe('getLatestForProject', () => {
    it('returns the most recent conversation for a given project path', async () => {
      const older = [
        '{"type":"user","cwd":"/project","sessionId":"old","timestamp":"2024-01-01T00:00:00Z","message":{"content":"old"}}',
        '{"type":"assistant","timestamp":"2024-01-01T00:00:01Z","message":{"content":"reply"}}',
      ].join('\n')
      const newer = [
        '{"type":"user","cwd":"/project","sessionId":"new","timestamp":"2025-06-01T00:00:00Z","message":{"content":"new"}}',
        '{"type":"assistant","timestamp":"2025-06-01T00:00:01Z","message":{"content":"reply"}}',
      ].join('\n')

      const configDir = await createConfig([
        { projectDir: '-project', fileName: 'old.jsonl', content: older },
        { projectDir: '-project', fileName: 'new.jsonl', content: newer },
      ])

      const scanner = new ConversationScanner([makeProfile(configDir)])
      await scanner.scanAllMeta()

      const latest = scanner.getLatestForProject('/project')
      expect(latest).not.toBeNull()
      expect(latest!.sessionId).toBe('new')
      expect(latest!.timestamp).toBe('2025-06-01T00:00:01Z')
    })

    it('returns null when no conversations match the project', async () => {
      const content = [
        '{"type":"user","cwd":"/other","sessionId":"s1","timestamp":"2025-01-01T00:00:00Z","message":{"content":"m"}}',
        '{"type":"assistant","timestamp":"2025-01-01T00:00:01Z","message":{"content":"r"}}',
      ].join('\n')

      const configDir = await createConfig([
        { projectDir: '-other', fileName: 's1.jsonl', content },
      ])

      const scanner = new ConversationScanner([makeProfile(configDir)])
      await scanner.scanAllMeta()

      expect(scanner.getLatestForProject('/nonexistent')).toBeNull()
    })
  })

  // ─── Batch scanning (BATCH_SIZE=10) ───────────────────────────────

  describe('batch scanning', () => {
    it('correctly processes more than BATCH_SIZE (10) files', async () => {
      const files = []
      for (let i = 0; i < 15; i++) {
        const padded = String(i).padStart(2, '0')
        const content = [
          `{"type":"user","cwd":"/proj","sessionId":"s${padded}","timestamp":"2025-01-15T10:00:${padded}Z","message":{"content":"msg ${i}"}}`,
          `{"type":"assistant","timestamp":"2025-01-15T10:01:${padded}Z","message":{"content":"reply ${i}"}}`,
        ].join('\n')
        files.push({ projectDir: '-proj', fileName: `s${padded}.jsonl`, content })
      }

      const configDir = await createConfig(files)
      const scanner = new ConversationScanner([makeProfile(configDir)])

      const progressCalls: Array<{ scanned: number; total: number }> = []
      scanner.setProgressCallback((scanned, total) => {
        progressCalls.push({ scanned, total })
      })

      const metas = await scanner.scanAllMeta()

      expect(metas).toHaveLength(15)

      // Should have at least 2 progress callbacks (batch 1: 10, batch 2: 5)
      expect(progressCalls.length).toBe(2)
      expect(progressCalls[0]).toEqual({ scanned: 10, total: 15 })
      expect(progressCalls[1]).toEqual({ scanned: 15, total: 15 })
    })
  })

  // ─── Multiple profiles ────────────────────────────────────────────

  describe('multiple profiles', () => {
    it('merges conversations from all enabled profiles', async () => {
      const content1 = [
        '{"type":"user","cwd":"/work","sessionId":"work-1","timestamp":"2025-01-15T10:00:00Z","message":{"content":"work stuff"}}',
        '{"type":"assistant","timestamp":"2025-01-15T10:00:01Z","message":{"content":"work reply"}}',
      ].join('\n')
      const content2 = [
        '{"type":"user","cwd":"/personal","sessionId":"personal-1","timestamp":"2025-01-15T11:00:00Z","message":{"content":"personal stuff"}}',
        '{"type":"assistant","timestamp":"2025-01-15T11:00:01Z","message":{"content":"personal reply"}}',
      ].join('\n')

      const configDir1 = await createConfig([
        { projectDir: '-work', fileName: 'w1.jsonl', content: content1 },
      ])
      const configDir2 = await createConfig([
        { projectDir: '-personal', fileName: 'p1.jsonl', content: content2 },
      ])

      const scanner = new ConversationScanner([
        makeProfile(configDir1, 'work'),
        makeProfile(configDir2, 'personal'),
      ])
      const metas = await scanner.scanAllMeta()

      expect(metas).toHaveLength(2)
      const accounts = metas.map((m) => m.account).sort()
      expect(accounts).toEqual(['personal', 'work'])
    })

    it('ignores disabled profiles', async () => {
      const content = [
        '{"type":"user","cwd":"/x","sessionId":"s1","timestamp":"2025-01-01T00:00:00Z","message":{"content":"m"}}',
        '{"type":"assistant","timestamp":"2025-01-01T00:00:01Z","message":{"content":"r"}}',
      ].join('\n')

      const configDir = await createConfig([
        { projectDir: '-x', fileName: 's1.jsonl', content },
      ])

      const disabledProfile: Profile = {
        ...makeProfile(configDir),
        enabled: false,
      }

      const scanner = new ConversationScanner([disabledProfile])
      const metas = await scanner.scanAllMeta()

      expect(metas).toHaveLength(0)
    })
  })

  // ─── getConversation (full parse) ─────────────────────────────────

  describe('getConversation', () => {
    it('returns null for unknown id', async () => {
      const scanner = new ConversationScanner([])
      const result = await scanner.getConversation('nonexistent')
      expect(result).toBeNull()
    })

    it('parses full conversation with messages, metadata, and tool results', async () => {
      const configDir = await createConfig([
        {
          projectDir: '-Users-test-dev-my-project',
          fileName: 'sess-abc-123.jsonl',
          fixturePath: join(FIXTURES_DIR, 'sample-conversation.jsonl'),
        },
      ])

      const scanner = new ConversationScanner([makeProfile(configDir)])
      await scanner.scanAllMeta()

      const id = join(configDir, 'projects', '-Users-test-dev-my-project', 'sess-abc-123.jsonl')
      const conv = await scanner.getConversation(id)

      expect(conv).not.toBeNull()
      expect(conv!.sessionId).toBe('sess-abc-123')
      expect(conv!.sessionName).toBe('fix-login-bug')
      expect(conv!.projectPath).toBe('/Users/test/dev/my-project')
      expect(conv!.messages.length).toBeGreaterThan(0)
      expect(conv!.fullText).toContain('login bug')
      expect(conv!.timestamp).toBe('2025-01-15T10:00:15Z')

      // Check first user message
      const firstUser = conv!.messages.find((m) => m.type === 'user' && !m.isToolResult)
      expect(firstUser).toBeDefined()
      expect(firstUser!.content).toContain('Can you help me fix the login bug?')

      // Check assistant message has metadata
      const assistantMsg = conv!.messages.find((m) => m.type === 'assistant' && m.metadata?.model)
      expect(assistantMsg).toBeDefined()
      expect(assistantMsg!.metadata!.model).toBe('claude-sonnet-4-20250514')
      expect(assistantMsg!.metadata!.inputTokens).toBe(500)
      expect(assistantMsg!.metadata!.outputTokens).toBe(200)

      // Check tool uses are extracted
      const withToolUses = conv!.messages.find((m) => m.metadata?.toolUses?.includes('Read'))
      expect(withToolUses).toBeDefined()

      // Check tool results are classified
      const editResult = conv!.messages.find(
        (m) => m.metadata?.toolResults?.some((tr) => tr.type === 'edit')
      )
      expect(editResult).toBeDefined()

      // Check last assistant message has gitBranch and version
      const lastAssistant = conv!.messages.filter((m) => m.type === 'assistant').pop()
      expect(lastAssistant!.metadata?.gitBranch).toBe('fix/login')
      expect(lastAssistant!.metadata?.version).toBe('1.2.3')
    })
  })

  // ─── Hidden directories and special dirs ──────────────────────────

  describe('directory filtering', () => {
    it('skips hidden directories (starting with dot)', async () => {
      const validContent = [
        '{"type":"user","cwd":"/p","sessionId":"s1","timestamp":"2025-01-01T00:00:00Z","message":{"content":"m"}}',
        '{"type":"assistant","timestamp":"2025-01-01T00:00:01Z","message":{"content":"r"}}',
      ].join('\n')

      const configDir = await createConfig([
        { projectDir: '-visible', fileName: 's1.jsonl', content: validContent },
      ])

      // Manually create a hidden directory with a JSONL file
      const hiddenDir = join(configDir, 'projects', '.hidden')
      await mkdir(hiddenDir, { recursive: true })
      await writeFile(join(hiddenDir, 'hidden.jsonl'), validContent, 'utf-8')

      const scanner = new ConversationScanner([makeProfile(configDir)])
      const metas = await scanner.scanAllMeta()

      expect(metas).toHaveLength(1)
      expect(metas[0].sessionId).toBe('s1')
    })
  })

  // ─── Nonexistent projects directory ───────────────────────────────

  describe('nonexistent config directory', () => {
    it('handles missing projects directory gracefully', async () => {
      const tmpDir = await mkdtemp(join(tmpdir(), 'scanner-nodir-'))
      tempDirs.push(tmpDir)

      const scanner = new ConversationScanner([makeProfile(tmpDir)])
      const metas = await scanner.scanAllMeta()

      expect(metas).toEqual([])
    })
  })

  // ─── cwd fallback to decoded directory name ───────────────────────

  describe('projectPath fallback', () => {
    it('uses decoded directory name when cwd is missing from JSONL', async () => {
      const content = [
        '{"type":"user","sessionId":"s1","timestamp":"2025-01-01T00:00:00Z","message":{"content":"no cwd"}}',
        '{"type":"assistant","timestamp":"2025-01-01T00:00:01Z","message":{"content":"reply"}}',
      ].join('\n')

      const configDir = await createConfig([
        { projectDir: '-Users-dev-fallback-project', fileName: 's1.jsonl', content },
      ])

      const scanner = new ConversationScanner([makeProfile(configDir)])
      const metas = await scanner.scanAllMeta()

      expect(metas).toHaveLength(1)
      expect(metas[0].projectPath).toBe('/Users/dev/fallback/project')
    })
  })

  // ─── scanAllMeta clears caches ────────────────────────────────────

  describe('cache clearing on rescan', () => {
    it('clears metadata and LRU caches when scanAllMeta is called again', async () => {
      const content = [
        '{"type":"user","cwd":"/p","sessionId":"s1","timestamp":"2025-01-01T00:00:00Z","message":{"content":"m"}}',
        '{"type":"assistant","timestamp":"2025-01-01T00:00:01Z","message":{"content":"r"}}',
      ].join('\n')

      const configDir = await createConfig([
        { projectDir: '-p', fileName: 's1.jsonl', content },
      ])

      const scanner = new ConversationScanner([makeProfile(configDir)])

      // First scan
      const metas1 = await scanner.scanAllMeta()
      expect(metas1).toHaveLength(1)

      // Load conversation into LRU
      const id = metas1[0].id
      await scanner.getConversation(id)

      // Second scan should clear caches
      await scanner.scanAllMeta()

      const lru = (scanner as any).conversationLRU as Map<string, unknown>
      expect(lru.size).toBe(0)
    })
  })
})
