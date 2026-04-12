import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import KanbanBoard from './KanbanBoard'
import type { ActiveSession } from '../../../shared/types'

function makeSession(overrides: Partial<ActiveSession> = {}): ActiveSession {
  return {
    id: 'session-1',
    instanceId: 'inst-1',
    projectPath: '/home/user/my-project',
    projectName: 'my-project',
    status: 'running',
    lastOutput: 'Building…',
    elapsedMs: 12_000,
    promptCount: 3,
    startedAt: new Date(),
    ...overrides,
  }
}

describe('KanbanBoard', () => {
  it('renders all four column headers', () => {
    render(<KanbanBoard sessions={[]} onSelectSession={() => {}} />)
    expect(screen.getByText('Running')).toBeInTheDocument()
    expect(screen.getByText('Waiting for Input')).toBeInTheDocument()
    expect(screen.getByText('Completed')).toBeInTheDocument()
    expect(screen.getByText('Failed')).toBeInTheDocument()
  })

  it('shows empty state for columns with no sessions', () => {
    render(<KanbanBoard sessions={[]} onSelectSession={() => {}} />)
    expect(screen.getByText('No sessions currently running.')).toBeInTheDocument()
    expect(screen.getByText('No sessions awaiting input.')).toBeInTheDocument()
    expect(screen.getByText('No completed sessions yet.')).toBeInTheDocument()
    expect(screen.getByText('No failed sessions.')).toBeInTheDocument()
  })

  it('places a running session in the Running column', () => {
    const session = makeSession({ status: 'running', projectPath: '/home/user/alpha' })
    render(<KanbanBoard sessions={[session]} onSelectSession={() => {}} />)
    // Project name "alpha" should appear
    expect(screen.getByTitle('/home/user/alpha')).toBeInTheDocument()
    // Empty state for running should NOT appear
    expect(screen.queryByText('No sessions currently running.')).not.toBeInTheDocument()
  })

  it('places a waiting_input session in the Waiting column', () => {
    const session = makeSession({ status: 'waiting_input', projectPath: '/home/user/beta' })
    render(<KanbanBoard sessions={[session]} onSelectSession={() => {}} />)
    expect(screen.getByTitle('/home/user/beta')).toBeInTheDocument()
    expect(screen.getByText('Needs input')).toBeInTheDocument()
  })

  it('places a completed session in the Completed column', () => {
    const session = makeSession({ status: 'completed', projectPath: '/home/user/gamma' })
    render(<KanbanBoard sessions={[session]} onSelectSession={() => {}} />)
    expect(screen.getByTitle('/home/user/gamma')).toBeInTheDocument()
    expect(screen.queryByText('No completed sessions yet.')).not.toBeInTheDocument()
  })

  it('places a failed session in the Failed column', () => {
    const session = makeSession({ status: 'failed', projectPath: '/home/user/delta' })
    render(<KanbanBoard sessions={[session]} onSelectSession={() => {}} />)
    expect(screen.getByTitle('/home/user/delta')).toBeInTheDocument()
    expect(screen.queryByText('No failed sessions.')).not.toBeInTheDocument()
  })

  it('calls onSelectSession with instanceId when card is clicked', () => {
    const onSelect = vi.fn()
    const session = makeSession({ instanceId: 'inst-xyz', status: 'running' })
    render(<KanbanBoard sessions={[session]} onSelectSession={onSelect} />)
    const card = screen.getByTitle('/home/user/my-project')
    fireEvent.click(card.closest('button')!)
    expect(onSelect).toHaveBeenCalledWith('inst-xyz')
  })

  it('shows branch badge when branch is set', () => {
    const session = makeSession({ branch: 'feat/my-feature' })
    render(<KanbanBoard sessions={[session]} onSelectSession={() => {}} />)
    expect(screen.getByText('feat/my-feature')).toBeInTheDocument()
  })

  it('shows machine badge when machineName is set', () => {
    const session = makeSession({ machineName: 'macbook-pro' })
    render(<KanbanBoard sessions={[session]} onSelectSession={() => {}} />)
    expect(screen.getByText('macbook-pro')).toBeInTheDocument()
  })

  it('shows lastOutput snippet', () => {
    const session = makeSession({ lastOutput: 'Installing dependencies...' })
    render(<KanbanBoard sessions={[session]} onSelectSession={() => {}} />)
    expect(screen.getByText('Installing dependencies...')).toBeInTheDocument()
  })

  it('formats elapsed time in seconds', () => {
    const session = makeSession({ elapsedMs: 45_000 })
    render(<KanbanBoard sessions={[session]} onSelectSession={() => {}} />)
    expect(screen.getByText('45s')).toBeInTheDocument()
  })

  it('formats elapsed time in minutes', () => {
    const session = makeSession({ elapsedMs: 125_000 })
    render(<KanbanBoard sessions={[session]} onSelectSession={() => {}} />)
    expect(screen.getByText('2m')).toBeInTheDocument()
  })

  it('renders multiple sessions across different columns', () => {
    const sessions = [
      makeSession({ instanceId: 'a', status: 'running', projectPath: '/proj/a' }),
      makeSession({ instanceId: 'b', status: 'waiting_input', projectPath: '/proj/b' }),
      makeSession({ instanceId: 'c', status: 'completed', projectPath: '/proj/c' }),
    ]
    render(<KanbanBoard sessions={sessions} onSelectSession={() => {}} />)
    expect(screen.getByTitle('/proj/a')).toBeInTheDocument()
    expect(screen.getByTitle('/proj/b')).toBeInTheDocument()
    expect(screen.getByTitle('/proj/c')).toBeInTheDocument()
  })
})
