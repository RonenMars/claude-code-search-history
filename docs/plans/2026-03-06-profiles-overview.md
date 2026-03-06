# Profiles Overview Panel — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a full-screen right-panel Profiles dashboard where users can view per-profile usage stats, filter conversations by profile, and manage profiles (add, edit label/emoji/configDir, enable/disable, delete).

**Architecture:** Profiles are persisted in `profiles.json` alongside `preferences.json` in `app.getPath('userData')`. The scanner reads from this file at startup instead of hardcoded paths. A new `ProfilesPanel` component renders in the right panel via a `rightPanel` enum state in App.tsx.

**Tech Stack:** Electron (main process IPC), React 18, TypeScript, Tailwind CSS, xterm.js (existing)

---

## Task 1: Update shared types

**Files:**
- Modify: `src/shared/types.ts`

The `Account` type widens from a union to `string` (profile id). `ClaudeProfile` is removed — callers use the full `Profile` object or its `configDir` directly. `PtySpawnOptions.profile` becomes `configDir?: string`.

**Step 1: Add Profile and ProfilesConfig, widen Account, remove ClaudeProfile**

Replace lines 13 and 195–214 of `src/shared/types.ts`:

```ts
// Line 13 — change:
export type Account = string  // profile id, e.g. "default", "work", custom uuid

// Remove the entire "Profile Types" block (lines 193–206) and replace with:

// ─── Profile Types ───────────────────────────────────────────────────

export interface Profile {
  id: string        // stable slug or uuid, used as Account value
  label: string     // display name, e.g. "Default", "Work"
  emoji: string     // single emoji character
  configDir: string // absolute or ~-prefixed path to CLAUDE_CONFIG_DIR
  enabled: boolean  // soft-disable without deleting
}

export interface ProfilesConfig {
  profiles: Profile[]
}

// ─── PTY / Chat Types ────────────────────────────────────────────────

export interface PtySpawnOptions {
  cwd: string
  resumeSessionId?: string
  configDir?: string   // CLAUDE_CONFIG_DIR to set; omit for default ~/.claude
}

export interface PtyStatus {
  active: boolean
  pid?: number
}
```

**Step 2: Verify TypeScript compiles**

```bash
cd /Users/ronen/Desktop/dev/personal/claude-search
npm run typecheck 2>&1 | head -60
```

Expected: errors referencing `ClaudeProfile` in several files — that's fine, we'll fix them in subsequent tasks.

**Step 3: Commit**

```bash
git add src/shared/types.ts
git commit -m "feat: add Profile/ProfilesConfig types, widen Account to string, drop ClaudeProfile"
```

---

## Task 2: Profiles persistence in main process

**Files:**
- Modify: `src/main/index.ts`

Add `loadProfilesConfig`, `saveProfilesConfig`, first-run migration, and IPC handlers `get-profiles` + `save-profiles`. Also update `get-profiles-usage` to accept dynamic configDirs.

**Step 1: Add helper functions after `savePreferences`**

After the `savePreferences` function (around line 33), add:

```ts
const DEFAULT_PROFILE: Profile = {
  id: 'default',
  label: 'Default',
  emoji: '🤖',
  configDir: join(homedir(), '.claude'),
  enabled: true
}

function getProfilesPath(): string {
  return join(app.getPath('userData'), 'profiles.json')
}

async function loadProfilesConfig(): Promise<ProfilesConfig> {
  try {
    const data = await readFile(getProfilesPath(), 'utf-8')
    const parsed = JSON.parse(data) as ProfilesConfig
    if (Array.isArray(parsed.profiles) && parsed.profiles.length > 0) {
      return parsed
    }
  } catch {
    // Missing or malformed — fall through to default
  }
  return { profiles: [DEFAULT_PROFILE] }
}

async function saveProfilesConfig(config: ProfilesConfig): Promise<void> {
  const dir = app.getPath('userData')
  await mkdir(dir, { recursive: true })
  await writeFile(getProfilesPath(), JSON.stringify(config, null, 2), 'utf-8')
}

async function ensureProfilesExist(): Promise<ProfilesConfig> {
  try {
    await readFile(getProfilesPath(), 'utf-8')
    return loadProfilesConfig()
  } catch {
    // File doesn't exist — write defaults
    const defaults = { profiles: [DEFAULT_PROFILE] }
    await saveProfilesConfig(defaults)
    return defaults
  }
}
```

Also add the import at the top:
```ts
import type { Conversation, PtySpawnOptions, Profile, ProfilesConfig } from '../shared/types'
```

**Step 2: Update `getProfileUsage` signature**

Change the function signature to accept a resolved absolute path (it already works this way — just verify it doesn't use hardcoded paths internally). No code change needed here.

**Step 3: Update `get-profiles-usage` IPC handler**

Replace the existing handler (around line 273):

```ts
ipcMain.handle('get-profiles-usage', async () => {
  const config = await loadProfilesConfig()
  const enabledProfiles = config.profiles.filter((p) => p.enabled)
  const results = await Promise.all(
    enabledProfiles.map(async (p) => {
      const resolvedDir = p.configDir.replace(/^~/, homedir())
      const usage = await getProfileUsage(resolvedDir)
      return [p.id, usage] as const
    })
  )
  return Object.fromEntries(results)
})
```

**Step 4: Add `get-profiles` and `save-profiles` IPC handlers**

Inside `setupIpcHandlers()`, after the `get-profiles-usage` handler:

```ts
ipcMain.handle('get-profiles', async () => {
  const config = await loadProfilesConfig()
  return config.profiles
})

ipcMain.handle('save-profiles', async (_event, profiles: Profile[]) => {
  const config: ProfilesConfig = { profiles }
  await saveProfilesConfig(config)
  // Re-initialize scanner with updated profiles
  const enabledProfiles = profiles.filter((p) => p.enabled)
  scanner = new ConversationScanner(enabledProfiles)
  indexer = new SearchIndexer()
  scanner.setProgressCallback((scanned, total) => {
    mainWindow?.webContents.send('scan-progress', { scanned, total })
  })
  const metas = await scanner.scanAllMeta()
  await indexer.buildIndex(metas)
  mainWindow?.webContents.send('index-ready')
  return true
})
```

**Step 5: Update `initializeSearch` to accept profiles**

```ts
async function initializeSearch(profiles: Profile[]): Promise<void> {
  scanner = new ConversationScanner(profiles)
  indexer = new SearchIndexer()
  // ... rest unchanged
}
```

**Step 6: Update `app.whenReady()` to load profiles first**

```ts
app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.claude-code-search')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  setupIpcHandlers()
  createWindow()

  // Load profiles (or write defaults), then initialize search
  const profilesConfig = await ensureProfilesExist()
  const enabledProfiles = profilesConfig.profiles.filter((p) => p.enabled)

  initializeSearch(enabledProfiles)
    .then(() => {
      mainWindow?.webContents.send('index-ready')
    })
    .catch(console.error)

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})
```

**Step 7: Update the PTY spawn handler to use configDir**

In `setupIpcHandlers`, the `pty-spawn` handler passes `options` to `ptyManager.spawn(options)`. No change needed — `PtySpawnOptions` now has `configDir` and `pty-manager.ts` will use it in Task 3.

**Step 8: Verify typecheck**

```bash
npm run typecheck 2>&1 | head -60
```

**Step 9: Commit**

```bash
git add src/main/index.ts
git commit -m "feat: add profiles.json persistence and get-profiles/save-profiles IPC handlers"
```

---

## Task 3: Scanner — dynamic profiles

**Files:**
- Modify: `src/main/services/scanner.ts`

Change the constructor to accept `Profile[]` instead of building hardcoded configDirs.

**Step 1: Update constructor**

Replace lines 16–23 of `src/main/services/scanner.ts`:

```ts
import { homedir } from 'os'
import type { Account, ConversationMeta, Conversation, ConversationMessage, MessageMetadata, ToolResult, ToolUseBlock, StructuredPatchHunk, Profile } from '../../shared/types'

// In the class:
constructor(profiles: Profile[]) {
  this.configDirs = profiles
    .filter((p) => p.enabled)
    .map((p) => ({
      projectsDir: join(p.configDir.replace(/^~/, homedir()), 'projects'),
      account: p.id
    }))
}
```

Remove the old hardcoded `configDirs` initialization entirely.

**Step 2: Verify typecheck**

```bash
npm run typecheck 2>&1 | head -60
```

**Step 3: Commit**

```bash
git add src/main/services/scanner.ts
git commit -m "feat: scanner reads configDirs from Profile[] instead of hardcoded paths"
```

---

## Task 4: Update PtyManager — use configDir directly

**Files:**
- Modify: `src/main/services/pty-manager.ts`

Remove the `profile` string comparison and just set `CLAUDE_CONFIG_DIR` from `options.configDir`.

**Step 1: Replace lines 49–53**

```ts
// Before:
if (options.profile === 'work') {
  spawnEnv.CLAUDE_CONFIG_DIR = join(homedir(), '.claude-work')
} else if (options.profile === 'personal') {
  spawnEnv.CLAUDE_CONFIG_DIR = join(homedir(), '.claude-personal')
}

// After:
if (options.configDir) {
  spawnEnv.CLAUDE_CONFIG_DIR = options.configDir.replace(/^~/, homedir())
}
```

**Step 2: Remove unused imports**

Remove `join` from the import if it was only used for the profile paths. (Check — `join` is also used in `buildClaudeCommand`? No — `join` is from `path` and used in `spawn`'s cwd. Keep it.)

Actually `join` is imported from `'path'` and used in the removed block. Check if it's used elsewhere:

```bash
grep -n 'join(' src/main/services/pty-manager.ts
```

If `join` is no longer used, remove it from the import.

**Step 3: Verify typecheck**

```bash
npm run typecheck 2>&1 | head -40
```

**Step 4: Commit**

```bash
git add src/main/services/pty-manager.ts
git commit -m "fix: pty-manager uses configDir directly instead of hardcoded profile path lookup"
```

---

## Task 5: Preload bridge

**Files:**
- Modify: `src/preload/index.ts`

Expose `getProfiles` and `saveProfiles`. Update `ProfilesUsage` type to be dynamic (keyed by profile id).

**Step 1: Update imports**

```ts
import type {
  SearchResult,
  Conversation,
  ExportFormat,
  ExportResult,
  UserPreferences,
  PtySpawnOptions,
  PtyStatus,
  Profile
} from '../shared/types'

export type { SearchResult, Conversation, ExportFormat, ExportResult, UserPreferences, PtySpawnOptions, PtyStatus, Profile }
```

Remove `ProfilesUsage` from the imports (it was a static shape; now the IPC returns `Record<string, ProfileUsage>` dynamically).

**Step 2: Add to `ElectronAPI` interface**

```ts
getProfiles: () => Promise<Profile[]>
saveProfiles: (profiles: Profile[]) => Promise<boolean>
getProfilesUsage: () => Promise<Record<string, { conversations: number; lastUsed: string | null; tokensThisMonth: number }>>
```

(The `getProfilesUsage` return type changes from the static `ProfilesUsage` shape to `Record<string, ...>`)

**Step 3: Add to `api` object**

```ts
getProfiles: () => ipcRenderer.invoke('get-profiles'),
saveProfiles: (profiles) => ipcRenderer.invoke('save-profiles', profiles),
```

**Step 4: Verify typecheck**

```bash
npm run typecheck 2>&1 | head -40
```

**Step 5: Commit**

```bash
git add src/preload/index.ts
git commit -m "feat: expose getProfiles and saveProfiles in preload bridge"
```

---

## Task 6: Update App.tsx — rightPanel state, profiles, accountFilter

**Files:**
- Modify: `src/renderer/src/App.tsx`

This is the biggest change. Replace `ClaudeProfile` with `Profile`, add `rightPanel` enum, `profiles` state, and `accountFilter` state.

**Step 1: Update imports**

```ts
import type { Conversation, SortOption, DateRangeOption, Profile } from '../../shared/types'
```

**Step 2: Add rightPanel type and profiles/accountFilter state**

After existing state declarations, add:

```ts
type RightPanelView = 'conversation' | 'chat' | 'profiles' | 'empty'
const [rightPanel, setRightPanel] = useState<RightPanelView>('empty')
const [profiles, setProfiles] = useState<Profile[]>([])
const [accountFilter, setAccountFilter] = useState<string | null>(null)
```

**Step 3: Change activeChatProfile type**

```ts
const [activeChatProfile, setActiveChatProfile] = useState<Profile | null>(null)
```

**Step 4: Fetch profiles on startup**

In `loadData()`, add `getProfiles` to the parallel calls:

```ts
const [projectList, statsData, prefs, profileList] = await Promise.all([
  window.electronAPI.getProjects(),
  window.electronAPI.getStats(),
  window.electronAPI.getPreferences(),
  window.electronAPI.getProfiles()
])
setProfiles(profileList)
```

**Step 5: Update handleProfileSelected**

```ts
const handleProfileSelected = useCallback(async (profile: Profile) => {
  const pending = pendingChatConfig
  setPendingChatConfig(null)
  if (!pending) return

  let cwd = pending.cwd
  if (cwd === null) {
    const dir = await window.electronAPI.selectDirectory()
    if (!dir) return
    cwd = dir
  }

  setActiveChatProfile(profile)
  setChatCwd(cwd)
  setChatResumeSessionId(pending.resumeSessionId)
  setChatKey((k) => k + 1)
  setSelectedConversation(null)
  setRightPanel('chat')
}, [pendingChatConfig])
```

**Step 6: Update handleSelectResult and handleCloseChat**

```ts
const handleSelectResult = useCallback(async (id: string) => {
  try {
    const conversation = await window.electronAPI.getConversation(id)
    setSelectedConversation(conversation)
    setChatCwd(null)
    setRightPanel(conversation ? 'conversation' : 'empty')
  } catch (err) {
    console.error('Failed to load conversation:', err)
  }
}, [])

// In handleCloseChat:
setChatCwd(null)
setActiveChatProfile(null)
setRightPanel('empty')
```

**Step 7: Update handleNewChat/handleChatInProject/handleContinueChat**

After `await window.electronAPI.ptyKill()`, set `setRightPanel('empty')` then let `handleProfileSelected` set it to `'chat'`.

**Step 8: Add handleOpenProfiles and handleFilterByProfile**

```ts
const handleOpenProfiles = useCallback(() => {
  setRightPanel('profiles')
}, [])

const handleFilterByProfile = useCallback((profileId: string | null) => {
  setAccountFilter(profileId)
  setRightPanel(selectedConversation ? 'conversation' : 'empty')
}, [selectedConversation])

const handleProfilesSaved = useCallback(async (updated: Profile[]) => {
  setProfiles(updated)
  await window.electronAPI.saveProfiles(updated)
}, [])
```

**Step 9: Update titlebar JSX — add Profiles button**

```tsx
<button
  onClick={handleOpenProfiles}
  className="hover:text-neutral-300 transition-colors flex items-center gap-1"
  title="Manage profiles"
>
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
  Profiles
</button>
```

**Step 10: Update ChatTerminal call — pass configDir**

```tsx
<ChatTerminal
  key={chatKey}
  cwd={chatCwd}
  resumeSessionId={chatResumeSessionId}
  configDir={activeChatProfile?.configDir}
  onExit={handleChatExit}
/>
```

**Step 11: Replace right-panel ternary with rightPanel switch**

```tsx
{/* Right panel */}
<div className="flex-1 overflow-hidden">
  {rightPanel === 'chat' && chatCwd ? (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-1 bg-claude-dark border-b border-neutral-700">
        <span className="text-xs text-neutral-500">
          Live Chat{activeChatProfile ? ` · ${activeChatProfile.emoji} ${activeChatProfile.label}` : ''}
        </span>
        <button onClick={handleCloseChat} className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors">
          Close
        </button>
      </div>
      <div className="flex-1 overflow-hidden">
        <ChatTerminal
          key={chatKey}
          cwd={chatCwd}
          resumeSessionId={chatResumeSessionId}
          configDir={activeChatProfile?.configDir}
          onExit={handleChatExit}
        />
      </div>
    </div>
  ) : rightPanel === 'profiles' ? (
    <ProfilesPanel
      profiles={profiles}
      onFilterByProfile={handleFilterByProfile}
      onProfilesSaved={handleProfilesSaved}
    />
  ) : rightPanel === 'conversation' && selectedConversation ? (
    <ErrorBoundary>
      <ConversationView conversation={selectedConversation} query={query} onContinueChat={handleContinueChat} />
    </ErrorBoundary>
  ) : (
    <div className="flex items-center justify-center h-full text-neutral-500">
      {/* existing empty state */}
    </div>
  )}
</div>
```

**Step 12: Pass accountFilter to ResultsList**

```tsx
<ResultsList
  results={sortedResults}
  selectedId={selectedConversation?.id || null}
  onSelect={handleSelectResult}
  query={query}
  activeCwd={chatCwd}
  isClaudeTyping={isClaudeTyping}
  activeChatProfile={activeChatProfile}
  accountFilter={accountFilter}
  onClearAccountFilter={() => setAccountFilter(null)}
/>
```

**Step 13: Pass profiles to ProfilePickerModal**

```tsx
{pendingChatConfig !== null && (
  <ProfilePickerModal
    profiles={profiles}
    onSelect={handleProfileSelected}
    onCancel={handleProfilePickerCancel}
  />
)}
```

**Step 14: Add ProfilesPanel import**

```ts
import ProfilesPanel from './components/ProfilesPanel'
```

**Step 15: Verify typecheck**

```bash
npm run typecheck 2>&1 | head -60
```

Fix any remaining type errors (likely `pendingChatConfig` type for Profile, `ChatTerminal` props mismatch — addressed in Task 7).

**Step 16: Commit**

```bash
git add src/renderer/src/App.tsx
git commit -m "feat: add rightPanel state, profiles state, accountFilter, and Profiles button to titlebar"
```

---

## Task 7: Update ChatTerminal — accept configDir prop

**Files:**
- Modify: `src/renderer/src/components/ChatTerminal.tsx`

**Step 1: Update props interface**

```ts
// Remove: import type { ClaudeProfile } from '../../../shared/types'

interface ChatTerminalProps {
  cwd: string
  resumeSessionId?: string
  configDir?: string   // replaces profile prop
  onExit: (code: number) => void
}
```

**Step 2: Update ptySpawn call (find where profile is passed)**

Find the `window.electronAPI.ptySpawn(...)` call in the useEffect and change:

```ts
// Before:
window.electronAPI.ptySpawn({ cwd, resumeSessionId, profile })

// After:
window.electronAPI.ptySpawn({ cwd, resumeSessionId, configDir })
```

**Step 3: Verify typecheck**

```bash
npm run typecheck 2>&1 | head -40
```

**Step 4: Commit**

```bash
git add src/renderer/src/components/ChatTerminal.tsx
git commit -m "fix: ChatTerminal accepts configDir instead of profile for PTY spawning"
```

---

## Task 8: Update ResultsList — accountFilter prop

**Files:**
- Modify: `src/renderer/src/components/ResultsList.tsx`

**Step 1: Update imports and props interface**

```ts
import type { Profile, SearchResult } from '../../../shared/types'

interface ResultsListProps {
  results: SearchResult[]
  selectedId: string | null
  onSelect: (id: string) => void
  query: string
  activeCwd: string | null
  activeChatSessionId: string | undefined
  isClaudeTyping: boolean
  activeChatProfile: Profile | null  // was ClaudeProfile | null
  accountFilter: string | null
  onClearAccountFilter: () => void
}
```

**Step 2: Filter results by accountFilter**

Add filtering near the top of the component body (after destructuring props):

```ts
const filteredResults = accountFilter
  ? results.filter((r) => r.account === accountFilter)
  : results
```

Use `filteredResults` instead of `results` in the virtualizer count and virtual item rendering.

**Step 3: Show "clear filter" chip when accountFilter is set**

Above the virtualizer container:

```tsx
{accountFilter && (
  <div className="px-3 py-1.5 flex items-center gap-2 border-b border-neutral-800">
    <span className="text-xs text-neutral-400">Filtered by profile</span>
    <button
      onClick={onClearAccountFilter}
      className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors underline"
    >
      Clear
    </button>
  </div>
)}
```

**Step 4: Verify typecheck**

```bash
npm run typecheck 2>&1 | head -40
```

**Step 5: Commit**

```bash
git add src/renderer/src/components/ResultsList.tsx
git commit -m "feat: ResultsList accepts accountFilter prop and shows clear-filter chip"
```

---

## Task 9: Update ProfilePickerModal — dynamic profiles

**Files:**
- Modify: `src/renderer/src/components/ProfilePickerModal.tsx`

**Step 1: Update props interface and imports**

```ts
import type { Profile } from '../../../shared/types'

interface ProfilePickerModalProps {
  profiles: Profile[]
  onSelect: (profile: Profile) => void
  onCancel: () => void
}
```

**Step 2: Remove static profile array and usage fetch**

Remove the `useEffect` that fetches `getProfilesUsage` (the modal no longer needs to fetch its own usage — it gets profiles as a prop). Remove the `usage` state.

The modal just displays the profiles from props. Usage stats can be shown in the dedicated ProfilesPanel instead.

**Step 3: Update the grid rendering**

```tsx
<div className="grid grid-cols-2 gap-3 mb-5">
  {profiles.filter((p) => p.enabled).map((profile) => (
    <button
      key={profile.id}
      onClick={() => onSelect(profile)}
      className="flex flex-col items-start text-left p-4 bg-neutral-900 border border-neutral-700 hover:border-claude-orange hover:bg-neutral-800 rounded-lg transition-colors group"
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-base">{profile.emoji}</span>
        <span className="text-sm font-medium text-neutral-200 group-hover:text-white">{profile.label}</span>
      </div>
      <div className="text-[10px] font-mono text-neutral-600">{profile.configDir}</div>
    </button>
  ))}
</div>
```

**Step 4: Verify typecheck**

```bash
npm run typecheck 2>&1 | head -40
```

**Step 5: Commit**

```bash
git add src/renderer/src/components/ProfilePickerModal.tsx
git commit -m "feat: ProfilePickerModal accepts dynamic profiles prop, removes hardcoded work/personal"
```

---

## Task 10: Create ProfileCard component

**Files:**
- Create: `src/renderer/src/components/ProfileCard.tsx`

**Step 1: Write the component**

```tsx
import type { Profile } from '../../../shared/types'

interface ProfileUsage {
  conversations: number
  lastUsed: string | null
  tokensThisMonth: number
}

interface ProfileCardProps {
  profile: Profile
  usage: ProfileUsage | null
  isOnly: boolean  // disable delete when true
  onFilter: () => void
  onEdit: () => void
  onDelete: () => void
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return String(n)
}

function formatLastUsed(iso: string | null): string {
  if (!iso) return 'Never used'
  const date = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffH = Math.floor(diffMs / (1000 * 60 * 60))
  const diffD = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (diffH < 1) return 'Just now'
  if (diffH < 24) return `${diffH}h ago`
  if (diffD === 1) return 'Yesterday'
  if (diffD < 7) return `${diffD} days ago`
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

export default function ProfileCard({ profile, usage, isOnly, onFilter, onEdit, onDelete }: ProfileCardProps): JSX.Element {
  const tokens = usage?.tokensThisMonth ?? 0

  return (
    <div className="bg-neutral-900 border border-neutral-700 rounded-lg p-4 flex flex-col gap-3">
      {/* Header row */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">{profile.emoji}</span>
          <div>
            <div className="text-sm font-medium text-neutral-200">{profile.label}</div>
            <div className="text-[10px] font-mono text-neutral-600 mt-0.5">{profile.configDir}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onEdit}
            className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors px-2 py-1 border border-neutral-700 hover:border-neutral-500 rounded"
          >
            Edit
          </button>
          <button
            onClick={onDelete}
            disabled={isOnly}
            title={isOnly ? 'Must have at least one profile' : 'Delete profile'}
            className="text-xs text-neutral-500 hover:text-red-400 transition-colors px-2 py-1 border border-neutral-700 hover:border-red-800 rounded disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:text-neutral-500 disabled:hover:border-neutral-700"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="border-t border-neutral-800 pt-3 flex flex-col gap-1">
        {usage ? (
          <>
            <div className="text-xs text-neutral-400">
              <span className="font-medium text-neutral-300">{usage.conversations}</span> conversations
            </div>
            <div className="text-xs text-neutral-500">
              Last used: {formatLastUsed(usage.lastUsed)}
            </div>
            {tokens > 0 && (
              <div className="text-xs text-neutral-500">
                This month: <span className="font-medium text-neutral-400">{formatTokens(tokens)}</span> tokens
              </div>
            )}
          </>
        ) : (
          <div className="text-xs text-neutral-600 animate-pulse">Loading stats…</div>
        )}
      </div>

      {/* Filter link */}
      <button
        onClick={onFilter}
        className="text-xs text-claude-orange hover:text-orange-300 transition-colors text-left"
      >
        Filter conversations to this profile →
      </button>
    </div>
  )
}
```

**Step 2: Verify typecheck**

```bash
npm run typecheck 2>&1 | head -40
```

**Step 3: Commit**

```bash
git add src/renderer/src/components/ProfileCard.tsx
git commit -m "feat: add ProfileCard component with stats and filter/edit/delete actions"
```

---

## Task 11: Create ProfileEditModal component

**Files:**
- Create: `src/renderer/src/components/ProfileEditModal.tsx`

**Step 1: Write the component**

```tsx
import { useState } from 'react'
import type { Profile } from '../../../shared/types'

const PRESET_EMOJIS = ['🤖', '💼', '🏠', '🎯', '🔬', '🎨', '⚡', '🌍', '🛠️', '📚', '🚀', '🎮']

interface ProfileEditModalProps {
  profile: Profile | null  // null = creating new
  onSave: (profile: Profile) => void
  onCancel: () => void
}

function generateId(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Math.random().toString(36).slice(2, 6)
}

export default function ProfileEditModal({ profile, onSave, onCancel }: ProfileEditModalProps): JSX.Element {
  const isNew = profile === null
  const [label, setLabel] = useState(profile?.label ?? '')
  const [emoji, setEmoji] = useState(profile?.emoji ?? '🤖')
  const [configDir, setConfigDir] = useState(profile?.configDir ?? '~/.claude')
  const [enabled, setEnabled] = useState(profile?.enabled ?? true)

  const handleBrowse = async (): Promise<void> => {
    const dir = await window.electronAPI.selectDirectory()
    if (dir) setConfigDir(dir)
  }

  const handleSave = (): void => {
    if (!label.trim()) return
    onSave({
      id: profile?.id ?? generateId(label),
      label: label.trim(),
      emoji,
      configDir: configDir.trim(),
      enabled
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div className="bg-claude-dark border border-neutral-700 rounded-xl shadow-2xl w-[420px] p-6">
        <h2 className="text-sm font-semibold text-neutral-200 mb-4">
          {isNew ? 'Add Profile' : 'Edit Profile'}
        </h2>

        {/* Emoji picker */}
        <div className="mb-4">
          <label className="block text-xs text-neutral-500 mb-2">Emoji</label>
          <div className="flex flex-wrap gap-2">
            {PRESET_EMOJIS.map((e) => (
              <button
                key={e}
                onClick={() => setEmoji(e)}
                className={`text-lg w-9 h-9 flex items-center justify-center rounded border transition-colors ${
                  emoji === e
                    ? 'border-claude-orange bg-claude-orange/10'
                    : 'border-neutral-700 hover:border-neutral-500'
                }`}
              >
                {e}
              </button>
            ))}
          </div>
        </div>

        {/* Label */}
        <div className="mb-4">
          <label className="block text-xs text-neutral-500 mb-1">Label</label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Work, Personal, Freelance"
            className="w-full bg-neutral-900 border border-neutral-700 rounded px-3 py-2 text-sm text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-neutral-500"
          />
        </div>

        {/* Config dir */}
        <div className="mb-4">
          <label className="block text-xs text-neutral-500 mb-1">Config directory (CLAUDE_CONFIG_DIR)</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={configDir}
              onChange={(e) => setConfigDir(e.target.value)}
              placeholder="~/.claude"
              className="flex-1 bg-neutral-900 border border-neutral-700 rounded px-3 py-2 text-sm text-neutral-200 font-mono placeholder-neutral-600 focus:outline-none focus:border-neutral-500"
            />
            <button
              onClick={handleBrowse}
              className="text-xs text-neutral-400 hover:text-neutral-200 border border-neutral-700 hover:border-neutral-500 rounded px-3 py-2 transition-colors"
            >
              Browse…
            </button>
          </div>
        </div>

        {/* Enabled toggle */}
        <div className="mb-6 flex items-center gap-3">
          <button
            onClick={() => setEnabled((v) => !v)}
            className={`w-9 h-5 rounded-full transition-colors ${enabled ? 'bg-claude-orange' : 'bg-neutral-700'}`}
            role="switch"
            aria-checked={enabled}
          >
            <span
              className={`block w-3 h-3 bg-white rounded-full m-1 transition-transform ${enabled ? 'translate-x-4' : 'translate-x-0'}`}
            />
          </button>
          <span className="text-xs text-neutral-400">Profile enabled</span>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors px-3 py-1.5"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!label.trim()}
            className="text-xs text-white bg-claude-orange hover:bg-orange-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors px-4 py-1.5 rounded"
          >
            {isNew ? 'Add Profile' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

**Step 2: Verify typecheck**

```bash
npm run typecheck 2>&1 | head -40
```

**Step 3: Commit**

```bash
git add src/renderer/src/components/ProfileEditModal.tsx
git commit -m "feat: add ProfileEditModal with emoji picker, label, configDir browse, and enabled toggle"
```

---

## Task 12: Create ProfilesPanel component

**Files:**
- Create: `src/renderer/src/components/ProfilesPanel.tsx`

**Step 1: Write the component**

```tsx
import { useState, useEffect } from 'react'
import type { Profile } from '../../../shared/types'
import ProfileCard from './ProfileCard'
import ProfileEditModal from './ProfileEditModal'

interface ProfileUsage {
  conversations: number
  lastUsed: string | null
  tokensThisMonth: number
}

interface ProfilesPanelProps {
  profiles: Profile[]
  onFilterByProfile: (profileId: string | null) => void
  onProfilesSaved: (profiles: Profile[]) => Promise<void>
}

export default function ProfilesPanel({ profiles, onFilterByProfile, onProfilesSaved }: ProfilesPanelProps): JSX.Element {
  const [usage, setUsage] = useState<Record<string, ProfileUsage>>({})
  const [editingProfile, setEditingProfile] = useState<Profile | null | 'new'>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    window.electronAPI.getProfilesUsage()
      .then(setUsage)
      .catch(() => {})
  }, [profiles])

  const enabledCount = profiles.filter((p) => p.enabled).length

  const handleSaveEdit = async (updated: Profile): Promise<void> => {
    setSaving(true)
    let next: Profile[]
    if (editingProfile === 'new') {
      next = [...profiles, updated]
    } else {
      next = profiles.map((p) => (p.id === updated.id ? updated : p))
    }
    setEditingProfile(null)
    await onProfilesSaved(next)
    setSaving(false)
  }

  const handleDelete = async (profileId: string): Promise<void> => {
    const next = profiles.filter((p) => p.id !== profileId)
    await onProfilesSaved(next)
  }

  return (
    <div className="flex flex-col h-full bg-claude-darker">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800">
        <div>
          <h1 className="text-sm font-semibold text-neutral-200">Profiles</h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            Each profile uses a separate CLAUDE_CONFIG_DIR — independent auth, history, and memory.
          </p>
        </div>
        <button
          onClick={() => setEditingProfile('new')}
          className="text-xs text-neutral-300 hover:text-white border border-neutral-700 hover:border-neutral-500 rounded px-3 py-1.5 transition-colors flex items-center gap-1"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Profile
        </button>
      </div>

      {/* Cards grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {saving && (
          <div className="text-xs text-neutral-500 animate-pulse mb-4">Saving and rebuilding index…</div>
        )}
        {profiles.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-neutral-600 text-sm">
            No profiles configured.
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {profiles.map((profile) => (
              <ProfileCard
                key={profile.id}
                profile={profile}
                usage={usage[profile.id] ?? null}
                isOnly={enabledCount <= 1 && profile.enabled}
                onFilter={() => onFilterByProfile(profile.id)}
                onEdit={() => setEditingProfile(profile)}
                onDelete={() => handleDelete(profile.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Edit/Add modal */}
      {editingProfile !== null && (
        <ProfileEditModal
          profile={editingProfile === 'new' ? null : editingProfile}
          onSave={handleSaveEdit}
          onCancel={() => setEditingProfile(null)}
        />
      )}
    </div>
  )
}
```

**Step 2: Verify typecheck**

```bash
npm run typecheck 2>&1 | head -40
```

**Step 3: Commit**

```bash
git add src/renderer/src/components/ProfilesPanel.tsx
git commit -m "feat: add ProfilesPanel right-panel dashboard with usage stats, add/edit/delete, and filter shortcut"
```

---

## Task 13: Final integration check

**Step 1: Run typecheck clean**

```bash
npm run typecheck 2>&1
```

Expected: zero errors.

**Step 2: Start the app and manually verify**

```bash
npm run dev
```

Checklist:
- [ ] App starts with a single Default profile in the picker (first-run migration)
- [ ] Clicking "Profiles" button in titlebar opens the right panel
- [ ] Profiles panel shows Default profile card with conversation count and last used
- [ ] "Add Profile" opens ProfileEditModal; filling in label/emoji/configDir and saving adds the card
- [ ] Edit opens the modal pre-populated; saving updates the card
- [ ] Delete is disabled when only one enabled profile exists
- [ ] "Filter conversations →" on a card filters the sidebar and returns to conversation view
- [ ] Clear filter chip appears in ResultsList when filter is active; clicking it clears it
- [ ] "New Chat" → ProfilePickerModal shows the dynamic profile list
- [ ] Selecting a profile starts a PTY session using the correct CLAUDE_CONFIG_DIR
- [ ] After editing profile paths, the index rebuilds and new conversations appear under the correct profile

**Step 3: Fix any issues found, then final commit**

```bash
git add -p  # stage only what's changed
git commit -m "fix: integration fixes from manual verification"
```
