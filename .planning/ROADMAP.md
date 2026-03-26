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

---

## Milestone 2: Multi-Assistant Support

**Goal:** Extend the session browser to index, search, and display sessions from multiple AI coding assistants (Codex CLI, Continue.dev, OpenCode, Amazon Q, Aider) alongside Claude Code sessions.

---

### Phase 3: Provider Abstraction + Codex CLI Provider

**Goal:** Establish the provider pattern with the first non-Claude provider (OpenAI Codex CLI), validating the architecture before adding more providers.

**Plans:** 4 plans

Plans:
- [x] 03-01-PLAN.md — Provider types (AssistantProvider interface, ProviderSession/Message types) + Wave 0 failing test stubs
- [ ] 03-02-PLAN.md — Core provider implementations (ClaudeProvider, CodexProvider, ProviderRegistry) — makes Wave 0 tests GREEN
- [ ] 03-03-PLAN.md — Main process integration (refactor initializeSearch, update IPC handlers, extend shared types and indexer)
- [ ] 03-04-PLAN.md — UI layer (provider badge in ResultsList, provider filter in FilterPanel, Providers section in SettingsModal)

**Success Criteria:**
- Codex sessions appear alongside Claude sessions in the list
- Provider badge distinguishes them visually
- Provider filter works correctly
- Claude behavior unchanged when Codex is disabled or not installed
- All existing tests pass

---

### Phase 4: Continue.dev + OpenCode Providers

**Goal:** Add the two next-priority providers (Continue.dev JSON format and OpenCode SQLite).

**Tasks:**
- Create `src/main/providers/continue.ts`:
  - Scan `~/.continue/sessions/sessions.json` index for session metadata
  - Load individual `~/.continue/sessions/<uuid>.json` for full message content
  - Map `ChatHistoryItem[]` → `Message[]`
  - No CLI resume — show "Open in IDE" notification
- Create `src/main/providers/opencode.ts`:
  - Locate `~/.local/share/opencode/<project-hash>/sessions.db`
  - Use `better-sqlite3` (already available in Electron) to query `session`, `message`, `part` tables
  - Reconstruct message content from `part.data` discriminated union
  - Fail gracefully if `sessions.db` absent
- Register both providers in `ProviderRegistry`

**Success Criteria:**
- Continue and OpenCode sessions indexed and searchable
- SQLite reader fails gracefully when no DB present
- Provider badges and filters work for all 3 providers

---

### Phase 5: Amazon Q + Aider Providers (Optional)

**Goal:** Cover the Tier 2/3 tools for completeness.

**Tasks:**
- Create `src/main/providers/amazonq.ts`:
  - Query `~/.local/share/amazon-q/data.sqlite3` → `conversations` table
  - Deserialize `history: HistoryEntry[]` into messages
  - `resumeCommand`: `q chat --resume`
- Create `src/main/providers/aider.ts`:
  - Walk workspace paths for `.aider.chat.history.md` files
  - Parse markdown: split on `# aider chat started at <datetime>` headers → sessions
  - Split on `> ` prefix → user messages; remainder → assistant

**Success Criteria:**
- Q sessions and Aider transcripts browsable in the app
- Aider parser handles append-only multi-session files correctly
