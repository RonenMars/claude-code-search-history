// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import ProfilePickerModal from './ProfilePickerModal'
import { buildProfile, buildWorkProfile } from '../../../test/factories'

describe('ProfilePickerModal', () => {
  const defaultProfile = buildProfile()
  const workProfile = buildWorkProfile()

  it('renders enabled profiles with emoji and label', () => {
    render(
      <ProfilePickerModal
        profiles={[defaultProfile, workProfile]}
        onSelect={vi.fn()}
        onCancel={vi.fn()}
      />
    )
    expect(screen.getByText('Default')).toBeInTheDocument()
    expect(screen.getByText('Work')).toBeInTheDocument()
    expect(screen.getByText('🤖')).toBeInTheDocument()
    expect(screen.getByText('💼')).toBeInTheDocument()
  })

  it('only shows enabled profiles', () => {
    const disabledProfile = buildProfile({
      id: 'disabled',
      label: 'Disabled',
      emoji: '🚫',
      enabled: false,
    })
    render(
      <ProfilePickerModal
        profiles={[defaultProfile, disabledProfile]}
        onSelect={vi.fn()}
        onCancel={vi.fn()}
      />
    )
    expect(screen.getByText('Default')).toBeInTheDocument()
    expect(screen.queryByText('Disabled')).not.toBeInTheDocument()
  })

  it('calls onSelect with profile and remember=false when a profile is clicked', async () => {
    const onSelect = vi.fn()
    render(
      <ProfilePickerModal
        profiles={[defaultProfile, workProfile]}
        onSelect={onSelect}
        onCancel={vi.fn()}
      />
    )
    await userEvent.click(screen.getByText('Work'))
    expect(onSelect).toHaveBeenCalledWith(workProfile, false)
  })

  it('calls onCancel when Cancel button is clicked', async () => {
    const onCancel = vi.fn()
    render(
      <ProfilePickerModal
        profiles={[defaultProfile]}
        onSelect={vi.fn()}
        onCancel={onCancel}
      />
    )
    await userEvent.click(screen.getByText('Cancel'))
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('has a "Remember my choice" checkbox that is toggleable', async () => {
    const onSelect = vi.fn()
    render(
      <ProfilePickerModal
        profiles={[defaultProfile]}
        onSelect={onSelect}
        onCancel={vi.fn()}
      />
    )
    const checkbox = screen.getByRole('checkbox')
    expect(checkbox).not.toBeChecked()

    await userEvent.click(checkbox)
    expect(checkbox).toBeChecked()

    // Selecting a profile after checking remember should pass true
    await userEvent.click(screen.getByText('Default'))
    expect(onSelect).toHaveBeenCalledWith(defaultProfile, true)
  })

  it('displays the heading and description', () => {
    render(
      <ProfilePickerModal
        profiles={[defaultProfile]}
        onSelect={vi.fn()}
        onCancel={vi.fn()}
      />
    )
    expect(screen.getByText('Start New Chat')).toBeInTheDocument()
    expect(screen.getByText('Select which Claude profile to use')).toBeInTheDocument()
  })

  it('displays config directory for each profile', () => {
    render(
      <ProfilePickerModal
        profiles={[defaultProfile, workProfile]}
        onSelect={vi.fn()}
        onCancel={vi.fn()}
      />
    )
    expect(screen.getByText('~/.claude')).toBeInTheDocument()
    expect(screen.getByText('~/.claude-work')).toBeInTheDocument()
  })
})
