// @vitest-environment jsdom
import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useSearch } from './useSearch'
import { buildSearchResult } from '../../../test/factories'

describe('useSearch', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.mocked(window.electronAPI.search).mockReset()
    vi.mocked(window.electronAPI.search).mockResolvedValue([])
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts with empty results and empty query', () => {
    const { result } = renderHook(() => useSearch())
    expect(result.current.query).toBe('')
    expect(result.current.results).toEqual([])
  })

  it('performs initial search after debounce', async () => {
    const mockResults = [buildSearchResult()]
    vi.mocked(window.electronAPI.search).mockResolvedValue(mockResults)

    const { result } = renderHook(() => useSearch())

    // Advance past the 150ms debounce and flush microtasks
    await act(async () => {
      vi.advanceTimersByTime(200)
    })

    expect(result.current.results).toEqual(mockResults)
  })

  it('debounces search calls', async () => {
    const { result } = renderHook(() => useSearch())

    // Set query multiple times rapidly
    act(() => { result.current.setQuery('h') })
    act(() => { result.current.setQuery('he') })
    act(() => { result.current.setQuery('hel') })

    await act(async () => {
      vi.advanceTimersByTime(200)
    })

    // The search API should have been called with 'hel', not intermediate values
    const calls = vi.mocked(window.electronAPI.search).mock.calls
    const lastCall = calls[calls.length - 1]
    expect(lastCall[0]).toBe('hel')
  })

  it('passes project filter to search API', async () => {
    renderHook(() => useSearch('/dev/my-project'))

    await act(async () => {
      vi.advanceTimersByTime(200)
    })

    expect(window.electronAPI.search).toHaveBeenCalledWith(
      '',
      { project: '/dev/my-project' }
    )
  })

  it('handles search errors gracefully', async () => {
    vi.mocked(window.electronAPI.search).mockRejectedValue(new Error('IPC failed'))
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const { result } = renderHook(() => useSearch())

    await act(async () => {
      vi.advanceTimersByTime(200)
    })

    expect(result.current.results).toEqual([])
    expect(result.current.searching).toBe(false)
  })

  it('refresh triggers search with current query', async () => {
    const { result } = renderHook(() => useSearch())

    // Let initial search complete
    await act(async () => {
      vi.advanceTimersByTime(200)
    })

    vi.mocked(window.electronAPI.search).mockClear()
    const freshResults = [buildSearchResult()]
    vi.mocked(window.electronAPI.search).mockResolvedValue(freshResults)

    await act(async () => {
      result.current.refresh()
    })

    expect(result.current.results).toEqual(freshResults)
  })
})
