// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import WorktreesPanel from './WorktreesPanel'
import { buildWorktree } from '../../../test/factories'

beforeEach(() => {
  vi.mocked(window.electronAPI.getWorktrees).mockReset()
})

describe('WorktreesPanel', () => {
  it('shows loading state initially', () => {
    // Never resolve so we stay in loading state
    vi.mocked(window.electronAPI.getWorktrees).mockReturnValue(new Promise(() => {}))

    render(
      <WorktreesPanel onChatInWorktree={vi.fn()} onClose={vi.fn()} />
    )

    expect(screen.getByText('Loading worktrees...')).toBeInTheDocument()
  })

  it('shows empty state when no worktrees are returned', async () => {
    vi.mocked(window.electronAPI.getWorktrees).mockResolvedValue([])

    render(
      <WorktreesPanel onChatInWorktree={vi.fn()} onClose={vi.fn()} />
    )

    await waitFor(() => {
      expect(screen.getByText('No linked worktrees found')).toBeInTheDocument()
    })
    expect(screen.getByText(/git worktree add/)).toBeInTheDocument()
  })

  it('renders grouped worktrees by project', async () => {
    const main = buildWorktree({
      path: '/home/user/dev/alpha',
      branch: 'main',
      head: 'aaa1111',
      isMain: true,
      projectPath: '/home/user/dev/alpha',
      projectName: 'alpha',
    })
    const linked = buildWorktree({
      path: '/home/user/dev/alpha-feature',
      branch: 'feature-x',
      head: 'bbb2222',
      isMain: false,
      projectPath: '/home/user/dev/alpha',
      projectName: 'alpha',
    })

    vi.mocked(window.electronAPI.getWorktrees).mockResolvedValue([main, linked])

    render(
      <WorktreesPanel onChatInWorktree={vi.fn()} onClose={vi.fn()} />
    )

    await waitFor(() => {
      expect(screen.getByText('alpha')).toBeInTheDocument()
    })
    // Linked worktree branch and head are displayed
    expect(screen.getByText('feature-x')).toBeInTheDocument()
    expect(screen.getByText('bbb2222')).toBeInTheDocument()
  })

  it('displays main worktree branch and HEAD SHA in the group header', async () => {
    const main = buildWorktree({
      branch: 'main',
      head: 'ccc3333',
      isMain: true,
      projectPath: '/home/user/dev/myproject',
      projectName: 'myproject',
    })

    vi.mocked(window.electronAPI.getWorktrees).mockResolvedValue([main])

    render(
      <WorktreesPanel onChatInWorktree={vi.fn()} onClose={vi.fn()} />
    )

    await waitFor(() => {
      expect(screen.getByText('myproject')).toBeInTheDocument()
    })
    expect(screen.getByText('main')).toBeInTheDocument()
    expect(screen.getByText('ccc3333')).toBeInTheDocument()
  })

  it('displays the linked worktree path', async () => {
    const main = buildWorktree({
      isMain: true,
      projectPath: '/home/user/dev/proj',
      projectName: 'proj',
    })
    const linked = buildWorktree({
      path: '/home/user/dev/proj-wt',
      branch: 'wt-branch',
      head: 'ddd4444',
      isMain: false,
      projectPath: '/home/user/dev/proj',
      projectName: 'proj',
    })

    vi.mocked(window.electronAPI.getWorktrees).mockResolvedValue([main, linked])

    render(
      <WorktreesPanel onChatInWorktree={vi.fn()} onClose={vi.fn()} />
    )

    await waitFor(() => {
      expect(screen.getByText('/home/user/dev/proj-wt')).toBeInTheDocument()
    })
  })

  it('calls onChatInWorktree with the worktree path when "Open Chat" is clicked', async () => {
    const onChatInWorktree = vi.fn().mockResolvedValue(undefined)
    const main = buildWorktree({
      isMain: true,
      projectPath: '/home/user/dev/proj',
      projectName: 'proj',
    })
    const linked = buildWorktree({
      path: '/home/user/dev/proj-feat',
      branch: 'feat',
      head: 'eee5555',
      isMain: false,
      projectPath: '/home/user/dev/proj',
      projectName: 'proj',
    })

    vi.mocked(window.electronAPI.getWorktrees).mockResolvedValue([main, linked])

    render(
      <WorktreesPanel onChatInWorktree={onChatInWorktree} onClose={vi.fn()} />
    )

    await waitFor(() => {
      expect(screen.getByText('Open Chat')).toBeInTheDocument()
    })

    await userEvent.click(screen.getByText('Open Chat'))
    expect(onChatInWorktree).toHaveBeenCalledWith('/home/user/dev/proj-feat')
  })

  it('copy button copies branch text to clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, {
      clipboard: { writeText },
    })

    const main = buildWorktree({
      isMain: true,
      projectPath: '/home/user/dev/proj',
      projectName: 'proj',
      branch: 'main',
      head: 'fff6666',
    })
    const linked = buildWorktree({
      path: '/home/user/dev/proj-copy',
      branch: 'copy-branch',
      head: 'ggg7777',
      isMain: false,
      projectPath: '/home/user/dev/proj',
      projectName: 'proj',
    })

    vi.mocked(window.electronAPI.getWorktrees).mockResolvedValue([main, linked])

    render(
      <WorktreesPanel onChatInWorktree={vi.fn()} onClose={vi.fn()} />
    )

    await waitFor(() => {
      expect(screen.getByText('copy-branch')).toBeInTheDocument()
    })

    // The copy button for the linked branch has a title "Copy copy-branch"
    const copyButton = screen.getByTitle('Copy copy-branch')
    await userEvent.click(copyButton)

    expect(writeText).toHaveBeenCalledWith('copy-branch')
  })

  it('multiple projects group correctly', async () => {
    const mainA = buildWorktree({
      path: '/home/user/dev/alpha',
      branch: 'main',
      head: 'aaa0001',
      isMain: true,
      projectPath: '/home/user/dev/alpha',
      projectName: 'alpha',
    })
    const linkedA = buildWorktree({
      path: '/home/user/dev/alpha-wt',
      branch: 'feat-a',
      head: 'aaa0002',
      isMain: false,
      projectPath: '/home/user/dev/alpha',
      projectName: 'alpha',
    })
    const mainB = buildWorktree({
      path: '/home/user/dev/beta',
      branch: 'main',
      head: 'bbb0001',
      isMain: true,
      projectPath: '/home/user/dev/beta',
      projectName: 'beta',
    })
    const linkedB = buildWorktree({
      path: '/home/user/dev/beta-wt',
      branch: 'feat-b',
      head: 'bbb0002',
      isMain: false,
      projectPath: '/home/user/dev/beta',
      projectName: 'beta',
    })

    vi.mocked(window.electronAPI.getWorktrees).mockResolvedValue([mainA, linkedA, mainB, linkedB])

    render(
      <WorktreesPanel onChatInWorktree={vi.fn()} onClose={vi.fn()} />
    )

    await waitFor(() => {
      expect(screen.getByText('alpha')).toBeInTheDocument()
    })
    expect(screen.getByText('beta')).toBeInTheDocument()
    expect(screen.getByText('feat-a')).toBeInTheDocument()
    expect(screen.getByText('feat-b')).toBeInTheDocument()

    // Two "Open Chat" buttons — one per linked worktree
    const chatButtons = screen.getAllByText('Open Chat')
    expect(chatButtons).toHaveLength(2)
  })

  it('calls onClose when the close button is clicked', async () => {
    vi.mocked(window.electronAPI.getWorktrees).mockResolvedValue([])
    const onClose = vi.fn()

    render(
      <WorktreesPanel onChatInWorktree={vi.fn()} onClose={onClose} />
    )

    await userEvent.click(screen.getByTitle('Close worktrees'))
    expect(onClose).toHaveBeenCalled()
  })

  it('refresh button reloads worktrees', async () => {
    vi.mocked(window.electronAPI.getWorktrees).mockResolvedValue([])

    render(
      <WorktreesPanel onChatInWorktree={vi.fn()} onClose={vi.fn()} />
    )

    await waitFor(() => {
      expect(screen.getByText('No linked worktrees found')).toBeInTheDocument()
    })

    // Now mock a worktree for the second load
    const wt = buildWorktree({
      isMain: true,
      projectPath: '/home/user/dev/refreshed',
      projectName: 'refreshed',
      branch: 'main',
      head: 'rrr1111',
    })
    vi.mocked(window.electronAPI.getWorktrees).mockResolvedValue([wt])

    await userEvent.click(screen.getByTitle('Refresh worktrees'))

    await waitFor(() => {
      expect(screen.getByText('refreshed')).toBeInTheDocument()
    })
  })

  it('renders the header title', async () => {
    vi.mocked(window.electronAPI.getWorktrees).mockResolvedValue([])

    render(
      <WorktreesPanel onChatInWorktree={vi.fn()} onClose={vi.fn()} />
    )

    expect(screen.getByText('Git Worktrees')).toBeInTheDocument()
  })

  it('shows only linked worktrees with Open Chat buttons (main worktree has no chat button)', async () => {
    const main = buildWorktree({
      isMain: true,
      projectPath: '/home/user/dev/proj',
      projectName: 'proj',
    })

    vi.mocked(window.electronAPI.getWorktrees).mockResolvedValue([main])

    render(
      <WorktreesPanel onChatInWorktree={vi.fn()} onClose={vi.fn()} />
    )

    await waitFor(() => {
      expect(screen.getByText('proj')).toBeInTheDocument()
    })

    // Main worktree does not get an "Open Chat" button
    expect(screen.queryByText('Open Chat')).not.toBeInTheDocument()
  })
})
