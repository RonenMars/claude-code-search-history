---
phase: 03-provider-abstraction-codex-cli-provider
plan: 02
subsystem: api
tags: [typescript, vitest, tdd, provider-abstraction, codex, claude, registry]

# Dependency graph
requires:
  - phase: 03-01
    provides: AssistantProvider interface, ProviderSession/Message types, failing test stubs
provides:
  - ClaudeProvider implementing AssistantProvider (wraps ConversationScanner)
  - CodexProvider implementing AssistantProvider (JSONL streaming parser)
  - ProviderRegistry aggregating multiple providers with merge/sort/routing
  - All 18 Wave 0 test stubs from Plan 01 turned GREEN
affects: [03-03, 03-04]

# Tech tracking
tech-stack:
  added: []
  patterns: [provider adapter pattern, TDD RED-GREEN, readline streaming JSONL parsing]

key-files:
  created:
    - src/main/providers/claude.ts
    - src/main/providers/codex.ts
    - src/main/providers/registry.ts
  modified: []

key-decisions:
  - "ProviderRegistry constructor takes providers array (not profiles) — matches test contract, registry is agnostic to creation details"
  - "CodexProvider.parseLines() is public for testability — tests call it directly with line arrays instead of touching disk"
  - "ProviderRegistry.discoverNewProviders() is a separate public method — called within scanAll() and also directly testable"

patterns-established:
  - "Provider adapter pattern: each provider wraps its own scanner and maps to ProviderSession[] independently"
  - "parseLines() pattern: CodexProvider exposes its line parser as a public testable method taking (filePath, lines[])"

requirements-completed: [PROVIDER-INTERFACE, CLAUDE-PROVIDER, CODEX-PROVIDER, PROVIDER-REGISTRY]

# Metrics
duration: 15min
completed: 2026-03-27
---

# Phase 3 Plan 02: Provider Implementations Summary

**ClaudeProvider wrapping ConversationScanner, CodexProvider with readline JSONL streaming for all 4 line types, and ProviderRegistry with merge/sort/route — 417 tests GREEN**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-27T00:40:00Z
- **Completed:** 2026-03-27T00:55:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- ClaudeProvider wraps ConversationScanner, maps ConversationMeta to ProviderSession with provider='claude'
- CodexProvider parses all 4 Codex JSONL line types: session_meta, event_msg, response_item, TokenCount
- ProviderRegistry merges sessions from all enabled providers, sorts by lastModified desc, routes getSession() to the correct provider
- All 18 failing Wave 0 test stubs from Plan 01 turned GREEN; 417 total tests pass with no regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement ClaudeProvider and CodexProvider** - `339bfe1` (feat)
2. **Task 2: Implement ProviderRegistry** - `9bf1d93` (feat)

## Files Created/Modified
- `src/main/providers/claude.ts` - ClaudeProvider implementing AssistantProvider; wraps ConversationScanner, maps meta to ProviderSession, resumeCommand returns `claude --resume <sessionId>`
- `src/main/providers/codex.ts` - CodexProvider implementing AssistantProvider; readline streaming JSONL parser for Codex format, public parseLines() for testability
- `src/main/providers/registry.ts` - ProviderRegistry aggregating providers; scanAll(), getSession(), discoverNewProviders(), getProjects()

## Decisions Made
- ProviderRegistry constructor takes `providers: AssistantProvider[]` rather than profiles — the test contract drives this; callers at the index.ts level instantiate providers before passing them in
- `parseLines()` on CodexProvider is made public so tests can call it directly with fixture line arrays without disk I/O
- `discoverNewProviders()` extracted as a public method on ProviderRegistry so it's directly testable and callable from scanAll()

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All three provider modules implement AssistantProvider interface and are tested
- ClaudeProvider and CodexProvider ready for wiring into index.ts (Plan 03)
- ProviderRegistry ready to replace direct ConversationScanner usage in main process IPC handlers
- TypeScript compiles cleanly across all provider files

---
*Phase: 03-provider-abstraction-codex-cli-provider*
*Completed: 2026-03-27*
