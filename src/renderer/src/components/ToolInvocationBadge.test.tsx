// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import ToolInvocationBadge from './ToolInvocationBadge'
import type { ToolUseBlock } from '../../../shared/types'

function makeBlock(
  name: string,
  input: Record<string, unknown> = {},
  id?: string,
): ToolUseBlock {
  return { id: id ?? `block-${name}`, name, input }
}

describe('ToolInvocationBadge', () => {
  it('renders a badge for each tool block', () => {
    const blocks = [
      makeBlock('Read', { file_path: '/src/a.ts' }, 'b1'),
      makeBlock('Edit', { file_path: '/src/b.ts' }, 'b2'),
      makeBlock('Bash', { command: 'ls' }, 'b3'),
    ]
    const { container } = render(<ToolInvocationBadge blocks={blocks} />)
    const badges = container.querySelectorAll('span.inline-flex')
    expect(badges).toHaveLength(3)
  })

  it('renders empty container for empty blocks array', () => {
    const { container } = render(<ToolInvocationBadge blocks={[]} />)
    const wrapper = container.firstElementChild!
    expect(wrapper).toBeInTheDocument()
    expect(wrapper.children).toHaveLength(0)
  })

  describe('tool icons', () => {
    const iconCases: [string, string][] = [
      ['Edit', '✏️'],
      ['Read', '📖'],
      ['Write', '📝'],
      ['Bash', '⚡'],
      ['Glob', '🔍'],
      ['Grep', '🔎'],
      ['Task', '🤖'],
      ['TaskCreate', '📋'],
      ['TaskUpdate', '✅'],
      ['EnterPlanMode', '📐'],
      ['ExitPlanMode', '🚀'],
      ['mcp__plugin__tool', '🔧'],
      ['UnknownTool', '⚙️'],
    ]

    it.each(iconCases)('shows %s icon as %s', (name, icon) => {
      const { container } = render(<ToolInvocationBadge blocks={[makeBlock(name)]} />)
      const badge = container.querySelector('span.inline-flex')!
      expect(badge.textContent).toContain(icon)
    })
  })

  describe('MCP tool name shortening', () => {
    it('strips MCP prefix from tool name', () => {
      const block = makeBlock('mcp__plugin_serena_serena__find_symbol')
      render(<ToolInvocationBadge blocks={[block]} />)
      expect(screen.getByText('find_symbol')).toBeInTheDocument()
    })

    it('strips MCP prefix with two segments', () => {
      const block = makeBlock('mcp__plugin__tool')
      render(<ToolInvocationBadge blocks={[block]} />)
      expect(screen.getByText('tool')).toBeInTheDocument()
    })

    it('keeps non-MCP names as-is', () => {
      const block = makeBlock('Read', { file_path: '/a.ts' })
      render(<ToolInvocationBadge blocks={[block]} />)
      expect(screen.getByText('Read')).toBeInTheDocument()
    })
  })

  describe('key parameter display', () => {
    it('Edit shows basename of file_path', () => {
      const block = makeBlock('Edit', { file_path: '/src/components/App.tsx' })
      render(<ToolInvocationBadge blocks={[block]} />)
      expect(screen.getByText('App.tsx')).toBeInTheDocument()
    })

    it('Read shows basename of file_path', () => {
      const block = makeBlock('Read', { file_path: '/deep/nested/config.json' })
      render(<ToolInvocationBadge blocks={[block]} />)
      expect(screen.getByText('config.json')).toBeInTheDocument()
    })

    it('Write shows basename of file_path', () => {
      const block = makeBlock('Write', { file_path: '/output/result.txt' })
      render(<ToolInvocationBadge blocks={[block]} />)
      expect(screen.getByText('result.txt')).toBeInTheDocument()
    })

    it('Bash shows command when short', () => {
      const block = makeBlock('Bash', { command: 'ls -la' })
      render(<ToolInvocationBadge blocks={[block]} />)
      expect(screen.getByText('ls -la')).toBeInTheDocument()
    })

    it('Bash truncates command longer than 40 chars', () => {
      const longCmd = 'find /usr/local/share -name "*.conf" -exec grep -l pattern {} +'
      const block = makeBlock('Bash', { command: longCmd })
      render(<ToolInvocationBadge blocks={[block]} />)
      const truncated = longCmd.slice(0, 40) + '...'
      expect(screen.getByText(truncated)).toBeInTheDocument()
    })

    it('Glob shows pattern', () => {
      const block = makeBlock('Glob', { pattern: '**/*.tsx' })
      render(<ToolInvocationBadge blocks={[block]} />)
      expect(screen.getByText('**/*.tsx')).toBeInTheDocument()
    })

    it('Grep shows pattern', () => {
      const block = makeBlock('Grep', { pattern: 'TODO|FIXME' })
      render(<ToolInvocationBadge blocks={[block]} />)
      expect(screen.getByText('TODO|FIXME')).toBeInTheDocument()
    })

    it('Task shows description', () => {
      const block = makeBlock('Task', { description: 'Research authentication' })
      render(<ToolInvocationBadge blocks={[block]} />)
      expect(screen.getByText('Research authentication')).toBeInTheDocument()
    })

    describe('MCP tools try common param names', () => {
      it('uses relative_path basename', () => {
        const block = makeBlock('mcp__plugin__write_file', {
          relative_path: 'src/utils/helper.ts',
        })
        render(<ToolInvocationBadge blocks={[block]} />)
        expect(screen.getByText('helper.ts')).toBeInTheDocument()
      })

      it('uses name_path_pattern', () => {
        const block = makeBlock('mcp__plugin__search', {
          name_path_pattern: '*.test.ts',
        })
        render(<ToolInvocationBadge blocks={[block]} />)
        expect(screen.getByText('*.test.ts')).toBeInTheDocument()
      })

      it('falls back to file_path basename', () => {
        const block = makeBlock('mcp__plugin__read', {
          file_path: '/absolute/path/index.ts',
        })
        render(<ToolInvocationBadge blocks={[block]} />)
        expect(screen.getByText('index.ts')).toBeInTheDocument()
      })

      it('shows nothing when no known params present', () => {
        const block = makeBlock('mcp__plugin__custom', { foo: 'bar' })
        const { container } = render(<ToolInvocationBadge blocks={[block]} />)
        const badge = container.querySelector('span.inline-flex')!
        // Should only contain icon + tool name, no key param span
        const paramSpans = badge.querySelectorAll('span.text-neutral-500')
        expect(paramSpans).toHaveLength(0)
      })
    })
  })

  describe('title attribute shows input JSON', () => {
    it('sets title to formatted JSON of block input', () => {
      const input = { file_path: '/src/a.ts', content: 'hello' }
      const block = makeBlock('Write', input)
      const { container } = render(<ToolInvocationBadge blocks={[block]} />)
      const badge = container.querySelector('span.inline-flex')!
      expect(badge.getAttribute('title')).toBe(JSON.stringify(input, null, 2))
    })
  })
})
