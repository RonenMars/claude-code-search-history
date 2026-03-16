# Phase 1 Plan: Context Menus on Conversation List Items

## Goal
Right-clicking any conversation item shows a native OS context menu with quick actions.

## Key Architectural Constraints
- Electron context isolation is ACTIVE — renderer cannot call Electron APIs directly
- All menu construction must happen in the main process
- Flow: renderer → preload (contextBridge) → main (ipcMain.handle) → Menu.popup()
- The `ipcRenderer.send` (one-way) is preferred over `invoke` for context menu since
  the renderer doesn't need a return value

## Tasks

### Task 1: IPC Setup
**Files:** `src/main/index.ts`, `src/preload/index.ts`, `src/preload/index.d.ts`

- Add `context-menu:show` handler in main using `ipcMain.on` (one-way, no reply needed)
- Expose `showContextMenu(data: ContextMenuData)` via contextBridge in preload
- Add `ContextMenuData` type and `showContextMenu` to `ElectronAPI` interface in `index.d.ts`

### Task 2: Main Process Menu
**File:** `src/main/index.ts`

The `context-menu:show` handler receives `{ sessionId, sessionPath, title }` and:
1. Builds a `Menu` using `Menu.buildFromTemplate`
2. Items:
   - "Copy Session ID" → `clipboard.writeText(sessionId)`
   - "Export as Markdown" → triggers existing `export-conversation` flow (needs sessionId mapped to conversation id)
   - "Export as JSON" → same
   - "Export as Plain Text" → same
   - separator
   - "Reveal in Finder" → `shell.showItemInFolder(sessionPath)`
   - "Open in New Chat" → sends `context-menu:continue-chat` back to renderer
3. Calls `menu.popup({ window: BrowserWindow.fromWebContents(event.sender)! })`

**Important:** Export actions need the conversation `id` (not just sessionId). The payload
should include `id` as well, OR we call the export IPC inline. Simplest: include `id` in the
payload and call the existing `export-conversation` handler directly from main.

For "Open in New Chat": send `context-menu:continue-chat` back to the renderer via
`event.sender.send(...)`, which triggers the existing `handleContinueChat` flow in App.tsx.
The renderer must listen for this event and wire it to `handleContinueChat`.

### Task 3: Renderer Integration
**File:** `src/renderer/src/components/ResultsList.tsx`

- Add `onContextMenu` prop to `ResultsListProps`: `onContextMenu: (data: ContextMenuData) => void`
- Wire it into `ResultItem`: add `onContextMenu` to `ResultItemProps`, attach handler to the
  `<button>` element
- Handler calls `window.electronAPI.showContextMenu(data)` with `{ id, sessionId, sessionPath, title }`
- Must use `e.preventDefault()` to suppress the browser's default context menu

**App.tsx integration:**
- Pass `handleContextMenu` callback to `<ResultsList>`
- `handleContextMenu` calls `window.electronAPI.showContextMenu(data)`
- Listen for `context-menu:continue-chat` event from main and wire to `handleContinueChat`

## Data Shape
```typescript
interface ContextMenuData {
  id: string          // conversation id (for export)
  sessionId: string   // display + copy action
  sessionPath: string // for Reveal in Finder
  title: string       // for future use / display
  projectPath: string // for Open in New Chat
  account?: string    // for profile-aware continue-chat
}
```

## Testing Strategy
- `src/preload/index.test.ts`: verify `context-menu:show` channel is present, `showContextMenu` method
- `src/renderer/src/components/ResultsList.test.tsx`: verify `onContextMenu` is called with correct data on right-click
- `src/main/index.test.ts`: context menu handler test (source-level channel name check)

## Risk: Export flow from context menu
The existing export flow shows a save dialog and needs `scanner` to be initialized.
We can call the handler logic directly from the `context-menu:show` handler.
Simplest approach: emit the `export-conversation` IPC call FROM the renderer side when
the user picks an export option. But since Menu items run in main, we need to send a
message back to renderer or call the export logic inline.

Decision: Call export logic inline in main (same code path as the `export-conversation` handler).
This avoids a second round-trip and keeps things clean.
