# Test Coverage Plan — Vitest + Playwright/Electron

## Status Legend
- [x] Implemented
- [ ] Planned
- [-] Blocked (reason noted inline)

---

## 1. SEARCH ENGINE

### Vitest (scanner.test.ts — 41 tests, indexer.test.ts — 34 tests, useSearch.test.ts — 6 tests)

- [x] Scanner: metadata extraction from JSONL conversations
- [x] Scanner: batched scan behavior
- [x] Scanner: progress callback invocation
- [x] Scanner: malformed entry handling
- [x] Indexer: indexing metadata snippets correctly
- [x] Indexer: search result ranking basics
- [x] Indexer: case-insensitive matching
- [x] Indexer: empty query behavior
- [x] Scanner: LRU cache behavior for full conversation loading
- [x] useSearch: debounce behavior
- [x] useSearch: query updates
- [x] useSearch: error handling
- [ ] useSearch: filter composition (project + account filters)
- [ ] useSearch: clear/reset behavior

### Playwright (e2e/app.spec.ts)

- [x] App window opens
- [x] Search bar is visible
- [x] Can type in search bar
- [x] App launches, scan completes, results appear
- [x] Typing in search updates results after debounce
- [x] Clearing search restores default results
- [x] Cmd+Shift+F focuses search
- [x] Escape blurs search
- [x] No-results empty state appears
- [ ] Matched terms are highlighted in results
- [ ] Search remains usable with large virtualized result sets

---

## 2. FILTERING AND SORTING

### Vitest (FilterPanel.test.tsx — 26 tests)

- [x] FilterPanel: renders sort/date-range dropdowns with all options
- [x] FilterPanel: sort change calls onSortChange
- [x] FilterPanel: date range change calls onDateRangeChange
- [x] FilterPanel: project autocomplete opens on focus
- [x] FilterPanel: autocomplete filters projects as user types
- [x] FilterPanel: arrow keys navigate autocomplete
- [x] FilterPanel: Enter selects project
- [x] FilterPanel: Escape closes autocomplete
- [x] FilterPanel: "All Projects" selects empty string
- [x] FilterPanel: profile filter appears only with multiple profiles
- [x] FilterPanel: profile filter calls onAccountFilterChange
- [x] FilterPanel: disabled state prevents interaction
- [x] FilterPanel: "Chat in this project" button appears when project selected
- [x] HighlightedPath: highlights matching substring

### Playwright (e2e/app.spec.ts)

- [x] Sort dropdown has 5 options
- [x] Date range dropdown has 4 options
- [ ] Sort modes reorder results correctly
- [ ] Date range filters narrow results
- [ ] Search + filters + sort compose correctly

---

## 3. RESULTS LIST / SIDEBAR

### Vitest (ResultsList.test.tsx — 19 tests)

- [x] Empty states (no query, no results)
- [x] Flat list rendering
- [x] Result selection
- [x] Account filtering
- [x] Profile badges
- [x] Live/Typing indicators
- [x] Search highlighting in previews
- [x] Grouped list by project

### Playwright (e2e/app.spec.ts)

- [x] Selecting a result opens conversation view
- [ ] Virtualized list scrolling to offscreen items
- [-] Sidebar width persists across relaunch
  > **Blocked:** Requires relaunch fixture.
- [ ] Grouped-by-project view works with real data

---

## 4. CONVERSATION VIEWER — CORE

### Vitest

- [x] MessageNavigation: prev/next/first/last (17 tests)
- [ ] ConversationView: export serializers (markdown, JSON, text)
- [ ] ConversationView: copy message text extraction

### Playwright

- [x] Opening a conversation shows content (via result selection test)
- [ ] Messages appear in correct order
- [ ] Navigation works (prev/next/first/last)
- [ ] Export actions work from user perspective

---

## 5. CONVERSATION VIEWER — RICH RENDERING

### Vitest (MessageContent.test.tsx — 22 tests, ToolResultCard.test.tsx — 13 tests, ToolInvocationBadge.test.tsx — 31 tests)

- [x] Markdown headings, lists, tables, blockquotes, links, emphasis
- [x] Code block rendering with language labels
- [x] JSON block recognition and expand/collapse
- [x] Search highlighting
- [x] ToolResultCard dispatch (all tool types)
- [x] ToolInvocationBadge: getShortToolName MCP parsing
- [x] ToolInvocationBadge: getKeyParam extraction per tool type
- [x] ToolInvocationBadge: getToolIcon mapping for all 11+ tool types
- [x] ToolInvocationBadge: MCP tool param fallback chain
- [x] ToolInvocationBadge: Bash command truncation at 40 chars

### Playwright

- [ ] Markdown renders correctly in the real app
- [ ] Code blocks show copy controls
- [ ] JSON blocks expand/collapse
- [ ] Tool result cards render for supported types

---

## 6. EMBEDDED CHAT / PTY / XTERM

### Vitest (pty-manager.test.ts — 16 tests, ActiveChatList.test.tsx — 10 tests)

- [x] PtyManager: spawn, data, exit lifecycle
- [x] PtyManager: stale process guard
- [x] PtyManager: two-phase kill
- [x] PtyManager: resume command construction
- [x] PtyManager: registry identity guard
- [x] ActiveChatList: rendering, profile badges, focus/close callbacks

### Playwright

- [-] Start new chat, terminal opens, PTY output appears
  > **Blocked:** Requires real `claude` CLI or test-mode seam. Smallest change: add `CLAUDE_SEARCH_PTY_CMD` env override in PtyManager.
- [-] Stop/force-stop behavior
  > **Blocked:** Same as above.

---

## 7. PROFILES

### Vitest (ProfilesPanel.test.tsx — 10 tests, ProfilePickerModal.test.tsx — 7 tests)

- [x] ProfilesPanel: renders profile cards for each profile
- [x] ProfilesPanel: shows empty state when no profiles
- [x] ProfilesPanel: displays usage stats (conversations, projects, messages, tokens)
- [x] ProfilesPanel: delete calls onProfilesSaved with filtered list
- [x] ProfilesPanel: Add Profile button opens modal
- [x] ProfilesPanel: Edit button opens edit modal
- [x] ProfilesPanel: disables delete for only enabled profile
- [x] ProfilePickerModal: renders enabled profiles with emoji and label
- [x] ProfilePickerModal: filters out disabled profiles
- [x] ProfilePickerModal: calls onSelect with profile
- [x] ProfilePickerModal: Cancel button calls onCancel
- [x] ProfilePickerModal: "Remember my choice" checkbox toggleable

### Playwright

- [ ] Profiles panel renders
- [ ] Add/edit/delete profile flows
- [-] Profile persistence survives relaunch
  > **Blocked:** Requires relaunch fixture.

---

## 8. GIT / WORKTREES

### Vitest (worktree-parser.test.ts — 8 tests, plus 7 in index.test.ts)

- [x] parseWorktrees: parsing, HEAD, branch extraction
- [x] parseWorktrees: detached HEAD handling
- [x] parseWorktrees: all worktrees share projectPath/projectName
- [x] parseWorktrees: HEAD truncation, refs/heads/ stripping
- [x] parseWorktrees: malformed block skipping
- [x] parseWorktrees: empty input
- [x] WorktreesPanel: renders grouped worktrees by project
- [x] WorktreesPanel: main vs linked display
- [x] WorktreesPanel: loading and empty states
- [x] WorktreesPanel: "Open Chat" button calls callback with worktree path
- [x] WorktreesPanel: copy button copies branch to clipboard
- [x] WorktreesPanel: multiple projects group correctly
- [x] WorktreesPanel: refresh reloads worktrees
- [x] WorktreesPanel: main worktree has no "Open Chat" button

### Playwright

- [ ] Worktrees panel shows grouped worktrees
- [-] "Chat in worktree" starts chat in correct cwd
  > **Blocked:** Requires real git repo + PTY seam.

---

## 9. SETTINGS AND PREFERENCES

### Vitest (SettingsModal.test.tsx — 14 tests)

- [x] SettingsModal: renders Settings heading
- [x] SettingsModal: max chat instances input reflects value
- [x] SettingsModal: group by project toggle reflects value
- [x] SettingsModal: changing max instances calls onSave
- [x] SettingsModal: toggling group by project calls onSave
- [x] SettingsModal: close button calls onClose
- [x] SettingsModal: default profile display and clear
- [x] SettingsModal: clamps max instances to minimum of 1

### Playwright

- [x] Settings page opens via gear button
- [-] Settings persistence survives relaunch
  > **Blocked:** Requires relaunch fixture.

---

## 10. ERROR HANDLING / RESILIENCE

### Vitest (ErrorBoundary.test.tsx — 4 tests, formatters.test.ts — 11 tests)

- [x] Error boundary catches render errors
- [x] Recovery via "Try Again"
- [x] Formatters: unicode content handling
- [x] Formatters: markdown special characters pass-through
- [x] Formatters: null/undefined timestamp fallback
- [x] Formatters: empty content strings
- [x] Formatters: system/assistant message role labels
- [x] Formatters: correct separator format between messages

### Playwright

- [x] No-results empty state renders (via empty state test)
- [ ] Malformed conversation file does not crash the app

---

## 11. KEYBOARD / ACCESSIBILITY

### Vitest

- [x] SearchBar: Cmd+Shift+F, Escape (11 tests)
- [x] MessageNavigation: keyboard navigation (17 tests)
- [x] FilterPanel: keyboard interaction — arrow keys, Enter, Escape (26 tests)

### Playwright

- [x] Cmd+Shift+F focuses search
- [x] Escape blurs search
- [ ] Tab order across primary controls
- [ ] Escape closes popovers/modals

---

## Summary

### Implemented
| Layer | Files | Tests |
|-------|-------|-------|
| Vitest | 22 files | 383 tests |
| Playwright | 1 file | ~14 tests |
| **Total** | **23 files** | **~397 tests** |

### New tests added this session
| File | Tests | Layer |
|------|-------|-------|
| `FilterPanel.test.tsx` | 26 | Vitest |
| `ToolInvocationBadge.test.tsx` | 31 | Vitest |
| `formatters.test.ts` | 11 | Vitest |
| `worktree-parser.test.ts` | 8 | Vitest |
| `ProfilePickerModal.test.tsx` | 7 | Vitest |
| `ProfilesPanel.test.tsx` | 10 | Vitest |
| `SettingsModal.test.tsx` | 14 | Vitest |
| `WorktreesPanel.test.tsx` | 12 | Vitest |
| `e2e/app.spec.ts` (expanded) | +11 | Playwright |

### Remains Blocked
| Area | Reason | Smallest Seam |
|------|--------|---------------|
| PTY E2E tests | Needs real `claude` CLI | Add `CLAUDE_SEARCH_PTY_CMD` env override |
| Relaunch persistence | No relaunch fixture | Add `app.close()` + `electron.launch()` helper |

### Highest Risk / Most Important for Regression
1. **Search + filter composition** — core user workflow, limited E2E coverage for filter interaction
2. **Conversation viewer rendering** — complex component, only unit-tested for individual pieces
3. **PTY lifecycle** — well unit-tested but no integration coverage
4. **Profile CRUD UI** — now unit-tested, but no E2E integration

### Next Priority
1. Vitest: useSearch filter composition tests
2. Playwright: conversation viewer navigation + rendering with real data
3. Playwright: profile management flows
4. Add PTY test seam for deterministic E2E chat tests
