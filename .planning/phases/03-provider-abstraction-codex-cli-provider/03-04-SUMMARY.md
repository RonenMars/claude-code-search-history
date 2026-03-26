---
phase: 03-provider-abstraction-codex-cli-provider
plan: 04
subsystem: ui
tags: [typescript, react, electron, provider-badge, provider-filter, settings]

# Dependency graph
requires:
  - phase: 03-03
    provides: getProviders/setProviderEnabled/onProviderDetected in ElectronAPI preload; provider field on SearchResult; ProviderRegistry IPC channels
provides:
  - providerFilter and enabledProviders state in App.tsx wired to FilterPanel and ResultsList
  - Provider filter checkboxes in FilterPanel (conditional on 2+ providers)
  - Provider badge on non-claude sessions in ResultsList
  - Providers section in SettingsModal with enable/disable toggle per provider
  - Auto-discovery notification banner in sidebar
  - New-chat button and context menu "Open in New Chat" hidden for non-claude sessions
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns: [provider-aware UI — badge/filter/settings conditional on enabledProviders.length]

key-files:
  created: []
  modified:
    - src/renderer/src/App.tsx
    - src/renderer/src/components/FilterPanel.tsx
    - src/renderer/src/components/ResultsList.tsx
    - src/renderer/src/components/SettingsModal.tsx
    - src/main/index.ts

key-decisions:
  - "showProviderBadge computed as enabledProviders.length > 1 OR single provider that is not claude — covers edge case of codex-only install"
  - "New-chat button hidden via result.provider check in ResultItem; context menu 'Open in New Chat' omitted via spread conditional in menu template"
  - "ContextMenuData extended with provider field so main process can gate menu items without re-fetching session"
  - "availableProviders state stored separately from enabledProviders so SettingsModal can show all detected providers including disabled ones"

requirements-completed: [PROVIDER-BADGE-UI, PROVIDER-FILTER-UI, SETTINGS-UI, CONTINUE-CHAT-HIDDEN-FOR-CODEX]

# Metrics
duration: ~20min
completed: 2026-03-27
---

# Phase 3 Plan 04: Renderer UI — Provider Badge, Filter, and Settings Summary

**Provider badge on Codex sessions, provider filter checkboxes in FilterPanel, Providers section in SettingsModal with enable/disable toggles, and new-chat hidden for non-claude sessions**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-03-27T00:53:00Z
- **Completed:** 2026-03-27T01:13:00Z
- **Tasks:** 2 (Task 3 is a checkpoint — PENDING human approval)
- **Files modified:** 5

## Accomplishments

- Added `providerFilter`, `enabledProviders`, `availableProviders`, `newlyDetectedProviders` state to App.tsx; loads providers on startup via `getProviders()` alongside existing Promise.all calls
- Provider filter step added to `sortedResults` useMemo — filters by `result.provider ?? 'claude'`
- Auto-discovery notification banner rendered above FilterPanel when `newlyDetectedProviders.length > 0`
- FilterPanel extended with `enabledProviders`/`providerFilter`/`onProviderFilterChange` props; provider checkbox filter section shown only when 2+ providers enabled
- ResultsList extended with `enabledProviders` prop; `showProviderBadge` computed and passed through all three list modes (flat, grouped, file-tree); provider badge rendered on non-claude sessions; new-chat button hidden for non-claude sessions; `provider` field added to `ContextMenuData`
- SettingsModal extended with `enabledProviders`/`availableProviders`/`onToggleProvider` props; Providers section renders all detected providers with enable/disable toggle
- main/index.ts context menu handler extended with `provider` field; "Open in New Chat" conditionally omitted for non-claude sessions

## Task Commits

1. **Task 1: App.tsx provider state, filter wiring, discovery notification** - `7ceac74` (feat)
2. **Task 2: FilterPanel/ResultsList/SettingsModal/main provider UI** - `fc3b298` (feat)
3. **Task 3: Human verification checkpoint** - PENDING (awaiting human approval)

## Files Created/Modified

- `src/renderer/src/App.tsx` - Provider state, getProviders() in startup, onProviderDetected listener, sortedResults provider filter, handleProviderFilterChange, handleToggleProvider, discovery banner, threaded props to FilterPanel/ResultsList/SettingsModal
- `src/renderer/src/components/FilterPanel.tsx` - enabledProviders/providerFilter/onProviderFilterChange props; provider filter checkbox section
- `src/renderer/src/components/ResultsList.tsx` - enabledProviders prop; showProviderBadge; ContextMenuData.provider field; provider badge on non-claude sessions; new-chat button hidden for non-claude
- `src/renderer/src/components/SettingsModal.tsx` - enabledProviders/availableProviders/onToggleProvider props; Providers section
- `src/main/index.ts` - provider field in context-menu:show data type; conditional "Open in New Chat" menu item

## Decisions Made

- `showProviderBadge` is true when `enabledProviders.length > 1` OR when the single provider is not `claude`. This handles the edge case where only Codex is configured (badge still shows to indicate provider).
- `ContextMenuData` was extended with `provider` rather than re-fetching session data in the main process. This keeps the IPC simple and avoids an async lookup for a fast user interaction.
- `availableProviders` is stored as separate state from `enabledProviders` so the SettingsModal can show all detected providers including those currently disabled.
- `handleToggleProvider` refetches the full provider list after toggling to keep both `enabledProviders` and `availableProviders` in sync.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- `tsconfig.web.json` referenced in the plan's verify step does not exist in this project; the renderer TypeScript config is `tsconfig.json`. Verified with `npx tsc --noEmit` (exits 0) instead.

## Checkpoint Status

**Task 3 (human-verify) is PENDING.** The checkpoint requires the user to visually verify:
1. Providers section in Settings modal
2. Codex session badges (if Codex CLI is installed)
3. Provider filter checkboxes in FilterPanel
4. New-chat hidden for Codex sessions
5. Context menu "Open in New Chat" absent for Codex sessions

## Next Phase Readiness

- All Phase 3 renderer UI work is complete pending checkpoint approval
- If checkpoint passes: Phase 3 success criteria fully satisfied
- Claude-only behavior is unchanged when Codex is disabled or not installed (all UI gated on `enabledProviders.length`)

---
*Phase: 03-provider-abstraction-codex-cli-provider*
*Completed: 2026-03-27*

## Self-Check: PASSED

- App.tsx: FOUND
- FilterPanel.tsx: FOUND
- ResultsList.tsx: FOUND
- SettingsModal.tsx: FOUND
- 03-04-SUMMARY.md: FOUND
- Commit 7ceac74: FOUND
- Commit fc3b298: FOUND
