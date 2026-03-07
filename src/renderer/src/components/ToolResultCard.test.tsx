// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import ToolResultCard from './ToolResultCard'
import type { ToolResult } from '../../../shared/types'
import {
  buildEditToolResult,
  buildBashToolResult,
  buildGlobToolResult,
  buildGrepToolResult,
} from '../../../test/factories'

describe('ToolResultCard', () => {
  it('renders nothing for empty results array', () => {
    const { container } = render(<ToolResultCard results={[]} />)
    expect(container.querySelector('.space-y-2')).toBeInTheDocument()
    expect(container.querySelector('.space-y-2')!.children).toHaveLength(0)
  })

  describe('dispatches to correct card by type', () => {
    it('renders EditDiffCard for edit results', () => {
      const result = buildEditToolResult({ filePath: '/src/app.ts' })
      render(<ToolResultCard results={[result]} />)
      expect(screen.getByText(/app\.ts/)).toBeInTheDocument()
    })

    it('renders BashTerminalCard for bash results', () => {
      const result = buildBashToolResult({ stdout: 'hello world output' })
      const { container } = render(<ToolResultCard results={[result]} />)
      // BashTerminalCard renders stdout in both header preview and terminal body
      // Verify the terminal body <pre> contains the output
      const pre = container.querySelector('.terminal-body pre')
      expect(pre).toBeInTheDocument()
      expect(pre!.textContent).toContain('hello world output')
    })

    it('renders BashTerminalCard with interrupted badge', () => {
      const result = buildBashToolResult({ stdout: 'partial', interrupted: true })
      render(<ToolResultCard results={[result]} />)
      expect(screen.getByText('interrupted')).toBeInTheDocument()
    })

    it('renders GlobResultCard for glob results', () => {
      const result = buildGlobToolResult({ filenames: ['file1.ts', 'file2.ts'], numFiles: 2 })
      render(<ToolResultCard results={[result]} />)
      expect(screen.getByText(/file1\.ts/)).toBeInTheDocument()
    })

    it('renders GrepResultCard for grep results', () => {
      const result = buildGrepToolResult({ content: 'matching content here' })
      render(<ToolResultCard results={[result]} />)
      expect(screen.getByText(/matching content/)).toBeInTheDocument()
    })

    it('renders ReadFileCard for read results', () => {
      const result: ToolResult = { type: 'read', filePath: '/src/config.json' }
      render(<ToolResultCard results={[result]} />)
      expect(screen.getByText(/config\.json/)).toBeInTheDocument()
    })

    it('renders WriteFileCard for write results', () => {
      const result: ToolResult = { type: 'write', filePath: '/src/new-file.ts' }
      render(<ToolResultCard results={[result]} />)
      expect(screen.getByText(/new-file\.ts/)).toBeInTheDocument()
    })

    it('renders TaskAgentCard for taskAgent results', () => {
      const result: ToolResult = {
        type: 'taskAgent',
        status: 'completed',
        prompt: 'Research this topic',
        agentId: 'agent-123',
      }
      render(<ToolResultCard results={[result]} />)
      // TaskAgentCard shows Sub-agent label, agentId, and status
      expect(screen.getByText('Sub-agent')).toBeInTheDocument()
      expect(screen.getByText('agent-123')).toBeInTheDocument()
      expect(screen.getByText('completed')).toBeInTheDocument()
    })

    it('renders TaskCreateCard for taskCreate results', () => {
      const result: ToolResult = {
        type: 'taskCreate',
        taskId: 'task-456',
        subject: 'Implement feature X',
      }
      render(<ToolResultCard results={[result]} />)
      expect(screen.getByText(/Implement feature X/)).toBeInTheDocument()
      expect(screen.getByText('Created')).toBeInTheDocument()
    })

    it('renders TaskUpdateCard for taskUpdate results', () => {
      const result: ToolResult = {
        type: 'taskUpdate',
        taskId: 'task-456',
        updatedFields: ['status'],
        statusChange: { from: 'todo', to: 'done' },
      }
      render(<ToolResultCard results={[result]} />)
      expect(screen.getByText(/todo → done/)).toBeInTheDocument()
      expect(screen.getByText('Updated')).toBeInTheDocument()
    })

    it('renders GenericToolCard for generic results', () => {
      const result: ToolResult = {
        type: 'generic',
        toolName: 'CustomTool',
        data: { message: 'ok' },
      }
      render(<ToolResultCard results={[result]} />)
      expect(screen.getByText(/CustomTool/)).toBeInTheDocument()
    })
  })

  it('renders multiple results', () => {
    const results: ToolResult[] = [
      buildBashToolResult({ stdout: 'command output here' }),
      buildEditToolResult({ filePath: '/src/second.ts' }),
    ]
    const { container } = render(<ToolResultCard results={results} />)
    // Verify both cards rendered
    expect(container.querySelector('.terminal-body')).toBeInTheDocument()
    expect(screen.getByText(/second\.ts/)).toBeInTheDocument()
  })
})
