// @vitest-environment jsdom
import { render, screen, fireEvent, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeAll } from 'vitest'
import FilterPanel from './FilterPanel'
import type { Profile } from '../../../shared/types'

beforeAll(() => {
  // jsdom does not implement scrollIntoView
  Element.prototype.scrollIntoView = vi.fn()
})

const defaultProjects = [
  '/Users/dev/projects/alpha',
  '/Users/dev/projects/beta',
  '/Users/dev/work/gamma'
]

const singleProfile: Profile[] = [
  { id: 'p1', label: 'Personal', emoji: '🏠', configDir: '/tmp/p1', enabled: true }
]

const multipleProfiles: Profile[] = [
  { id: 'p1', label: 'Personal', emoji: '🏠', configDir: '/tmp/p1', enabled: true },
  { id: 'p2', label: 'Work', emoji: '💼', configDir: '/tmp/p2', enabled: true },
  { id: 'p3', label: 'Disabled', emoji: '🚫', configDir: '/tmp/p3', enabled: false }
]

function renderPanel(overrides: Partial<Parameters<typeof FilterPanel>[0]> = {}) {
  const props = {
    projects: defaultProjects,
    selectedProject: '',
    onProjectChange: vi.fn(),
    sortBy: 'recent' as const,
    onSortChange: vi.fn(),
    dateRange: 'all' as const,
    onDateRangeChange: vi.fn(),
    onChatInProject: vi.fn(),
    profiles: singleProfile,
    accountFilter: null,
    onAccountFilterChange: vi.fn(),
    disabled: false,
    ...overrides
  }
  const result = render(<FilterPanel {...props} />)
  return { ...result, props }
}

describe('FilterPanel', () => {
  // ─── Sort dropdown ──────────────────────────────────────────────

  it('renders sort dropdown with correct options', () => {
    renderPanel()
    const sortSelect = screen.getByTitle('Sort conversations')
    const options = within(sortSelect).getAllByRole('option')
    expect(options.map((o) => o.textContent)).toEqual([
      'Most Recent',
      'Oldest First',
      'Most Messages',
      'Least Messages',
      'A-Z'
    ])
  })

  it('calls onSortChange when sort selection changes', async () => {
    const { props } = renderPanel()
    const sortSelect = screen.getByTitle('Sort conversations')
    await userEvent.selectOptions(sortSelect, 'oldest')
    expect(props.onSortChange).toHaveBeenCalledWith('oldest')
  })

  // ─── Date range dropdown ────────────────────────────────────────

  it('renders date range dropdown with correct options', () => {
    renderPanel()
    const dateSelect = screen.getByTitle('Filter by date')
    const options = within(dateSelect).getAllByRole('option')
    expect(options.map((o) => o.textContent)).toEqual([
      'All Time',
      'Today',
      'Last 7 Days',
      'Last 30 Days'
    ])
  })

  it('calls onDateRangeChange when date range selection changes', async () => {
    const { props } = renderPanel()
    const dateSelect = screen.getByTitle('Filter by date')
    await userEvent.selectOptions(dateSelect, 'week')
    expect(props.onDateRangeChange).toHaveBeenCalledWith('week')
  })

  // ─── Project autocomplete ──────────────────────────────────────

  it('opens autocomplete dropdown on input focus', async () => {
    renderPanel()
    const input = screen.getByPlaceholderText(/all projects/i)
    expect(screen.queryByText('All Projects')).not.toBeInTheDocument()
    await userEvent.click(input)
    expect(screen.getByText('All Projects')).toBeInTheDocument()
  })

  it('shows all projects when dropdown is open with no filter text', async () => {
    renderPanel()
    const input = screen.getByPlaceholderText(/all projects/i)
    await userEvent.click(input)
    // All three projects should be listed (via their short paths)
    expect(screen.getByText('All Projects')).toBeInTheDocument()
    // Projects are rendered with HighlightedPath showing getShortPath result
    // /Users/dev/projects/alpha -> .../dev/projects/alpha
    expect(screen.getByTitle('/Users/dev/projects/alpha')).toBeInTheDocument()
    expect(screen.getByTitle('/Users/dev/projects/beta')).toBeInTheDocument()
    expect(screen.getByTitle('/Users/dev/work/gamma')).toBeInTheDocument()
  })

  it('filters projects as user types', async () => {
    renderPanel()
    const input = screen.getByPlaceholderText(/all projects/i)
    await userEvent.click(input)
    await userEvent.type(input, 'alpha')
    expect(screen.getByTitle('/Users/dev/projects/alpha')).toBeInTheDocument()
    expect(screen.queryByTitle('/Users/dev/projects/beta')).not.toBeInTheDocument()
    expect(screen.queryByTitle('/Users/dev/work/gamma')).not.toBeInTheDocument()
  })

  it('"All Projects" option is always shown even when filtering', async () => {
    renderPanel()
    const input = screen.getByPlaceholderText(/all projects/i)
    await userEvent.click(input)
    await userEvent.type(input, 'alpha')
    expect(screen.getByText('All Projects')).toBeInTheDocument()
  })

  it('ArrowDown navigates the highlighted item', async () => {
    renderPanel()
    const input = screen.getByPlaceholderText(/all projects/i)
    await userEvent.click(input)

    // Initially index 0 (All Projects) is highlighted
    const allProjectsItem = screen.getByText('All Projects').closest('li')!
    expect(allProjectsItem.className).toContain('bg-claude-orange/20')

    // Press ArrowDown to move to first project
    await userEvent.keyboard('{ArrowDown}')
    const firstProject = screen.getByTitle('/Users/dev/projects/alpha').closest('li')!
    expect(firstProject.className).toContain('bg-claude-orange/20')
    // All Projects should no longer be highlighted
    expect(allProjectsItem.className).not.toContain('bg-claude-orange/20')
  })

  it('ArrowUp navigates upward and wraps around', async () => {
    renderPanel()
    const input = screen.getByPlaceholderText(/all projects/i)
    await userEvent.click(input)

    // Press ArrowUp from 0 should wrap to last item (index 3 = gamma)
    await userEvent.keyboard('{ArrowUp}')
    const lastProject = screen.getByTitle('/Users/dev/work/gamma').closest('li')!
    expect(lastProject.className).toContain('bg-claude-orange/20')
  })

  it('Enter selects the highlighted project', async () => {
    const { props } = renderPanel()
    const input = screen.getByPlaceholderText(/all projects/i)
    await userEvent.click(input)

    // Navigate to first project
    await userEvent.keyboard('{ArrowDown}')
    await userEvent.keyboard('{Enter}')

    expect(props.onProjectChange).toHaveBeenCalledWith('/Users/dev/projects/alpha')
  })

  it('Enter on "All Projects" selects empty string', async () => {
    const { props } = renderPanel()
    const input = screen.getByPlaceholderText(/all projects/i)
    await userEvent.click(input)

    // Highlighted index starts at 0 (All Projects)
    await userEvent.keyboard('{Enter}')

    expect(props.onProjectChange).toHaveBeenCalledWith('')
  })

  it('Escape closes the autocomplete dropdown', async () => {
    renderPanel()
    const input = screen.getByPlaceholderText(/all projects/i)
    await userEvent.click(input)
    expect(screen.getByText('All Projects')).toBeInTheDocument()

    await userEvent.keyboard('{Escape}')
    expect(screen.queryByText('All Projects')).not.toBeInTheDocument()
  })

  // ─── Profile filter ─────────────────────────────────────────────

  it('does not show profile filter when only one enabled profile exists', () => {
    renderPanel({ profiles: singleProfile })
    expect(screen.queryByTitle('Filter by profile')).not.toBeInTheDocument()
  })

  it('shows profile filter when multiple enabled profiles exist', () => {
    renderPanel({ profiles: multipleProfiles })
    const profileSelect = screen.getByTitle('Filter by profile')
    expect(profileSelect).toBeInTheDocument()
    const options = within(profileSelect).getAllByRole('option')
    // "All Profiles" + 2 enabled profiles (disabled profile is excluded)
    expect(options).toHaveLength(3)
    expect(options[0].textContent).toBe('All Profiles')
  })

  it('calls onAccountFilterChange when profile selection changes', async () => {
    const { props } = renderPanel({ profiles: multipleProfiles })
    const profileSelect = screen.getByTitle('Filter by profile')
    await userEvent.selectOptions(profileSelect, 'p2')
    expect(props.onAccountFilterChange).toHaveBeenCalledWith('p2')
  })

  it('calls onAccountFilterChange with null when "All Profiles" is selected', async () => {
    const { props } = renderPanel({ profiles: multipleProfiles, accountFilter: 'p1' })
    const profileSelect = screen.getByTitle('Filter by profile')
    await userEvent.selectOptions(profileSelect, '')
    expect(props.onAccountFilterChange).toHaveBeenCalledWith(null)
  })

  it('shows clear button for active profile filter', () => {
    renderPanel({ profiles: multipleProfiles, accountFilter: 'p1' })
    expect(screen.getByTitle('Clear profile filter')).toBeInTheDocument()
  })

  it('clears profile filter when clear button is clicked', async () => {
    const { props } = renderPanel({ profiles: multipleProfiles, accountFilter: 'p1' })
    await userEvent.click(screen.getByTitle('Clear profile filter'))
    expect(props.onAccountFilterChange).toHaveBeenCalledWith(null)
  })

  // ─── Chat in project button ─────────────────────────────────────

  it('does not show "Chat in this project" button when no project is selected', () => {
    renderPanel({ selectedProject: '' })
    expect(screen.queryByText('Chat in this project')).not.toBeInTheDocument()
  })

  it('shows "Chat in this project" button when a project is selected', () => {
    renderPanel({ selectedProject: '/Users/dev/projects/alpha' })
    expect(screen.getByText('Chat in this project')).toBeInTheDocument()
  })

  it('calls onChatInProject with the selected project when button is clicked', async () => {
    const { props } = renderPanel({ selectedProject: '/Users/dev/projects/alpha' })
    await userEvent.click(screen.getByText('Chat in this project'))
    expect(props.onChatInProject).toHaveBeenCalledWith('/Users/dev/projects/alpha')
  })

  // ─── Disabled state ─────────────────────────────────────────────

  it('applies disabled styling when disabled prop is true', () => {
    const { container } = renderPanel({ disabled: true })
    const wrapper = container.firstElementChild!
    expect(wrapper.className).toContain('opacity-50')
    expect(wrapper.className).toContain('pointer-events-none')
  })

  it('does not apply disabled styling when disabled prop is false', () => {
    const { container } = renderPanel({ disabled: false })
    const wrapper = container.firstElementChild!
    expect(wrapper.className).not.toContain('opacity-50')
    expect(wrapper.className).not.toContain('pointer-events-none')
  })

  // ─── Path highlighting ──────────────────────────────────────────

  it('highlights the matching substring in project paths', async () => {
    renderPanel()
    const input = screen.getByPlaceholderText(/all projects/i)
    await userEvent.click(input)
    await userEvent.type(input, 'alpha')

    const projectItem = screen.getByTitle('/Users/dev/projects/alpha')
    const highlight = projectItem.querySelector('span.text-claude-orange')
    expect(highlight).toBeInTheDocument()
    expect(highlight!.textContent).toBe('alpha')
  })

  it('shows full text without highlight when query does not match short path', async () => {
    renderPanel()
    const input = screen.getByPlaceholderText(/all projects/i)
    await userEvent.click(input)

    // "Users" is in the full path but getShortPath for /Users/dev/projects/alpha
    // returns ".../dev/projects/alpha" so "Users" won't match the short path
    await userEvent.type(input, 'Users')

    // The projects still show (filter is on full path) but highlight is on short path
    // For /Users/dev/projects/alpha, short path is ".../dev/projects/alpha" which doesn't contain "Users"
    const projectItem = screen.getByTitle('/Users/dev/projects/alpha')
    const highlight = projectItem.querySelector('span.text-claude-orange')
    expect(highlight).not.toBeInTheDocument()
  })
})
