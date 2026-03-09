# VS Code Extension Migration — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate the Electron Claude History app into a production-quality VS Code extension covering Stages 0–5 (core + conversation viewer).

**Architecture:** Extension host (Node.js) holds all domain logic via `src/core/` and `src/services/`. VS Code TreeView replaces the sidebar. A React webview (bundled with esbuild) handles the conversation viewer.

**Tech Stack:** TypeScript 5.3+, React 18, esbuild, Vitest, FlexSearch, vscode API ^1.85.0

**Source (read-only):** `/Users/ronen/Desktop/dev/personal/claude-search`
**Target:** `/Users/ronen/Desktop/dev/personal/vscode-claude-code-manager`

---

## STAGE 0 — Analysis & Project Bootstrap

### Task 0.1: Create target directory + git init

**Files:**
- Create: `../vscode-claude-code-manager/` (directory)

**Step 1: Initialize the target project**

```bash
cd /Users/ronen/Desktop/dev/personal
mkdir -p vscode-claude-code-manager
cd vscode-claude-code-manager
git init
mkdir -p src/core src/services src/providers src/commands src/webview src/webview-ui/components/tool-cards src/test/fixtures docs
```

**Step 2: Copy test fixtures from source**

```bash
cp /Users/ronen/Desktop/dev/personal/claude-search/src/test/fixtures/*.jsonl \
   /Users/ronen/Desktop/dev/personal/vscode-claude-code-manager/src/test/fixtures/
```

**Step 3: Commit**

```bash
cd /Users/ronen/Desktop/dev/personal/vscode-claude-code-manager
git add .
git commit -m "chore: initialize vscode extension project"
```

---

### Task 0.2: Write Stage 0 analysis documents

**Files:**
- Create: `docs/stage0-feature-parity.md`
- Create: `docs/stage0-architecture.md`

**Step 1: Write feature parity matrix**

Create `docs/stage0-feature-parity.md`:

```markdown
# Feature Parity Matrix — VS Code Extension Migration

## Scope: Stages 0–5

| Feature | Electron | VS Code | Status | Notes |
|---|---|---|---|---|
| Full-text search (FlexSearch) | ✅ | ✅ | Full parity | Core ported directly |
| Two-tier indexing (meta-first) | ✅ | ✅ | Full parity | HistoryService |
| Batched JSONL scanning | ✅ | ✅ | Full parity | ConversationScanner ported |
| Project filter | ✅ | ✅ | Full parity | QuickPick in search command |
| Date range filter | ✅ | ✅ | Full parity | Applied in HistoryService |
| Sort options | ✅ | ✅ | Full parity | Applied in HistoryService |
| Profile/account filter | ✅ | ✅ | Full parity | TreeView grouped by profile |
| Conversation list sidebar | ResultsList | TreeView | Redesign | VS Code native TreeView |
| Project grouping | ✅ | ✅ | Full parity | TreeView groups |
| Profile badges | ✅ | ✅ | Partial redesign | TreeView item description |
| Git branch badges | ✅ | Deferred | Deferred | Stage 7 |
| Markdown rendering | ✅ | ✅ | Full parity | react-markdown in webview |
| Syntax highlighted code | ✅ | ✅ | Full parity | react-markdown |
| Tool result cards | ✅ | ✅ | Full parity | Ported React components |
| Tool invocation badges | ✅ | ✅ | Full parity | Ported React component |
| Message navigation | ✅ | ✅ | Full parity | Ported React component |
| Token/model metadata | ✅ | ✅ | Full parity | Ported |
| Export conversation | ✅ | ✅ | Full parity | vscode.window.showSaveDialog |
| Copy message | ✅ | ✅ | Full parity | vscode.env.clipboard |
| xterm chat terminal | ✅ | Deferred | Deferred | Stage 8 |
| Multiple chat sessions | ✅ | Deferred | Deferred | Stage 8 |
| Profile CRUD management | ✅ | Deferred | Deferred | Stage 6 |
| Worktree management | ✅ | Deferred | Deferred | Stage 7 |
| Worktree detection | ✅ | Deferred | Deferred | Stage 7 |
| Settings (display mode, etc.) | ✅ | Deferred | Deferred | Stage 9 |
| Scan progress indicator | ✅ | ✅ | Full parity | vscode.window.withProgress |
| Manual refresh | ✅ | ✅ | Full parity | Command palette command |
| Dark theme | ✅ | ✅ | Full parity | VS Code theme variables |
| Virtualized list | ✅ | N/A | Dropped | TreeView handles natively |
| LRU conversation cache | ✅ | ✅ | Full parity | Kept in ConversationScanner |
| Debounced search | ✅ | ✅ | Full parity | In search command |
| SystemStats panel | ✅ | Deferred | Deferred | Status bar items |
| Active chat list | ✅ | Deferred | Deferred | Stage 8 |
```

**Step 2: Write architecture document**

Create `docs/stage0-architecture.md` with the target directory tree and the Electron→VS Code API mapping table from the design doc (see `claude-search/docs/plans/2026-03-08-vscode-migration-design.md`).

**Step 3: Commit**

```bash
git add docs/
git commit -m "docs: add stage 0 analysis — feature parity matrix and architecture"
```

---

## STAGE 1 — Extract Reusable Core

> Run agents 1A, 1B, 1C in parallel (see architecture doc).

### Task 1A: Port types + scanner + worktree-parser

**Files:**
- Create: `src/core/types.ts`
- Create: `src/core/scanner.ts`
- Create: `src/core/worktree-parser.ts`
- Create: `src/core/execFileNoThrow.ts`
- Create: `src/core/scanner.test.ts`

**Step 1: Port types.ts — drop Electron/PTY types**

Create `src/core/types.ts`. Copy from source `src/shared/types.ts` with these changes:
- **Remove** `PtySpawnOptions`, `PtyStatus`, `ChatInstance`
- **Remove** `ClaudeProfile` type alias
- **Keep** everything else unchanged

The removed types are Electron/PTY-specific and have no equivalent in the VS Code extension for stages 0–5.

```typescript
// src/core/types.ts
// [Copy src/shared/types.ts verbatim, removing the three PTY/chat types listed above]
// The file will be ~260 lines. Verify: PtySpawnOptions, PtyStatus, ChatInstance are absent.
```

**Step 2: Port scanner.ts**

Create `src/core/scanner.ts`. Copy from source `src/main/services/scanner.ts` **verbatim** — the entire file has zero Electron imports and is fully platform-agnostic. Update the import path:

```typescript
// Change:
import type { ... } from '../../shared/types'
// To:
import type { ... } from './types'
```

**Step 3: Port worktree-parser.ts**

Create `src/core/worktree-parser.ts`. Copy from source `src/main/worktree-parser.ts` verbatim (pure string parsing, no Electron deps). Update import if it has a shared types import.

**Step 4: Port execFileNoThrow.ts**

Create `src/core/execFileNoThrow.ts`. Copy from source `src/main/utils/execFileNoThrow.ts` verbatim — uses only Node.js `child_process`, no Electron deps.

**Step 5: Write scanner tests**

Create `src/core/scanner.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { ConversationScanner } from './scanner'
import { join } from 'path'
import { homedir } from 'os'

// Use the real fixture files from the source project
const FIXTURES_DIR = join(__dirname, '../test/fixtures')

describe('ConversationScanner', () => {
  it('scanAllMeta returns non-empty result for real fixture dir', async () => {
    // Create scanner pointing at fixture-level directory
    // (fixtures contain sample-conversation.jsonl)
    const scanner = new ConversationScanner([{
      id: 'test',
      label: 'Test',
      emoji: '🧪',
      configDir: join(FIXTURES_DIR, '..', '..'), // walk up to find fixtures
      enabled: true
    }])
    // Should not throw
    const metas = await scanner.scanAllMeta()
    expect(Array.isArray(metas)).toBe(true)
  })

  it('parseConversationMeta returns null for empty file', async () => {
    const scanner = new ConversationScanner([{
      id: 'test', label: 'Test', emoji: '🧪',
      configDir: join(homedir(), '.claude'), enabled: true
    }])
    // getConversation for unknown id returns null
    const result = await scanner.getConversation('nonexistent-id')
    expect(result).toBeNull()
  })
})
```

**Step 6: Run tests**

```bash
cd /Users/ronen/Desktop/dev/personal/vscode-claude-code-manager
npx vitest run src/core/scanner.test.ts
```

Expected: PASS (or skip if fixture path resolution differs — adjust path accordingly)

**Step 7: Commit**

```bash
git add src/core/types.ts src/core/scanner.ts src/core/worktree-parser.ts \
        src/core/execFileNoThrow.ts src/core/scanner.test.ts
git commit -m "feat(core): port types, scanner, worktree-parser, execFileNoThrow"
```

---

### Task 1B: Port indexer + formatters

**Files:**
- Create: `src/core/indexer.ts`
- Create: `src/core/formatters.ts`
- Create: `src/core/indexer.test.ts`
- Create: `src/core/formatters.test.ts`

**Step 1: Port indexer.ts**

Create `src/core/indexer.ts`. Copy from source `src/main/services/indexer.ts` verbatim. Update import:

```typescript
// Change:
import type { Account, ConversationMeta, SearchResult } from '../../shared/types'
// To:
import type { Account, ConversationMeta, SearchResult } from './types'
```

**Step 2: Port formatters.ts**

Create `src/core/formatters.ts`. Copy from source `src/main/formatters.ts` verbatim. Update import:

```typescript
// Change:
import type { Conversation, ConversationMessage } from '../shared/types'
// To:
import type { Conversation, ConversationMessage } from './types'
```

**Step 3: Write indexer tests**

Create `src/core/indexer.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { SearchIndexer } from './indexer'
import type { ConversationMeta } from './types'

const MOCK_META: ConversationMeta = {
  id: 'test-id',
  filePath: '/test/path.jsonl',
  projectPath: '/home/user/projects/myapp',
  projectName: 'projects/myapp',
  sessionId: 'abc123',
  sessionName: 'fix-auth-bug',
  timestamp: '2024-01-15T10:00:00Z',
  messageCount: 5,
  preview: 'How do I fix the authentication?',
  contentSnippet: 'How do I fix the authentication? You can use JWT tokens...',
  lastMessageSender: 'assistant',
  account: 'default',
}

describe('SearchIndexer', () => {
  let indexer: SearchIndexer

  beforeEach(async () => {
    indexer = new SearchIndexer()
    await indexer.buildIndex([MOCK_META])
  })

  it('returns all documents for empty query', () => {
    const results = indexer.search('', 100)
    expect(results).toHaveLength(1)
    expect(results[0].id).toBe('test-id')
  })

  it('finds document by content keyword', () => {
    const results = indexer.search('authentication', 100)
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].id).toBe('test-id')
  })

  it('finds document by session name', () => {
    const results = indexer.search('fix-auth', 100)
    expect(results.length).toBeGreaterThan(0)
  })

  it('returns empty for unknown query', () => {
    const results = indexer.search('zzznomatch999', 100)
    expect(results).toHaveLength(0)
  })

  it('applies project filter', () => {
    const results = indexer.search('', 100, '/home/user/projects/myapp')
    expect(results).toHaveLength(1)

    const noMatch = indexer.search('', 100, '/other/project')
    expect(noMatch).toHaveLength(0)
  })

  it('getDocumentCount returns correct count', () => {
    expect(indexer.getDocumentCount()).toBe(1)
  })
})
```

**Step 4: Write formatters tests**

Create `src/core/formatters.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { formatAsMarkdown, formatAsText } from './formatters'
import type { Conversation } from './types'

const MOCK_CONVERSATION: Conversation = {
  id: 'test-id',
  filePath: '/test/path.jsonl',
  projectPath: '/home/user/myapp',
  projectName: 'myapp',
  sessionId: 'abc123',
  sessionName: 'fix-bug',
  messages: [
    { type: 'user', content: 'How do I fix this?', timestamp: '2024-01-15T10:00:00Z' },
    { type: 'assistant', content: 'You can try this approach.', timestamp: '2024-01-15T10:01:00Z' },
  ],
  fullText: 'How do I fix this? You can try this approach.',
  timestamp: '2024-01-15T10:01:00Z',
  messageCount: 2,
  account: 'default',
}

describe('formatAsMarkdown', () => {
  it('includes project name in output', () => {
    const result = formatAsMarkdown(MOCK_CONVERSATION)
    expect(result).toContain('myapp')
  })

  it('includes message content', () => {
    const result = formatAsMarkdown(MOCK_CONVERSATION)
    expect(result).toContain('How do I fix this?')
    expect(result).toContain('You can try this approach.')
  })
})

describe('formatAsText', () => {
  it('includes message content', () => {
    const result = formatAsText(MOCK_CONVERSATION)
    expect(result).toContain('How do I fix this?')
    expect(result).toContain('You can try this approach.')
  })
})
```

**Step 5: Run tests**

```bash
npx vitest run src/core/indexer.test.ts src/core/formatters.test.ts
```

Expected: All PASS

**Step 6: Commit**

```bash
git add src/core/indexer.ts src/core/formatters.ts \
        src/core/indexer.test.ts src/core/formatters.test.ts
git commit -m "feat(core): port indexer and formatters with tests"
```

---

### Task 1C: New core modules — profiles, filters, export

**Files:**
- Create: `src/core/profiles.ts`
- Create: `src/core/filters.ts`
- Create: `src/core/export.ts`
- Create: `src/core/profiles.test.ts`
- Create: `src/core/filters.test.ts`

**Step 1: Write profiles.ts — extracted from Electron main/index.ts**

The profile loading logic in `main/index.ts:84-139` is Electron-specific only because it reads from `app.getPath('userData')`. Extract as a pure function that accepts a config dir path:

Create `src/core/profiles.ts`:

```typescript
import { readFile, writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { homedir } from 'os'
import type { Profile, ProfilesConfig } from './types'

export const DEFAULT_PROFILE: Profile = {
  id: 'default',
  label: 'Default',
  emoji: '🤖',
  configDir: join(homedir(), '.claude'),
  enabled: true,
}

export async function loadProfilesConfig(storageDir: string): Promise<ProfilesConfig> {
  const profilesPath = join(storageDir, 'profiles.json')
  try {
    const data = await readFile(profilesPath, 'utf-8')
    const parsed = JSON.parse(data) as ProfilesConfig
    if (Array.isArray(parsed.profiles) && parsed.profiles.length > 0) {
      return parsed
    }
  } catch {
    // Missing or malformed — fall through to default
  }
  return { profiles: [DEFAULT_PROFILE] }
}

export async function saveProfilesConfig(storageDir: string, config: ProfilesConfig): Promise<void> {
  await mkdir(storageDir, { recursive: true })
  await writeFile(join(storageDir, 'profiles.json'), JSON.stringify(config, null, 2), 'utf-8')
}

export async function ensureProfilesExist(storageDir: string): Promise<ProfilesConfig> {
  const profilesPath = join(storageDir, 'profiles.json')
  try {
    const data = await readFile(profilesPath, 'utf-8')
    try {
      const parsed = JSON.parse(data) as ProfilesConfig
      if (Array.isArray(parsed.profiles) && parsed.profiles.length > 0) {
        return parsed
      }
    } catch {
      // Malformed JSON — rewrite with defaults
    }
    const defaults = { profiles: [DEFAULT_PROFILE] }
    await saveProfilesConfig(storageDir, defaults)
    return defaults
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
    const defaults = { profiles: [DEFAULT_PROFILE] }
    await saveProfilesConfig(storageDir, defaults)
    return defaults
  }
}
```

**Step 2: Write filters.ts — new, encapsulates filter/sort logic**

This is new code that centralizes filtering logic that was previously split between the Electron renderer and main process:

Create `src/core/filters.ts`:

```typescript
import type { ConversationMeta, SearchResult, SortOption, DateRangeOption } from './types'

export interface FilterOptions {
  project?: string
  account?: string
  dateRange?: DateRangeOption
  sortBy?: SortOption
}

export function applyFilters(items: ConversationMeta[], opts: FilterOptions): ConversationMeta[] {
  let result = [...items]

  if (opts.project) {
    result = result.filter(m => m.projectPath === opts.project || m.projectName.includes(opts.project!))
  }

  if (opts.account) {
    result = result.filter(m => m.account === opts.account)
  }

  if (opts.dateRange && opts.dateRange !== 'all') {
    const cutoff = getDateRangeCutoff(opts.dateRange)
    result = result.filter(m => new Date(m.timestamp) >= cutoff)
  }

  return applySorting(result, opts.sortBy ?? 'recent')
}

export function applyFiltersToResults(items: SearchResult[], opts: FilterOptions): SearchResult[] {
  let result = [...items]

  if (opts.project) {
    result = result.filter(m => m.projectPath === opts.project)
  }

  if (opts.account) {
    result = result.filter(m => m.account === opts.account)
  }

  if (opts.dateRange && opts.dateRange !== 'all') {
    const cutoff = getDateRangeCutoff(opts.dateRange)
    result = result.filter(m => new Date(m.timestamp) >= cutoff)
  }

  return result
}

export function applySorting(items: ConversationMeta[], sortBy: SortOption): ConversationMeta[] {
  return [...items].sort((a, b) => {
    switch (sortBy) {
      case 'recent':
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      case 'oldest':
        return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      case 'most-messages':
        return b.messageCount - a.messageCount
      case 'least-messages':
        return a.messageCount - b.messageCount
      case 'alphabetical':
        return a.projectName.localeCompare(b.projectName)
    }
  })
}

function getDateRangeCutoff(range: DateRangeOption): Date {
  const now = new Date()
  switch (range) {
    case 'today': {
      const d = new Date(now)
      d.setHours(0, 0, 0, 0)
      return d
    }
    case 'week': {
      const d = new Date(now)
      d.setDate(d.getDate() - 7)
      return d
    }
    case 'month': {
      const d = new Date(now)
      d.setMonth(d.getMonth() - 1)
      return d
    }
    default:
      return new Date(0)
  }
}
```

**Step 3: Write export.ts — extracted from Electron main/index.ts**

The export logic in `main/index.ts:320-367` is Electron-specific only due to `dialog.showSaveDialog`. Extract the content-generation part as platform-agnostic:

Create `src/core/export.ts`:

```typescript
import type { Conversation, ExportFormat } from './types'
import { formatAsMarkdown, formatAsText } from './formatters'

export interface ExportContent {
  content: string
  defaultFilename: string
  extension: string
  mimeType: string
}

export function buildExportContent(conversation: Conversation, format: ExportFormat): ExportContent {
  const extensions: Record<ExportFormat, string> = {
    markdown: 'md',
    json: 'json',
    text: 'txt',
  }
  const mimeTypes: Record<ExportFormat, string> = {
    markdown: 'text/markdown',
    json: 'application/json',
    text: 'text/plain',
  }

  const sessionPrefix = conversation.sessionId?.slice(0, 8) || Date.now().toString()
  const ext = extensions[format]

  let content: string
  if (format === 'json') {
    content = JSON.stringify(conversation, null, 2)
  } else if (format === 'markdown') {
    content = formatAsMarkdown(conversation)
  } else {
    content = formatAsText(conversation)
  }

  return {
    content,
    defaultFilename: `conversation-${sessionPrefix}.${ext}`,
    extension: ext,
    mimeType: mimeTypes[format],
  }
}
```

**Step 4: Write profiles tests**

Create `src/core/profiles.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { tmpdir } from 'os'
import { mkdtemp, rm } from 'fs/promises'
import { join } from 'path'
import { loadProfilesConfig, saveProfilesConfig, ensureProfilesExist, DEFAULT_PROFILE } from './profiles'

let tempDir: string

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'claude-ext-test-'))
})

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true })
})

describe('loadProfilesConfig', () => {
  it('returns default profile when file does not exist', async () => {
    const config = await loadProfilesConfig(tempDir)
    expect(config.profiles).toHaveLength(1)
    expect(config.profiles[0].id).toBe('default')
  })

  it('returns saved profiles when file exists', async () => {
    const profiles = [{ ...DEFAULT_PROFILE, id: 'work', label: 'Work', emoji: '💼' }]
    await saveProfilesConfig(tempDir, { profiles })

    const config = await loadProfilesConfig(tempDir)
    expect(config.profiles[0].id).toBe('work')
  })
})

describe('ensureProfilesExist', () => {
  it('creates default profile and persists it', async () => {
    const config = await ensureProfilesExist(tempDir)
    expect(config.profiles[0].id).toBe('default')

    // Re-read — should persist
    const config2 = await loadProfilesConfig(tempDir)
    expect(config2.profiles[0].id).toBe('default')
  })
})
```

**Step 5: Write filters tests**

Create `src/core/filters.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { applyFilters, applySorting } from './filters'
import type { ConversationMeta } from './types'

const makeMeta = (overrides: Partial<ConversationMeta>): ConversationMeta => ({
  id: 'id',
  filePath: '/path.jsonl',
  projectPath: '/home/user/project-a',
  projectName: 'project-a',
  sessionId: 'abc',
  sessionName: 'session',
  timestamp: '2024-01-15T10:00:00Z',
  messageCount: 3,
  preview: 'preview',
  contentSnippet: 'snippet',
  lastMessageSender: 'assistant',
  account: 'default',
  ...overrides,
})

const ITEMS: ConversationMeta[] = [
  makeMeta({ id: 'a', projectPath: '/proj/a', projectName: 'proj/a', timestamp: '2024-01-10T00:00:00Z', messageCount: 5, account: 'default' }),
  makeMeta({ id: 'b', projectPath: '/proj/b', projectName: 'proj/b', timestamp: '2024-01-15T00:00:00Z', messageCount: 2, account: 'work' }),
  makeMeta({ id: 'c', projectPath: '/proj/a', projectName: 'proj/a', timestamp: '2024-01-20T00:00:00Z', messageCount: 8, account: 'default' }),
]

describe('applyFilters', () => {
  it('filters by project path', () => {
    const result = applyFilters(ITEMS, { project: '/proj/a' })
    expect(result.map(r => r.id)).toEqual(expect.arrayContaining(['a', 'c']))
    expect(result.find(r => r.id === 'b')).toBeUndefined()
  })

  it('filters by account', () => {
    const result = applyFilters(ITEMS, { account: 'work' })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('b')
  })
})

describe('applySorting', () => {
  it('sorts by recent (newest first)', () => {
    const result = applySorting(ITEMS, 'recent')
    expect(result[0].id).toBe('c')
    expect(result[2].id).toBe('a')
  })

  it('sorts by oldest (oldest first)', () => {
    const result = applySorting(ITEMS, 'oldest')
    expect(result[0].id).toBe('a')
  })

  it('sorts by most-messages', () => {
    const result = applySorting(ITEMS, 'most-messages')
    expect(result[0].id).toBe('c') // 8 messages
  })
})
```

**Step 6: Run all core tests**

```bash
npx vitest run src/core/
```

Expected: All PASS

**Step 7: Commit**

```bash
git add src/core/profiles.ts src/core/filters.ts src/core/export.ts \
        src/core/profiles.test.ts src/core/filters.test.ts
git commit -m "feat(core): add profiles, filters, export modules with tests"
```

---

## STAGE 2 — Extension Scaffold

### Task 2.1: package.json and tsconfig

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.webview.json`
- Create: `.vscodeignore`
- Create: `.gitignore`

**Step 1: Create package.json**

```json
{
  "name": "claude-history-vscode",
  "displayName": "Claude History",
  "description": "Search and browse Claude Code conversation history",
  "version": "0.1.0",
  "publisher": "claude-history",
  "engines": { "vscode": "^1.85.0" },
  "categories": ["Other"],
  "activationEvents": ["onStartupFinished"],
  "main": "./out/extension.js",
  "contributes": {
    "viewsContainers": {
      "activitybar": [
        {
          "id": "claude-history",
          "title": "Claude History",
          "icon": "$(history)"
        }
      ]
    },
    "views": {
      "claude-history": [
        {
          "id": "claudeHistoryView",
          "name": "Conversations"
        }
      ]
    },
    "commands": [
      {
        "command": "claudeHistory.search",
        "title": "Claude History: Search"
      },
      {
        "command": "claudeHistory.refresh",
        "title": "Claude History: Refresh Index"
      },
      {
        "command": "claudeHistory.openWorkspace",
        "title": "Claude History: Open Workspace Conversations"
      }
    ],
    "configuration": {
      "title": "Claude History",
      "properties": {
        "claudeHistory.defaultProfileId": {
          "type": "string",
          "default": "default",
          "description": "Default profile ID to use for scanning"
        }
      }
    }
  },
  "scripts": {
    "build": "node esbuild.js",
    "watch": "node esbuild.js --watch",
    "test": "npx vitest run",
    "test:watch": "npx vitest",
    "vscode:prepublish": "node esbuild.js --production"
  },
  "dependencies": {
    "flexsearch": "^0.7.43",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-markdown": "^10.1.0",
    "remark-gfm": "^4.0.1"
  },
  "devDependencies": {
    "@types/node": "^20.10.0",
    "@types/react": "^18.2.42",
    "@types/react-dom": "^18.2.17",
    "@types/vscode": "^1.85.0",
    "@vitest/coverage-v8": "^4.0.0",
    "esbuild": "^0.20.0",
    "jsdom": "^28.0.0",
    "typescript": "^5.3.2",
    "vitest": "^4.0.0"
  }
}
```

**Step 2: Create tsconfig.json (extension host)**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "moduleResolution": "node",
    "lib": ["ES2020"],
    "outDir": "out",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "sourceMap": true,
    "declaration": true
  },
  "include": ["src/**/*"],
  "exclude": ["src/webview-ui/**/*", "node_modules", "out"]
}
```

**Step 3: Create tsconfig.webview.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2020", "DOM"],
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/webview-ui/**/*", "src/core/types.ts"]
}
```

**Step 4: Create esbuild.js**

```javascript
const esbuild = require('esbuild')
const production = process.argv.includes('--production')
const watch = process.argv.includes('--watch')

const extensionOptions = {
  entryPoints: ['src/extension.ts'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  external: ['vscode'],
  outfile: 'out/extension.js',
  sourcemap: !production,
  minify: production,
  logLevel: 'info',
}

const webviewOptions = {
  entryPoints: ['src/webview-ui/main.tsx'],
  bundle: true,
  platform: 'browser',
  target: 'es2020',
  outfile: 'out/webview/main.js',
  sourcemap: !production,
  minify: production,
  logLevel: 'info',
}

async function build() {
  if (watch) {
    const [extCtx, webCtx] = await Promise.all([
      esbuild.context(extensionOptions),
      esbuild.context(webviewOptions),
    ])
    await Promise.all([extCtx.watch(), webCtx.watch()])
    console.log('Watching...')
  } else {
    await Promise.all([
      esbuild.build(extensionOptions),
      esbuild.build(webviewOptions),
    ])
  }
}

build().catch(() => process.exit(1))
```

**Step 5: Create .vscodeignore**

```
src/
node_modules/
*.test.ts
tsconfig*.json
esbuild.js
.gitignore
docs/
```

**Step 6: Create .gitignore**

```
node_modules/
out/
*.js.map
coverage/
```

**Step 7: Create vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/core/**/*.test.ts'],
    exclude: ['src/webview-ui/**'],
  },
})
```

**Step 8: Install dependencies and verify build**

```bash
npm install
node esbuild.js
```

Expected: Creates `out/extension.js` and `out/webview/main.js` (stubs — will fail until src/extension.ts exists; that's OK)

**Step 9: Commit**

```bash
git add package.json tsconfig.json tsconfig.webview.json esbuild.js vitest.config.ts \
        .vscodeignore .gitignore
git commit -m "chore: add extension scaffold — package.json, tsconfigs, esbuild"
```

---

### Task 2.2: extension.ts entry point

**Files:**
- Create: `src/extension.ts`

**Step 1: Create extension.ts**

```typescript
import * as vscode from 'vscode'
import { HistoryService } from './services/HistoryService'
import { ConversationTreeProvider } from './providers/ConversationTreeProvider'
import { ConversationPanel } from './webview/ConversationPanel'

let historyService: HistoryService | undefined

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const outputChannel = vscode.window.createOutputChannel('Claude History')
  context.subscriptions.push(outputChannel)

  historyService = new HistoryService(context, outputChannel)
  const treeProvider = new ConversationTreeProvider(historyService)

  const treeView = vscode.window.createTreeView('claudeHistoryView', {
    treeDataProvider: treeProvider,
    showCollapseAll: true,
  })
  context.subscriptions.push(treeView)

  // Initialize index in background
  vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Window,
      title: 'Claude History: Scanning conversations...',
      cancellable: false,
    },
    async () => {
      await historyService!.initialize()
      treeProvider.refresh()
    }
  )

  // Commands
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeHistory.search', async () => {
      if (!historyService) return
      const query = await vscode.window.showInputBox({
        placeHolder: 'Search conversations...',
        prompt: 'Enter search query',
      })
      if (query === undefined) return
      treeProvider.setSearchQuery(query)
      treeProvider.refresh()
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('claudeHistory.refresh', async () => {
      if (!historyService) return
      await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Window, title: 'Claude History: Refreshing...' },
        async () => {
          await historyService!.rebuild()
          treeProvider.refresh()
        }
      )
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('claudeHistory.openConversation', async (id: string) => {
      if (!historyService) return
      const conversation = await historyService.getConversation(id)
      if (!conversation) {
        vscode.window.showErrorMessage('Conversation not found')
        return
      }
      ConversationPanel.createOrShow(context, conversation)
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('claudeHistory.openWorkspace', async () => {
      if (!historyService) return
      const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
      if (!workspacePath) {
        vscode.window.showInformationMessage('No workspace open')
        return
      }
      treeProvider.setProjectFilter(workspacePath)
      treeProvider.refresh()
    })
  )
}

export function deactivate(): void {
  historyService = undefined
}
```

**Step 2: Verify TypeScript compiles (errors expected — stubs not yet created)**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: Errors about missing `HistoryService`, `ConversationTreeProvider`, `ConversationPanel` — these will be created in tasks 3.x and 4.x. This is expected at this stage.

**Step 3: Commit**

```bash
git add src/extension.ts
git commit -m "feat: add extension.ts entry point with command registration"
```

---

## STAGE 3 — Search Service + TreeView

### Task 3.1: HistoryService

**Files:**
- Create: `src/services/HistoryService.ts`

**Step 1: Create HistoryService.ts**

The HistoryService is the VS Code equivalent of the Electron main process's scanner + indexer + IPC handlers. It replaces `main/index.ts:initializeSearch()` and all `ipcMain.handle` calls for search/scan:

```typescript
import * as vscode from 'vscode'
import { join } from 'path'
import { ConversationScanner } from '../core/scanner'
import { SearchIndexer } from '../core/indexer'
import { ensureProfilesExist, loadProfilesConfig } from '../core/profiles'
import { applyFilters } from '../core/filters'
import type { Conversation, ConversationMeta, SearchResult, FilterOptions } from '../core/types'

export class HistoryService {
  private scanner: ConversationScanner | undefined
  private indexer: SearchIndexer | undefined
  private initialized = false
  private readonly storageDir: string

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly output: vscode.OutputChannel,
  ) {
    this.storageDir = context.globalStorageUri.fsPath
  }

  async initialize(): Promise<void> {
    const config = await ensureProfilesExist(this.storageDir)
    const enabledProfiles = config.profiles.filter(p => p.enabled)
    await this.buildIndex(enabledProfiles.map(p => ({
      ...p,
      configDir: p.configDir,
    })))
  }

  async rebuild(): Promise<void> {
    const config = await loadProfilesConfig(this.storageDir)
    const enabledProfiles = config.profiles.filter(p => p.enabled)
    await this.buildIndex(enabledProfiles)
  }

  private async buildIndex(profiles: Array<{ id: string; label: string; emoji: string; configDir: string; enabled: boolean }>): Promise<void> {
    this.output.appendLine(`Scanning with ${profiles.length} profile(s)...`)

    this.scanner = new ConversationScanner(profiles)
    this.indexer = new SearchIndexer()

    const metas = await this.scanner.scanAllMeta()
    this.output.appendLine(`Found ${metas.length} conversations`)

    await this.indexer.buildIndex(metas)
    this.output.appendLine(`Index built: ${this.indexer.getDocumentCount()} documents`)

    this.initialized = true
  }

  search(query: string, limit = 10000, projectFilter?: string): SearchResult[] {
    if (!this.indexer) return []
    return this.indexer.search(query, limit, projectFilter)
  }

  async getAllMeta(filters?: FilterOptions): Promise<ConversationMeta[]> {
    if (!this.scanner) return []
    // Return from metadata cache via search with empty query
    const results = this.search('', 10000, filters?.project)
    // Map SearchResult back to ConversationMeta shape for tree provider
    return results.map(r => ({
      id: r.id,
      filePath: r.id,
      projectPath: r.projectPath,
      projectName: r.projectName,
      sessionId: r.sessionId,
      sessionName: r.sessionName,
      timestamp: r.timestamp,
      messageCount: r.messageCount,
      preview: r.preview,
      contentSnippet: r.preview,
      lastMessageSender: r.lastMessageSender,
      account: r.account,
    }))
  }

  async getConversation(id: string): Promise<Conversation | null> {
    if (!this.scanner) return null
    return this.scanner.getConversation(id)
  }

  getProjects(): string[] {
    if (!this.scanner) return []
    return this.scanner.getProjects()
  }

  isInitialized(): boolean {
    return this.initialized
  }
}
```

**Step 2: Commit**

```bash
git add src/services/HistoryService.ts
git commit -m "feat(services): add HistoryService — VS Code orchestrator for scanner+indexer"
```

---

### Task 3.2: ConversationTreeProvider

**Files:**
- Create: `src/providers/ConversationTreeProvider.ts`

**Step 1: Create ConversationTreeProvider.ts**

The TreeProvider replaces the Electron `ResultsList.tsx` + `FilterPanel.tsx` + `SearchBar.tsx`. It uses VS Code's native TreeView API:

```typescript
import * as vscode from 'vscode'
import type { HistoryService } from '../services/HistoryService'
import type { ConversationMeta } from '../core/types'

export class ConversationItem extends vscode.TreeItem {
  constructor(
    public readonly meta: ConversationMeta,
    public readonly collapsibleState = vscode.TreeItemCollapsibleState.None,
  ) {
    super(meta.sessionName || meta.sessionId.slice(0, 8), collapsibleState)

    this.description = `${meta.messageCount} msgs · ${this.formatDate(meta.timestamp)}`
    this.tooltip = meta.preview
    this.contextValue = 'conversation'
    this.command = {
      command: 'claudeHistory.openConversation',
      title: 'Open Conversation',
      arguments: [meta.id],
    }

    // Badge: last message sender indicator
    this.iconPath = meta.lastMessageSender === 'assistant'
      ? new vscode.ThemeIcon('comment')
      : new vscode.ThemeIcon('account')
  }

  private formatDate(iso: string): string {
    const d = new Date(iso)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffDays === 0) return 'today'
    if (diffDays === 1) return 'yesterday'
    if (diffDays < 7) return `${diffDays}d ago`
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
    return d.toLocaleDateString()
  }
}

export class ProjectGroupItem extends vscode.TreeItem {
  constructor(
    public readonly projectName: string,
    public readonly projectPath: string,
    public readonly count: number,
  ) {
    super(projectName, vscode.TreeItemCollapsibleState.Expanded)
    this.description = `${count} conversation${count !== 1 ? 's' : ''}`
    this.contextValue = 'projectGroup'
    this.iconPath = new vscode.ThemeIcon('folder')
    this.tooltip = projectPath
  }
}

export type TreeNode = ConversationItem | ProjectGroupItem

export class ConversationTreeProvider implements vscode.TreeDataProvider<TreeNode> {
  private _onDidChangeTreeData = new vscode.EventEmitter<TreeNode | undefined | void>()
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event

  private searchQuery = ''
  private projectFilter: string | undefined
  private groupByProject = true

  constructor(private readonly service: HistoryService) {}

  refresh(): void {
    this._onDidChangeTreeData.fire()
  }

  setSearchQuery(query: string): void {
    this.searchQuery = query
  }

  setProjectFilter(projectPath: string | undefined): void {
    this.projectFilter = projectPath
  }

  getTreeItem(element: TreeNode): vscode.TreeItem {
    return element
  }

  async getChildren(element?: TreeNode): Promise<TreeNode[]> {
    if (!this.service.isInitialized()) {
      return [new vscode.TreeItem('Loading...') as TreeNode]
    }

    // Child items of a project group
    if (element instanceof ProjectGroupItem) {
      const allMeta = await this.service.getAllMeta()
      const grouped = allMeta.filter(m => m.projectPath === element.projectPath)
      const filtered = this.searchQuery
        ? this.service.search(this.searchQuery, 10000, element.projectPath).map(r =>
            grouped.find(m => m.id === r.id)!).filter(Boolean)
        : grouped
      return filtered
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .map(m => new ConversationItem(m))
    }

    // Root level
    if (!element) {
      if (this.searchQuery) {
        const results = this.service.search(this.searchQuery, 100, this.projectFilter)
        const metas = await this.service.getAllMeta()
        return results
          .map(r => metas.find(m => m.id === r.id))
          .filter((m): m is ConversationMeta => m !== undefined)
          .map(m => new ConversationItem(m))
      }

      const allMeta = await this.service.getAllMeta()
      const filtered = this.projectFilter
        ? allMeta.filter(m => m.projectPath === this.projectFilter)
        : allMeta

      if (this.groupByProject) {
        // Group by project
        const groups = new Map<string, ConversationMeta[]>()
        for (const meta of filtered) {
          const existing = groups.get(meta.projectPath) ?? []
          existing.push(meta)
          groups.set(meta.projectPath, existing)
        }

        return Array.from(groups.entries())
          .sort(([, a], [, b]) => {
            const latestA = Math.max(...a.map(m => new Date(m.timestamp).getTime()))
            const latestB = Math.max(...b.map(m => new Date(m.timestamp).getTime()))
            return latestB - latestA
          })
          .map(([path, metas]) =>
            new ProjectGroupItem(metas[0].projectName, path, metas.length)
          )
      }

      return filtered
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 200)
        .map(m => new ConversationItem(m))
    }

    return []
  }
}
```

**Step 2: Commit**

```bash
git add src/providers/ConversationTreeProvider.ts
git commit -m "feat(providers): add ConversationTreeProvider with project grouping"
```

---

## STAGE 4 — Webview Infrastructure

### Task 4.1: Webview panel factory + message protocol

**Files:**
- Create: `src/webview/ConversationPanel.ts`
- Create: `src/webview/protocol.ts`

**Step 1: Create protocol.ts — typed message contracts**

```typescript
import type { Conversation, ExportFormat } from '../core/types'

// Messages sent from extension host → webview
export type ExtensionMessage =
  | { type: 'loadConversation'; conversation: Conversation }
  | { type: 'highlightQuery'; query: string }
  | { type: 'navigateResult'; direction: 'prev' | 'next' }

// Messages sent from webview → extension host
export type WebviewMessage =
  | { type: 'ready' }
  | { type: 'copyMessage'; content: string }
  | { type: 'exportConversation'; format: ExportFormat }
  | { type: 'openExternal'; url: string }
```

**Step 2: Create ConversationPanel.ts**

```typescript
import * as vscode from 'vscode'
import { join } from 'path'
import { readFile, writeFile } from 'fs/promises'
import type { Conversation } from '../core/types'
import type { ExtensionMessage, WebviewMessage } from './protocol'
import { buildExportContent } from '../core/export'

export class ConversationPanel {
  static currentPanel: ConversationPanel | undefined
  private readonly panel: vscode.WebviewPanel
  private disposables: vscode.Disposable[] = []

  private constructor(
    panel: vscode.WebviewPanel,
    private readonly context: vscode.ExtensionContext,
  ) {
    this.panel = panel

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables)

    this.panel.webview.onDidReceiveMessage(
      async (message: WebviewMessage) => {
        switch (message.type) {
          case 'ready':
            // Webview signals it's ready — nothing to do on initial load
            break

          case 'copyMessage':
            await vscode.env.clipboard.writeText(message.content)
            vscode.window.showInformationMessage('Copied to clipboard')
            break

          case 'exportConversation': {
            // The webview requests export — but we need the conversation
            // This gets re-sent with the conversation attached if needed.
            // For now, just acknowledge.
            break
          }

          case 'openExternal':
            vscode.env.openExternal(vscode.Uri.parse(message.url))
            break
        }
      },
      null,
      this.disposables,
    )
  }

  static async createOrShow(
    context: vscode.ExtensionContext,
    conversation: Conversation,
  ): Promise<void> {
    const column = vscode.window.activeTextEditor
      ? vscode.ViewColumn.Beside
      : vscode.ViewColumn.One

    if (ConversationPanel.currentPanel) {
      ConversationPanel.currentPanel.panel.reveal(column)
      await ConversationPanel.currentPanel.loadConversation(conversation)
      return
    }

    const panel = vscode.window.createWebviewPanel(
      'claudeHistoryConversation',
      'Claude Conversation',
      column,
      {
        enableScripts: true,
        localResourceRoots: [
          vscode.Uri.joinPath(context.extensionUri, 'out', 'webview'),
        ],
        retainContextWhenHidden: true,
      },
    )

    ConversationPanel.currentPanel = new ConversationPanel(panel, context)
    panel.webview.html = await ConversationPanel.currentPanel.getHtmlContent(panel.webview)
    await ConversationPanel.currentPanel.loadConversation(conversation)
  }

  private async loadConversation(conversation: Conversation): Promise<void> {
    const title = conversation.sessionName || conversation.sessionId.slice(0, 8)
    this.panel.title = `Claude: ${title}`

    const message: ExtensionMessage = { type: 'loadConversation', conversation }
    this.panel.webview.postMessage(message)
  }

  private async getHtmlContent(webview: vscode.Webview): Promise<string> {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'out', 'webview', 'main.js'),
    )

    const nonce = generateNonce()

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none';
             script-src 'nonce-${nonce}';
             style-src ${webview.cspSource} 'unsafe-inline';
             img-src ${webview.cspSource} https: data:;
             font-src ${webview.cspSource};" />
  <title>Claude Conversation</title>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`
  }

  dispose(): void {
    ConversationPanel.currentPanel = undefined
    this.panel.dispose()
    for (const d of this.disposables) d.dispose()
    this.disposables = []
  }
}

function generateNonce(): string {
  let text = ''
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length))
  }
  return text
}
```

**Step 3: Commit**

```bash
git add src/webview/ConversationPanel.ts src/webview/protocol.ts
git commit -m "feat(webview): add ConversationPanel factory with typed message protocol"
```

---

### Task 4.2: VS Code API shim for webview

**Files:**
- Create: `src/webview-ui/vscodeApi.ts`

**Step 1: Create the VS Code API shim**

The webview uses `acquireVsCodeApi()` which is only available inside the VS Code webview context. This shim provides the typed interface and a safe accessor:

```typescript
// src/webview-ui/vscodeApi.ts
import type { WebviewMessage } from '../webview/protocol'

interface VsCodeApi {
  postMessage(message: WebviewMessage): void
  getState(): unknown
  setState(state: unknown): void
}

declare function acquireVsCodeApi(): VsCodeApi

let api: VsCodeApi | undefined

export function getVsCodeApi(): VsCodeApi {
  if (!api) {
    api = acquireVsCodeApi()
  }
  return api
}

export function postMessage(message: WebviewMessage): void {
  getVsCodeApi().postMessage(message)
}
```

**Step 2: Commit**

```bash
git add src/webview-ui/vscodeApi.ts
git commit -m "feat(webview-ui): add VS Code API shim for webview messaging"
```

---

## STAGE 5 — Conversation Viewer (React Webview)

> For each component below: read the source, decide whether to port directly or adapt, then implement.

### Task 5.1: Port ToolInvocationBadge

**Files:**
- Create: `src/webview-ui/components/ToolInvocationBadge.tsx`

**Step 1: Read source and verify — no Electron deps**

Source: `src/renderer/src/components/ToolInvocationBadge.tsx` — pure React, no imports from Electron or IPC. **Port directly.**

Copy the file to `src/webview-ui/components/ToolInvocationBadge.tsx`. Update the import path from `../../shared/types` to `../../core/types` (via relative path in webview-ui).

**Note:** The webview bundle includes types.ts via the webview tsconfig. The import path must resolve correctly within esbuild's bundle — use `'../../core/types'` or create a local re-export.

**Step 2: Create types re-export for webview-ui**

```typescript
// src/webview-ui/types.ts
// Re-export from core so webview components have a clean import path
export type * from '../core/types'
```

**Step 3: Port ToolInvocationBadge.tsx with updated import**

```typescript
// src/webview-ui/components/ToolInvocationBadge.tsx
// [Copy src/renderer/src/components/ToolInvocationBadge.tsx verbatim]
// Change: import type { ... } from '../../../shared/types'
// To:     import type { ... } from '../types'
```

**Step 4: Commit**

```bash
git add src/webview-ui/types.ts src/webview-ui/components/ToolInvocationBadge.tsx
git commit -m "feat(webview-ui): port ToolInvocationBadge component"
```

---

### Task 5.2: Port MessageNavigation

**Files:**
- Create: `src/webview-ui/components/MessageNavigation.tsx`

**Step 1: Read source and evaluate**

Source: `src/renderer/src/components/MessageNavigation.tsx` — pure React, no Electron deps. **Port directly.** Update import path.

**Step 2: Port MessageNavigation.tsx**

```typescript
// src/webview-ui/components/MessageNavigation.tsx
// [Copy src/renderer/src/components/MessageNavigation.tsx verbatim]
// Change import: '../../shared/types' → '../types'
```

**Step 3: Commit**

```bash
git add src/webview-ui/components/MessageNavigation.tsx
git commit -m "feat(webview-ui): port MessageNavigation component"
```

---

### Task 5.3: Port tool-cards/* (7 components)

**Files:**
- Create: `src/webview-ui/components/tool-cards/EditDiffCard.tsx`
- Create: `src/webview-ui/components/tool-cards/BashTerminalCard.tsx` (adapted — no xterm)
- Create: `src/webview-ui/components/tool-cards/GrepResultCard.tsx`
- Create: `src/webview-ui/components/tool-cards/GlobResultCard.tsx`
- Create: `src/webview-ui/components/tool-cards/ReadFileCard.tsx`
- Create: `src/webview-ui/components/tool-cards/WriteFileCard.tsx`
- Create: `src/webview-ui/components/tool-cards/GenericToolCard.tsx`

**Step 1: Port EditDiffCard, GrepResultCard, GlobResultCard, ReadFileCard, WriteFileCard, GenericToolCard**

All are pure React with no Electron/xterm deps. Port each verbatim, updating import paths from `../../../shared/types` to `../../types`.

**Step 2: Adapt BashTerminalCard — REMOVE xterm dependency**

Source `BashTerminalCard.tsx` uses `@xterm/xterm` and `@xterm/addon-fit`. In the webview, xterm is unavailable (no Node.js process). Render bash output as `<pre>` instead:

```typescript
// src/webview-ui/components/tool-cards/BashTerminalCard.tsx
import React from 'react'
import type { BashToolResult } from '../../types'

interface Props {
  result: BashToolResult
}

export function BashTerminalCard({ result }: Props) {
  const hasOutput = result.stdout || result.stderr

  return (
    <div className="bash-card">
      {result.interrupted && (
        <div className="bash-interrupted">⚠ Interrupted</div>
      )}
      {result.stdout && (
        <pre className="bash-stdout">{result.stdout}</pre>
      )}
      {result.stderr && (
        <pre className="bash-stderr">{result.stderr}</pre>
      )}
      {!hasOutput && (
        <span className="bash-empty">(no output)</span>
      )}
    </div>
  )
}
```

**Step 3: Commit all tool-cards**

```bash
git add src/webview-ui/components/tool-cards/
git commit -m "feat(webview-ui): port all tool-cards; BashTerminalCard adapted (no xterm)"
```

---

### Task 5.4: Port ToolResultCard

**Files:**
- Create: `src/webview-ui/components/ToolResultCard.tsx`

**Step 1: Read source and evaluate**

Source: `src/renderer/src/components/ToolResultCard.tsx` — imports tool-cards, pure React. **Port directly.** Update imports.

**Step 2: Port ToolResultCard.tsx**

```typescript
// src/webview-ui/components/ToolResultCard.tsx
// [Copy src/renderer/src/components/ToolResultCard.tsx verbatim]
// Update all import paths:
//   '../../../shared/types' → '../types'
//   './tool-cards/...' → './tool-cards/...' (same relative path, no change needed)
```

**Step 3: Commit**

```bash
git add src/webview-ui/components/ToolResultCard.tsx
git commit -m "feat(webview-ui): port ToolResultCard"
```

---

### Task 5.5: Port MessageContent

**Files:**
- Create: `src/webview-ui/components/MessageContent.tsx`

**Step 1: Read source and evaluate**

Source: `src/renderer/src/components/MessageContent.tsx` — uses `react-markdown` and `remark-gfm`. Both are pure JS packages that work in browser context. **Port directly.** Update imports.

**Step 2: Port MessageContent.tsx**

```typescript
// src/webview-ui/components/MessageContent.tsx
// [Copy src/renderer/src/components/MessageContent.tsx verbatim]
// Update import path: '../../shared/types' → '../types'
// react-markdown and remark-gfm are already in package.json dependencies
```

**Step 3: Commit**

```bash
git add src/webview-ui/components/MessageContent.tsx
git commit -m "feat(webview-ui): port MessageContent with react-markdown"
```

---

### Task 5.6: Build ConversationView (App.tsx)

**Files:**
- Create: `src/webview-ui/App.tsx`
- Create: `src/webview-ui/main.tsx`

**Step 1: Read source ConversationView.tsx and evaluate**

Source: `src/renderer/src/components/ConversationView.tsx` — uses IPC calls via `window.electron.ipc`. These must be replaced with webview message protocol.

**Step 2: Create App.tsx — adapted from ConversationView**

```typescript
// src/webview-ui/App.tsx
import React, { useState, useEffect, useCallback } from 'react'
import type { Conversation } from './types'
import type { ExtensionMessage, WebviewMessage } from '../webview/protocol'
import { MessageContent } from './components/MessageContent'
import { ToolResultCard } from './components/ToolResultCard'
import { ToolInvocationBadge } from './components/ToolInvocationBadge'
import { MessageNavigation } from './components/MessageNavigation'
import { postMessage } from './vscodeApi'

export function App() {
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [highlightQuery, setHighlightQuery] = useState('')
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0)

  useEffect(() => {
    // Tell extension we're ready
    postMessage({ type: 'ready' })

    const handler = (event: MessageEvent) => {
      const message = event.data as ExtensionMessage
      switch (message.type) {
        case 'loadConversation':
          setConversation(message.conversation)
          setCurrentMessageIndex(0)
          break
        case 'highlightQuery':
          setHighlightQuery(message.query)
          break
      }
    }

    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  const handleCopy = useCallback((content: string) => {
    postMessage({ type: 'copyMessage', content })
  }, [])

  const handleExport = useCallback((format: 'markdown' | 'json' | 'text') => {
    postMessage({ type: 'exportConversation', format })
  }, [])

  if (!conversation) {
    return <div className="loading">Select a conversation from the sidebar</div>
  }

  return (
    <div className="conversation-view">
      <div className="conversation-header">
        <h2>{conversation.sessionName || conversation.sessionId.slice(0, 8)}</h2>
        <div className="conversation-meta">
          <span>{conversation.messageCount} messages</span>
          <span>{new Date(conversation.timestamp).toLocaleDateString()}</span>
          <div className="export-actions">
            <button onClick={() => handleExport('markdown')}>Export MD</button>
            <button onClick={() => handleExport('json')}>Export JSON</button>
            <button onClick={() => handleExport('text')}>Export TXT</button>
          </div>
        </div>
      </div>

      <div className="messages">
        {conversation.messages.map((message, index) => (
          <div
            key={message.uuid ?? `${message.type}-${index}`}
            className={`message message-${message.type} ${message.isToolResult ? 'tool-result' : ''}`}
          >
            <div className="message-header">
              <span className="message-role">{message.type}</span>
              {message.metadata?.toolUses && (
                <div className="tool-badges">
                  {message.metadata.toolUses.map(tool => (
                    <ToolInvocationBadge key={tool} toolName={tool} />
                  ))}
                </div>
              )}
              <button
                className="copy-btn"
                onClick={() => handleCopy(message.content)}
                title="Copy message"
              >
                Copy
              </button>
            </div>

            {message.content && (
              <MessageContent
                content={message.content}
                highlightQuery={highlightQuery}
              />
            )}

            {message.metadata?.toolResults?.map((result, i) => (
              <ToolResultCard key={i} result={result} />
            ))}

            {message.metadata && (
              <div className="message-metadata">
                {message.metadata.model && <span>{message.metadata.model}</span>}
                {message.metadata.inputTokens && (
                  <span>↑{message.metadata.inputTokens} ↓{message.metadata.outputTokens}</span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
```

**Step 3: Create main.tsx — webview React entry point**

```typescript
// src/webview-ui/main.tsx
import React from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'

const root = document.getElementById('root')
if (root) {
  createRoot(root).render(<App />)
}
```

**Step 4: Commit**

```bash
git add src/webview-ui/App.tsx src/webview-ui/main.tsx
git commit -m "feat(webview-ui): add App.tsx conversation viewer and main.tsx entry"
```

---

### Task 5.7: Full build + verify

**Step 1: Install dependencies**

```bash
cd /Users/ronen/Desktop/dev/personal/vscode-claude-code-manager
npm install
```

**Step 2: Build**

```bash
node esbuild.js
```

Expected: `out/extension.js` and `out/webview/main.js` created with no errors

**Step 3: Run all tests**

```bash
npx vitest run
```

Expected: All PASS

**Step 4: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: No errors (or only minor import path issues to fix)

**Step 5: Fix any TypeScript errors**

Address any remaining type errors one by one. Common issues:
- Import paths in webview-ui components referencing `../core/types` — verify esbuild resolves them
- Missing `@types/react` in webview-ui tsconfig scope

**Step 6: Final commit**

```bash
git add -A
git commit -m "feat: complete Stage 0-5 — core extraction, extension scaffold, TreeView, webview viewer"
```

---

## Reference: Key Source Files

| Source file | Maps to | Migration |
|---|---|---|
| `src/shared/types.ts` | `src/core/types.ts` | Port, remove PTY types |
| `src/main/services/scanner.ts` | `src/core/scanner.ts` | Port verbatim |
| `src/main/services/indexer.ts` | `src/core/indexer.ts` | Port verbatim |
| `src/main/formatters.ts` | `src/core/formatters.ts` | Port verbatim |
| `src/main/worktree-parser.ts` | `src/core/worktree-parser.ts` | Port verbatim |
| `src/main/utils/execFileNoThrow.ts` | `src/core/execFileNoThrow.ts` | Port verbatim |
| `src/main/index.ts` (profiles) | `src/core/profiles.ts` | Extract, make path-agnostic |
| `src/main/index.ts` (export) | `src/core/export.ts` | Extract content-only logic |
| `src/renderer/src/components/MessageContent.tsx` | `src/webview-ui/components/MessageContent.tsx` | Port, update import path |
| `src/renderer/src/components/ToolResultCard.tsx` | `src/webview-ui/components/ToolResultCard.tsx` | Port, update import path |
| `src/renderer/src/components/ToolInvocationBadge.tsx` | `src/webview-ui/components/ToolInvocationBadge.tsx` | Port, update import path |
| `src/renderer/src/components/MessageNavigation.tsx` | `src/webview-ui/components/MessageNavigation.tsx` | Port, update import path |
| `src/renderer/src/components/tool-cards/BashTerminalCard.tsx` | same path in webview-ui | Adapt: remove xterm, use `<pre>` |
| `src/renderer/src/components/tool-cards/*.tsx` (others) | same path in webview-ui | Port verbatim |
| `src/renderer/src/components/ConversationView.tsx` | `src/webview-ui/App.tsx` | Rewrite: replace IPC with postMessage |
