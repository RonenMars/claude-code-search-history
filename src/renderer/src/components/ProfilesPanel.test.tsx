// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ProfilesPanel from './ProfilesPanel'
import { buildProfile, buildWorkProfile } from '../../../test/factories'
import type { Profile } from '../../../shared/types'

describe('ProfilesPanel', () => {
  const defaultProfile = buildProfile()
  const workProfile = buildWorkProfile()

  beforeEach(() => {
    vi.mocked(window.electronAPI.getProfilesUsage).mockResolvedValue({
      default: {
        conversations: 42,
        lastUsed: '2026-03-06T12:00:00Z',
        tokensThisMonth: 150000,
        messages: 320,
        projects: 5,
      },
      work: {
        conversations: 10,
        lastUsed: '2026-03-05T08:00:00Z',
        tokensThisMonth: 50000,
        messages: 80,
        projects: 2,
      },
    })
  })

  it('renders profile cards for each profile', () => {
    render(
      <ProfilesPanel
        profiles={[defaultProfile, workProfile]}
        onFilterByProfile={vi.fn()}
        onProfilesSaved={vi.fn()}
      />
    )
    expect(screen.getByText('Default')).toBeInTheDocument()
    expect(screen.getByText('Work')).toBeInTheDocument()
  })

  it('renders the Profiles heading', () => {
    render(
      <ProfilesPanel
        profiles={[defaultProfile]}
        onFilterByProfile={vi.fn()}
        onProfilesSaved={vi.fn()}
      />
    )
    expect(screen.getByText('Profiles')).toBeInTheDocument()
  })

  it('shows empty state when no profiles', () => {
    render(
      <ProfilesPanel
        profiles={[]}
        onFilterByProfile={vi.fn()}
        onProfilesSaved={vi.fn()}
      />
    )
    expect(screen.getByText('No profiles configured.')).toBeInTheDocument()
  })

  it('displays usage stats when loaded', async () => {
    render(
      <ProfilesPanel
        profiles={[defaultProfile]}
        onFilterByProfile={vi.fn()}
        onProfilesSaved={vi.fn()}
      />
    )
    // Wait for async usage data to load
    expect(await screen.findByText('42')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('320')).toBeInTheDocument()
    expect(screen.getByText('150.0K')).toBeInTheDocument()
  })

  it('calls onProfilesSaved when delete button is clicked', async () => {
    const onProfilesSaved = vi.fn().mockResolvedValue(undefined)
    render(
      <ProfilesPanel
        profiles={[defaultProfile, workProfile]}
        onFilterByProfile={vi.fn()}
        onProfilesSaved={onProfilesSaved}
      />
    )
    // There are two Delete buttons; click the second one (Work)
    const deleteButtons = screen.getAllByText('Delete')
    await userEvent.click(deleteButtons[1])
    expect(onProfilesSaved).toHaveBeenCalledWith([defaultProfile])
  })

  it('has an Add Profile button', () => {
    render(
      <ProfilesPanel
        profiles={[defaultProfile]}
        onFilterByProfile={vi.fn()}
        onProfilesSaved={vi.fn()}
      />
    )
    expect(screen.getByText('Add Profile')).toBeInTheDocument()
  })

  it('opens edit modal when Add Profile is clicked', async () => {
    render(
      <ProfilesPanel
        profiles={[defaultProfile]}
        onFilterByProfile={vi.fn()}
        onProfilesSaved={vi.fn()}
      />
    )
    await userEvent.click(screen.getByText('Add Profile'))
    // The ProfileEditModal should appear with "Add Profile" as heading
    // (there are now two: the button and the modal heading/save button)
    const addProfileTexts = screen.getAllByText('Add Profile')
    expect(addProfileTexts.length).toBeGreaterThanOrEqual(2)
  })

  it('opens edit modal when Edit button is clicked', async () => {
    render(
      <ProfilesPanel
        profiles={[defaultProfile]}
        onFilterByProfile={vi.fn()}
        onProfilesSaved={vi.fn()}
      />
    )
    await userEvent.click(screen.getByText('Edit'))
    expect(screen.getByText('Edit Profile')).toBeInTheDocument()
  })

  it('disables delete for the only enabled profile', () => {
    render(
      <ProfilesPanel
        profiles={[defaultProfile]}
        onFilterByProfile={vi.fn()}
        onProfilesSaved={vi.fn()}
      />
    )
    const deleteButton = screen.getByText('Delete')
    expect(deleteButton).toBeDisabled()
  })

  it('does not disable delete when multiple profiles are enabled', () => {
    render(
      <ProfilesPanel
        profiles={[defaultProfile, workProfile]}
        onFilterByProfile={vi.fn()}
        onProfilesSaved={vi.fn()}
      />
    )
    const deleteButtons = screen.getAllByText('Delete')
    deleteButtons.forEach((btn) => {
      expect(btn).not.toBeDisabled()
    })
  })
})
