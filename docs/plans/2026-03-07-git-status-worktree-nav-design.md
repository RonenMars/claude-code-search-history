# Git Status Marks & Worktree Navigation

## Overview

Two features:
1. Show git repo/worktree icons in the conversations list
2. Enable worktree navigation from the conversation view (go to root project, create new worktree)

## Backend: Git Status Detection

New IPC handler `get-git-info`: after index is ready, batch-runs `git rev-parse` and `git worktree list --porcelain` for each unique project path. Returns `Record<string, GitInfo>`.

New IPC handler `create-worktree`: runs `git worktree add <path> -b <branch>` from a given root path.

Results sent to renderer via `git-info-ready` event.

## Types

```ts
interface GitInfo {
  type: 'none' | 'git' | 'worktree'
  branch?: string
  rootProjectPath?: string
  rootProjectName?: string
}

interface CreateWorktreeOptions {
  rootPath: string
  worktreePath: string
  branch: string
}
```

## Conversations List Marks

In each ResultItem, between project name and profile badge:
- No git: no icon
- Git repo: small branch icon (neutral-500), tooltip "Git repo"
- Worktree: small fork icon (neutral-500), tooltip shows branch name on hover

Data flow: App.tsx holds `gitInfo` state -> passed to ResultsList -> ResultItem.

## ConversationView Worktree Navigation

When conversation's projectPath is a worktree (per gitInfo), header shows:

1. "Go to Root Project" button - loads latest conversation for rootProjectPath
2. "New Worktree" button - opens inline form with:
   - Branch name input (required)
   - Path input (default: `<rootProjectPath>/../worktrees/<branch>`, updates as branch typed)
   - Create / Cancel buttons
   - On success: brief message, auto-close, refresh worktrees

These buttons only appear for worktree conversations.

## Files Changed

| File | Change |
|------|--------|
| shared/types.ts | Add GitInfo, CreateWorktreeOptions types |
| main/index.ts | Add get-git-info, create-worktree IPC, emit git-info-ready |
| preload/index.ts | Expose getGitInfo, onGitInfoReady, createWorktree |
| App.tsx | Hold gitInfo state, listen for git-info-ready, pass down |
| ResultsList.tsx | Accept gitInfo prop, render icons in ResultItem |
| ConversationView.tsx | Accept gitInfo + callbacks, render nav buttons + form |
