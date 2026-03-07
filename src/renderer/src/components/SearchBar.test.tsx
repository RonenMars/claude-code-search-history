// @vitest-environment jsdom
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import SearchBar from './SearchBar'

describe('SearchBar', () => {
  it('renders input with placeholder', () => {
    render(<SearchBar value="" onChange={vi.fn()} isSearching={false} />)
    expect(screen.getByPlaceholderText(/search conversations/i)).toBeInTheDocument()
  })

  it('displays the current value', () => {
    render(<SearchBar value="hello" onChange={vi.fn()} isSearching={false} />)
    expect(screen.getByDisplayValue('hello')).toBeInTheDocument()
  })

  it('calls onChange when typing', async () => {
    const onChange = vi.fn()
    render(<SearchBar value="" onChange={onChange} isSearching={false} />)
    const input = screen.getByPlaceholderText(/search conversations/i)
    await userEvent.type(input, 'a')
    expect(onChange).toHaveBeenCalledWith('a')
  })

  it('shows clear button when value is non-empty', () => {
    const onChange = vi.fn()
    render(<SearchBar value="test" onChange={onChange} isSearching={false} />)
    const clearButton = screen.getByRole('button')
    expect(clearButton).toBeInTheDocument()
  })

  it('clears input when clear button is clicked', async () => {
    const onChange = vi.fn()
    render(<SearchBar value="test" onChange={onChange} isSearching={false} />)
    await userEvent.click(screen.getByRole('button'))
    expect(onChange).toHaveBeenCalledWith('')
  })

  it('hides clear button when value is empty', () => {
    render(<SearchBar value="" onChange={vi.fn()} isSearching={false} />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('focuses input on mount', () => {
    render(<SearchBar value="" onChange={vi.fn()} isSearching={false} />)
    const input = screen.getByPlaceholderText(/search conversations/i)
    expect(document.activeElement).toBe(input)
  })

  it('shows spinner when isSearching is true', () => {
    const { container } = render(<SearchBar value="" onChange={vi.fn()} isSearching={true} />)
    // The spinning SVG has animate-spin class
    const spinner = container.querySelector('.animate-spin')
    expect(spinner).toBeInTheDocument()
  })

  it('does not show spinner when isSearching is false', () => {
    const { container } = render(<SearchBar value="" onChange={vi.fn()} isSearching={false} />)
    const spinner = container.querySelector('.animate-spin')
    expect(spinner).not.toBeInTheDocument()
  })

  it('focuses on Cmd+Shift+F', () => {
    render(<SearchBar value="" onChange={vi.fn()} isSearching={false} />)
    const input = screen.getByPlaceholderText(/search conversations/i)

    // Blur first to test the focus action
    input.blur()
    expect(document.activeElement).not.toBe(input)

    fireEvent.keyDown(window, { key: 'f', metaKey: true, shiftKey: true })
    expect(document.activeElement).toBe(input)
  })

  it('blurs on Escape', () => {
    render(<SearchBar value="" onChange={vi.fn()} isSearching={false} />)
    const input = screen.getByPlaceholderText(/search conversations/i)
    expect(document.activeElement).toBe(input)

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(document.activeElement).not.toBe(input)
  })
})
