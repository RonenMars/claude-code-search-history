# Testing Report

## Summary

A comprehensive test suite was added to the project, going from **zero tests** to **244 tests across 13 test files**, all passing in **~2.7 seconds**.

---

## What Was Added

### Infrastructure
- **vitest.config.ts** — Test runner configuration (Vitest v4, v8 coverage provider, path aliases)
- **src/test/setup.ts** — Global setup mocking `window.electronAPI` and importing `@testing-library/jest-dom`
- **src/test/factories.ts** — Factory functions for all domain types (`buildSearchResult`, `buildConversation`, `buildMessage`, `buildProfile`, `buildWorktree`, tool result builders, etc.)
- **src/test/fixtures/*.jsonl** — 5 JSONL fixture files (sample-conversation, malformed, empty, meta-only, system-tags)

### Extracted Modules (for testability)
- **src/main/formatters.ts** — `formatAsMarkdown()` and `formatAsText()` extracted from `index.ts`
- **src/main/worktree-parser.ts** — `parseWorktrees()` extracted from `index.ts`

### Test Files

| File | Tests | Layer | What It Covers |
|------|-------|-------|----------------|
| `src/main/services/scanner.test.ts` | 55 | Integration | JSONL scanning, metadata extraction, content extraction, tool classification, LRU cache, system tag stripping, batch processing, multiple profiles |
| `src/main/services/indexer.test.ts` | 34 | Integration | FlexSearch indexing, search with query/filter/limit, preview generation, getRecent, getDailyStats (day/week/month), getStatsByAccount, deduplication |
| `src/main/index.test.ts` | 16 | Unit | formatAsMarkdown, formatAsText, parseWorktrees (via extracted modules) |
| `src/main/utils/execFileNoThrow.test.ts` | 4 | Integration | Successful/failed commands, stderr capture, non-existent commands |
| `src/preload/index.test.ts` | 37 | Contract | All 26 IPC channel mappings, event listener channels, send vs invoke usage, cleanup function, contextBridge exposure |
| `src/renderer/src/components/SearchBar.test.tsx` | 11 | Unit | Input rendering, onChange, clear button, focus-on-mount, spinner, Cmd+Shift+F shortcut, Escape blur |
| `src/renderer/src/components/MessageNavigation.test.tsx` | 17 | Unit | Position display, prev/next navigation, boundary disabled states, jump to first/last, jump-to-message input with clamping |
| `src/renderer/src/components/ActiveChatList.test.tsx` | 10 | Unit | Project display, profile emojis, exited badge, focus/close callbacks, multiple instances |
| `src/renderer/src/components/ErrorBoundary.test.tsx` | 4 | Unit | Normal rendering, fallback UI on error, custom fallback, recovery via "Try Again" |
| `src/renderer/src/components/ToolResultCard.test.tsx` | 13 | Unit | Dispatch to all 10 card types (edit, bash, glob, grep, read, write, taskAgent, taskCreate, taskUpdate, generic), empty array, interrupted badge, multiple results |
| `src/renderer/src/components/ResultsList.test.tsx` | 15 | Unit | Empty states, flat list rendering, account filtering, profile badges, live/typing/awaiting-reply indicators, search highlighting, grouped list |
| `src/renderer/src/components/MessageContent.test.tsx` | 22 | Unit | Markdown rendering (bold, italic, headings, lists, links, inline code, code blocks, tables, blockquotes), JSON detection, collapse/expand, search highlighting (case-insensitive, empty, not-found, code blocks), clipboard copy |
| `src/renderer/src/hooks/useSearch.test.ts` | 6 | Unit | Initial state, debounced search, query filtering, project filter, error handling, refresh |

**Total: 244 tests**

---

## Coverage Summary

| Module | Statements | Branch | Target Met? |
|--------|-----------|--------|-------------|
| Scanner (`scanner.ts`) | 90.5% | ~79% | >90% stmt |
| Indexer (`indexer.ts`) | 97.5% | ~95% | >95% |
| Formatters (`formatters.ts`) | 100% | 100% | 100% |
| Worktree parser (`worktree-parser.ts`) | 96.15% | ~92% | >95% |
| `execFileNoThrow` | 100% | 100% | 100% |
| SearchBar | 100% | ~95% | 100% |
| MessageNavigation | 100% | ~98% | 100% |
| ActiveChatList | 100% | ~95% | 100% |
| ErrorBoundary | 100% | 100% | 100% |
| useSearch hook | 100% | ~90% | 100% |
| MessageContent | ~78% | ~65% | >75% |
| ResultsList | ~77% | ~60% | >70% |
| ToolResultCard | ~93% | ~85% | >90% |

---

## Remaining Uncovered Risk Areas

### Not Covered (with justification)

| Area | Reason | Risk Level |
|------|--------|------------|
| **main/index.ts IPC handlers** | Tightly coupled to Electron `ipcMain`, `dialog`, `app` — requires full Electron test harness or heavy mocking | Medium |
| **PtyManager** | Requires `node-pty` native module; high setup cost for test environment | Low (isolated module) |
| **ChatTerminal** | Wraps `xterm.js` terminal emulator; not meaningfully testable in jsdom | Low |
| **ConversationView** | 1300+ lines with virtualized message list; partially covered by ToolResultCard + MessageContent tests | Medium |
| **FilterPanel** | Complex autocomplete with DOM event listeners; testable but lower priority | Low-Medium |
| **App.tsx** | 860-line orchestrator; mostly wiring between components. Best tested via E2E | Medium |

---

## Flaky / Blocked Tests

| Test | Status | Reason |
|------|--------|--------|
| None | N/A | No flaky tests detected |

### Flake Prevention Measures In Place
- `vi.useFakeTimers()` for all debounce tests (no real timer races)
- Temp directory cleanup in `afterEach` for scanner tests
- Factory counter reset prevents ID collisions
- `@tanstack/react-virtual` mocked to bypass jsdom layout limitations
- No network calls — all IPC mocked at preload boundary
- Static JSONL fixtures, not generated data

---

## Key Technical Decisions

1. **`// @vitest-environment jsdom` docblock** — Required in Vitest v4 (the `environmentMatchGlobs` config option was removed). Every renderer test file uses this.

2. **Virtualizer mock** — `@tanstack/react-virtual`'s `useVirtualizer` returns zero items in jsdom (no layout engine). We mock it with a pass-through that renders all items directly.

3. **Preload contract tests via source analysis** — Since `contextBridge` is unavailable outside Electron, preload tests read the TypeScript source and verify IPC channel strings + patterns via string matching.

4. **Pure function extraction** — `formatAsMarkdown`, `formatAsText`, and `parseWorktrees` were extracted from the monolithic `index.ts` into separate modules for direct unit testing without Electron runtime.

---

## Recommended Next Steps

1. **Playwright + Electron E2E** — Critical user flows (app launch, search, filter, open conversation, continue chat) should be smoke-tested in a real Electron window.
2. **FilterPanel component tests** — Autocomplete behavior, keyboard navigation, Enter/Escape handling.
3. **ConversationView component tests** — Export flow, message navigation integration, scroll behavior.
4. **PtyManager integration tests** — Mock `node-pty` spawn/kill to test the SIGINT/SIGKILL double-kill pattern.
5. **CI integration** — Add test step to CI pipeline (see commands below).

---

## Commands

### Run locally
```bash
# Run all tests
npx vitest run

# Run in watch mode
npx vitest

# Run with coverage report
npx vitest run --coverage

# Run a specific test file
npx vitest run src/main/services/scanner.test.ts

# Run tests matching a pattern
npx vitest run -t "parseWorktrees"
```

### CI pipeline
```bash
# Install dependencies
pnpm install --frozen-lockfile

# Run tests (exits non-zero on failure)
npx vitest run

# Run with coverage and fail if thresholds not met (optional)
npx vitest run --coverage
```

Add to your CI config (e.g., GitHub Actions):
```yaml
- name: Test
  run: |
    pnpm install --frozen-lockfile
    npx vitest run
```
