---
phase: 03-provider-abstraction-codex-cli-provider
plan: 03
subsystem: main-process
tags: [typescript, electron, ipc, provider-registry, integration]

# Dependency graph
requires:
  - phase: 03-02
    provides: ClaudeProvider, CodexProvider, ProviderRegistry implementations
provides:
  - ProviderRegistry wired into main process initializeSearch()
  - All IPC handlers using registry instead of direct ConversationScanner
  - get-providers and set-provider-enabled IPC channels
  - getProviders/setProviderEnabled/onProviderDetected in ElectronAPI preload
  - provider field flowing through ConversationMeta -> IndexedDocument -> SearchResult
  - providers filter parameter on search() and IPC search handler
affects: [03-04]

# Tech tracking
tech-stack:
  added: []
  patterns: [ProviderRegistry as main-process orchestrator, provider field passthrough pattern]

key-files:
  created: []
  modified:
    - src/shared/types.ts
    - src/main/services/indexer.ts
    - src/main/index.ts
    - src/preload/index.ts
    - src/main/providers/claude.ts
    - src/test/setup.ts

key-decisions:
  - "ProviderRegistry instantiated inside initializeSearch() with ClaudeProvider + CodexProvider — stateless, recreated on every re-scan"
  - "account field for claude sessions falls back to 'default' when ProviderSession has no account; non-claude providers use provider id as account"
  - "set-provider-enabled triggers full re-scan via initializeSearch() to ensure index reflects updated provider state"

requirements-completed: [MAIN-PROCESS-INTEGRATION, SETTINGS-EXTENSION, IPC-HANDLERS]

# Metrics
duration: ~15min
completed: 2026-03-27
---

# Phase 3 Plan 03: Main Process Integration Summary

**ProviderRegistry wired into initializeSearch() replacing ConversationScanner directly; all IPC handlers migrated to registry; get-providers and set-provider-enabled channels added; provider field flowing end-to-end through indexer to SearchResult**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-27T00:48:00Z
- **Completed:** 2026-03-27T01:03:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Replaced module-level `let scanner: ConversationScanner` with `let registry: ProviderRegistry` in `src/main/index.ts`
- Rewrote `initializeSearch()` to construct `ClaudeProvider` and `CodexProvider`, pass them to `ProviderRegistry`, call `registry.scanAll()`, and map `ProviderSession[]` to `ConversationMeta[]` for the indexer
- Migrated all 8 IPC handlers that previously called `scanner.*` to call `registry.*`
- Added `providers?: string[]` filter to the search IPC handler and indexer `search()` call
- Added two new IPC channels: `get-providers` (delegates to `registry.getProviderInfoList`) and `set-provider-enabled` (updates settings, re-scans)
- Extended `ElectronAPI` preload interface with `getProviders`, `setProviderEnabled`, `onProviderDetected`
- Types already extended (Task 1 was in prior commit `5c2239f`): `ConversationMeta.provider`, `SearchResult.provider`, `AppSettings.enabledProviders/providerPaths`, `UserPreferences.providerFilter`, `IndexedDocument.provider` in FlexSearch store

## Task Commits

1. **Task 1: Types and indexer** - `5c2239f` (feat — applied before this plan execution)
2. **Task 2: Main process wiring + TS fixes** - `7aa57c9` (feat)

## Files Created/Modified

- `src/shared/types.ts` - `provider?: string` on `ConversationMeta` and `SearchResult`; `enabledProviders`, `providerPaths` on `AppSettings`; `providerFilter` on `UserPreferences`
- `src/main/services/indexer.ts` - `provider` in `IndexedDocument`, FlexSearch store array, `buildIndex()`, `search()`, `getRecent()`; `providerFilter` parameter on `search()`
- `src/main/index.ts` - Full registry wiring: imports, module-level var, `initializeSearch()`, all IPC handlers, two new handlers
- `src/preload/index.ts` - `getProviders`, `setProviderEnabled`, `onProviderDetected` in interface and api object
- `src/main/providers/claude.ts` - Removed `private` keyword from constructor parameter shorthand (was causing TS6138 unused property error)
- `src/test/setup.ts` - Added `getProviders`, `setProviderEnabled`, `onProviderDetected` mocks to satisfy `ElectronAPI` type

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TS6138: unused private constructor parameter in ClaudeProvider**
- **Found during:** Task 2 TypeScript compilation
- **Issue:** `constructor(private profiles: Profile[])` stored `profiles` as a class field but never accessed `this.profiles` — only used it in `new ConversationScanner(profiles)`. TypeScript 5 strict mode reports TS6138.
- **Fix:** Changed `private profiles: Profile[]` to plain `profiles: Profile[]` in constructor signature
- **Files modified:** `src/main/providers/claude.ts`
- **Commit:** `7aa57c9`

**2. [Rule 2 - Missing functionality] Added ElectronAPI mocks for new methods in test setup**
- **Found during:** Task 2 TypeScript compilation
- **Issue:** `src/test/setup.ts` mock object was missing `getProviders`, `setProviderEnabled`, `onProviderDetected` required by `ElectronAPI` type
- **Fix:** Added vi.fn() mocks for all three new methods
- **Files modified:** `src/test/setup.ts`
- **Commit:** `7aa57c9`

## Verification

- `npm test`: 417 tests pass across 26 test files (no regressions)
- `npx tsc --noEmit --project tsconfig.node.json`: clean
- `npx tsc --noEmit`: clean
- `grep "scanner\."` in `src/main/index.ts`: zero results (all replaced with `registry.`)
- FlexSearch store array in `indexer.ts`: includes `'provider'`
- `src/preload/index.ts`: `getProviders`, `setProviderEnabled`, `onProviderDetected` present in both interface and api object
- Both new IPC channels (`get-providers`, `set-provider-enabled`) registered in `setupIpcHandlers()`

## Self-Check: PASSED

All modified files verified to exist, all commits confirmed present in git log.

---
*Phase: 03-provider-abstraction-codex-cli-provider*
*Completed: 2026-03-27*
