# Data Model: Git Worktrees Panel

## Worktree (shared/types.ts addition)

```typescript
export interface Worktree {
  path: string        // absolute path to the worktree directory
  head: string        // short SHA of HEAD commit (7 chars)
  branch: string      // display branch name (e.g. "main", "feature-foo", or "(detached)")
  isMain: boolean     // true if this is the main worktree (not a linked worktree)
  projectPath: string // absolute path of the main worktree (root project)
  projectName: string // basename of projectPath, for display grouping
}
```

**Source**: Derived from `git worktree list --porcelain` output per project directory.

**Notes**:
- `branch` is the display name: `refs/heads/feature-foo` → `feature-foo`; detached HEAD → `(detached)`
- `head` is the first 7 characters of the full SHA from the `HEAD` line
- `isMain`: true only for the first block in `--porcelain` output (git always lists main worktree first)
- `projectName`: `path.basename(projectPath)` — same derivation used elsewhere in the app for display

## IPC contract

**Handler**: `ipcMain.handle('get-worktrees', async () => Worktree[])`

**ElectronAPI addition** (preload/index.ts):
```typescript
getWorktrees: () => Promise<Worktree[]>
```

## WorktreesPanel props

```typescript
interface WorktreesPanelProps {
  onChatInWorktree: (worktreePath: string) => Promise<void>
}
```
The panel fetches worktrees itself via `window.electronAPI.getWorktrees()` on mount and on refresh. The `onChatInWorktree` prop maps to the existing `handleChatInProject` in App.tsx.

## App.tsx RightPanelView update

```typescript
// Before
type RightPanelView = 'conversation' | 'profiles' | 'settings' | 'empty'

// After
type RightPanelView = 'conversation' | 'profiles' | 'settings' | 'worktrees' | 'empty'
```
