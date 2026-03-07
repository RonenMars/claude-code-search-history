# Testing Strategy

## Current State Audit

### Before This Work
- **No test framework** installed
- **No test files** in the repository
- **No CI test scripts** configured
- Zero automated test coverage

### Architecture Summary
- **Electron + React + TypeScript** desktop app built with `electron-vite`
- **Main process:** scanner (JSONL parsing), indexer (FlexSearch), PTY manager, IPC handlers, persistence
- **Preload:** contextBridge API surface (~30 methods)
- **Renderer:** React 18 components with virtualized lists, markdown rendering, tool card dispatch
- **Shared:** TypeScript type definitions

---

## Test Pyramid

```
         /-----------\
         |   E2E     |  Smoke tests (blocked: requires Electron runtime)
         |  (0)      |
         |-----------|
         | Integr.   |  Scanner + real JSONL fixtures, Indexer + FlexSearch
         |  (~60)    |
         |-----------|
         |  Unit     |  Pure functions, React components, hooks
         |  (~180)   |
         \-----------/
```

### What is tested at each layer

| Layer | Scope | Environment |
|-------|-------|------------|
| **Unit** | Pure functions (formatters, parsers, highlight), React components, hooks | Node / jsdom |
| **Integration** | Scanner with real temp-dir file I/O, Indexer with FlexSearch, preload contract | Node |
| **E2E** | Not yet -- requires Playwright + Electron setup | Electron |

---

## What Should Be Unit vs Integration vs E2E

### Unit Tests (jsdom / node)
- React components: SearchBar, FilterPanel, ResultsList, MessageContent, etc.
- Hooks: useSearch
- Pure functions: formatAsMarkdown, formatAsText, parseWorktrees, highlightText, escapeHtml
- Tool result classification logic

### Integration Tests (node)
- ConversationScanner with real filesystem fixtures
- SearchIndexer with FlexSearch (real library, no mocks)
- execFileNoThrow with real system commands

### E2E Tests (future)
- App launch + initial scan
- Search + filter + open conversation flow
- Continue/resume chat flow

---

## Fixture Strategy

- **JSONL fixtures** in `src/test/fixtures/`:
  - `sample-conversation.jsonl` -- complete happy-path conversation with tool uses
  - `malformed.jsonl` -- mix of valid and invalid JSON lines
  - `empty.jsonl` -- empty file
  - `meta-only.jsonl` -- only isMeta entries (should produce 0 messages)
  - `system-tags.jsonl` -- content with system tags to test stripping

- **Factory functions** in `src/test/factories.ts`:
  - `buildConversationMeta()`, `buildConversation()`, `buildSearchResult()`
  - `buildProfile()`, `buildWorktree()`, `buildGitInfo()`
  - `buildEditToolResult()`, `buildBashToolResult()`, etc.
  - All accept override objects for composability

---

## Mock Strategy

### What We Mock
- `window.electronAPI` -- mocked in `src/test/setup.ts` for all renderer tests
- `@tanstack/react-virtual` -- mocked in ResultsList tests (jsdom has no layout engine)
- `navigator.clipboard` -- mocked for copy tests

### What We Do NOT Mock
- FlexSearch library (used directly in indexer tests)
- Filesystem in scanner tests (use real temp directories)
- React components under test (no shallow rendering)
- `execFile` in execFileNoThrow tests (tests real commands)

### Boundary Principle
Mock only at true system boundaries (IPC, Electron APIs, filesystem edge). Keep business logic tests as real as possible.

---

## Flake Prevention Strategy

1. **No real timers in tests** -- `vi.useFakeTimers()` for debounce tests
2. **Temp directory cleanup** -- `afterEach` removes temp dirs in scanner tests
3. **Factory counter reset** -- `resetFactoryCounter()` prevents ID collisions
4. **`@vitest-environment jsdom`** docblock on renderer tests -- explicit, no magic config
5. **No network calls** -- all IPC mocked at the preload boundary
6. **Deterministic fixtures** -- static JSONL files, not generated data

---

## Coverage Targets by Layer

| Module | Target | Current |
|--------|--------|---------|
| Scanner (scanner.ts) | >90% | 90.5% |
| Indexer (indexer.ts) | >95% | 97.5% |
| Formatters | 100% | 100% |
| Worktree parser | >95% | 96.15% |
| execFileNoThrow | 100% | 100% |
| SearchBar | 100% | 100% |
| MessageNavigation | 100% | 100% |
| ActiveChatList | 100% | 100% |
| ErrorBoundary | 100% | 100% |
| useSearch hook | 100% | 100% |
| MessageContent | >75% | 78.3% |
| ResultsList | >70% | 76.8% |
| ToolResultCard | >90% | 92.85% |

---

## Gaps / Risks / Blocked Areas

### Not Covered (and why)
- **main/index.ts IPC handlers** -- tightly coupled to Electron ipcMain, dialog, app. Would need Electron test harness.
- **PtyManager** -- requires node-pty native module. Could be tested with integration test but high setup cost.
- **ChatTerminal** -- wraps xterm.js terminal emulator. Not meaningfully testable in jsdom.
- **ConversationView** -- 1300+ line component with virtualized message list. Partial coverage via ToolResultCard and MessageContent tests.
- **FilterPanel** -- complex autocomplete with DOM event listeners. Testable but lower priority.
- **App.tsx** -- orchestrator component, mostly wiring. Best tested via E2E.

### Recommended Future Work
1. Playwright + Electron E2E for critical user flows
2. PtyManager integration tests with mocked node-pty
3. FilterPanel component tests (autocomplete behavior)
4. ConversationView component tests (export flow, message navigation integration)
