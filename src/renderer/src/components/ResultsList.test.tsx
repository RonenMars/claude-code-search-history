// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ResultsList from './ResultsList'
import { buildSearchResult, buildProfile } from '../../../test/factories'

// Mock useVirtualizer — jsdom has no layout engine, so the virtualizer
// renders zero items. We replace it with a simple pass-through.
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getVirtualItems: () =>
      Array.from({ length: count }, (_, i) => ({
        index: i,
        key: String(i),
        start: i * 100,
        size: 100,
      })),
    getTotalSize: () => count * 100,
    measureElement: () => {},
  }),
}))

const defaultProps = {
  results: [] as ReturnType<typeof buildSearchResult>[],
  selectedId: null,
  onSelect: vi.fn(),
  onNewChat: vi.fn(),
  query: '',
  gitInfo: {},
  activeCwd: null,
  activeChatSessionId: undefined,
  isClaudeTyping: false,
  activeChatProfile: null as 'work' | 'personal' | null,
  accountFilter: null as string | null,
  profiles: [buildProfile()],
  groupByProject: false,
}

function renderList(overrides = {}) {
  return render(<ResultsList {...defaultProps} {...overrides} />)
}

describe('ResultsList', () => {
  beforeEach(() => {
    vi.mocked(defaultProps.onSelect).mockClear()
  })

  describe('empty state', () => {
    it('shows "Start typing" when no query and no results', () => {
      renderList({ results: [], query: '' })
      expect(screen.getByText('Start typing to search')).toBeInTheDocument()
    })

    it('shows "No results found" when query present but no results', () => {
      renderList({ results: [], query: 'something' })
      expect(screen.getByText('No results found')).toBeInTheDocument()
    })
  })

  describe('flat list rendering', () => {
    it('renders result items with project name', () => {
      const results = [
        buildSearchResult({ projectName: 'my-cool-project', preview: 'some preview text' }),
      ]
      renderList({ results })
      expect(screen.getByText('my-cool-project')).toBeInTheDocument()
    })

    it('renders message count', () => {
      const results = [buildSearchResult({ messageCount: 42 })]
      renderList({ results })
      expect(screen.getByText('42 messages')).toBeInTheDocument()
    })

    it('calls onSelect when a result is clicked', async () => {
      const onSelect = vi.fn()
      const results = [buildSearchResult({ id: 'conv-123' })]
      renderList({ results, onSelect })

      const buttons = screen.getAllByRole('button')
      await userEvent.click(buttons[0])
      expect(onSelect).toHaveBeenCalledWith('conv-123')
    })

    it('shows session name when present', () => {
      const results = [buildSearchResult({ sessionName: 'fix-login-bug' })]
      renderList({ results })
      expect(screen.getByText('fix-login-bug')).toBeInTheDocument()
    })
  })

  describe('account filtering', () => {
    it('filters results by accountFilter', () => {
      const results = [
        buildSearchResult({ account: 'work', projectName: 'work-project' }),
        buildSearchResult({ account: 'personal', projectName: 'personal-project' }),
      ]
      renderList({ results, accountFilter: 'work' })
      expect(screen.getByText('work-project')).toBeInTheDocument()
      expect(screen.queryByText('personal-project')).not.toBeInTheDocument()
    })

    it('shows all results when accountFilter is null', () => {
      const results = [
        buildSearchResult({ account: 'work', projectName: 'work-project' }),
        buildSearchResult({ account: 'personal', projectName: 'personal-project' }),
      ]
      renderList({ results, accountFilter: null })
      expect(screen.getByText('work-project')).toBeInTheDocument()
      expect(screen.getByText('personal-project')).toBeInTheDocument()
    })
  })

  describe('profile badges', () => {
    it('shows profile badge when multiple profiles enabled', () => {
      const profiles = [
        buildProfile({ id: 'default', emoji: '🤖' }),
        buildProfile({ id: 'work', emoji: '💼' }),
      ]
      const results = [buildSearchResult({ account: 'default' })]
      renderList({ results, profiles })
      expect(screen.getByTitle('Default')).toHaveTextContent('🤖')
    })

    it('hides profile badge when only one profile', () => {
      const profiles = [buildProfile({ id: 'default', emoji: '🤖' })]
      const results = [buildSearchResult({ account: 'default' })]
      renderList({ results, profiles })
      expect(screen.queryByTitle('Default')).not.toBeInTheDocument()
    })
  })

  describe('live/typing indicators', () => {
    it('shows Live badge when activeCwd matches result projectPath', () => {
      const results = [buildSearchResult({ projectPath: '/dev/project' })]
      renderList({ results, activeCwd: '/dev/project' })
      expect(screen.getByText('Live')).toBeInTheDocument()
    })

    it('shows Typing indicator when active and isClaudeTyping', () => {
      const results = [buildSearchResult({ projectPath: '/dev/project' })]
      renderList({ results, activeCwd: '/dev/project', isClaudeTyping: true })
      expect(screen.getByText(/Typing/)).toBeInTheDocument()
    })

    it('shows Awaiting reply badge for assistant last message when not active', () => {
      const results = [buildSearchResult({ lastMessageSender: 'assistant', projectPath: '/other' })]
      renderList({ results, activeCwd: null })
      expect(screen.getByText('Awaiting reply')).toBeInTheDocument()
    })
  })

  describe('search highlighting', () => {
    it('highlights query matches in preview', () => {
      const results = [buildSearchResult({ preview: 'Fix the login bug in auth module' })]
      const { container } = renderList({ results, query: 'login' })
      const highlights = container.querySelectorAll('.highlight')
      expect(highlights.length).toBeGreaterThan(0)
      expect(highlights[0].textContent).toBe('login')
    })
  })

  describe('new chat button', () => {
    it('renders a new-chat button for each result item', () => {
      const results = [
        buildSearchResult({ projectName: 'project-a', projectPath: '/dev/a' }),
        buildSearchResult({ projectName: 'project-b', projectPath: '/dev/b' }),
      ]
      renderList({ results })
      expect(screen.getByTitle('New chat in project-a')).toBeInTheDocument()
      expect(screen.getByTitle('New chat in project-b')).toBeInTheDocument()
    })

    it('calls onNewChat with projectPath when clicked', async () => {
      const onNewChat = vi.fn()
      const results = [buildSearchResult({ projectPath: '/dev/my-project', projectName: 'my-project' })]
      renderList({ results, onNewChat })

      await userEvent.click(screen.getByTitle('New chat in my-project'))
      expect(onNewChat).toHaveBeenCalledWith('/dev/my-project')
    })

    it('does not call onSelect when new-chat button is clicked', async () => {
      const onSelect = vi.fn()
      const onNewChat = vi.fn()
      const results = [buildSearchResult({ projectPath: '/dev/proj', projectName: 'proj' })]
      renderList({ results, onSelect, onNewChat })

      await userEvent.click(screen.getByTitle('New chat in proj'))
      expect(onNewChat).toHaveBeenCalledTimes(1)
      expect(onSelect).not.toHaveBeenCalled()
    })

    it('renders new-chat button in grouped mode after expanding', async () => {
      const onNewChat = vi.fn()
      const results = [
        buildSearchResult({ projectPath: '/dev/a', projectName: 'project-a' }),
      ]
      renderList({ results, groupByProject: true, onNewChat })

      // Expand the group
      await userEvent.click(screen.getByText('project-a'))
      expect(screen.getByTitle('New chat in project-a')).toBeInTheDocument()

      await userEvent.click(screen.getByTitle('New chat in project-a'))
      expect(onNewChat).toHaveBeenCalledWith('/dev/a')
    })
  })

  describe('grouped list', () => {
    it('groups results by project when groupByProject is true', () => {
      const results = [
        buildSearchResult({ projectPath: '/dev/a', projectName: 'project-a' }),
        buildSearchResult({ projectPath: '/dev/a', projectName: 'project-a' }),
        buildSearchResult({ projectPath: '/dev/b', projectName: 'project-b' }),
      ]
      renderList({ results, groupByProject: true })
      // Group headers with conversation counts
      expect(screen.getByText('2 chats')).toBeInTheDocument()
      expect(screen.getByText('1 chat')).toBeInTheDocument()
    })
  })
})
