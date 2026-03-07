// @vitest-environment jsdom
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import SettingsModal from './SettingsModal'
import { buildAppSettings, buildProfile, buildWorkProfile } from '../../../test/factories'
import type { AppSettings, Profile } from '../../../shared/types'

// Mock child components that have their own tests or complex side effects
vi.mock('./SystemStats', () => ({
  default: () => <div data-testid="system-stats">SystemStats</div>,
}))

vi.mock('./ProfilesPanel', () => ({
  default: ({ profiles }: { profiles: Profile[] }) => (
    <div data-testid="profiles-panel">ProfilesPanel ({profiles.length})</div>
  ),
}))

describe('SettingsModal', () => {
  const defaultSettings = buildAppSettings({ maxChatInstances: 3, groupByProject: false })
  const defaultProfile = buildProfile()
  const workProfile = buildWorkProfile()

  function renderModal(overrides: {
    settings?: AppSettings
    profiles?: Profile[]
    defaultProfileId?: string | null
  } = {}) {
    const props = {
      settings: overrides.settings ?? defaultSettings,
      onSave: vi.fn(),
      profiles: overrides.profiles ?? [defaultProfile, workProfile],
      onFilterByProfile: vi.fn(),
      onProfilesSaved: vi.fn().mockResolvedValue(undefined),
      onClose: vi.fn(),
      defaultProfileId: overrides.defaultProfileId ?? null,
      onClearDefaultProfile: vi.fn(),
    }
    const result = render(<SettingsModal {...props} />)
    return { ...result, props }
  }

  beforeEach(() => {
    vi.mocked(window.electronAPI.getProfilesUsage).mockResolvedValue({})
  })

  it('renders the Settings heading', () => {
    renderModal()
    expect(screen.getByText('Settings')).toBeInTheDocument()
  })

  it('renders max chat instances input with current value', () => {
    renderModal({ settings: buildAppSettings({ maxChatInstances: 5 }) })
    const input = screen.getByRole('spinbutton')
    expect(input).toHaveValue(5)
  })

  it('renders group by project toggle with current value (off)', () => {
    renderModal({ settings: buildAppSettings({ groupByProject: false }) })
    const toggle = screen.getByRole('switch')
    expect(toggle).toHaveAttribute('aria-checked', 'false')
  })

  it('renders group by project toggle with current value (on)', () => {
    renderModal({ settings: buildAppSettings({ groupByProject: true }) })
    const toggle = screen.getByRole('switch')
    expect(toggle).toHaveAttribute('aria-checked', 'true')
  })

  it('calls onSave when max instances is changed', () => {
    const { props } = renderModal()
    const input = screen.getByRole('spinbutton')
    fireEvent.change(input, { target: { value: '7' } })
    expect(props.onSave).toHaveBeenCalledWith({ maxChatInstances: 7 })
  })

  it('calls onSave when group by project toggle is clicked', async () => {
    const { props } = renderModal()
    const toggle = screen.getByRole('switch')
    await userEvent.click(toggle)
    expect(props.onSave).toHaveBeenCalledWith({ groupByProject: true })
  })

  it('calls onClose when close button is clicked', async () => {
    const { props } = renderModal()
    await userEvent.click(screen.getByTitle('Close settings'))
    expect(props.onClose).toHaveBeenCalledOnce()
  })

  it('shows "None" when no default profile is set', () => {
    renderModal({ defaultProfileId: null })
    expect(screen.getByText(/None/)).toBeInTheDocument()
  })

  it('shows default profile name and Clear button when set', () => {
    renderModal({ defaultProfileId: 'default' })
    expect(screen.getByText('Clear')).toBeInTheDocument()
    // The default profile emoji + label is rendered in a span
    expect(screen.getByText(/🤖\s+Default/)).toBeInTheDocument()
  })

  it('calls onClearDefaultProfile when Clear is clicked', async () => {
    const { props } = renderModal({ defaultProfileId: 'default' })
    await userEvent.click(screen.getByText('Clear'))
    expect(props.onClearDefaultProfile).toHaveBeenCalledOnce()
  })

  it('clamps max instances to minimum of 1', () => {
    const { props } = renderModal()
    const input = screen.getByRole('spinbutton')
    fireEvent.change(input, { target: { value: '0' } })
    // The handler clamps to min 1
    expect(props.onSave).toHaveBeenCalledWith({ maxChatInstances: 1 })
  })

  it('renders the ProfilesPanel section', () => {
    renderModal()
    expect(screen.getByTestId('profiles-panel')).toBeInTheDocument()
  })

  it('renders the SystemStats section', () => {
    renderModal()
    expect(screen.getByTestId('system-stats')).toBeInTheDocument()
  })

  it('renders Display and Chat section headings', () => {
    renderModal()
    expect(screen.getByText('Display')).toBeInTheDocument()
    expect(screen.getByText('Chat')).toBeInTheDocument()
  })
})
