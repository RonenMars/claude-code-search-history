# Multi-Instance Chat & Settings Panel — Design

> Date: 2026-03-06
> Status: Approved

## Summary

Allow users to run multiple Claude Code instances simultaneously across different projects. Active chats are pinned as entries at the top of the sidebar. A new Settings modal (gear icon near the conversations counter) hosts configurable options including the max simultaneous instances limit and the Profiles management panel (previously planned as a standalone title bar button).

---

## Decisions

- **Navigation**: Active chats pinned in the sidebar above the search area
- **Exit behavior**: Exited instances stay in the sidebar with an "Exited" badge; user manually dismisses them via the `[x]` button
- **IPC strategy**: Static channel names (`pty-data`, `pty-exit`) with `instanceId` embedded in the payload (Approach C)
- **Max instances**: Configurable in Settings, default 3
- **Settings entry point**: Gear icon button placed near the conversations counter in the title bar; absorbs the Profiles panel from the approved `2026-03-06-profiles-overview-design.md`

---

## Data Model

### `ChatInstance` (renderer state only)

```ts
interface ChatInstance {
  instanceId: string          // uuid, stable key for the lifetime of the session
  cwd: string
  profile: ClaudeProfile | null
  status: 'active' | 'exited'
  exitCode: number | null
  resumeSessionId?: string
  isClaudeTyping: boolean     // debounced from pty-data events
}
```

### `AppSettings` (persisted to `app.getPath('userData')/settings.json`)

```ts
interface AppSettings {
  maxChatInstances: number    // default: 3, range: 1–10
}
```

---

## Architecture

### Files changed

| File | Change |
|---|---|
| `src/shared/types.ts` | Add `ChatInstance`, `AppSettings`; update `PtySpawnOptions` to include `instanceId` |
| `src/main/index.ts` | `ptyManagers: Map<string, PtyManager>`; update all PTY IPC handlers to be instance-aware; add `get-settings` / `set-settings` handlers |
| `src/preload/index.ts` | All PTY methods gain `instanceId`; `onPtyData` / `onPtyExit` callbacks receive `instanceId` in payload; add `getSettings` / `setSettings` |
| `src/renderer/src/App.tsx` | Replace scalar chat state with `chatInstances: ChatInstance[]` + `activeChatInstanceId`; sidebar entries; instance limit enforcement |
| `src/renderer/src/components/ChatTerminal.tsx` | Gains `instanceId` prop; filters IPC events by id |
| `src/renderer/src/components/ActiveChatList.tsx` | NEW — sidebar section rendering pinned chat entries |
| `src/renderer/src/components/SettingsModal.tsx` | NEW — modal with Chat and Profiles sections |

### Files unchanged

- `src/main/services/scanner.ts`
- `src/main/services/indexer.ts`
- `src/renderer/src/components/ConversationView.tsx`
- `src/renderer/src/components/ResultsList.tsx`
- `src/renderer/src/components/FilterPanel.tsx`

---

## IPC Layer

### Payload changes

**`pty-spawn`** request: `PtySpawnOptions` gains `instanceId: string`

**`pty-input`** payload: `{ instanceId: string; data: string }`

**`pty-resize`** payload: `{ instanceId: string; cols: number; rows: number }`

**`pty-kill`** payload: `instanceId: string`

**`pty-data`** event pushed to renderer: `{ instanceId: string; data: string }`

**`pty-exit`** event pushed to renderer: `{ instanceId: string; code: number }`

New handlers:
- `get-settings` → returns `AppSettings`
- `set-settings` → saves `AppSettings`, returns `true`

### Main process (`main/index.ts`)

```
ptyManagers: Map<string, PtyManager>
```

- `pty-spawn`: look up or create `PtyManager` for `instanceId`; reject with `{ success: false, error: 'limit' }` if `ptyManagers.size >= settings.maxChatInstances`
- `pty-kill`: kill the named instance and delete from map
- `before-quit`: kill all instances in map

### Preload (`preload/index.ts`)

```ts
ptySpawn: (options: PtySpawnOptions) => Promise<{ success: boolean; error?: string }>
ptyInput: (instanceId: string, data: string) => void
ptyResize: (instanceId: string, cols: number, rows: number) => void
ptyKill: (instanceId: string) => Promise<boolean>
onPtyData: (cb: (instanceId: string, data: string) => void) => () => void
onPtyExit: (cb: (instanceId: string, code: number) => void) => () => void
getSettings: () => Promise<AppSettings>
setSettings: (s: Partial<AppSettings>) => Promise<boolean>
```

---

## UI / UX

### Sidebar — Active Chats section

Rendered above the search bar. Only shown when `chatInstances.length > 0`.

```
┌─────────────────────────┐
│ ● my-app       [→] [x]  │  ← active (green dot, typing indicator)
│ ⊘ api-server   [→] [x]  │  ← exited (gray dot, "Exited" badge)
├─────────────────────────┤
│ 🔍 Search...            │
│ Filter | Sort           │
│─────────────────────────│
│ Conv 1                  │
│ Conv 2                  │
└─────────────────────────┘
```

Each entry shows:
- Status dot: green pulsing (active) / gray (exited)
- Project name: `path.basename(cwd)` + profile emoji
- `[→]` focuses the instance in the right panel (sets `activeChatInstanceId`)
- `[x]` kills (if active) then removes from `chatInstances`
- Typing indicator (the existing dot animation) when `isClaudeTyping` is true

### Right panel

- If `activeChatInstanceId` is set: show `ChatTerminal` for that instance
- Else if `selectedConversation`: show `ConversationView`
- Else: empty state

Clicking `[→]` on a sidebar entry sets `activeChatInstanceId` and clears `selectedConversation`. Clicking a conversation in the list clears `activeChatInstanceId` and sets `selectedConversation`.

### Title bar

```
[+ Chat]  [gear]  · 42 conversations · 8 projects  [refresh]
```

Gear icon opens `SettingsModal`. The standalone `[Profiles]` button from `2026-03-06-profiles-overview-design.md` is dropped — profiles are managed inside Settings.

### SettingsModal

Centered overlay, two sections:

**Chat**
- "Max simultaneous instances": number input, 1–10, default 3
- Saved on blur / change

**Profiles**
- Full profiles management panel from `2026-03-06-profiles-overview-design.md` (profile cards, add/edit/delete)

---

## Instance limit enforcement

When the user triggers "new chat" or "chat in project" and `chatInstances.filter(i => i.status === 'active').length >= settings.maxChatInstances`:

- Show an inline message: *"Maximum of N active chats reached. Close one to start a new session."*
- Do not open `ProfilePickerModal`

Exited instances do not count toward the limit.

---

## Error Handling

| Scenario | Behavior |
|---|---|
| `pty-spawn` returns `{ error: 'limit' }` | Renderer shows inline limit message (belt-and-suspenders; limit also enforced in renderer) |
| Instance exits with non-zero code | Sidebar shows "Exited (N)" badge; right panel shows exit message in terminal |
| `settings.json` missing or malformed | Use defaults (`maxChatInstances: 3`) |
| User closes `[x]` on active instance | Calls `ptyKill(instanceId)` then removes from state on resolution |

---

## Out of Scope

- Persisting active chat sessions across app restarts
- Split-view layout showing two terminals simultaneously
- Per-instance terminal themes
- Drag-to-reorder sidebar entries
