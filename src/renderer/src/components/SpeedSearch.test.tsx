// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import SpeedSearch from './SpeedSearch'

describe('SpeedSearch', () => {
  it('renders nothing when query is empty', () => {
    const { container } = render(
      <SpeedSearch query="" onQueryChange={vi.fn()} onDismiss={vi.fn()} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders the query text when query is non-empty', () => {
    render(
      <SpeedSearch query="hello" onQueryChange={vi.fn()} onDismiss={vi.fn()} />
    )
    expect(screen.getByTestId('speed-search-query')).toHaveTextContent('hello')
  })

  it('calls onDismiss when the clear button is clicked', async () => {
    const onDismiss = vi.fn()
    render(
      <SpeedSearch query="test" onQueryChange={vi.fn()} onDismiss={onDismiss} />
    )
    await userEvent.click(screen.getByTitle('Clear speed search (Escape)'))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('displays partial query as typed so far', () => {
    render(
      <SpeedSearch query="abc" onQueryChange={vi.fn()} onDismiss={vi.fn()} />
    )
    expect(screen.getByTestId('speed-search-query').textContent).toBe('abc')
  })
})
