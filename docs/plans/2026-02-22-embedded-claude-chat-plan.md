# Embedded Claude Code Chat — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Embed a live Claude Code CLI terminal in the app's right panel so users can chat with Claude Code in any project directory.

**Architecture:** The main process manages a `node-pty` pseudo-terminal that spawns the `claude` CLI. The renderer renders it via `xterm.js`. Data flows over Electron IPC: keystrokes from renderer to main, terminal output from main to renderer.

**Tech Stack:** node-pty, @xterm/xterm, @xterm/addon-fit, Electron IPC

---

### Task 1: Install Dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install node-pty and xterm packages**

```bash
npm install node-pty @xterm/xterm @xterm/addon-fit
```

`node-pty` is a native module — the existing `postinstall` script (`electron-builder install-app-deps`) will rebuild it for Electron.

**Step 2: Verify installation**

Run: `ls node_modules/node-pty/build/Release/`
Expected: Should contain `pty.node` (the native binary)

Run: `ls node_modules/@xterm/xterm/`
Expected: Should contain `lib/` and `css/` directories

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add node-pty and xterm dependencies"
```

---

### Task 2: Add Shared Types for PTY

**Files:**
- Modify: `src/shared/types.ts` (append at end)

**Step 1: Add PTY types to shared types**

Append the following to the end of `src/shared/types.ts`:

```typescript
// ─── PTY / Chat Types ────────────────────────────────────────────────

export interface PtySpawnOptions {
  cwd: string
  resumeSessionId?: string  // pass to claude --resume <id>
}

export interface PtyStatus {
  active: boolean
  cwd?: string
  pid?: number
}
```

**Step 2: Commit**

```bash
git add src/shared/types.ts
git commit -m "feat: add PTY shared types"
```

---

### Task 3: Create PtyManager Service

**Files:**
- Create: `src/main/services/pty-manager.ts`

**Step 1: Create the PTY manager**

Create `src/main/services/pty-manager.ts` with the following content:

```typescript
import * as pty from 'node-pty'
import { platform } from 'os'
import type { PtySpawnOptions } from '../../shared/types'

export class PtyManager {
  private process: pty.IPty | null = null
  private onData?: (data: string) => void
  private onExit?: (code: number) => void

  setDataHandler(handler: (data: string) => void): void {
    this.onData = handler
  }

  setExitHandler(handler: (code: number) => void): void {
    this.onExit = handler
  }

  spawn(options: PtySpawnOptions): { success: boolean; error?: string } {
    if (this.process) {
      return { success: false, error: 'A session is already active. Kill it first.' }
    }

    try {
      const shell = platform() === 'win32' ? 'cmd.exe' : '/bin/zsh'
      const args: string[] = []

      if (platform() === 'win32') {
        args.push('/c', 'claude')
      } else {
        args.push('-l', '-c', this.buildClaudeCommand(options))
      }

      this.process = pty.spawn(shell, args, {
        name: 'xterm-256color',
        cols: 120,
        rows: 30,
        cwd: options.cwd,
        env: {
          ...process.env,
          // Unset CLAUDECODE to avoid "nested session" error
          CLAUDECODE: ''
        }
      })

      this.process.onData((data) => {
        this.onData?.(data)
      })

      this.process.onExit(({ exitCode }) => {
        this.process = null
        this.onExit?.(exitCode)
      })

      return { success: true }
    } catch (err) {
      this.process = null
      return { success: false, error: String(err) }
    }
  }

  private buildClaudeCommand(options: PtySpawnOptions): string {
    const parts = ['claude']
    if (options.resumeSessionId) {
      parts.push('--resume', options.resumeSessionId)
    }
    return parts.join(' ')
  }

  write(data: string): void {
    this.process?.write(data)
  }

  resize(cols: number, rows: number): void {
    this.process?.resize(cols, rows)
  }

  kill(): void {
    if (!this.process) return
    // Send SIGINT first (graceful)
    this.process.kill('SIGINT')
    // Force kill after 3 seconds if still alive
    const pid = this.process.pid
    setTimeout(() => {
      if (this.process && this.process.pid === pid) {
        this.process.kill('SIGKILL')
        this.process = null
      }
    }, 3000)
  }

  isActive(): boolean {
    return this.process !== null
  }

  getPid(): number | undefined {
    return this.process?.pid
  }
}
```

**Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors related to pty-manager.ts

**Step 3: Commit**

```bash
git add src/main/services/pty-manager.ts
git commit -m "feat: add PtyManager service for spawning claude CLI"
```

---

### Task 4: Add PTY IPC Handlers to Main Process

**Files:**
- Modify: `src/main/index.ts`

**Step 1: Import PtyManager and wire up IPC**

At the top of `src/main/index.ts`, add the import alongside the existing ones:

```typescript
import { PtyManager } from './services/pty-manager'
import type { PtySpawnOptions } from '../shared/types'
```

Add a new variable alongside the existing `scanner`/`indexer`:

```typescript
let ptyManager: PtyManager | null = null
```

**Step 2: Add PTY IPC handlers inside `setupIpcHandlers()`**

Append these handlers at the end of the `setupIpcHandlers()` function body (after the existing `set-preferences` handler):

```typescript
  // ─── PTY Handlers ──────────────────────────────────────────────────

  ipcMain.handle('pty-spawn', async (_event, options: PtySpawnOptions) => {
    if (!ptyManager) {
      ptyManager = new PtyManager()
      ptyManager.setDataHandler((data) => {
        mainWindow?.webContents.send('pty-data', data)
      })
      ptyManager.setExitHandler((code) => {
        mainWindow?.webContents.send('pty-exit', code)
      })
    }
    return ptyManager.spawn(options)
  })

  ipcMain.on('pty-input', (_event, data: string) => {
    ptyManager?.write(data)
  })

  ipcMain.on('pty-resize', (_event, cols: number, rows: number) => {
    ptyManager?.resize(cols, rows)
  })

  ipcMain.handle('pty-kill', async () => {
    ptyManager?.kill()
    return true
  })

  ipcMain.handle('pty-status', async () => {
    return {
      active: ptyManager?.isActive() ?? false,
      pid: ptyManager?.getPid()
    }
  })

  ipcMain.handle('select-directory', async () => {
    if (!mainWindow) return null
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      title: 'Select Project Directory'
    })
    if (canceled || filePaths.length === 0) return null
    return filePaths[0]
  })
```

Note: `pty-input` and `pty-resize` use `ipcMain.on` (fire-and-forget) rather than `ipcMain.handle` (invoke) because they're high-frequency and don't need a return value.

**Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/main/index.ts
git commit -m "feat: add PTY and directory-picker IPC handlers"
```

---

### Task 5: Update Preload Bridge

**Files:**
- Modify: `src/preload/index.ts`

**Step 1: Add PTY methods to the ElectronAPI interface**

Add the import for `PtySpawnOptions` and `PtyStatus` at the top:

```typescript
import type {
  SearchResult,
  Conversation,
  ExportFormat,
  ExportResult,
  UserPreferences,
  PtySpawnOptions,
  PtyStatus
} from '../shared/types'
```

Update the `export type` line to include the new types:

```typescript
export type { SearchResult, Conversation, ExportFormat, ExportResult, UserPreferences, PtySpawnOptions, PtyStatus }
```

Add these methods to the `ElectronAPI` interface:

```typescript
  // PTY
  ptySpawn: (options: PtySpawnOptions) => Promise<{ success: boolean; error?: string }>
  ptyInput: (data: string) => void
  ptyResize: (cols: number, rows: number) => void
  ptyKill: () => Promise<boolean>
  ptyStatus: () => Promise<PtyStatus>
  onPtyData: (callback: (data: string) => void) => () => void
  onPtyExit: (callback: (code: number) => void) => () => void
  selectDirectory: () => Promise<string | null>
```

**Step 2: Add the implementations to the `api` object**

Add these entries to the `api` object:

```typescript
  // PTY
  ptySpawn: (options) => ipcRenderer.invoke('pty-spawn', options),
  ptyInput: (data) => ipcRenderer.send('pty-input', data),
  ptyResize: (cols, rows) => ipcRenderer.send('pty-resize', cols, rows),
  ptyKill: () => ipcRenderer.invoke('pty-kill'),
  ptyStatus: () => ipcRenderer.invoke('pty-status'),
  onPtyData: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, data: string): void => {
      callback(data)
    }
    ipcRenderer.on('pty-data', handler)
    return () => ipcRenderer.removeListener('pty-data', handler)
  },
  onPtyExit: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, code: number): void => {
      callback(code)
    }
    ipcRenderer.on('pty-exit', handler)
    return () => ipcRenderer.removeListener('pty-exit', handler)
  },
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
```

Note: `ptyInput` and `ptyResize` use `ipcRenderer.send` (not `invoke`) to match the `ipcMain.on` handlers.

**Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/preload/index.ts
git commit -m "feat: expose PTY and directory-picker APIs in preload bridge"
```

---

### Task 6: Create ChatTerminal Component

**Files:**
- Create: `src/renderer/src/components/ChatTerminal.tsx`

**Step 1: Create the xterm.js wrapper component**

Create `src/renderer/src/components/ChatTerminal.tsx`:

```tsx
import { useEffect, useRef, useCallback, useState } from 'react'
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

  const handleRestart = useCallback(() => {
    setExited(null)
    // Re-trigger spawn by updating key — parent handles this
  }, [])

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
            <button
              onClick={handleRestart}
              className="px-3 py-1 text-xs font-medium text-claude-orange bg-claude-orange/10 hover:bg-claude-orange/20 border border-claude-orange/30 rounded-md transition-colors"
            >
              New Chat
            </button>
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
```

**Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/renderer/src/components/ChatTerminal.tsx
git commit -m "feat: add ChatTerminal component with xterm.js"
```

---

### Task 7: Update App.tsx — Chat State and Launch UI

**Files:**
- Modify: `src/renderer/src/App.tsx`

**Step 1: Add ChatTerminal import**

Add at the top with other imports:

```typescript
import ChatTerminal from './components/ChatTerminal'
```

**Step 2: Add chat state**

Inside the `App` component, add state alongside the existing state declarations:

```typescript
const [chatCwd, setChatCwd] = useState<string | null>(null)
const [chatKey, setChatKey] = useState(0) // increment to force remount
```

**Step 3: Add launch handlers**

Add these handlers alongside the existing `handleRefresh`:

```typescript
const handleNewChat = useCallback(async () => {
  if (chatCwd) {
    const confirmed = window.confirm('A chat session is active. Start a new one?')
    if (!confirmed) return
    await window.electronAPI.ptyKill()
  }
  const dir = await window.electronAPI.selectDirectory()
  if (dir) {
    setChatCwd(dir)
    setChatKey((k) => k + 1)
    setSelectedConversation(null)
  }
}, [chatCwd])

const handleChatInProject = useCallback(async (projectPath: string) => {
  if (chatCwd) {
    const confirmed = window.confirm('A chat session is active. Start a new one?')
    if (!confirmed) return
    await window.electronAPI.ptyKill()
  }
  setChatCwd(projectPath)
  setChatKey((k) => k + 1)
  setSelectedConversation(null)
}, [chatCwd])

const handleChatExit = useCallback(() => {
  // Keep the terminal visible with the exit message — don't auto-close
}, [])

const handleCloseChat = useCallback(() => {
  setChatCwd(null)
}, [])
```

**Step 4: Add "+ New Chat" button to the title bar**

In the title bar div (the one with `titlebar-no-drag`), add this button before the stats:

```tsx
<button
  onClick={handleNewChat}
  className="hover:text-neutral-300 transition-colors text-xs flex items-center gap-1"
  title="New Claude Code chat"
>
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
  Chat
</button>
```

**Step 5: Update the right panel to show ChatTerminal or ConversationView**

Replace the existing right panel (`<div className="flex-1 overflow-hidden">` and its children) with:

```tsx
<div className="flex-1 overflow-hidden">
  {chatCwd ? (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-1 bg-claude-dark border-b border-neutral-700">
        <span className="text-xs text-neutral-500">Live Chat</span>
        <button
          onClick={handleCloseChat}
          className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
          title="Close chat and return to history"
        >
          Close
        </button>
      </div>
      <div className="flex-1 overflow-hidden">
        <ChatTerminal
          key={chatKey}
          cwd={chatCwd}
          onExit={handleChatExit}
        />
      </div>
    </div>
  ) : selectedConversation ? (
    <ErrorBoundary>
      <ConversationView conversation={selectedConversation} query={query} />
    </ErrorBoundary>
  ) : (
    <div className="flex items-center justify-center h-full text-neutral-500">
      <div className="text-center">
        <svg
          className="w-16 h-16 mx-auto mb-4 opacity-50"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1}
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        </svg>
        <p>Select a conversation to view</p>
        <button
          onClick={handleNewChat}
          className="mt-4 px-4 py-2 text-sm text-claude-orange bg-claude-orange/10 hover:bg-claude-orange/20 border border-claude-orange/30 rounded-lg transition-colors"
        >
          Start a new chat
        </button>
      </div>
    </div>
  )}
</div>
```

**Step 6: Pass `onChatInProject` to FilterPanel**

Update the FilterPanel usage to pass the new handler. This will be wired in Task 8.

Add this prop to the FilterPanel component:

```tsx
<FilterPanel
  projects={projects}
  selectedProject={selectedProject}
  onProjectChange={setSelectedProject}
  sortBy={sortBy}
  onSortChange={setSortBy}
  dateRange={dateRange}
  onDateRangeChange={setDateRange}
  onChatInProject={handleChatInProject}
/>
```

**Step 7: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: May have an error about FilterPanel prop — that's addressed in Task 8.

**Step 8: Commit**

```bash
git add src/renderer/src/App.tsx
git commit -m "feat: integrate ChatTerminal into App with launch controls"
```

---

### Task 8: Add "Chat in Project" Button to FilterPanel

**Files:**
- Modify: `src/renderer/src/components/FilterPanel.tsx`

**Step 1: Add the new prop to the interface**

Add `onChatInProject` to `FilterPanelProps`:

```typescript
interface FilterPanelProps {
  projects: string[]
  selectedProject: string
  onProjectChange: (project: string) => void
  sortBy: SortOption
  onSortChange: (sort: SortOption) => void
  dateRange: DateRangeOption
  onDateRangeChange: (range: DateRangeOption) => void
  onChatInProject: (projectPath: string) => void
}
```

Update the function signature to destructure `onChatInProject`:

```typescript
export default function FilterPanel({
  projects,
  selectedProject,
  onProjectChange,
  sortBy,
  onSortChange,
  dateRange,
  onDateRangeChange,
  onChatInProject
}: FilterPanelProps): JSX.Element {
```

**Step 2: Add the "Chat" button after the project select**

After the `<select>` element for project filter, add a conditional button:

```tsx
{selectedProject && (
  <button
    onClick={() => onChatInProject(selectedProject)}
    className="mt-1 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-claude-orange bg-claude-orange/10 hover:bg-claude-orange/20 border border-claude-orange/30 rounded-lg transition-colors"
  >
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
    Chat in this project
  </button>
)}
```

**Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/renderer/src/components/FilterPanel.tsx
git commit -m "feat: add 'Chat in this project' button to FilterPanel"
```

---

### Task 9: Configure Electron Builder for node-pty

**Files:**
- Modify: `electron-builder.yml`
- Modify: `electron.vite.config.ts`

**Step 1: Add node-pty to electron-vite externals**

`node-pty` is a native module and must not be bundled by Vite. The `externalizeDepsPlugin()` in `electron.vite.config.ts` already handles this — it externalizes all `dependencies` from `package.json`. Verify `node-pty` is in `dependencies` (not `devDependencies`) in `package.json`. It should be, since `npm install node-pty` puts it there by default.

If for any reason it ended up in devDependencies, move it to dependencies.

**Step 2: Verify the electron-builder config**

The existing `electron-builder.yml` uses `asarUnpack: resources/**`. Native modules like `node-pty` need to be unpacked from the ASAR archive. Add `node-pty` to the unpack list:

In `electron-builder.yml`, update the `asarUnpack` section:

```yaml
asarUnpack:
  - resources/**
  - node_modules/node-pty/**
```

**Step 3: Test the dev build**

Run: `npm run dev`
Expected: The app starts without errors. You should see the new "+ Chat" button in the title bar.

**Step 4: Commit**

```bash
git add electron-builder.yml package.json
git commit -m "build: configure electron-builder for node-pty native module"
```

---

### Task 10: Manual Smoke Test

**Step 1: Start the dev server**

Run: `npm run dev`
Expected: App opens normally with all existing features working.

**Step 2: Test "+ Chat" button**

Click the "+ Chat" button in the title bar. Select a project directory.
Expected: The right panel switches to a terminal showing the Claude Code CLI launching.

**Step 3: Test interaction**

Type a message in the terminal and press Enter.
Expected: Claude Code responds, streaming output appears in the terminal.

**Step 4: Test "Chat in this project"**

Select a project from the sidebar filter dropdown. Click "Chat in this project".
Expected: Confirmation dialog if a session is active, then a new terminal session opens in that project's directory.

**Step 5: Test Stop button**

Click the "Stop" button while Claude is running.
Expected: Process receives SIGINT and stops.

**Step 6: Test Close button**

Click the "Close" button above the terminal.
Expected: Terminal closes and the right panel returns to the conversation view or empty state.

**Step 7: Test window resize**

Resize the app window while a terminal session is active.
Expected: Terminal reflows properly to fill the available space.

**Step 8: Final commit**

If any tweaks were needed during testing, commit them:

```bash
git add -A
git commit -m "fix: smoke test adjustments for embedded chat"
```
