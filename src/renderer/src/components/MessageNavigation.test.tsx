// @vitest-environment jsdom
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import MessageNavigation from './MessageNavigation'

const defaultProps = {
  currentIndex: 5,
  totalMessages: 20,
  onNavigate: vi.fn(),
  onJumpToFirst: vi.fn(),
  onJumpToLast: vi.fn(),
}

function renderNav(overrides = {}) {
  const props = { ...defaultProps, ...overrides }
  // Reset all mocks for fresh assertions
  Object.values(props).forEach((v) => {
    if (typeof v === 'function' && 'mockClear' in v) {
      (v as ReturnType<typeof vi.fn>).mockClear()
    }
  })
  return render(<MessageNavigation {...props} />)
}

describe('MessageNavigation', () => {
  it('displays current message position (1-indexed)', () => {
    renderNav({ currentIndex: 0, totalMessages: 10 })
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('10')).toBeInTheDocument()
  })

  it('displays "Message X of Y" format', () => {
    renderNav({ currentIndex: 4, totalMessages: 15 })
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('15')).toBeInTheDocument()
  })

  describe('Previous button', () => {
    it('calls onNavigate(currentIndex - 1) when clicked', async () => {
      const onNavigate = vi.fn()
      renderNav({ currentIndex: 5, onNavigate })
      await userEvent.click(screen.getByLabelText('Previous message'))
      expect(onNavigate).toHaveBeenCalledWith(4)
    })

    it('is disabled at index 0', () => {
      renderNav({ currentIndex: 0 })
      expect(screen.getByLabelText('Previous message')).toBeDisabled()
    })

    it('is enabled at index > 0', () => {
      renderNav({ currentIndex: 1 })
      expect(screen.getByLabelText('Previous message')).not.toBeDisabled()
    })
  })

  describe('Next button', () => {
    it('calls onNavigate(currentIndex + 1) when clicked', async () => {
      const onNavigate = vi.fn()
      renderNav({ currentIndex: 5, totalMessages: 20, onNavigate })
      await userEvent.click(screen.getByLabelText('Next message'))
      expect(onNavigate).toHaveBeenCalledWith(6)
    })

    it('is disabled at last message', () => {
      renderNav({ currentIndex: 19, totalMessages: 20 })
      expect(screen.getByLabelText('Next message')).toBeDisabled()
    })

    it('is enabled when not at last', () => {
      renderNav({ currentIndex: 18, totalMessages: 20 })
      expect(screen.getByLabelText('Next message')).not.toBeDisabled()
    })
  })

  describe('Jump to first', () => {
    it('calls onJumpToFirst when clicked', async () => {
      const onJumpToFirst = vi.fn()
      renderNav({ currentIndex: 5, onJumpToFirst })
      await userEvent.click(screen.getByLabelText('Jump to first message'))
      expect(onJumpToFirst).toHaveBeenCalled()
    })

    it('is disabled at first message', () => {
      renderNav({ currentIndex: 0 })
      expect(screen.getByLabelText('Jump to first message')).toBeDisabled()
    })
  })

  describe('Jump to last', () => {
    it('calls onJumpToLast when clicked', async () => {
      const onJumpToLast = vi.fn()
      renderNav({ currentIndex: 5, totalMessages: 20, onJumpToLast })
      await userEvent.click(screen.getByLabelText('Jump to last message'))
      expect(onJumpToLast).toHaveBeenCalled()
    })

    it('is disabled at last message', () => {
      renderNav({ currentIndex: 19, totalMessages: 20 })
      expect(screen.getByLabelText('Jump to last message')).toBeDisabled()
    })
  })

  describe('Jump-to-message input', () => {
    it('enters edit mode when counter is clicked', async () => {
      renderNav({ currentIndex: 5, totalMessages: 20 })
      // Click the counter text "6"
      await userEvent.click(screen.getByText('6'))
      // Should now show an input
      expect(screen.getByRole('spinbutton')).toBeInTheDocument()
    })

    it('navigates to entered message number on Enter', async () => {
      const onNavigate = vi.fn()
      renderNav({ currentIndex: 5, totalMessages: 20, onNavigate })

      // Click counter to enter edit mode
      await userEvent.click(screen.getByText('6'))
      const input = screen.getByRole('spinbutton')

      // Clear and type new value
      await userEvent.clear(input)
      await userEvent.type(input, '10')
      fireEvent.keyDown(input, { key: 'Enter' })

      // Should navigate to index 9 (1-indexed input -> 0-indexed)
      expect(onNavigate).toHaveBeenCalledWith(9)
    })

    it('clamps input to valid range', async () => {
      const onNavigate = vi.fn()
      renderNav({ currentIndex: 5, totalMessages: 20, onNavigate })

      await userEvent.click(screen.getByText('6'))
      const input = screen.getByRole('spinbutton')

      // Enter value above max
      await userEvent.clear(input)
      await userEvent.type(input, '999')
      fireEvent.keyDown(input, { key: 'Enter' })

      // Should clamp to totalMessages (20) -> index 19
      expect(onNavigate).toHaveBeenCalledWith(19)
    })

    it('clamps negative values to 1', async () => {
      const onNavigate = vi.fn()
      renderNav({ currentIndex: 5, totalMessages: 20, onNavigate })

      await userEvent.click(screen.getByText('6'))
      const input = screen.getByRole('spinbutton')

      await userEvent.clear(input)
      await userEvent.type(input, '0')
      fireEvent.keyDown(input, { key: 'Enter' })

      // Should clamp to 1 -> index 0
      expect(onNavigate).toHaveBeenCalledWith(0)
    })

    it('cancels edit on Escape', async () => {
      renderNav({ currentIndex: 5, totalMessages: 20 })

      await userEvent.click(screen.getByText('6'))
      expect(screen.getByRole('spinbutton')).toBeInTheDocument()

      fireEvent.keyDown(screen.getByRole('spinbutton'), { key: 'Escape' })
      // Input should be gone, back to text display
      expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()
    })
  })
})
