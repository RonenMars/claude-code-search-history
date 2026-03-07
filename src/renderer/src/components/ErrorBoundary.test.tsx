// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ErrorBoundary from './ErrorBoundary'

// Component that throws on render
function ThrowingChild({ shouldThrow }: { shouldThrow: boolean }): JSX.Element {
  if (shouldThrow) throw new Error('Test explosion')
  return <div>Safe content</div>
}

describe('ErrorBoundary', () => {
  // Suppress console.error from React's error boundary logging
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('renders children when no error', () => {
    render(
      <ErrorBoundary>
        <div>Hello world</div>
      </ErrorBoundary>
    )
    expect(screen.getByText('Hello world')).toBeInTheDocument()
  })

  it('renders fallback UI when child throws', () => {
    render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>
    )
    expect(screen.getByText('Something went wrong rendering this view.')).toBeInTheDocument()
    expect(screen.getByText('Test explosion')).toBeInTheDocument()
  })

  it('renders custom fallback when provided', () => {
    render(
      <ErrorBoundary fallback={<div>Custom error page</div>}>
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>
    )
    expect(screen.getByText('Custom error page')).toBeInTheDocument()
  })

  it('recovers when "Try Again" is clicked', async () => {
    // Use a controllable component
    let shouldThrow = true
    function Controllable(): JSX.Element {
      if (shouldThrow) throw new Error('Boom')
      return <div>Recovered content</div>
    }

    const { rerender } = render(
      <ErrorBoundary>
        <Controllable />
      </ErrorBoundary>
    )

    expect(screen.getByText('Something went wrong rendering this view.')).toBeInTheDocument()

    // Fix the component before retrying
    shouldThrow = false
    await userEvent.click(screen.getByText('Try Again'))

    // After reset, ErrorBoundary should re-render children
    // Need to rerender to pick up the fixed component
    rerender(
      <ErrorBoundary>
        <Controllable />
      </ErrorBoundary>
    )
    expect(screen.getByText('Recovered content')).toBeInTheDocument()
  })
})
