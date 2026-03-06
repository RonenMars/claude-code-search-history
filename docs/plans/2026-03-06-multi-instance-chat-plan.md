# Multi-Instance Chat & Settings Panel — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow users to run multiple Claude Code instances simultaneously across different projects, with active chats pinned in the sidebar and a Settings modal for configuration.

**Architecture:** IPC channels (`pty-data`, `pty-exit`) stay static but carry an `instanceId` in the payload; main process holds a `Map<string, PtyManager>`; renderer holds `ChatInstance[]` and routes by ID. A new `SettingsModal` replaces the planned standalone Profiles title bar button and adds a max-instances setting.

**Tech Stack:** Electron 33, React 18, TypeScript, node-pty, xterm.js, Tailwind CSS

**Design doc:** `docs/plans/2026-03-06-multi-instance-chat-design.md`

---

## Task 1: Update shared types

**Files:**
- Modify: `src/shared/types.ts`

This is the foundation. All other tasks depend on the types being correct first.

**Step 1: Add the new types**

Open `src/shared/types.ts` and make these changes:

1. Add `ChatInstance` and `AppSettings` interfaces after the existing PTY/Chat types section (after `PtyStatus`):

```ts
export interface ChatInstance {
  instanceId: string
  cwd: string
  profile: ClaudeProfile | null
  status: 'active' | 'exited'
  exitCode: number | null
  resumeSessionId?: string
  isClaudeTyping: boolean
}

export interface AppSettings {
  maxChatInstances: number
}
```

2. Update `PtySpawnOptions` to include `instanceId`:

```ts
export interface PtySpawnOptions {
  instanceId: string        // ADD THIS
  cwd: string
  resumeSessionId?: string
  profile?: ClaudeProfile
}
```

3. `PtyStatus` remains unchanged.

**Step 2: Verify build**

```bash
npm run build
```

Expected: build succeeds. You will see type errors in later tasks as you update callers — that is expected and will be fixed in those tasks.

**Step 3: Commit**

```bash
git add src/shared/types.ts
git commit -m "feat: add ChatInstance and AppSettings types; add instanceId to PtySpawnOptions"
```

---

## Task 2: Settings persistence in main process

**Files:**
- Modify: `src/main/index.ts`

Add `loadSettings`/`saveSettings` helpers and two new IPC handlers: `get-settings` and `set-settings`. These are self-contained and don't touch the PTY code yet.

**Step 1: Add settings helpers**

In `src/main/index.ts`, directly after the `savePreferences` function (around line 33), add:

```ts
function getSettingsPath(): string {
  return join(app.getPath('userData'), 'settings.json')
}

const DEFAULT_SETTINGS: AppSettings = {
  maxChatInstances: 3
}

async function loadSettings(): Promise<AppSettings> {
  try {
    const data = await readFile(getSettingsPath(), 'utf-8')
    const parsed = JSON.parse(data)
    return { ...DEFAULT_SETTINGS, ...parsed }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

async function saveSettings(settings: Partial<AppSettings>): Promise<void> {
  const current = await loadSettings()
  const merged = { ...current, ...settings }
  const dir = app.getPath('userData')
  await mkdir(dir, { recursive: true })
  await writeFile(getSettingsPath(), JSON.stringify(merged, null, 2), 'utf-8')
}
```

Also add the `AppSettings` import at the top of the file:

```ts
import type { Conversation, PtySpawnOptions, AppSettings } from '../shared/types'
```

**Step 2: Add IPC handlers**

Inside `setupIpcHandlers()`, after the `set-preferences` handler, add:

```ts
ipcMain.handle('get-settings', async () => {
  return loadSettings()
})

ipcMain.handle('set-settings', async (_event, settings: Partial<AppSettings>) => {
  await saveSettings(settings)
  return true
})
```

**Step 3: Verify build**

```bash
npm run build
```

Expected: succeeds (no callers yet, no new errors).

**Step 4: Commit**

```bash
git add src/main/index.ts
git commit -m "feat: add settings persistence (get-settings, set-settings IPC handlers)"
```

---

## Task 3: Convert main process PTY to multi-instance

**Files:**
- Modify: `src/main/index.ts`

Replace the single `ptyManager` with a `Map<string, PtyManager>`. Update all PTY IPC handlers to route by `instanceId`.

**Step 1: Replace the ptyManager declaration**

Find this line (around line 14):
```ts
let ptyManager: PtyManager | null = null
```

Replace with:
```ts
const ptyManagers = new Map<string, PtyManager>()
```

**Step 2: Rewrite `pty-spawn` handler**

Find the entire `pty-spawn` handler (around lines 236–251) and replace it:

```ts
ipcMain.handle('pty-spawn', async (_event, options: PtySpawnOptions) => {
  const settings = await loadSettings()
  const activeCount = ptyManagers.size
  if (activeCount >= settings.maxChatInstances) {
    return { success: false, error: 'limit' }
  }

  // Kill stale instance with same id if it exists
  const stale = ptyManagers.get(options.instanceId)
  if (stale) {
    stale.kill().catch(() => {})
    ptyManagers.delete(options.instanceId)
  }

  const manager = new PtyManager()
  manager.setDataHandler((data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('pty-data', { instanceId: options.instanceId, data })
    }
  })
  manager.setExitHandler((code) => {
    ptyManagers.delete(options.instanceId)
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('pty-exit', { instanceId: options.instanceId, code })
    }
  })

  ptyManagers.set(options.instanceId, manager)
  return manager.spawn(options)
})
```

**Step 3: Rewrite `pty-input` handler**

Find:
```ts
ipcMain.on('pty-input', (_event, data: string) => {
  ptyManager?.write(data)
})
```

Replace with:
```ts
ipcMain.on('pty-input', (_event, payload: { instanceId: string; data: string }) => {
  ptyManagers.get(payload.instanceId)?.write(payload.data)
})
```

**Step 4: Rewrite `pty-resize` handler**

Find:
```ts
ipcMain.on('pty-resize', (_event, cols: number, rows: number) => {
  ptyManager?.resize(cols, rows)
})
```

Replace with:
```ts
ipcMain.on('pty-resize', (_event, payload: { instanceId: string; cols: number; rows: number }) => {
  ptyManagers.get(payload.instanceId)?.resize(payload.cols, payload.rows)
})
```

**Step 5: Rewrite `pty-kill` handler**

Find:
```ts
ipcMain.handle('pty-kill', async () => {
  await ptyManager?.kill()
  return true
})
```

Replace with:
```ts
ipcMain.handle('pty-kill', async (_event, instanceId: string) => {
  const manager = ptyManagers.get(instanceId)
  if (manager) {
    await manager.kill()
    ptyManagers.delete(instanceId)
  }
  return true
})
```

**Step 6: Rewrite `pty-status` handler**

Find:
```ts
ipcMain.handle('pty-status', async () => {
  return {
    active: ptyManager?.isActive() ?? false,
    pid: ptyManager?.getPid()
  }
})
```

Replace with:
```ts
ipcMain.handle('pty-status', async (_event, instanceId: string) => {
  const manager = ptyManagers.get(instanceId)
  return {
    active: manager?.isActive() ?? false,
    pid: manager?.getPid()
  }
})
```

**Step 7: Update `before-quit` handler**

Find:
```ts
app.on('before-quit', () => {
  if (ptyManager?.isActive()) {
    ptyManager.kill().catch(() => {})
  }
})
```

Replace with:
```ts
app.on('before-quit', () => {
  for (const manager of ptyManagers.values()) {
    if (manager.isActive()) {
      manager.kill().catch(() => {})
    }
  }
})
```

**Step 8: Verify build**

```bash
npm run build
```

Expected: type errors in `src/preload/index.ts` (callers still use old signatures). That is expected — fix in next task.

**Step 9: Commit**

```bash
git add src/main/index.ts
git commit -m "feat: convert PTY to multi-instance Map; all handlers are instanceId-aware"
```

---

## Task 4: Update preload to match new IPC signatures

**Files:**
- Modify: `src/preload/index.ts`

Update all PTY method signatures and the data/exit event callbacks to carry `instanceId`.

**Step 1: Update the `ElectronAPI` interface**

Find the PTY section of the interface and replace it entirely:

```ts
// PTY
ptySpawn: (options: PtySpawnOptions) => Promise<{ success: boolean; error?: string }>
ptyInput: (instanceId: string, data: string) => void
ptyResize: (instanceId: string, cols: number, rows: number) => void
ptyKill: (instanceId: string) => Promise<boolean>
ptyStatus: (instanceId: string) => Promise<PtyStatus>
onPtyData: (callback: (instanceId: string, data: string) => void) => () => void
onPtyExit: (callback: (instanceId: string, code: number) => void) => () => void
// Settings
getSettings: () => Promise<AppSettings>
setSettings: (settings: Partial<AppSettings>) => Promise<boolean>
```

Also add `AppSettings` to the import:
```ts
import type {
  SearchResult,
  Conversation,
  ExportFormat,
  ExportResult,
  UserPreferences,
  PtySpawnOptions,
  PtyStatus,
  ProfilesUsage,
  AppSettings
} from '../shared/types'
```

And add to the re-export line:
```ts
export type { SearchResult, Conversation, ExportFormat, ExportResult, UserPreferences, PtySpawnOptions, PtyStatus, ProfilesUsage, AppSettings }
```

**Step 2: Update the `api` object implementations**

Find the PTY section in the `api` object and replace:

```ts
// PTY
ptySpawn: (options) => ipcRenderer.invoke('pty-spawn', options),
ptyInput: (instanceId, data) => ipcRenderer.send('pty-input', { instanceId, data }),
ptyResize: (instanceId, cols, rows) => ipcRenderer.send('pty-resize', { instanceId, cols, rows }),
ptyKill: (instanceId) => ipcRenderer.invoke('pty-kill', instanceId),
ptyStatus: (instanceId) => ipcRenderer.invoke('pty-status', instanceId),
onPtyData: (callback) => {
  const handler = (_event: Electron.IpcRendererEvent, payload: { instanceId: string; data: string }): void => {
    callback(payload.instanceId, payload.data)
  }
  ipcRenderer.on('pty-data', handler)
  return () => ipcRenderer.removeListener('pty-data', handler)
},
onPtyExit: (callback) => {
  const handler = (_event: Electron.IpcRendererEvent, payload: { instanceId: string; code: number }): void => {
    callback(payload.instanceId, payload.code)
  }
  ipcRenderer.on('pty-exit', handler)
  return () => ipcRenderer.removeListener('pty-exit', handler)
},
// Settings
getSettings: () => ipcRenderer.invoke('get-settings'),
setSettings: (settings) => ipcRenderer.invoke('set-settings', settings),
```

**Step 3: Verify build**

```bash
npm run build
```

Expected: type errors in renderer files (`App.tsx`, `ChatTerminal.tsx`) that still call old signatures. Fix in subsequent tasks.

**Step 4: Commit**

```bash
git add src/preload/index.ts
git commit -m "feat: update preload API — PTY methods are instanceId-aware, add settings API"
```

---

## Task 5: Update ChatTerminal to be instance-aware

**Files:**
- Modify: `src/renderer/src/components/ChatTerminal.tsx`

Add `instanceId` prop. Route all IPC calls through it. Filter incoming events by `instanceId`.

**Step 1: Update props interface**

Find:
```ts
interface ChatTerminalProps {
  cwd: string
  resumeSessionId?: string
  profile?: ClaudeProfile
  onExit: (code: number) => void
}
```

Replace with:
```ts
interface ChatTerminalProps {
  instanceId: string
  cwd: string
  resumeSessionId?: string
  profile?: ClaudeProfile
  onExit: (code: number) => void
}
```

**Step 2: Destructure `instanceId` from props**

Find:
```ts
export default function ChatTerminal({ cwd, resumeSessionId, profile, onExit }: ChatTerminalProps): JSX.Element {
```

Replace with:
```ts
export default function ChatTerminal({ instanceId, cwd, resumeSessionId, profile, onExit }: ChatTerminalProps): JSX.Element {
```

**Step 3: Update `onData` subscription to filter by instanceId**

Find:
```ts
const cleanupData = window.electronAPI.onPtyData((data) => {
  terminal.write(data)
})
```

Replace with:
```ts
const cleanupData = window.electronAPI.onPtyData((id, data) => {
  if (id === instanceId) terminal.write(data)
})
```

**Step 4: Update `onExit` subscription to filter by instanceId**

Find:
```ts
const cleanupExit = window.electronAPI.onPtyExit((code) => {
  terminal.write(`\r\n\x1b[90m--- Process exited with code ${code} ---\x1b[0m\r\n`)
  setExited(code)
  onExitRef.current(code)
})
```

Replace with:
```ts
const cleanupExit = window.electronAPI.onPtyExit((id, code) => {
  if (id !== instanceId) return
  terminal.write(`\r\n\x1b[90m--- Process exited with code ${code} ---\x1b[0m\r\n`)
  setExited(code)
  onExitRef.current(code)
})
```

**Step 5: Update `ptySpawn` call**

Find:
```ts
window.electronAPI.ptySpawn({ cwd, resumeSessionId, profile }).then((result) => {
```

Replace with:
```ts
window.electronAPI.ptySpawn({ instanceId, cwd, resumeSessionId, profile }).then((result) => {
```

**Step 6: Update `terminal.onData` to use instanceId**

Find:
```ts
terminal.onData((data) => {
  window.electronAPI.ptyInput(data)
})
```

Replace with:
```ts
terminal.onData((data) => {
  window.electronAPI.ptyInput(instanceId, data)
})
```

**Step 7: Update resize calls to use instanceId**

Find:
```ts
window.electronAPI.ptyResize(dims.cols, dims.rows)
```

There are two occurrences (initial size after spawn, and inside `handleResize`). Replace both with:
```ts
window.electronAPI.ptyResize(instanceId, dims.cols, dims.rows)
```

**Step 8: Update Stop button to pass instanceId**

Find:
```ts
window.electronAPI.ptyKill()
```

Replace with:
```ts
window.electronAPI.ptyKill(instanceId)
```

**Step 9: Add `instanceId` to the `useEffect` dependency array**

Find:
```ts
}, [cwd, resumeSessionId, profile])
```

Replace with:
```ts
}, [instanceId, cwd, resumeSessionId, profile])
```

**Step 10: Verify build**

```bash
npm run build
```

Expected: errors only in `App.tsx` (still uses old `ChatTerminal` without `instanceId` and old PTY API calls). Fix in Task 7.

**Step 11: Commit**

```bash
git add src/renderer/src/components/ChatTerminal.tsx
git commit -m "feat: ChatTerminal is instanceId-aware; routes all IPC through instance id"
```

---

## Task 6: Create ActiveChatList sidebar component

**Files:**
- Create: `src/renderer/src/components/ActiveChatList.tsx`

This component renders the pinned active/exited chat entries above the search bar.

**Step 1: Create the component**

Create `src/renderer/src/components/ActiveChatList.tsx`:

```tsx
import { basename } from 'path'
import type { ChatInstance, ClaudeProfile } from '../../../shared/types'

interface ActiveChatListProps {
  instances: ChatInstance[]
  activeChatInstanceId: string | null
  onFocus: (instanceId: string) => void
  onClose: (instanceId: string) => void
}

function profileEmoji(profile: ClaudeProfile | null): string {
  if (profile === 'work') return '💼'
  if (profile === 'personal') return '🏠'
  return ''
}

export default function ActiveChatList({
  instances,
  activeChatInstanceId,
  onFocus,
  onClose,
}: ActiveChatListProps): JSX.Element | null {
  if (instances.length === 0) return null

  return (
    <div className="border-b border-neutral-800">
      {instances.map((instance) => {
        const isActive = instance.status === 'active'
        const isFocused = instance.instanceId === activeChatInstanceId
        const emoji = profileEmoji(instance.profile)

        return (
          <div
            key={instance.instanceId}
            className={`flex items-center gap-2 px-3 py-2 text-xs transition-colors ${
              isFocused ? 'bg-neutral-800' : 'hover:bg-neutral-900'
            }`}
          >
            {/* Status dot */}
            <div
              className={`flex-shrink-0 w-2 h-2 rounded-full ${
                isActive
                  ? instance.isClaudeTyping
                    ? 'bg-claude-orange animate-pulse'
                    : 'bg-green-500 animate-pulse'
                  : 'bg-neutral-600'
              }`}
            />

            {/* Project name + profile */}
            <span
              className="flex-1 truncate text-neutral-300 font-mono"
              title={instance.cwd}
            >
              {basename(instance.cwd)}
              {emoji ? ` ${emoji}` : ''}
            </span>

            {/* Exited badge */}
            {!isActive && (
              <span className="text-neutral-600 flex-shrink-0">
                Exited{instance.exitCode !== null ? ` (${instance.exitCode})` : ''}
              </span>
            )}

            {/* Focus button */}
            <button
              onClick={() => onFocus(instance.instanceId)}
              className="flex-shrink-0 text-neutral-500 hover:text-neutral-300 transition-colors px-1"
              title="Focus this chat"
            >
              →
            </button>

            {/* Close button */}
            <button
              onClick={() => onClose(instance.instanceId)}
              className="flex-shrink-0 text-neutral-600 hover:text-red-400 transition-colors px-1"
              title={isActive ? 'Stop and remove' : 'Remove'}
            >
              ✕
            </button>
          </div>
        )
      })}
    </div>
  )
}
```

**Step 2: Verify build**

```bash
npm run build
```

Expected: succeeds (component is not imported anywhere yet, so no downstream errors).

**Step 3: Commit**

```bash
git add src/renderer/src/components/ActiveChatList.tsx
git commit -m "feat: add ActiveChatList sidebar component for pinned chat instances"
```

---

## Task 7: Refactor App.tsx to multi-instance state

**Files:**
- Modify: `src/renderer/src/App.tsx`

This is the largest task. Replace scalar chat state with `ChatInstance[]`, wire up `ActiveChatList`, route the right panel by `activeChatInstanceId`.

**Step 1: Add new imports**

At the top of `App.tsx`, add:
```ts
import ActiveChatList from './components/ActiveChatList'
import type { ChatInstance, AppSettings } from '../../shared/types'
import { v4 as uuidv4 } from 'uuid'
```

Note: `uuid` is already a transitive dependency in most Electron apps. If build fails, run:
```bash
npm install uuid && npm install -D @types/uuid
```

**Step 2: Replace scalar chat state**

Find and **remove** these state declarations:
```ts
const [chatCwd, setChatCwd] = useState<string | null>(null)
const [chatResumeSessionId, setChatResumeSessionId] = useState<string | undefined>(undefined)
const [chatKey, setChatKey] = useState(0)
const [isClaudeTyping, setIsClaudeTyping] = useState(false)
const claudeTypingTimerRef = useRef<NodeJS.Timeout | null>(null)
const [activeChatProfile, setActiveChatProfile] = useState<ClaudeProfile | null>(null)
```

Add in their place:
```ts
const [chatInstances, setChatInstances] = useState<ChatInstance[]>([])
const [activeChatInstanceId, setActiveChatInstanceId] = useState<string | null>(null)
const [appSettings, setAppSettings] = useState<AppSettings>({ maxChatInstances: 3 })
const typingTimers = useRef<Map<string, NodeJS.Timeout>>(new Map())
```

**Step 3: Load settings on startup**

In the `loadData` function inside the startup `useEffect`, add settings loading alongside the other calls:

```ts
const [projectList, statsData, prefs, settings] = await Promise.all([
  window.electronAPI.getProjects(),
  window.electronAPI.getStats(),
  window.electronAPI.getPreferences(),
  window.electronAPI.getSettings()
])
setProjects(projectList)
setStats(statsData)
setAppSettings(settings)
// ... existing pref restores
```

**Step 4: Replace the isClaudeTyping useEffect**

Find and remove the entire `useEffect` that listens on `onPtyData` for typing detection (the one that depends on `[chatCwd]`).

Add a new one that handles all instances:

```ts
useEffect(() => {
  const cleanup = window.electronAPI.onPtyData((instanceId) => {
    // Update isClaudeTyping for the relevant instance
    setChatInstances((prev) =>
      prev.map((inst) =>
        inst.instanceId === instanceId ? { ...inst, isClaudeTyping: true } : inst
      )
    )
    // Clear existing timer and set a new one
    const existing = typingTimers.current.get(instanceId)
    if (existing) clearTimeout(existing)
    const timer = setTimeout(() => {
      setChatInstances((prev) =>
        prev.map((inst) =>
          inst.instanceId === instanceId ? { ...inst, isClaudeTyping: false } : inst
        )
      )
      typingTimers.current.delete(instanceId)
    }, 1500)
    typingTimers.current.set(instanceId, timer)
  })

  return () => {
    cleanup()
    for (const t of typingTimers.current.values()) clearTimeout(t)
    typingTimers.current.clear()
  }
}, [])
```

**Step 5: Replace the PTY exit useEffect**

Find and remove the `handleChatExit` callback and any `onPtyExit` wiring in `App.tsx`.

Add a new `useEffect` to handle exits for all instances:

```ts
useEffect(() => {
  const cleanup = window.electronAPI.onPtyExit((instanceId, code) => {
    setChatInstances((prev) =>
      prev.map((inst) =>
        inst.instanceId === instanceId
          ? { ...inst, status: 'exited', exitCode: code, isClaudeTyping: false }
          : inst
      )
    )
  })
  return cleanup
}, [])
```

**Step 6: Rewrite chat launch handlers**

Replace `handleNewChat`, `handleChatInProject`, `handleContinueChat`, `handleProfileSelected`, `handleProfilePickerCancel` with these:

```ts
const handleNewChat = useCallback(async () => {
  const activeCount = chatInstances.filter((i) => i.status === 'active').length
  if (activeCount >= appSettings.maxChatInstances) {
    window.alert(`Maximum of ${appSettings.maxChatInstances} active chats reached. Close one to start a new session.`)
    return
  }
  setPendingChatConfig({ cwd: null, resumeSessionId: undefined })
}, [chatInstances, appSettings.maxChatInstances])

const handleChatInProject = useCallback(async (projectPath: string) => {
  const activeCount = chatInstances.filter((i) => i.status === 'active').length
  if (activeCount >= appSettings.maxChatInstances) {
    window.alert(`Maximum of ${appSettings.maxChatInstances} active chats reached. Close one to start a new session.`)
    return
  }
  setPendingChatConfig({ cwd: projectPath, resumeSessionId: undefined })
}, [chatInstances, appSettings.maxChatInstances])

const handleContinueChat = useCallback(async (projectPath: string, sessionId: string) => {
  const activeCount = chatInstances.filter((i) => i.status === 'active').length
  if (activeCount >= appSettings.maxChatInstances) {
    window.alert(`Maximum of ${appSettings.maxChatInstances} active chats reached. Close one to start a new session.`)
    return
  }
  setPendingChatConfig({ cwd: projectPath, resumeSessionId: sessionId })
}, [chatInstances, appSettings.maxChatInstances])

const handleProfileSelected = useCallback(async (profile: ClaudeProfile) => {
  const pending = pendingChatConfig
  setPendingChatConfig(null)
  if (!pending) return

  let cwd = pending.cwd
  if (cwd === null) {
    const dir = await window.electronAPI.selectDirectory()
    if (!dir) return
    cwd = dir
  }

  const instanceId = uuidv4()
  const newInstance: ChatInstance = {
    instanceId,
    cwd,
    profile,
    status: 'active',
    exitCode: null,
    resumeSessionId: pending.resumeSessionId,
    isClaudeTyping: false,
  }
  setChatInstances((prev) => [...prev, newInstance])
  setActiveChatInstanceId(instanceId)
  setSelectedConversation(null)
}, [pendingChatConfig])

const handleProfilePickerCancel = useCallback(() => {
  setPendingChatConfig(null)
}, [])
```

**Step 7: Add instance focus and close handlers**

```ts
const handleFocusInstance = useCallback((instanceId: string) => {
  setActiveChatInstanceId(instanceId)
  setSelectedConversation(null)
}, [])

const handleCloseInstance = useCallback(async (instanceId: string) => {
  const instance = chatInstances.find((i) => i.instanceId === instanceId)
  if (instance?.status === 'active') {
    await window.electronAPI.ptyKill(instanceId)
  }
  setChatInstances((prev) => prev.filter((i) => i.instanceId !== instanceId))
  // If we just closed the focused instance, clear focus
  setActiveChatInstanceId((prev) => (prev === instanceId ? null : prev))
}, [chatInstances])
```

**Step 8: Remove old `handleCloseChat` and `returnToHistory`**

Delete the `returnToHistory` and `handleCloseChat` callbacks entirely — exit behavior no longer auto-navigates, instances stay in sidebar.

**Step 9: Update the right panel rendering**

Find the right panel section (the `{chatCwd ? ... }` ternary). Replace the entire right panel content:

```tsx
{/* Right panel: Chat terminal or Conversation view */}
<div className="flex-1 overflow-hidden">
  {(() => {
    const activeInstance = chatInstances.find((i) => i.instanceId === activeChatInstanceId)
    if (activeInstance) {
      return (
        <ChatTerminal
          key={activeInstance.instanceId}
          instanceId={activeInstance.instanceId}
          cwd={activeInstance.cwd}
          resumeSessionId={activeInstance.resumeSessionId}
          profile={activeInstance.profile ?? undefined}
          onExit={() => {/* handled by global onPtyExit effect */}}
        />
      )
    }
    if (selectedConversation) {
      return (
        <ErrorBoundary>
          <ConversationView conversation={selectedConversation} query={query} onContinueChat={handleContinueChat} />
        </ErrorBoundary>
      )
    }
    return (
      <div className="flex items-center justify-center h-full text-neutral-500">
        <div className="text-center">
          <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
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
    )
  })()}
</div>
```

**Step 10: Add `ActiveChatList` to the sidebar**

Find the sidebar `<div className="w-96 ...">`. Add `ActiveChatList` immediately after the opening div, before the search section:

```tsx
<ActiveChatList
  instances={chatInstances}
  activeChatInstanceId={activeChatInstanceId}
  onFocus={handleFocusInstance}
  onClose={handleCloseInstance}
/>
```

**Step 11: Update `ResultsList` props**

`ResultsList` currently receives `activeCwd`, `activeChatSessionId`, `isClaudeTyping`, `activeChatProfile`. These scalars no longer exist. Update the `ResultsList` call to:

```tsx
<ResultsList
  results={sortedResults}
  selectedId={selectedConversation?.id || null}
  onSelect={handleSelectResult}
  query={query}
  activeCwd={chatInstances.find(i => i.instanceId === activeChatInstanceId)?.cwd ?? null}
  activeChatSessionId={chatInstances.find(i => i.instanceId === activeChatInstanceId)?.resumeSessionId}
  isClaudeTyping={chatInstances.some(i => i.isClaudeTyping)}
  activeChatProfile={chatInstances.find(i => i.instanceId === activeChatInstanceId)?.profile ?? null}
/>
```

**Step 12: Remove the old Live Chat header bar**

The current code has a header bar inside the right panel showing "Live Chat · 💼 Work" and a Close button. Remove that entire `<div className="flex items-center justify-between px-4 py-1 ...">` block — the `ChatTerminal` itself has its own header, and the sidebar entry has the close button.

**Step 13: Verify build**

```bash
npm run build
```

Expected: succeeds with no type errors.

**Step 14: Smoke test**

```bash
npm run dev
```

- Start 2 chats in different projects — both appear as sidebar entries
- Click `→` on each to switch between them
- Verify the correct terminal is shown for each
- Stop one — it should show "Exited" badge but remain in the sidebar
- Click `✕` to dismiss it

**Step 15: Commit**

```bash
git add src/renderer/src/App.tsx
git commit -m "feat: refactor App to multi-instance chat state with sidebar entries"
```

---

## Task 8: Create SettingsModal

**Files:**
- Create: `src/renderer/src/components/SettingsModal.tsx`
- Modify: `src/renderer/src/App.tsx`

A centered modal with a Chat section (max instances slider/input) and a placeholder Profiles section (full Profiles implementation is tracked in the profiles feature).

**Step 1: Create the component**

Create `src/renderer/src/components/SettingsModal.tsx`:

```tsx
import { useState, useCallback } from 'react'
import type { AppSettings } from '../../../shared/types'

interface SettingsModalProps {
  settings: AppSettings
  onSave: (settings: Partial<AppSettings>) => void
  onClose: () => void
}

export default function SettingsModal({ settings, onSave, onClose }: SettingsModalProps): JSX.Element {
  const [maxChatInstances, setMaxChatInstances] = useState(settings.maxChatInstances)

  const handleMaxChange = useCallback((value: number) => {
    const clamped = Math.min(10, Math.max(1, value))
    setMaxChatInstances(clamped)
    onSave({ maxChatInstances: clamped })
  }, [onSave])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-claude-dark border border-neutral-700 rounded-xl shadow-2xl w-[480px] max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-700">
          <h2 className="text-sm font-semibold text-neutral-200">Settings</h2>
          <button
            onClick={onClose}
            className="text-neutral-500 hover:text-neutral-300 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Chat section */}
        <div className="px-6 py-5 border-b border-neutral-800">
          <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-4">Chat</h3>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-200">Max simultaneous instances</p>
              <p className="text-xs text-neutral-500 mt-0.5">How many Claude Code sessions can run at once</p>
            </div>
            <input
              type="number"
              min={1}
              max={10}
              value={maxChatInstances}
              onChange={(e) => handleMaxChange(parseInt(e.target.value, 10) || 1)}
              className="w-16 text-center bg-neutral-900 border border-neutral-700 rounded-md px-2 py-1.5 text-sm text-neutral-200 focus:outline-none focus:border-claude-orange"
            />
          </div>
        </div>

        {/* Profiles section */}
        <div className="px-6 py-5">
          <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-4">Profiles</h3>
          <p className="text-sm text-neutral-500">Profile management coming soon.</p>
        </div>
      </div>
    </div>
  )
}
```

Note: The Profiles section is stubbed here. The full implementation from `2026-03-06-profiles-overview-design.md` will be wired in when that feature is built, inside this modal.

**Step 2: Wire SettingsModal into App.tsx**

Add the import at the top of `App.tsx`:
```ts
import SettingsModal from './components/SettingsModal'
```

Add settings modal state alongside the other state:
```ts
const [showSettings, setShowSettings] = useState(false)
```

Add the `handleSaveSettings` callback:
```ts
const handleSaveSettings = useCallback(async (partial: Partial<AppSettings>) => {
  const updated = { ...appSettings, ...partial }
  setAppSettings(updated)
  await window.electronAPI.setSettings(partial)
}, [appSettings])
```

**Step 3: Add gear button to title bar**

In the title bar, find the `[+Chat]` button and add the gear button after it:

```tsx
<button
  onClick={() => setShowSettings(true)}
  className="hover:text-neutral-300 transition-colors"
  title="Settings"
>
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
</button>
```

**Step 4: Render the modal**

At the bottom of the `App` return, alongside the `ProfilePickerModal`, add:

```tsx
{showSettings && (
  <SettingsModal
    settings={appSettings}
    onSave={handleSaveSettings}
    onClose={() => setShowSettings(false)}
  />
)}
```

**Step 5: Verify build**

```bash
npm run build
```

Expected: succeeds.

**Step 6: Smoke test**

```bash
npm run dev
```

- Click the gear icon — settings modal opens
- Change max instances to 2 — try to start a 3rd chat — get the alert
- Close and reopen app — setting should persist (check `~/Library/Application Support/<appName>/settings.json`)

**Step 7: Commit**

```bash
git add src/renderer/src/components/SettingsModal.tsx src/renderer/src/App.tsx
git commit -m "feat: add SettingsModal with max chat instances config and gear icon in titlebar"
```

---

## Final smoke test checklist

Run `npm run dev` and verify:

- [ ] Sidebar shows no active chat entries on startup
- [ ] Click `[+Chat]` → profile picker → directory picker → chat spawns in sidebar
- [ ] Click `[+Chat]` again → second chat spawns, both visible in sidebar
- [ ] Click `→` on first entry → first terminal shown in right panel
- [ ] Click `→` on second entry → second terminal shown
- [ ] Click `✕` on first → it's removed; second still active
- [ ] Close second via `✕` Stop → "Exited" badge appears; `✕` dismisses
- [ ] Gear icon → settings modal opens
- [ ] Change max to 1, start a chat, try `+Chat` again → blocked with alert
- [ ] Settings persist across app restart
- [ ] `before-quit` kills all active PTYs (check no zombie `claude` processes: `ps aux | grep claude`)
