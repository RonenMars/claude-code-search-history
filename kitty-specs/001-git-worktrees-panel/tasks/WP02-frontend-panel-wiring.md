---
work_package_id: WP02
title: Frontend Panel & App Wiring
lane: "doing"
dependencies: [WP01]
base_branch: 001-git-worktrees-panel-WP01
base_commit: 0ef8552611c74f5f951245a7686cc9cb9250287e
created_at: '2026-03-06T21:51:37.654700+00:00'
subtasks:
- T005
- T006
- T007
- T008
phase: Phase 2 - Frontend
assignee: ''
agent: ''
shell_pid: "66854"
review_status: ''
reviewed_by: ''
history:
- timestamp: '2026-03-06T00:00:00Z'
  lane: planned
  agent: system
  shell_pid: ''
  action: Prompt generated via /spec-kitty.tasks
---

# Work Package Prompt: WP02 – Frontend Panel & App Wiring

## Review Feedback

*[Empty initially — reviewers populate this if work is returned.]*

---

## Objectives & Success Criteria

This work package delivers the complete frontend for the Worktrees panel:

1. `WorktreesPanel` React component created at `src/renderer/src/components/WorktreesPanel.tsx`
2. `'worktrees'` added to `RightPanelView` union type in `App.tsx`
3. Git-branch icon titlebar button added to `App.tsx` (between `+Chat` and settings gear)
4. `WorktreesPanel` case wired into the right-panel render switch in `App.tsx`

**Success gate**:
- Clicking the git-branch icon opens the Worktrees panel in the right panel area
- Worktrees grouped by project are displayed (or "No linked worktrees found" empty state)
- Clicking "Open Chat" on a worktree row starts a Claude Code PTY session in that directory (respects existing profile picker logic and active instance limits)

## Context & Constraints

- **Depends on**: WP01 (`Worktree` type, `window.electronAPI.getWorktrees()`)
- **Spec**: `kitty-specs/001-git-worktrees-panel/spec.md`
- **Plan**: `kitty-specs/001-git-worktrees-panel/plan.md`
- **Data model**: `kitty-specs/001-git-worktrees-panel/data-model.md`
- **Implementation command**: `spec-kitty implement WP02 --base WP01`

**Key constraints:**
- Visual style must match existing panels: `SettingsModal` and `ProfilesPanel` are the reference. Key patterns: `bg-claude-darker` background, `px-8 py-6` header padding, `border-neutral-800` dividers, `text-claude-orange` accent color, `text-neutral-*` text hierarchy.
- The "Open Chat" button calls the `onChatInWorktree` prop, which maps directly to the existing `handleChatInProject` in App.tsx. No new handler is needed — the existing function already handles the profile picker and instance limits.
- No state hoisting for worktrees — the `WorktreesPanel` component manages its own fetch state internally (similar to how `ProfilesPanel` manages its own state).
- TypeScript strict mode: `WorktreesPanel` props must be fully typed.

## Subtasks & Detailed Guidance

### Subtask T005 – Create `WorktreesPanel` component

- **Purpose**: The panel component that fetches worktrees from IPC, groups them by project, renders the list, and exposes a per-row "Open Chat" button.
- **Parallel?**: Yes — can be drafted while T006–T008 are applied to App.tsx.
- **File**: `src/renderer/src/components/WorktreesPanel.tsx` (new file)

**Props interface**:
```typescript
interface WorktreesPanelProps {
  onChatInWorktree: (worktreePath: string) => Promise<void>
}
```

**State**:
```typescript
const [worktrees, setWorktrees] = useState<Worktree[]>([])
const [loading, setLoading] = useState(true)
```

**Data fetching** (on mount and on refresh button click):
```typescript
const load = useCallback(async () => {
  setLoading(true)
  try {
    const data = await window.electronAPI.getWorktrees()
    setWorktrees(data)
  } finally {
    setLoading(false)
  }
}, [])

useEffect(() => { load() }, [load])
```

**Grouping logic**: Group worktrees by `projectName` (or `projectPath` for uniqueness):
```typescript
const grouped = useMemo(() => {
  const map = new Map<string, Worktree[]>()
  for (const w of worktrees) {
    const key = w.projectPath
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(w)
  }
  return Array.from(map.entries())
}, [worktrees])
```

**Full component structure**:

```tsx
import { useState, useEffect, useCallback, useMemo } from 'react'
import type { Worktree } from '../../../shared/types'

interface WorktreesPanelProps {
  onChatInWorktree: (worktreePath: string) => Promise<void>
}

export default function WorktreesPanel({ onChatInWorktree }: WorktreesPanelProps): JSX.Element {
  const [worktrees, setWorktrees] = useState<Worktree[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await window.electronAPI.getWorktrees()
      setWorktrees(data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const grouped = useMemo(() => {
    const map = new Map<string, Worktree[]>()
    for (const w of worktrees) {
      if (!map.has(w.projectPath)) map.set(w.projectPath, [])
      map.get(w.projectPath)!.push(w)
    }
    return Array.from(map.entries())  // [ [projectPath, Worktree[]], ... ]
  }, [worktrees])

  return (
    <div className="h-full overflow-y-auto bg-claude-darker">
      {/* Header */}
      <div className="px-8 py-6 border-b border-neutral-800 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-neutral-200">Git Worktrees</h2>
        <button
          onClick={load}
          disabled={loading}
          className="text-neutral-500 hover:text-neutral-300 transition-colors disabled:opacity-50"
          title="Refresh worktrees"
        >
          {/* Refresh icon - same SVG as the titlebar refresh button */}
          <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      {/* Body */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <span className="text-neutral-500 animate-pulse text-sm">Loading worktrees...</span>
        </div>
      ) : grouped.length === 0 ? (
        <div className="flex items-center justify-center h-32">
          <div className="text-center">
            <p className="text-neutral-500 text-sm">No linked worktrees found</p>
            <p className="text-neutral-600 text-xs mt-1">
              Create a worktree with <code className="font-mono">git worktree add</code>
            </p>
          </div>
        </div>
      ) : (
        grouped.map(([projectPath, projectWorktrees]) => (
          <div key={projectPath} className="border-b border-neutral-800 last:border-0">
            {/* Project header */}
            <div className="px-8 py-3 bg-claude-dark">
              <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider truncate" title={projectPath}>
                {projectWorktrees[0].projectName}
              </p>
            </div>

            {/* Worktree rows */}
            {projectWorktrees.map((w) => (
              <div
                key={w.path}
                className="px-8 py-4 flex items-center justify-between hover:bg-neutral-800/30 transition-colors"
              >
                <div className="min-w-0 flex-1 mr-4">
                  {/* Branch name */}
                  <div className="flex items-center gap-2 mb-0.5">
                    {w.isMain && (
                      <span className="text-xs text-neutral-600 font-medium">[main]</span>
                    )}
                    <span className="text-sm font-medium text-neutral-200 truncate">
                      {w.branch}
                    </span>
                    <span className="text-xs text-neutral-600 font-mono flex-shrink-0">{w.head}</span>
                  </div>
                  {/* Path */}
                  <p className="text-xs text-neutral-500 truncate" title={w.path}>{w.path}</p>
                </div>
                <button
                  onClick={() => onChatInWorktree(w.path)}
                  className="flex-shrink-0 px-3 py-1.5 text-xs text-claude-orange bg-claude-orange/10 hover:bg-claude-orange/20 border border-claude-orange/30 rounded-lg transition-colors"
                >
                  Open Chat
                </button>
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  )
}
```

**Visual design notes**:
- `bg-claude-darker` is the right panel background (same as `SettingsModal`)
- `bg-claude-dark` is used for project section headers (slightly lighter shade)
- `text-claude-orange` + `bg-claude-orange/10` + `border-claude-orange/30` is the standard button style for primary actions (matches "Start a new chat" button in the empty state)
- `border-neutral-800` is the standard divider color throughout the app
- `text-xs font-semibold uppercase tracking-wider` for section labels (matches Settings panel section headers like "Chat")

**Validation**:
- [ ] Component compiles with no TypeScript errors
- [ ] `Worktree` imported from correct relative path (`'../../../shared/types'`)
- [ ] Loading spinner shown during fetch
- [ ] Empty state rendered when no linked worktrees
- [ ] Projects grouped correctly
- [ ] "Open Chat" triggers `onChatInWorktree` with the worktree path
- [ ] Main worktree shows `[main]` label

---

### Subtask T006 – Add `'worktrees'` to `RightPanelView` type

- **Purpose**: Extend the discriminated union that controls which panel is shown in the right area, so `'worktrees'` is a valid value.
- **Parallel?**: No — T006, T007, T008 are all edits to `App.tsx` and should be done in one pass.
- **File**: `src/renderer/src/App.tsx`

**Step**: Find the type alias at the top of `App.tsx` (line 17):
```typescript
// Before
type RightPanelView = 'conversation' | 'profiles' | 'settings' | 'empty'

// After
type RightPanelView = 'conversation' | 'profiles' | 'settings' | 'worktrees' | 'empty'
```

**Validation**:
- [ ] Type alias updated
- [ ] TypeScript still compiles (no exhaustiveness errors in the switch/conditional)

---

### Subtask T007 – Add git-branch icon titlebar button

- **Purpose**: Give the user a way to open the Worktrees panel — a new button in the titlebar area, visually consistent with the existing Settings gear icon.
- **Parallel?**: No — edit alongside T006 and T008.
- **File**: `src/renderer/src/App.tsx`

**Step**: In the titlebar's `titlebar-no-drag` div, add the git-branch button between the `+Chat` button and the gear (settings) button:

```tsx
{/* Existing: +Chat button */}
<button onClick={handleNewChat} ...>...</button>

{/* NEW: Worktrees button */}
<button
  onClick={() => setRightPanel('worktrees')}
  className="hover:text-neutral-300 transition-colors"
  title="Git worktrees"
>
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
</button>

{/* Existing: Settings gear button */}
<button onClick={() => setRightPanel('settings')} ...>...</button>
```

**Icon note**: The SVG above is a "lightning bolt" / branch-like icon. A git branch icon (two nodes connected by a line with a fork) is more semantically correct but requires a more complex SVG. Either use the lightning bolt (simple, reasonable approximation) or use this proper git-branch SVG:

```tsx
{/* Git branch icon */}
<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
  <circle cx="6" cy="6" r="2" strokeWidth={2}/>
  <circle cx="6" cy="18" r="2" strokeWidth={2}/>
  <circle cx="18" cy="6" r="2" strokeWidth={2}/>
  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
    d="M6 8v8M8 6h4a4 4 0 014 4v0" />
</svg>
```

**Validation**:
- [ ] Button renders in the titlebar between `+Chat` and gear icon
- [ ] Clicking sets `rightPanel` to `'worktrees'`
- [ ] Button has `title="Git worktrees"` tooltip
- [ ] No layout shift (spacing consistent with existing buttons)

---

### Subtask T008 – Add `WorktreesPanel` case to right-panel render switch

- **Purpose**: Wire the `WorktreesPanel` component into the right panel area so it renders when `rightPanel === 'worktrees'`.
- **Parallel?**: No — edit alongside T006 and T007.
- **File**: `src/renderer/src/App.tsx`

**Steps**:

1. **Add import** at the top of `App.tsx`:
```typescript
import WorktreesPanel from './components/WorktreesPanel'
```

2. **Add the case** in the right-panel IIFE (the `(() => { ... })()` block). The current conditional chain is:
- Active chat instance → render `ChatTerminal`
- `rightPanel === 'settings'` → render `SettingsModal`
- `rightPanel === 'profiles'` → render `ProfilesPanel`
- `selectedConversation` → render `ConversationView`
- Default → render empty state

Add the `'worktrees'` case after `'settings'` and before `'profiles'`:

```tsx
if (rightPanel === 'worktrees') {
  return (
    <WorktreesPanel
      onChatInWorktree={handleChatInProject}
    />
  )
}
```

**Placement**: Insert between the `'settings'` block and the `'profiles'` block.

**Validation**:
- [ ] `WorktreesPanel` imported from `'./components/WorktreesPanel'`
- [ ] Panel renders when `rightPanel === 'worktrees'`
- [ ] `handleChatInProject` passed as `onChatInWorktree` (existing handler, no changes needed)
- [ ] TypeScript compiles with no errors
- [ ] Clicking another panel button (e.g., Settings gear) correctly switches away from Worktrees panel

---

## Test Strategy

Manual end-to-end validation:

**Scenario 1: Panel opens**
1. Run `pnpm dev`
2. Click the git-branch icon in the titlebar
3. Expected: Worktrees panel appears in the right area

**Scenario 2: Worktrees displayed**
1. Ensure at least one project in the app has a linked git worktree
2. Open the Worktrees panel
3. Expected: Project section header visible; worktree row with branch name, short SHA, path, and "Open Chat" button

**Scenario 3: Open Chat from worktree**
1. Click "Open Chat" on a worktree row
2. Expected: Profile picker appears (if no default profile) OR a new chat session starts in the worktree's directory
3. Verify the new chat instance's `cwd` is the worktree path (check in `ActiveChatList` or DevTools)

**Scenario 4: Empty state**
1. If no projects have linked worktrees, open the panel
2. Expected: "No linked worktrees found" message with a `git worktree add` hint

**Scenario 5: Panel switching**
1. Open Worktrees panel → click Settings gear → expected: Settings panel replaces Worktrees
2. Open Worktrees panel → click `+Chat` → expected: chat starts, right panel shows terminal

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Empty state shows blank panel | Empty state renders "No linked worktrees found" with hint text |
| Chat instance limit hit | `handleChatInProject` already shows alert — no extra guard needed |
| Worktree path doesn't exist on disk | git won't list it in `worktree list` output — not a concern |
| Panel switching breaks when active chat is open | Active chat takes priority in the render order (checked first) — unaffected |

## Review Guidance

- Verify `WorktreesPanel` visual style matches `SettingsModal` (same background, padding, divider colors)
- Verify the titlebar button position — must be between `+Chat` and the gear icon
- Verify `onChatInWorktree={handleChatInProject}` — confirm it correctly passes the worktree path as `cwd`
- Confirm `rightPanel === 'worktrees'` case is placed before the `selectedConversation` fallback
- Confirm that clicking another panel button while Worktrees is open correctly switches the view

## Activity Log

- 2026-03-06T00:00:00Z – system – lane=planned – Prompt created.
