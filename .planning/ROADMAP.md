# Roadmap — claude-search (Electron)

## Milestone 1: List Interaction Polish

**Goal:** Fill the two UX gaps where Electron lags behind the IDE plugins — right-click context menus and keyboard-driven speed search on the conversation list.

---

### Phase 1: Context Menus on Conversation List Items

**Goal:** Right-clicking any conversation item shows a native OS context menu with quick actions, eliminating the need to open a conversation just to copy its ID or export it.

**Tasks:**
- Add `contextmenu` event listener to conversation list item elements in the renderer
- Send IPC message to main process with the target conversation's ID, session path, and title
- Build native `Menu` using Electron's `Menu.buildFromTemplate` in the main process
- Wire **Copy Session ID** action → `clipboard.writeText(sessionId)`
- Wire **Export as Markdown / JSON / Plain Text** actions → existing export flow (reuse current export handlers)
- Wire **Reveal in Finder** action → `shell.showItemInFolder(sessionPath)`
- Wire **Open in New Chat** action → existing "continue chat" IPC flow
- Add IPC channel `context-menu:show` in `src/main/index.ts`

**Success Criteria:**
- Right-clicking a conversation item shows a context menu on macOS, Windows, and Linux
- All 4 actions (Copy ID, Export ×3, Reveal in Finder, Open in New Chat) execute correctly
- Menu does not appear on right-click outside a conversation item

---

### Phase 2: Type-to-Filter Speed Search

**Goal:** When the conversation list has focus, typing characters immediately filters the visible items by title — matching IntelliJ's speed-search UX without requiring the user to reach for the search bar.

**Tasks:**
- Add `keydown` listener to the conversation list container component
- On printable character input (not modifier-only), show a speed-search overlay input pinned to the bottom of the list
- Filter visible conversation items in real time by title substring (case-insensitive) as the user types
- Append characters on continued typing; Backspace removes the last character
- Dismiss overlay and clear filter on `Escape` or after 1.5 s of no new input
- Ensure speed-search filter composes with the existing project/date/profile filters (i.e. applies on top of them)
- Persist nothing — speed search is always transient

**Success Criteria:**
- Typing while the list has focus opens the overlay and filters items immediately
- Backspace and Escape behave correctly
- Overlay auto-dismisses after 1.5 s of inactivity
- Speed search does not interfere with existing search bar (Cmd/Ctrl+F) or other keyboard shortcuts
