# Feature Spec: Git Worktrees Panel

## Summary

Add a "Worktrees" panel to the app, accessible via a new titlebar button (alongside the existing Settings gear icon). The panel lists all git worktrees discovered across the user's known project directories, grouped by project. Clicking a worktree opens a Claude Code chat session in that worktree's directory using the existing multi-instance PTY chat system.

## User Story

As a developer using multiple git worktrees, I want to see all my worktrees in the app and quickly launch a Claude Code session in any of them, without having to manually navigate to a directory.

## Scope

**In scope:**
- Discover git worktrees by running `git worktree list --porcelain` for each known project directory
- Display worktrees grouped by project: branch name, path, and whether it's the main worktree
- "Open Chat" button per worktree that starts a Claude Code session in that directory (using the existing `handleChatInProject` flow including profile picker)
- New titlebar button (git branch icon) to toggle the panel (same pattern as the settings gear)
- `'worktrees'` added to the `RightPanelView` union in App.tsx

**Out of scope:**
- Creating, deleting, or pruning worktrees
- Worktree creation UI
- Any git operations beyond listing

## Acceptance Criteria

1. Clicking the git-branch icon in the titlebar opens the Worktrees panel in the right panel area
2. The panel shows all worktrees for each known project, with branch name and path displayed
3. Clicking "Open Chat" in a worktree row triggers the same flow as "Chat in Project" (respects profile picker, active instance limits, etc.)
4. If a project has no linked worktrees (only the main worktree), it is omitted from the list or shown with appropriate empty state
5. Panel has a refresh button to re-scan worktrees
