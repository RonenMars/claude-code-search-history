---
phase: 03-provider-abstraction-codex-cli-provider
plan: 01
subsystem: api
tags: [typescript, vitest, tdd, provider-abstraction, interfaces]

# Dependency graph
requires: []
provides:
  - AssistantProvider interface contract in src/main/providers/types.ts
  - ProviderSession and Message type definitions
  - ProviderInfo type for get-providers IPC
  - Failing test stubs for ClaudeProvider (5 tests)
  - Failing test stubs for CodexProvider with JSONL fixture parsing (7 tests)
  - Failing test stubs for ProviderRegistry merge/sort/filter/routing (6 tests)
affects: [03-02, 03-03, 03-04]

# Tech tracking
tech-stack:
  added: []
  patterns: [TDD RED-GREEN-REFACTOR, provider abstraction interface pattern]

key-files:
  created:
    - src/main/providers/types.ts
    - src/main/providers/claude.test.ts
    - src/main/providers/codex.test.ts
    - src/main/providers/registry.test.ts
  modified: []

key-decisions:
  - "ProviderSession.id is the file path (stable unique key), not provider-native UUID"
  - "provider-native UUID stored in ProviderSession.sessionId for resumeCommand"
  - "Message type is provider-level (distinct from shared ConversationMessage)"
  - "messages: Message[] is empty until loadSession() is called (lazy loading)"

patterns-established:
  - "Provider pattern: all providers implement AssistantProvider interface from types.ts"
  - "TDD pattern: test stubs import non-existent modules to produce explicit RED state"
  - "JSONL fixture pattern: inline string constants for codex JSONL line types in tests"

requirements-completed: [PROVIDER-INTERFACE, CODEX-PROVIDER, PROVIDER-REGISTRY]

# Metrics
duration: 8min
completed: 2026-03-27
---

# Phase 3 Plan 01: Provider Type Contracts and Failing Test Stubs Summary

**AssistantProvider interface + ProviderSession/Message types locked in types.ts, with 18 failing test stubs covering all Wave 0 VALIDATION.md gaps across ClaudeProvider, CodexProvider, and ProviderRegistry**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-03-27T00:36:00Z
- **Completed:** 2026-03-27T00:37:53Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Provider type contract established: `AssistantProvider`, `ProviderSession`, `Message`, `ProviderInfo` exported from `src/main/providers/types.ts`
- 5 failing tests for ClaudeProvider: interface compliance, scanSessions provider field, resumeCommand with/without sessionId, isAvailable
- 7 failing tests for CodexProvider: all 4 JSONL line types (session_meta, event_msg, response_item, TokenCount), unknown type handling, resumeCommand, isAvailable
- 6 failing tests for ProviderRegistry: merge+sort by lastModified desc, disabled provider exclusion, Claude-only mode, auto-discovery, getSession routing, getProjects union
- All 399 prior tests remain passing; 3 new test files fail with "Cannot find module" (correct RED state)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create provider types contract** - `580b815` (feat)
2. **Task 2: Write failing test stubs** - `951c429` (test)

## Files Created/Modified
- `src/main/providers/types.ts` - AssistantProvider interface, ProviderSession, Message, ProviderInfo types
- `src/main/providers/claude.test.ts` - 5 failing tests for ClaudeProvider interface compliance
- `src/main/providers/codex.test.ts` - 7 failing tests for CodexProvider JSONL parsing (all 4 line types)
- `src/main/providers/registry.test.ts` - 6 failing tests for ProviderRegistry merge/sort and disabled provider exclusion

## Decisions Made
- `ProviderSession.id` is the file path (stable unique key), `sessionId` holds the provider-native UUID for resumeCommand — this distinction is critical for codex where `codex resume <sessionId>` uses UUID not path
- `messages: Message[]` is empty array at scan time, only populated on `loadSession()` — keeps scan fast
- `Message` is a new provider-level type, not an alias of the existing `ConversationMessage` in shared/types.ts

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- types.ts contract is locked and exported — Plan 02 (ClaudeProvider implementation) and Plan 03 (CodexProvider implementation) can proceed
- All 18 test behaviors are specified — implementations in Plans 02-04 must make them GREEN
- TypeScript compiles cleanly with no errors

---
*Phase: 03-provider-abstraction-codex-cli-provider*
*Completed: 2026-03-27*
