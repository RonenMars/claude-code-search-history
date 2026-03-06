---
work_package_id: "WP01"
subtasks:
  - "T001"
  - "T002"
  - "T003"
  - "T004"
title: "Backend & IPC Bridge"
phase: "Phase 1 - Foundation"
lane: "planned"
assignee: ""
agent: ""
shell_pid: ""
review_status: ""
reviewed_by: ""
dependencies: []
history:
  - timestamp: "2026-03-06T00:00:00Z"
    lane: "planned"
    agent: "system"
    shell_pid: ""
    action: "Prompt generated via /spec-kitty.tasks"
---

# Work Package Prompt: WP01 – Backend & IPC Bridge

## Review Feedback

*[Empty initially — reviewers populate this if work is returned.]*

---

## Objectives & Success Criteria

This work package delivers the complete backend and IPC bridge for the Worktrees panel:

1. `Worktree` shared TypeScript interface added to `src/shared/types.ts`
2. `src/main/utils/execFileNoThrow.ts` utility created — safe promise-based subprocess helper
3. `get-worktrees` IPC handler registered in `src/main/index.ts` with `parseWorktrees` helper
4. `getWorktrees` added to `ElectronAPI` interface and `api` bridge in `src/preload/index.ts`

**Success gate**: In Electron DevTools console, `await window.electronAPI.getWorktrees()` returns a `Worktree[]`. An empty array is valid if no projects have linked worktrees.

## Context & Constraints

- **Spec**: `kitty-specs/001-git-worktrees-panel/spec.md`
- **Plan**: `kitty-specs/001-git-worktrees-panel/plan.md`
- **Data model**: `kitty-specs/001-git-worktrees-panel/data-model.md`
- **Research**: `kitty-specs/001-git-worktrees-panel/research.md`
- **Implementation command**: `spec-kitty implement WP01`

**Key architectural constraints:**
- The project security hook requires using `execFile` (not `exec`) for subprocess invocations to prevent shell injection. Name the utility `execFileNoThrow` to match the convention the hook expects.
- No new npm dependencies. Use Node.js built-ins only (`child_process`, `path`).
- `scanner.getProjects()` already exists on `ConversationScanner` and returns the project path list — do NOT modify `scanner.ts`.
- TypeScript strict mode is active — all new types must be properly typed with no `any`.
- The `Worktree` type must be exported from `src/shared/types.ts` and imported in both main and preload.

## Subtasks & Detailed Guidance

### Subtask T001 – Add `Worktree` interface to shared types

- **Purpose**: Define the canonical shared type that flows from main process through IPC bridge to the renderer.
- **Parallel?**: Yes — can be done alongside T002.
- **File**: `src/shared/types.ts` (existing file — append to the end)

**Steps**:
1. Open `src/shared/types.ts`.
2. Append a new section after the last existing type (after `AppSettings`):

```typescript
// ─── Git Worktree Types ──────────────────────────────────────────────

export interface Worktree {
  path: string        // absolute path to the worktree directory
  head: string        // short SHA (first 7 characters of HEAD commit)
  branch: string      // display name: "feature-foo", "main", or "(detached)"
  isMain: boolean     // true = main worktree (first in git output), false = linked
  projectPath: string // absolute path of the main worktree (root project)
  projectName: string // basename(projectPath) — used for display grouping
}
```

**Validation**:
- [ ] Interface is exported and compiles without TypeScript errors
- [ ] No `any` types used

---

### Subtask T002 – Create `execFileNoThrow` subprocess utility

- **Purpose**: Provide a safe, promise-based wrapper around Node's `execFile` for subprocess invocations in the main process. The utility never throws — errors are surfaced via return value.
- **Parallel?**: Yes — can be done alongside T001.
- **File**: `src/main/utils/execFileNoThrow.ts` (new file — create `src/main/utils/` directory first)

**Steps**:
1. Create directory `src/main/utils/` (it does not exist yet).
2. Create `src/main/utils/execFileNoThrow.ts`:

```typescript
import { execFile } from 'child_process'

export interface ExecFileResult {
  stdout: string
  stderr: string
  code: number
}

/**
 * Promise wrapper around Node's execFile.
 * Never throws — errors are returned in the result object.
 * Always use this instead of exec() to prevent shell injection.
 */
export function execFileNoThrow(
  file: string,
  args: string[],
  options: { cwd: string }
): Promise<ExecFileResult> {
  return new Promise((resolve) => {
    execFile(file, args, { cwd: options.cwd }, (err, stdout, stderr) => {
      resolve({
        stdout: stdout || '',
        stderr: stderr || '',
        code: err ? ((err.code as number) ?? 1) : 0,
      })
    })
  })
}
```

**Notes**:
- `err.code` is the process exit code when the subprocess exits non-zero. The `?? 1` fallback handles cases where `err.code` is undefined (e.g., binary not found).
- No shell is spawned — arguments are passed as an array, preventing injection.

**Validation**:
- [ ] File compiles without TypeScript errors
- [ ] `execFile` imported from `'child_process'` (built-in)
- [ ] Function resolves (never rejects)

---

### Subtask T003 – Add `parseWorktrees` helper and `get-worktrees` IPC handler

- **Purpose**: Register the IPC channel the renderer calls to get the worktree list. The handler iterates known project paths from `scanner.getProjects()`, runs `git worktree list --porcelain` for each via `execFileNoThrow`, parses output, and returns worktrees only for projects that have at least one linked (non-main) worktree.
- **Parallel?**: No — requires T001 and T002.
- **File**: `src/main/index.ts` (existing file)

**Steps**:

**1. Add imports** (alongside existing imports near the top):
```typescript
import { execFileNoThrow } from './utils/execFileNoThrow'
import type { Worktree } from '../shared/types'
```

Also add `basename` to the existing `path` import (currently `import { join } from 'path'`):
```typescript
import { join, basename } from 'path'
```

**2. Add `parseWorktrees` helper** (outside any handler, e.g. near the other helper functions):

```typescript
function parseWorktrees(stdout: string, projectPath: string): Worktree[] {
  const blocks = stdout.trim().split(/\n\n+/)
  const projectName = basename(projectPath)

  return blocks
    .map((block, index) => {
      const lines = block.split('\n')
      const get = (prefix: string): string =>
        lines.find((l) => l.startsWith(prefix))?.slice(prefix.length).trim() ?? ''

      const worktreePath = get('worktree ')
      if (!worktreePath) return null

      const head = get('HEAD ').slice(0, 7)
      const rawBranch = get('branch ')
      const isDetached = lines.some((l) => l === 'detached')
      const branch = isDetached
        ? '(detached)'
        : rawBranch.replace(/^refs\/heads\//, '')

      return {
        path: worktreePath,
        head,
        branch,
        isMain: index === 0,
        projectPath,
        projectName,
      } satisfies Worktree
    })
    .filter((w): w is Worktree => w !== null)
}
```

**3. Register the IPC handler** (alongside other `ipcMain.handle` registrations):

```typescript
ipcMain.handle('get-worktrees', async (): Promise<Worktree[]> => {
  if (!scanner) return []

  const projectPaths = scanner.getProjects()

  const results = await Promise.all(
    projectPaths.map(async (projectPath) => {
      const { stdout, code } = await execFileNoThrow(
        'git',
        ['worktree', 'list', '--porcelain'],
        { cwd: projectPath }
      )
      if (code !== 0 || !stdout.trim()) return []
      return parseWorktrees(stdout, projectPath)
    })
  )

  const all = results.flat()

  // Only surface projects that have at least one linked (non-main) worktree
  const projectsWithLinked = new Set(
    all.filter((w) => !w.isMain).map((w) => w.projectPath)
  )

  return all.filter((w) => projectsWithLinked.has(w.projectPath))
})
```

**Notes about `git worktree list --porcelain` output format**:
```
worktree /absolute/path/to/main
HEAD abc1234def567890abcdef1234567890abc12345
branch refs/heads/main

worktree /absolute/path/to/linked
HEAD def5678abc1234def5678abc1234def5678abc12
branch refs/heads/feature-branch

worktree /absolute/path/to/detached
HEAD ghi9012jkl3456ghi9012jkl3456ghi9012jkl34
detached
```
- Blocks are separated by a blank line.
- The first block is always the main worktree.
- Detached HEAD: no `branch` line; instead a line containing just `detached`.

**Validation**:
- [ ] `get-worktrees` handler compiled and registered
- [ ] `parseWorktrees` handles the `detached` edge case (no `branch ` line)
- [ ] `parseWorktrees` handles empty/malformed stdout gracefully (returns `[]`)
- [ ] Handler returns `[]` when `scanner` is null (startup race condition)
- [ ] Projects with only the main worktree are filtered out of the result

---

### Subtask T004 – Add `getWorktrees` to the preload bridge

- **Purpose**: Expose the `get-worktrees` IPC channel to the renderer via `contextBridge`, making it callable as `window.electronAPI.getWorktrees()`.
- **Parallel?**: No — requires T001 (`Worktree` type for the return type).
- **File**: `src/preload/index.ts` (existing file)

**Steps**:

**1. Add `Worktree` to the imports**. The file already has a named import block from `'../shared/types'`. Add `Worktree` there:
```typescript
import type {
  SearchResult,
  Conversation,
  ExportFormat,
  ExportResult,
  UserPreferences,
  PtySpawnOptions,
  PtyStatus,
  Profile,
  AppSettings,
  StatsGranularity,
  PeriodStat,
  Worktree,        // ADD
} from '../shared/types'
```

**2. Add `Worktree` to the re-export line** (the file has `export type { ... }` — add `Worktree` there):
```typescript
export type { SearchResult, Conversation, ExportFormat, ExportResult, UserPreferences, PtySpawnOptions, PtyStatus, Profile, AppSettings, StatsGranularity, PeriodStat, Worktree }
```

**3. Add `getWorktrees` to the `ElectronAPI` interface** (at the end, in the `// Settings` section or after the last entry):
```typescript
export interface ElectronAPI {
  // ... existing entries ...
  getWorktrees: () => Promise<Worktree[]>
}
```

**4. Add `getWorktrees` to the `api` object** (at the end, matching the interface):
```typescript
const api: ElectronAPI = {
  // ... existing entries ...
  getWorktrees: () => ipcRenderer.invoke('get-worktrees'),
}
```

**Validation**:
- [ ] TypeScript compiles in preload (no errors)
- [ ] `Worktree` imported and re-exported
- [ ] `getWorktrees` present in both `ElectronAPI` interface and `api` object
- [ ] Channel name `'get-worktrees'` matches the handler registered in T003

---

## Test Strategy

Manual validation (no automated test framework configured):

1. Run the app: `pnpm dev`
2. Open DevTools → Console
3. Run: `await window.electronAPI.getWorktrees()`
4. Expected: `Worktree[]` array
   - If you have projects with linked worktrees: array contains entries with `isMain: false`
   - If no linked worktrees exist: `[]`
5. Inspect a result entry:
   - `path`: absolute directory path
   - `head`: 7-character git SHA
   - `branch`: branch display name (or `"(detached)"`)
   - `isMain`: boolean
   - `projectPath`: root project path
   - `projectName`: basename of root project

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Project path is not a git repo | `execFileNoThrow` returns non-zero code → handler silently returns `[]` for that project |
| `git` not in PATH | Same result — non-zero code, silently skipped |
| Detached HEAD worktree | `parseWorktrees` checks for `detached` line, sets `branch: '(detached)'` |
| `scanner` is null during startup | Handler returns `[]` early — safe |
| Large number of projects | `Promise.all` runs git commands concurrently — acceptable for typical counts |

## Review Guidance

- Confirm `execFileNoThrow` uses `execFile` from `child_process`, not `exec`
- Confirm `parseWorktrees` handles the `detached` branch case
- Confirm `Worktree` is exported from `shared/types.ts` and imported in preload
- Confirm `basename` was added to the `path` import in `main/index.ts` without breaking existing usages (`join` still present)
- Confirm IPC channel name matches between handler (`'get-worktrees'`) and preload (`ipcRenderer.invoke('get-worktrees')`)

## Activity Log

- 2026-03-06T00:00:00Z – system – lane=planned – Prompt created.
