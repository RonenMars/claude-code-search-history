// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import MessageContent from './MessageContent'

describe('MessageContent', () => {
  describe('markdown rendering', () => {
    it('renders plain text', () => {
      render(<MessageContent content="Hello, world!" />)
      expect(screen.getByText('Hello, world!')).toBeInTheDocument()
    })

    it('renders bold text', () => {
      render(<MessageContent content="This is **bold** text" />)
      const bold = screen.getByText('bold')
      expect(bold.tagName).toBe('STRONG')
    })

    it('renders italic text', () => {
      render(<MessageContent content="This is *italic* text" />)
      const em = screen.getByText('italic')
      expect(em.tagName).toBe('EM')
    })

    it('renders headings', () => {
      const content = '# Heading 1\n\n## Heading 2'
      const { container } = render(<MessageContent content={content} />)
      const h1 = container.querySelector('h1')
      const h2 = container.querySelector('h2')
      expect(h1).toBeInTheDocument()
      expect(h1!.textContent).toContain('Heading 1')
      expect(h2).toBeInTheDocument()
      expect(h2!.textContent).toContain('Heading 2')
    })

    it('renders lists', () => {
      const content = '- Item A\n- Item B\n- Item C'
      const { container } = render(<MessageContent content={content} />)
      const items = container.querySelectorAll('li')
      expect(items.length).toBe(3)
      expect(items[0].textContent).toContain('Item A')
    })

    it('renders links with target=_blank', () => {
      render(<MessageContent content="Visit [Example](https://example.com)" />)
      const link = screen.getByText('Example')
      expect(link.tagName).toBe('A')
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    })

    it('renders inline code', () => {
      render(<MessageContent content="Use `npm install` to install" />)
      const code = screen.getByText('npm install')
      expect(code.tagName).toBe('CODE')
      expect(code.className).toContain('inline-code')
    })

    it('renders code blocks with language label', () => {
      render(<MessageContent content={'```typescript\nconst x = 1\n```'} />)
      expect(screen.getByText('typescript')).toBeInTheDocument()
    })

    it('renders code blocks with Copy button', () => {
      render(<MessageContent content={'```js\nconst x = 1\n```'} />)
      expect(screen.getByText('Copy')).toBeInTheDocument()
    })

    it('renders tables', () => {
      const table = '| Name | Value |\n|------|-------|\n| A | 1 |\n| B | 2 |'
      render(<MessageContent content={table} />)
      expect(screen.getByText('Name')).toBeInTheDocument()
      expect(screen.getByText('A')).toBeInTheDocument()
    })

    it('renders blockquotes', () => {
      render(<MessageContent content="> Important note" />)
      const quote = screen.getByText('Important note')
      expect(quote.closest('blockquote')).toBeInTheDocument()
    })
  })

  describe('JSON detection and rendering', () => {
    it('detects and renders JSON objects', () => {
      render(<MessageContent content='{"key": "value"}' />)
      expect(screen.getByText('JSON')).toBeInTheDocument()
    })

    it('detects and renders JSON arrays', () => {
      render(<MessageContent content='[1, 2, 3]' />)
      expect(screen.getByText('JSON')).toBeInTheDocument()
    })

    it('does not treat non-JSON as JSON', () => {
      render(<MessageContent content="This is not {json}" />)
      expect(screen.queryByText('JSON')).not.toBeInTheDocument()
    })

    it('JSON block has Collapse/Expand toggle', async () => {
      render(<MessageContent content='{"key": "value"}' />)
      const collapseBtn = screen.getByText(/Collapse/)
      expect(collapseBtn).toBeInTheDocument()

      await userEvent.click(collapseBtn)
      expect(screen.getByText(/Expand/)).toBeInTheDocument()
    })

    it('JSON block has Copy button', () => {
      render(<MessageContent content='{"key": "value"}' />)
      expect(screen.getByText('Copy')).toBeInTheDocument()
    })
  })

  describe('search highlighting', () => {
    it('highlights query matches in text', () => {
      const { container } = render(<MessageContent content="Fix the login bug" query="login" />)
      const highlights = container.querySelectorAll('.highlight')
      expect(highlights.length).toBeGreaterThan(0)
    })

    it('highlights are case-insensitive', () => {
      const { container } = render(<MessageContent content="Fix the LOGIN bug" query="login" />)
      const highlights = container.querySelectorAll('.highlight')
      expect(highlights.length).toBeGreaterThan(0)
    })

    it('no highlights when query is empty', () => {
      const { container } = render(<MessageContent content="Fix the login bug" query="" />)
      const highlights = container.querySelectorAll('.highlight')
      expect(highlights.length).toBe(0)
    })

    it('no highlights when query not found', () => {
      const { container } = render(<MessageContent content="Fix the login bug" query="zebra" />)
      const highlights = container.querySelectorAll('.highlight')
      expect(highlights.length).toBe(0)
    })

    it('highlights in code blocks via HTML injection', () => {
      const { container } = render(
        <MessageContent content={'```js\nconst login = true\n```'} query="login" />
      )
      const highlights = container.querySelectorAll('.highlight')
      expect(highlights.length).toBeGreaterThan(0)
    })
  })

  describe('code block copy', () => {
    it('copies code to clipboard on button click', async () => {
      // Mock clipboard API
      const writeText = vi.fn().mockResolvedValue(undefined)
      Object.assign(navigator, {
        clipboard: { writeText },
      })

      render(<MessageContent content={'```js\nconst x = 1\n```'} />)
      await userEvent.click(screen.getByText('Copy'))

      expect(writeText).toHaveBeenCalledWith('const x = 1')
    })
  })
})
