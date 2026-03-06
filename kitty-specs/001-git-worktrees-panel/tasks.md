# Work Packages: Git Worktrees Panel

**Inputs**: Design documents from `/kitty-specs/001-git-worktrees-panel/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md

**Tests**: No explicit testing requested — manual validation only.

**Organization**: 8 fine-grained subtasks (`T001`–`T008`) rolled into 2 work packages. WP01 delivers the backend IPC layer; WP02 delivers the frontend panel and wires it into App.tsx.

---

## Work Package WP01: Backend & IPC Bridge (Priority: P0)

**Goal**: Add the `Worktree` shared type, the `execFileSafe` subprocess utility, the `get-worktrees` IPC handler (with `parseWorktrees` parser), and the `getWorktrees` preload bridge — everything the renderer needs to fetch worktree data.
**Independent Test**: In Electron DevTools console, call `await window.electronAPI.getWorktrees()` and verify it returns a `Worktree[]` array (or `[]` if no linked worktrees exist).
**Prompt**: `/tasks/WP01-backend-ipc-bridge.md`
**Estimated size**: ~300 lines

### Included Subtasks
- [x] T001 Add `Worktree` interface to `src/shared/types.ts`
- [x] T002 Create `src/main/utils/execFileSafe.ts` — promise wrapper for `execFile`
- [x] T003 Add `parseWorktrees` helper + `get-worktrees` IPC handler in `src/main/index.ts`
- [x] T004 Add `getWorktrees` to `ElectronAPI` interface + `api` object in `src/preload/index.ts`

### Implementation Notes
- T001 and T002 are independent of each other and can be done in any order.
- T003 requires T001 (for the `Worktree` type) and T002 (for `execFileSafe`).
- T004 requires T001 (the `Worktree` import in the preload type signature).
- The scanner's existing `scanner.getProjects()` method returns the project path list — no changes to `scanner.ts` needed.

### Parallel Opportunities
- T001 and T002 can be coded in parallel (different files, no shared dependencies).

### Dependencies
- None (first package).

### Risks & Mitigations
- Projects that are not git repos will cause `git worktree` to exit with a non-zero code — `execFileSafe` must not throw; silently return `[]` for that project path.
- Detached HEAD worktrees have a `detached` line instead of a `branch` line — parser must handle both branches.
- TypeScript strict mode: ensure `Worktree` is exported from `src/shared/types.ts` and imported correctly in both main and preload.

---

## Work Package WP02: Frontend Panel & App Wiring (Priority: P1) 🎯 MVP

**Goal**: Create the `WorktreesPanel` React component and wire it into `App.tsx` — adding `'worktrees'` to `RightPanelView`, a git-branch titlebar button, and the panel case in the right-panel render switch.
**Independent Test**: Click the git-branch icon in the titlebar → the Worktrees panel renders. Click "Open Chat" on a worktree row → a new Claude Code PTY session starts in that directory (profile picker appears if no default profile is set, otherwise chat opens directly).
**Prompt**: `/tasks/WP02-frontend-panel-wiring.md`
**Estimated size**: ~320 lines

### Included Subtasks
- [ ] T005 [P] Create `src/renderer/src/components/WorktreesPanel.tsx`
- [ ] T006 Add `'worktrees'` to `RightPanelView` type in `src/renderer/src/App.tsx`
- [ ] T007 Add git-branch icon titlebar button in `src/renderer/src/App.tsx`
- [ ] T008 Add `WorktreesPanel` case in right-panel render switch in `src/renderer/src/App.tsx`

### Implementation Notes
- T005 (the component) can be drafted while T006–T008 are applied. The component is self-contained: it calls `window.electronAPI.getWorktrees()` on mount and provides a refresh button.
- T006–T008 are all in `App.tsx` and should be done together in one editing pass to avoid conflicts.
- The "Open Chat" button in `WorktreesPanel` calls the `onChatInWorktree` prop, which maps to the existing `handleChatInProject` in App.tsx — no new handler needed.
- Visual style must match existing panels: dark background (`bg-claude-darker`), `px-8 py-6` section padding, `border-neutral-800` dividers, `text-claude-orange` accent for interactive elements.

### Parallel Opportunities
- T005 can be drafted in parallel with T006–T008 since it has no compile-time dependency on App.tsx changes.

### Dependencies
- Depends on WP01 (requires `Worktree` type from shared/types and `getWorktrees` on `window.electronAPI`).

### Risks & Mitigations
- Empty state: if no projects have linked worktrees, the panel must render a clear "No linked worktrees found" message rather than a blank panel.
- Chat instance limit: `onChatInWorktree` (= `handleChatInProject`) already checks the active instance limit and shows an alert — no extra guard needed.
- Button collision: the new titlebar button sits between the `+Chat` button and the gear icon; verify spacing is consistent at all window widths.

---

## Dependency & Execution Summary

- **Sequence**: WP01 (backend + bridge) → WP02 (frontend + wiring)
- **Parallelization**: Within WP01, T001 and T002 can be done in parallel. Within WP02, T005 can be drafted while T006–T008 are applied.
- **MVP Scope**: Both WPs together constitute the complete feature — neither is meaningful without the other.

---

## Subtask Index (Reference)

| Subtask ID | Summary | Work Package | Priority | Parallel? |
|------------|---------|--------------|----------|-----------|
| T001 | Add `Worktree` interface to shared types | WP01 | P0 | Yes (with T002) |
| T002 | Create `execFileSafe` utility | WP01 | P0 | Yes (with T001) |
| T003 | Add `parseWorktrees` + IPC handler in main | WP01 | P0 | No (needs T001, T002) |
| T004 | Add `getWorktrees` to preload bridge | WP01 | P0 | No (needs T001) |
| T005 | Create `WorktreesPanel` component | WP02 | P1 | Yes (with T006–T008) |
| T006 | Add `'worktrees'` to `RightPanelView` type | WP02 | P1 | No (App.tsx edits) |
| T007 | Add git-branch titlebar button | WP02 | P1 | No (App.tsx edits) |
| T008 | Add `WorktreesPanel` panel case | WP02 | P1 | No (App.tsx edits) |
