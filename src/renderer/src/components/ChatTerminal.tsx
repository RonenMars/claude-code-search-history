import { useEffect, useRef, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'

interface ChatTerminalProps {
  cwd: string
  resumeSessionId?: string
  onExit: (code: number) => void
}

export default function ChatTerminal({ cwd, resumeSessionId, onExit }: ChatTerminalProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const [exited, setExited] = useState<number | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: "'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace",
      theme: {
        background: '#0d0d0d',
        foreground: '#d4d4d4',
        cursor: '#e07a2f',
        selectionBackground: 'rgba(224, 122, 47, 0.3)',
        black: '#171717',
        red: '#ef4444',
        green: '#22c55e',
        yellow: '#eab308',
        blue: '#3b82f6',
        magenta: '#a855f7',
        cyan: '#06b6d4',
        white: '#d4d4d4',
        brightBlack: '#525252',
        brightRed: '#fca5a5',
        brightGreen: '#86efac',
        brightYellow: '#fde047',
        brightBlue: '#93c5fd',
        brightMagenta: '#d8b4fe',
        brightCyan: '#67e8f9',
        brightWhite: '#f5f5f5',
      },
      allowProposedApi: true,
    })

    const fitAddon = new FitAddon()
    terminal.loadAddon(fitAddon)
    terminal.open(containerRef.current)

    // Fit after a frame so the container has its final size
    requestAnimationFrame(() => {
      fitAddon.fit()
    })

    terminalRef.current = terminal
    fitAddonRef.current = fitAddon

    // Send keystrokes to PTY
    terminal.onData((data) => {
      window.electronAPI.ptyInput(data)
    })

    // Receive PTY output
    const cleanupData = window.electronAPI.onPtyData((data) => {
      terminal.write(data)
    })

    // Handle process exit
    const cleanupExit = window.electronAPI.onPtyExit((code) => {
      terminal.write(`\r\n\x1b[90m--- Process exited with code ${code} ---\x1b[0m\r\n`)
      setExited(code)
      onExit(code)
    })

    // Spawn the claude process
    window.electronAPI.ptySpawn({ cwd, resumeSessionId }).then((result) => {
      if (!result.success) {
        terminal.write(`\x1b[31mFailed to start: ${result.error}\x1b[0m\r\n`)
        setExited(-1)
      } else {
        // Send initial size
        const dims = fitAddon.proposeDimensions()
        if (dims) {
          window.electronAPI.ptyResize(dims.cols, dims.rows)
        }
      }
    })

    // Resize handler
    const handleResize = (): void => {
      fitAddon.fit()
      const dims = fitAddon.proposeDimensions()
      if (dims) {
        window.electronAPI.ptyResize(dims.cols, dims.rows)
      }
    }

    const resizeObserver = new ResizeObserver(handleResize)
    resizeObserver.observe(containerRef.current)

    return () => {
      cleanupData()
      cleanupExit()
      resizeObserver.disconnect()
      terminal.dispose()
      terminalRef.current = null
      fitAddonRef.current = null
    }
  }, [cwd, resumeSessionId, onExit])

  return (
    <div className="flex flex-col h-full">
      {/* Terminal Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-claude-dark border-b border-neutral-800">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${exited !== null ? 'bg-neutral-500' : 'bg-green-500 animate-pulse'}`} />
          <span className="text-xs text-neutral-400 font-mono truncate max-w-md" title={cwd}>
            {cwd}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {exited !== null && (
            <span className="text-xs text-neutral-500">
              Exited ({exited})
            </span>
          )}
          {exited === null && (
            <button
              onClick={() => window.electronAPI.ptyKill()}
              className="px-3 py-1 text-xs font-medium text-red-400 bg-red-400/10 hover:bg-red-400/20 border border-red-400/30 rounded-md transition-colors"
            >
              Stop
            </button>
          )}
        </div>
      </div>

      {/* Terminal */}
      <div ref={containerRef} className="flex-1 overflow-hidden" style={{ padding: '4px 0 0 4px' }} />
    </div>
  )
}
