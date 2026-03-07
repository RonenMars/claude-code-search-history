/**
 * Test data factories for deterministic, composable test fixtures.
 */
import type {
  ConversationMeta,
  Conversation,
  ConversationMessage,
  SearchResult,
  Profile,
  Worktree,
  GitInfo,
  ToolResult,
  EditToolResult,
  BashToolResult,
  GlobToolResult,
  GrepToolResult,
  MessageMetadata,
  AppSettings,
  UserPreferences,
} from '../shared/types'

let counter = 0
function nextId(): string {
  return `test-id-${++counter}`
}

export function resetFactoryCounter(): void {
  counter = 0
}

// ─── Messages ─────────────────────────────────────────────────────

export function buildMessage(overrides: Partial<ConversationMessage> = {}): ConversationMessage {
  return {
    type: 'user',
    content: 'Hello, this is a test message',
    timestamp: '2025-01-15T10:00:00Z',
    ...overrides,
  }
}

export function buildAssistantMessage(overrides: Partial<ConversationMessage> = {}): ConversationMessage {
  return buildMessage({
    type: 'assistant',
    content: 'I can help you with that.',
    metadata: {
      model: 'claude-sonnet-4-20250514',
      inputTokens: 100,
      outputTokens: 50,
    },
    ...overrides,
  })
}

export function buildToolResultMessage(toolResults: ToolResult[], overrides: Partial<ConversationMessage> = {}): ConversationMessage {
  return buildMessage({
    type: 'user',
    content: '',
    isToolResult: true,
    metadata: { toolResults },
    ...overrides,
  })
}

// ─── Conversations ────────────────────────────────────────────────

export function buildConversationMeta(overrides: Partial<ConversationMeta> = {}): ConversationMeta {
  const id = nextId()
  return {
    id,
    filePath: `/home/user/.claude/projects/test-project/${id}.jsonl`,
    projectPath: '/home/user/dev/test-project',
    projectName: 'dev/test-project',
    sessionId: `session-${id}`,
    sessionName: '',
    timestamp: '2025-01-15T10:00:00Z',
    messageCount: 5,
    preview: 'Test conversation preview text',
    contentSnippet: 'Full content snippet for indexing purposes with more text here',
    lastMessageSender: 'assistant',
    account: 'default',
    ...overrides,
  }
}

export function buildConversation(overrides: Partial<Conversation> = {}): Conversation {
  const id = nextId()
  return {
    id,
    filePath: `/home/user/.claude/projects/test-project/${id}.jsonl`,
    projectPath: '/home/user/dev/test-project',
    projectName: 'dev/test-project',
    sessionId: `session-${id}`,
    sessionName: '',
    messages: [
      buildMessage({ content: 'Help me fix this bug' }),
      buildAssistantMessage({ content: 'I can see the issue in your code.' }),
    ],
    fullText: 'Help me fix this bug I can see the issue in your code.',
    timestamp: '2025-01-15T10:00:00Z',
    messageCount: 2,
    account: 'default',
    ...overrides,
  }
}

// ─── Search Results ───────────────────────────────────────────────

export function buildSearchResult(overrides: Partial<SearchResult> = {}): SearchResult {
  const id = nextId()
  return {
    id,
    projectName: 'dev/test-project',
    projectPath: '/home/user/dev/test-project',
    sessionId: `session-${id}`,
    sessionName: '',
    preview: 'Search result preview text',
    timestamp: '2025-01-15T10:00:00Z',
    messageCount: 5,
    score: 1,
    lastMessageSender: 'assistant',
    account: 'default',
    ...overrides,
  }
}

// ─── Profiles ─────────────────────────────────────────────────────

export function buildProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: 'default',
    label: 'Default',
    emoji: '🤖',
    configDir: '~/.claude',
    enabled: true,
    ...overrides,
  }
}

export function buildWorkProfile(): Profile {
  return buildProfile({
    id: 'work',
    label: 'Work',
    emoji: '💼',
    configDir: '~/.claude-work',
  })
}

// ─── Worktrees ────────────────────────────────────────────────────

export function buildWorktree(overrides: Partial<Worktree> = {}): Worktree {
  return {
    path: '/home/user/dev/project',
    head: 'abc1234',
    branch: 'main',
    isMain: true,
    projectPath: '/home/user/dev/project',
    projectName: 'project',
    ...overrides,
  }
}

// ─── Git Info ─────────────────────────────────────────────────────

export function buildGitInfo(overrides: Partial<GitInfo> = {}): GitInfo {
  return {
    type: 'git',
    branch: 'main',
    ...overrides,
  }
}

// ─── Tool Results ─────────────────────────────────────────────────

export function buildEditToolResult(overrides: Partial<EditToolResult> = {}): EditToolResult {
  return {
    type: 'edit',
    filePath: '/home/user/dev/project/src/main.ts',
    oldString: 'const x = 1',
    newString: 'const x = 2',
    structuredPatch: [{
      oldStart: 1,
      oldLines: 1,
      newStart: 1,
      newLines: 1,
      lines: ['-const x = 1', '+const x = 2'],
    }],
    userModified: false,
    replaceAll: false,
    ...overrides,
  }
}

export function buildBashToolResult(overrides: Partial<BashToolResult> = {}): BashToolResult {
  return {
    type: 'bash',
    stdout: '$ npm test\nAll tests passed',
    stderr: '',
    interrupted: false,
    ...overrides,
  }
}

export function buildGlobToolResult(overrides: Partial<GlobToolResult> = {}): GlobToolResult {
  return {
    type: 'glob',
    filenames: ['src/main.ts', 'src/util.ts'],
    numFiles: 2,
    truncated: false,
    ...overrides,
  }
}

export function buildGrepToolResult(overrides: Partial<GrepToolResult> = {}): GrepToolResult {
  return {
    type: 'grep',
    mode: 'content',
    filenames: ['src/main.ts'],
    content: 'src/main.ts:1:const x = 1',
    numFiles: 1,
    numLines: 1,
    ...overrides,
  }
}

// ─── Settings / Preferences ──────────────────────────────────────

export function buildAppSettings(overrides: Partial<AppSettings> = {}): AppSettings {
  return {
    maxChatInstances: 3,
    groupByProject: false,
    ...overrides,
  }
}

export function buildUserPreferences(overrides: Partial<UserPreferences> = {}): UserPreferences {
  return {
    sortBy: 'recent',
    dateRange: 'all',
    selectedProject: '',
    ...overrides,
  }
}

// ─── Metadata ─────────────────────────────────────────────────────

export function buildMessageMetadata(overrides: Partial<MessageMetadata> = {}): MessageMetadata {
  return {
    model: 'claude-sonnet-4-20250514',
    inputTokens: 1000,
    outputTokens: 500,
    cacheReadTokens: 200,
    ...overrides,
  }
}
