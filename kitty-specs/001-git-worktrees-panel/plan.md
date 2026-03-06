# Implementation Plan: Git Worktrees Panel

**Branch**: `main` | **Date**: 2026-03-06 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/kitty-specs/001-git-worktrees-panel/spec.md`

## Summary

Add a Worktrees panel to the app — a new right-panel view (alongside Settings/Profiles) accessible via a titlebar git-branch icon button. The panel lists all git worktrees discovered across the user's known project directories, grouped by project. Clicking "Open Chat" on any worktree starts a Claude Code PTY session in that directory via the existing `handleChatInProject` flow.

The feature touches five files: shared types, preload bridge, IPC main, a new component, and App.tsx wiring. A small `execFileSafe` utility is created in the main process to safely invoke git without shell injection risk.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode)
**Primary Dependencies**: Electron 31, React 18, Node.js child_process (built-in)
**Storage**: N/A (read-only git command output, no persistence)
**Testing**: Manual (no test framework configured in this project)
**Target Platform**: macOS (Electron desktop app)
**Project Type**: Electron monorepo — `src/main/`, `src/renderer/`, `src/preload/`, `src/shared/`
**Performance Goals**: Worktree scan completes in <500ms for typical project counts (<50 projects)
**Constraints**: Must use `execFile` not `exec` for subprocess invocations (project security rule). No new npm dependencies.
**Scale/Scope**: Single user, 1–100 projects

## Constitution Check

*No constitution file found — section skipped.*

## Project Structure

### Documentation (this feature)

```
kitty-specs/001-git-worktrees-panel/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
└── tasks.md             # Phase 2 output (/spec-kitty.tasks — not yet generated)
```

### Source Code (repository root)

```
src/
├── shared/
│   └── types.ts                          # ADD: Worktree interface
├── preload/
│   └── index.ts                          # ADD: getWorktrees to ElectronAPI + bridge
├── main/
│   ├── index.ts                          # ADD: get-worktrees ipcMain handler
│   └── utils/
│       └── execFileSafe.ts               # NEW: promise wrapper for execFile
└── renderer/src/
    ├── App.tsx                           # ADD: 'worktrees' to RightPanelView, titlebar button, panel switch
    └── components/
        └── WorktreesPanel.tsx            # NEW: worktrees list component
```

## Implementation Phases

### Phase 0: Research (complete)

See [research.md](research.md).

Key decisions:
- `git worktree list --porcelain` for machine-parseable discovery
- Iterate existing `projectPath` list (no new discovery mechanism)
- `execFile` (not `exec`) via a safe utility wrapper
- Show only projects with linked worktrees; omit main-only projects
- IPC channel: `get-worktrees`

### Phase 1: Design & Contracts (complete)

See [data-model.md](data-model.md).

#### Worktree type (`src/shared/types.ts`)

```typescript
export interface Worktree {
  path: string        // absolute path to the worktree directory
  head: string        // short SHA (7 chars)
  branch: string      // display name: "feature-foo", "(detached)"
  isMain: boolean     // true = main worktree, false = linked worktree
  projectPath: string // main worktree absolute path
  projectName: string // basename(projectPath) for grouping
}
```

#### execFileSafe utility (`src/main/utils/execFileSafe.ts`)

```typescript
import { execFile } from 'child_process'

export function execFileSafe(
  file: string,
  args: string[],
  options: { cwd: string }
): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve) => {
    execFile(file, args, { cwd: options.cwd }, (err, stdout, stderr) => {
      resolve({ stdout, stderr, code: err?.code ?? 0 })
    })
  })
}
```

#### IPC handler (`src/main/index.ts`)

```typescript
ipcMain.handle('get-worktrees', async (): Promise<Worktree[]> => {
  // 1. Get known project paths from scanner
  const projectPaths = scanner ? scanner.getProjectPaths() : []

  // 2. For each project, run git worktree list --porcelain
  const results: Worktree[][] = await Promise.all(
    projectPaths.map(async (projectPath) => {
      const { stdout, code } = await execFileSafe('git', ['worktree', 'list', '--porcelain'], { cwd: projectPath })
      if (code !== 0 || !stdout.trim()) return []
      return parseWorktrees(stdout, projectPath)
    })
  )

  // 3. Flatten and filter: only projects that have linked worktrees
  const all = results.flat()
  const projectsWithLinked = new Set(
    all.filter(w => !w.isMain).map(w => w.projectPath)
  )
  return all.filter(w => projectsWithLinked.has(w.projectPath))
})
```

#### parseWorktrees helper

```typescript
function parseWorktrees(stdout: string, projectPath: string): Worktree[] {
  const blocks = stdout.trim().split(/\n\n+/)
  const projectName = path.basename(projectPath)

  return blocks.map((block, index) => {
    const lines = block.split('\n')
    const get = (prefix: string) =>
      lines.find(l => l.startsWith(prefix))?.slice(prefix.length).trim() ?? ''

    const worktreePath = get('worktree ')
    const head = get('HEAD ').slice(0, 7)
    const rawBranch = get('branch ')
    const isDetached = lines.some(l => l === 'detached')
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
    }
  })
}
```

#### ElectronAPI bridge (`src/preload/index.ts`)

Add to `ElectronAPI` interface:
```typescript
getWorktrees: () => Promise<Worktree[]>
```

Add to `api` object:
```typescript
getWorktrees: () => ipcRenderer.invoke('get-worktrees'),
```

#### WorktreesPanel component (`src/renderer/src/components/WorktreesPanel.tsx`)

Props:
```typescript
interface WorktreesPanelProps {
  onChatInWorktree: (worktreePath: string) => Promise<void>
}
```

Behavior:
- On mount: calls `window.electronAPI.getWorktrees()`, stores in local state
- Groups results by `projectName`
- Renders one section per project with worktree rows
- Each row: branch name (bold), short path, "Open Chat" button
- Refresh button in header re-fetches
- Empty state: "No linked worktrees found"
- Mirrors the visual style of `SettingsModal` / `ProfilesPanel` (dark bg, `px-8 py-6` header, `border-neutral-800` dividers, `text-claude-orange` accent)

#### App.tsx changes

1. Add `'worktrees'` to `RightPanelView` type
2. Add titlebar button (git branch SVG icon) between the `+Chat` button and settings gear
3. Add `WorktreesPanel` case to the right panel render switch
4. Pass `onChatInWorktree={handleChatInProject}` to `WorktreesPanel`

#### Scanner: getProjectPaths()

The `ConversationScanner` in `src/main/services/scanner.ts` needs a `getProjectPaths()` method that returns the set of known project root paths. Check if this already exists; if not, add it. Project paths are derived from the conversation file paths already tracked by the scanner.

## Complexity Tracking

*No constitution violations — section N/A.*

## Quickstart for Implementer

1. Add `Worktree` to `src/shared/types.ts`
2. Create `src/main/utils/execFileSafe.ts`
3. Check/add `getProjectPaths()` to `ConversationScanner`
4. Add `get-worktrees` handler to `src/main/index.ts` (import `execFileSafe`, import `Worktree`)
5. Add `getWorktrees` to `ElectronAPI` interface + `api` object in `src/preload/index.ts`
6. Create `src/renderer/src/components/WorktreesPanel.tsx`
7. Wire into `src/renderer/src/App.tsx` (type, button, panel case)
