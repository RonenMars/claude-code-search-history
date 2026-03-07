// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import ActiveChatList from './ActiveChatList'
import type { ChatInstance } from '../../../shared/types'

function buildInstance(overrides: Partial<ChatInstance> = {}): ChatInstance {
  return {
    instanceId: 'inst-1',
    cwd: '/Users/dev/my-project',
    profile: null,
    status: 'active',
    exitCode: null,
    isClaudeTyping: false,
    ...overrides,
  }
}

describe('ActiveChatList', () => {
  it('returns null when no instances', () => {
    const { container } = render(
      <ActiveChatList
        instances={[]}
        activeChatInstanceId={null}
        onFocus={vi.fn()}
        onClose={vi.fn()}
      />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders instance with project basename', () => {
    render(
      <ActiveChatList
        instances={[buildInstance({ cwd: '/Users/dev/cool-project' })]}
        activeChatInstanceId={null}
        onFocus={vi.fn()}
        onClose={vi.fn()}
      />
    )
    expect(screen.getByText(/cool-project/)).toBeInTheDocument()
  })

  it('shows work profile emoji', () => {
    render(
      <ActiveChatList
        instances={[buildInstance({ profile: 'work' })]}
        activeChatInstanceId={null}
        onFocus={vi.fn()}
        onClose={vi.fn()}
      />
    )
    expect(screen.getByText(/my-project/)).toHaveTextContent('💼')
  })

  it('shows personal profile emoji', () => {
    render(
      <ActiveChatList
        instances={[buildInstance({ profile: 'personal' })]}
        activeChatInstanceId={null}
        onFocus={vi.fn()}
        onClose={vi.fn()}
      />
    )
    expect(screen.getByText(/my-project/)).toHaveTextContent('🏠')
  })

  it('shows "Exited" badge with exit code for exited instances', () => {
    render(
      <ActiveChatList
        instances={[buildInstance({ status: 'exited', exitCode: 1 })]}
        activeChatInstanceId={null}
        onFocus={vi.fn()}
        onClose={vi.fn()}
      />
    )
    expect(screen.getByText('Exited (1)')).toBeInTheDocument()
  })

  it('shows "Exited" without code when exitCode is null', () => {
    render(
      <ActiveChatList
        instances={[buildInstance({ status: 'exited', exitCode: null })]}
        activeChatInstanceId={null}
        onFocus={vi.fn()}
        onClose={vi.fn()}
      />
    )
    expect(screen.getByText('Exited')).toBeInTheDocument()
  })

  it('calls onFocus when focus button is clicked', async () => {
    const onFocus = vi.fn()
    render(
      <ActiveChatList
        instances={[buildInstance({ instanceId: 'inst-42' })]}
        activeChatInstanceId={null}
        onFocus={onFocus}
        onClose={vi.fn()}
      />
    )
    await userEvent.click(screen.getByTitle('Focus this chat'))
    expect(onFocus).toHaveBeenCalledWith('inst-42')
  })

  it('calls onClose when close button is clicked', async () => {
    const onClose = vi.fn()
    render(
      <ActiveChatList
        instances={[buildInstance({ instanceId: 'inst-42' })]}
        activeChatInstanceId={null}
        onFocus={vi.fn()}
        onClose={onClose}
      />
    )
    await userEvent.click(screen.getByTitle('Stop and remove'))
    expect(onClose).toHaveBeenCalledWith('inst-42')
  })

  it('close button says "Remove" for exited instances', () => {
    render(
      <ActiveChatList
        instances={[buildInstance({ status: 'exited', exitCode: 0 })]}
        activeChatInstanceId={null}
        onFocus={vi.fn()}
        onClose={vi.fn()}
      />
    )
    expect(screen.getByTitle('Remove')).toBeInTheDocument()
  })

  it('renders multiple instances', () => {
    render(
      <ActiveChatList
        instances={[
          buildInstance({ instanceId: 'a', cwd: '/dev/project-a' }),
          buildInstance({ instanceId: 'b', cwd: '/dev/project-b' }),
        ]}
        activeChatInstanceId="a"
        onFocus={vi.fn()}
        onClose={vi.fn()}
      />
    )
    expect(screen.getByText(/project-a/)).toBeInTheDocument()
    expect(screen.getByText(/project-b/)).toBeInTheDocument()
  })
})
