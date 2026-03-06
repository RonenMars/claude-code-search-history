# Research: Git Worktrees Panel

## Decision: git worktree list --porcelain for discovery

**Decision**: Use `git worktree list --porcelain` output parsed in the main process.

**Rationale**: The `--porcelain` flag produces a stable, machine-parseable format:
```
worktree /path/to/main
HEAD abc1234def5678...
branch refs/heads/main

worktree /path/to/linked-worktree
HEAD def5678abc1234...
branch refs/heads/feature-branch

worktree /path/to/detached
HEAD ghi9012jkl3456...
detached
```
Each worktree block is separated by a blank line. Fields: `worktree` (path), `HEAD` (full SHA), `branch` (full ref like `refs/heads/name`) or `detached`. The first block is always the main worktree.

**Alternatives considered**:
- `git worktree list` (no `--porcelain`): human-readable, fragile to parse
- Reading `.git/worktrees/` directory directly: lower-level, brittle, doesn't handle all edge cases

**Parsing approach**: Split on double-newline, parse key-value lines within each block. Derive `branch` display name by stripping `refs/heads/` prefix.

## Decision: Run per known project, not recursively

**Decision**: Iterate the project list already tracked by the app (same `projectPath` values from `getProjects()` IPC). For each, run `git worktree list --porcelain` in that directory.

**Rationale**: We already have a curated list of Claude project directories. Re-using it avoids a new discovery mechanism. A `projectPath` that isn't a git repo will cause the git command to fail — caught and skipped silently.

**Alternatives considered**:
- Recursive filesystem scan for `.git/worktrees/`: slower, finds repos unrelated to Claude projects

## Decision: Use Node.js execFile (not exec) for the git command

**Decision**: Use `execFile('git', ['worktree', 'list', '--porcelain'], { cwd: projectPath })` wrapped in a promise, in the main process IPC handler. This avoids shell injection risk.

**Note**: The project security hook requires `execFile` over `exec` for all subprocess invocations. A utility `src/main/utils/execFileSafe.ts` should be created to wrap `execFile` in a promise with structured output (stdout, stderr, exit code).

**Alternatives considered**:
- `simple-git` npm package: an additional dependency not justified for a single command
- `isomorphic-git`: pure JS, no worktree support

## Decision: Show linked worktrees only; omit projects with none

**Decision**: Show all worktrees per project, but if a project has only the main worktree (no linked worktrees), omit it from the list.

**Rationale**: Users already reach main worktrees via the existing "Chat in Project" flow. The value of this panel is quick access to linked worktrees. Projects with no linked worktrees add noise.

## IPC Channel

`get-worktrees` → returns `Worktree[]`
