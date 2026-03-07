# Git Status Marks & Worktree Navigation — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Show git/worktree icons in the conversations list, and enable worktree navigation (go to root project, create new worktree) from the conversation view header.

**Architecture:** A new background IPC handler (`get-git-info`) batch-detects git status for all unique project paths after index is ready, pushing results to the renderer via event. The renderer stores this as a `Record<string, GitInfo>` and passes it down to `ResultsList` (for icons) and `ConversationView` (for navigation buttons + create-worktree form). A second IPC handler (`create-worktree`) runs `git worktree add`.

**Tech Stack:** Electron IPC, React, Tailwind CSS, `git` CLI via `execFileNoThrow`

---

## Task 1: Add Types

**Files:**
- Modify: `src/shared/types.ts` (append after line 270, after the `Worktree` interface)

**Step 1: Add GitInfo and CreateWorktreeOptions types**

Add at the end of `src/shared/types.ts`:

```ts
// ─── Git Info Types (for conversation list badges) ──────────────────

export interface GitInfo {
  type: 'none' | 'git' | 'worktree'
  branch?: string           // current branch name
  rootProjectPath?: string  // for worktrees: absolute path to main worktree
  rootProjectName?: string  // basename(rootProjectPath)
}

export interface CreateWorktreeOptions {
  rootPath: string       // cwd for git command (main worktree path)
  worktreePath: string   // absolute path for the new worktree
  branch: string         // new branch name
}

export interface CreateWorktreeResult {
  success: boolean
  error?: string
}
```

**Step 2: Commit**

```bash
git add src/shared/types.ts
git commit -m "feat: add GitInfo and CreateWorktreeOptions types"
```

---

## Task 2: Backend — `get-git-info` IPC Handler

**Files:**
- Modify: `src/main/index.ts`

**Context:** The existing `execFileNoThrow` utility at `src/main/utils/execFileNoThrow.ts` returns `{ stdout, stderr, code }`. The existing `parseWorktrees` function (line 543 in `main/index.ts`) already parses `git worktree list --porcelain` output.

**Step 1: Add the `get-git-info` IPC handler**

Inside `setupIpcHandlers()` in `src/main/index.ts`, add after the `open-in-finder` handler (after line 540):

```ts
  ipcMain.handle("get-git-info", async (): Promise<Record<string, GitInfo>> => {
    if (!scanner) return {};

    const projectPaths = scanner.getProjects();
    const result: Record<string, GitInfo> = {};

    await Promise.all(
      projectPaths.map(async (projectPath) => {
        // Check if it's a git repo at all
        const { code: revParseCode } = await execFileNoThrow(
          "git",
          ["rev-parse", "--is-inside-work-tree"],
          { cwd: projectPath },
        );
        if (revParseCode !== 0) {
          result[projectPath] = { type: "none" };
          return;
        }

        // Get current branch
        const { stdout: branchOut } = await execFileNoThrow(
          "git",
          ["rev-parse", "--abbrev-ref", "HEAD"],
          { cwd: projectPath },
        );
        const branch = branchOut.trim() || undefined;

        // Check if this path is a linked worktree by comparing
        // git rev-parse --show-toplevel with git worktree list main entry
        const { stdout: toplevelOut } = await execFileNoThrow(
          "git",
          ["rev-parse", "--show-toplevel"],
          { cwd: projectPath },
        );
        const toplevel = toplevelOut.trim();

        // Get the main worktree path (first entry in worktree list)
        const { stdout: wtOut, code: wtCode } = await execFileNoThrow(
          "git",
          ["worktree", "list", "--porcelain"],
          { cwd: projectPath },
        );

        if (wtCode === 0 && wtOut.trim()) {
          const firstLine = wtOut.split("\n").find((l) => l.startsWith("worktree "));
          const mainWorktreePath = firstLine?.slice("worktree ".length).trim();

          if (mainWorktreePath && toplevel !== mainWorktreePath) {
            // This is a linked worktree
            result[projectPath] = {
              type: "worktree",
              branch,
              rootProjectPath: mainWorktreePath,
              rootProjectName: basename(mainWorktreePath),
            };
            return;
          }
        }

        // Plain git repo (or main worktree)
        result[projectPath] = { type: "git", branch };
      }),
    );

    return result;
  });
```

Also add `GitInfo` and `CreateWorktreeOptions` and `CreateWorktreeResult` to the import from `../shared/types` at the top of the file (line 11-18).

**Step 2: Add the `create-worktree` IPC handler**

Below the `get-git-info` handler, add:

```ts
  ipcMain.handle(
    "create-worktree",
    async (_event, options: CreateWorktreeOptions): Promise<CreateWorktreeResult> => {
      const { rootPath, worktreePath, branch } = options;
      const { stdout, stderr, code } = await execFileNoThrow(
        "git",
        ["worktree", "add", worktreePath, "-b", branch],
        { cwd: rootPath },
      );
      if (code !== 0) {
        return { success: false, error: stderr.trim() || stdout.trim() || "Unknown error" };
      }
      return { success: true };
    },
  );
```

**Step 3: Emit `git-info-ready` after index is ready**

In `app.whenReady()` (around line 666), modify the `.then()` callback after `initializeSearch`:

```ts
  initializeSearch(enabledProfiles)
    .then(async () => {
      mainWindow?.webContents.send("index-ready");
      // Background git info detection
      try {
        const gitInfo = await ipcMain.handle
        // Actually, we just trigger the renderer to call get-git-info
        // after it receives index-ready. No separate event needed.
      } catch {
        // ignore
      }
    })
    .catch(console.error);
```

**Wait — simpler approach:** Don't add a new event. The renderer already listens for `index-ready`. After that fires, the renderer calls `getGitInfo()` itself. This avoids a new event and keeps the pattern consistent with existing IPC. Remove the `git-info-ready` event from the design — just use request/response.

**Step 4: Commit**

```bash
git add src/main/index.ts
git commit -m "feat: add get-git-info and create-worktree IPC handlers"
```

---

## Task 3: Preload Bridge

**Files:**
- Modify: `src/preload/index.ts`

**Step 1: Add imports**

Add `GitInfo`, `CreateWorktreeOptions`, `CreateWorktreeResult` to the type imports from `../shared/types` (line 7) and the re-export (line 17).

**Step 2: Add to ElectronAPI interface**

After `openInFinder` (line 48), add:

```ts
  getGitInfo: () => Promise<Record<string, GitInfo>>
  createWorktree: (options: CreateWorktreeOptions) => Promise<CreateWorktreeResult>
```

**Step 3: Add to api implementation**

After `openInFinder` (line 99), add:

```ts
  getGitInfo: () => ipcRenderer.invoke('get-git-info'),
  createWorktree: (options) => ipcRenderer.invoke('create-worktree', options),
```

**Step 4: Commit**

```bash
git add src/preload/index.ts
git commit -m "feat: expose getGitInfo and createWorktree in preload bridge"
```

---

## Task 4: App.tsx — State & Data Flow

**Files:**
- Modify: `src/renderer/src/App.tsx`

**Step 1: Add GitInfo import**

Add `GitInfo` to the import from `../../shared/types` (line 14):

```ts
import type {
  Conversation,
  SortOption,
  DateRangeOption,
  Profile,
  GitInfo,
} from "../../shared/types";
```

**Step 2: Add gitInfo state**

After `const [defaultProfileId, setDefaultProfileId] = ...` (line 64), add:

```ts
  const [gitInfo, setGitInfo] = useState<Record<string, GitInfo>>({});
```

**Step 3: Fetch gitInfo after index is ready**

In the `onIndexReady` callback (around line 108), add after `refresh()`:

```ts
      // Fetch git info in background
      window.electronAPI.getGitInfo().then(setGitInfo).catch(console.error);
```

Also add a similar call at the end of `loadData` (around line 100, before the `finally`):

```ts
        // Fetch git info
        if (indexReady) {
          window.electronAPI.getGitInfo().then(setGitInfo).catch(console.error);
        }
```

**Step 4: Add handleGoToRootProject callback**

After `handleClearDefaultProfile` (around line 406), add:

```ts
  const handleGoToRootProject = useCallback(
    async (rootProjectPath: string) => {
      try {
        const conversation = await window.electronAPI.getLatestConversation(rootProjectPath);
        if (conversation) {
          setSelectedConversation(conversation);
          setActiveChatInstanceId(null);
          setRightPanel("conversation");
        }
      } catch (err) {
        console.error("Failed to load root project conversation:", err);
      }
    },
    [],
  );
```

**Step 5: Add handleCreateWorktree callback**

```ts
  const handleCreateWorktree = useCallback(
    async (rootPath: string, worktreePath: string, branch: string) => {
      const result = await window.electronAPI.createWorktree({
        rootPath,
        worktreePath,
        branch,
      });
      if (result.success) {
        // Refresh git info to pick up the new worktree
        window.electronAPI.getGitInfo().then(setGitInfo).catch(console.error);
      }
      return result;
    },
    [],
  );
```

**Step 6: Pass gitInfo to ResultsList**

In the `<ResultsList>` JSX (around line 648), add prop:

```tsx
  gitInfo={gitInfo}
```

**Step 7: Pass gitInfo and callbacks to ConversationView**

In the `<ConversationView>` JSX (around line 729), add props:

```tsx
  gitInfo={gitInfo}
  onGoToRootProject={handleGoToRootProject}
  onCreateWorktree={handleCreateWorktree}
```

**Step 8: Commit**

```bash
git add src/renderer/src/App.tsx
git commit -m "feat: wire gitInfo state and worktree callbacks in App"
```

---

## Task 5: Git Icons in ResultsList

**Files:**
- Modify: `src/renderer/src/components/ResultsList.tsx`

**Step 1: Add GitInfo import**

```ts
import type { ClaudeProfile, GitInfo, Profile, SearchResult } from '../../../shared/types'
```

**Step 2: Add gitInfo to ResultsListProps and ResultItemProps**

In `ResultsListProps` (line 5), add:

```ts
  gitInfo: Record<string, GitInfo>
```

In `ResultItemProps` (line 92), add:

```ts
  gitInfo: Record<string, GitInfo>
```

**Step 3: Thread gitInfo through**

In the `ResultsList` component, destructure `gitInfo` from props and pass it to `ResultItem`:

```tsx
  gitInfo={gitInfo}
```

**Step 4: Render git icon in ResultItem**

In `ResultItem`, after the project name `<span>` (line 133-135) and before the `profileBadge` conditional (line 136), add:

```tsx
          {(() => {
            const gi = gitInfo[result.projectPath]
            if (!gi || gi.type === 'none') return null
            if (gi.type === 'worktree') {
              return (
                <span
                  className="shrink-0"
                  title={`Worktree: ${gi.branch || 'unknown'}`}
                >
                  <svg className="w-3 h-3 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <circle cx="6" cy="6" r="2" strokeWidth={2} />
                    <circle cx="6" cy="18" r="2" strokeWidth={2} />
                    <circle cx="18" cy="6" r="2" strokeWidth={2} />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 8v8M8 6h4a4 4 0 014 4v0" />
                  </svg>
                </span>
              )
            }
            // type === 'git'
            return (
              <span className="shrink-0" title="Git repo">
                <svg className="w-3 h-3 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </span>
            )
          })()}
```

**Note:** The worktree icon reuses the same git-branch SVG from the title bar's worktrees button. The git repo icon uses a simple branch symbol. Both are 12px (`w-3 h-3`), neutral-500, matching the design.

**Step 5: Commit**

```bash
git add src/renderer/src/components/ResultsList.tsx
git commit -m "feat: show git/worktree icons in conversation list items"
```

---

## Task 6: ConversationView — Worktree Navigation Buttons

**Files:**
- Modify: `src/renderer/src/components/ConversationView.tsx`

**Step 1: Add imports**

Add `GitInfo`, `CreateWorktreeResult` to the type import from `../../../shared/types` (line 17):

```ts
import type {
  ToolResult,
  ToolUseBlock,
  Conversation,
  ConversationMessage,
  MessageMetadata,
  ExportFormat,
  GitInfo,
  CreateWorktreeResult,
} from "../../../shared/types";
```

**Step 2: Extend ConversationViewProps**

Add to the interface (line 26):

```ts
  gitInfo?: Record<string, GitInfo>;
  onGoToRootProject?: (rootProjectPath: string) => void;
  onCreateWorktree?: (rootPath: string, worktreePath: string, branch: string) => Promise<CreateWorktreeResult>;
```

**Step 3: Destructure new props and add form state**

In the `ConversationView` function, destructure the new props:

```ts
export default function ConversationView({
  conversation,
  query,
  onContinueChat,
  gitInfo,
  onGoToRootProject,
  onCreateWorktree,
}: ConversationViewProps): JSX.Element {
```

After the existing state declarations (around line 44), add:

```ts
  // Worktree creation form state
  const [showWorktreeForm, setShowWorktreeForm] = useState(false);
  const [wtBranch, setWtBranch] = useState("");
  const [wtPath, setWtPath] = useState("");
  const [wtError, setWtError] = useState<string | null>(null);
  const [wtCreating, setWtCreating] = useState(false);
  const [wtSuccess, setWtSuccess] = useState(false);

  // Derive git info for current conversation
  const currentGitInfo = gitInfo?.[conversation.projectPath];
  const isWorktree = currentGitInfo?.type === "worktree";
  const rootPath = currentGitInfo?.rootProjectPath;
  const rootName = currentGitInfo?.rootProjectName;
```

**Step 4: Add worktree form default path logic**

After the above, add:

```ts
  // Compute default worktree path when branch name changes
  const defaultWorktreePath = rootPath
    ? join_path(rootPath, "..", "worktrees", wtBranch)
    : "";

  // Reset form when conversation changes
  useEffect(() => {
    setShowWorktreeForm(false);
    setWtBranch("");
    setWtPath("");
    setWtError(null);
    setWtCreating(false);
    setWtSuccess(false);
  }, [conversation.id]);
```

Add a simple `join_path` helper at the bottom of the file (before the final exports):

```ts
function join_path(...parts: string[]): string {
  return parts
    .join("/")
    .replace(/\/+/g, "/")
    .replace(/\/\.\.\//g, (_, i, s) => {
      // Simple .. resolution for display only
      return "/../";
    });
}
```

**Actually, simpler:** Just use string concatenation for the default. The path is sent to the backend which handles it properly. Use a simpler approach:

```ts
  const defaultWorktreePath = rootPath
    ? `${rootPath}/../worktrees/${wtBranch || "<branch>"}`
    : "";
```

No need for a join function. The backend receives the full path.

When the user opens the form, pre-fill `wtPath` with the computed default:

```ts
  const handleOpenWorktreeForm = useCallback(() => {
    setShowWorktreeForm(true);
    setWtBranch("");
    setWtPath("");
    setWtError(null);
    setWtSuccess(false);
  }, []);
```

Update `wtPath` as branch changes — use an effect:

```ts
  useEffect(() => {
    if (showWorktreeForm && rootPath && wtBranch) {
      const parent = rootPath.replace(/\/[^/]+$/, "");
      setWtPath(`${parent}/worktrees/${wtBranch}`);
    }
  }, [wtBranch, showWorktreeForm, rootPath]);
```

**Step 5: Add handleCreateWorktree**

```ts
  const handleSubmitWorktree = useCallback(async () => {
    if (!onCreateWorktree || !rootPath || !wtBranch.trim() || !wtPath.trim()) return;
    setWtCreating(true);
    setWtError(null);
    try {
      const result = await onCreateWorktree(rootPath, wtPath.trim(), wtBranch.trim());
      if (result.success) {
        setWtSuccess(true);
        setTimeout(() => {
          setShowWorktreeForm(false);
          setWtSuccess(false);
        }, 2000);
      } else {
        setWtError(result.error || "Failed to create worktree");
      }
    } catch (err) {
      setWtError(String(err));
    } finally {
      setWtCreating(false);
    }
  }, [onCreateWorktree, rootPath, wtBranch, wtPath]);
```

**Step 6: Render navigation buttons in the header**

In the header JSX, after the "Continue Chat" button block (after line 297, before the in-chat search toggle), add:

```tsx
            {/* Worktree navigation — only for worktree conversations */}
            {isWorktree && rootPath && (
              <>
                <button
                  onClick={() => onGoToRootProject?.(rootPath)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-300 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-md transition-colors"
                  title={`Go to root project: ${rootName}`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0h4" />
                  </svg>
                  Root
                </button>
                <button
                  onClick={handleOpenWorktreeForm}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-300 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-md transition-colors"
                  title="Create a new worktree"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Worktree
                </button>
              </>
            )}
```

**Step 7: Render the inline worktree creation form**

After the `{/* In-chat Search Bar */}` block (after line 409), add:

```tsx
      {/* Worktree Creation Form */}
      {showWorktreeForm && isWorktree && rootPath && (
        <div className="px-4 py-3 bg-neutral-900/90 border-b border-neutral-700 backdrop-blur-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-300">
              New Worktree from <span className="text-claude-orange">{rootName}</span>
            </span>
            <button
              onClick={() => setShowWorktreeForm(false)}
              className="p-1 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded transition-colors"
              title="Cancel"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-[10px] text-neutral-500 mb-1">Branch name</label>
              <input
                type="text"
                value={wtBranch}
                onChange={(e) => setWtBranch(e.target.value)}
                placeholder="feature/my-branch"
                className="w-full px-2 py-1.5 text-xs bg-neutral-800 border border-neutral-700 rounded text-neutral-200 placeholder-neutral-500 outline-none focus:border-claude-orange/50"
                autoFocus
              />
            </div>
            <div className="flex-1">
              <label className="block text-[10px] text-neutral-500 mb-1">Path</label>
              <input
                type="text"
                value={wtPath}
                onChange={(e) => setWtPath(e.target.value)}
                placeholder="Worktree path"
                className="w-full px-2 py-1.5 text-xs bg-neutral-800 border border-neutral-700 rounded text-neutral-200 placeholder-neutral-500 outline-none focus:border-claude-orange/50 font-mono"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSubmitWorktree}
              disabled={!wtBranch.trim() || !wtPath.trim() || wtCreating}
              className="px-3 py-1.5 text-xs font-medium text-claude-orange bg-claude-orange/10 hover:bg-claude-orange/20 border border-claude-orange/30 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {wtCreating ? "Creating..." : wtSuccess ? "Created!" : "Create"}
            </button>
            <button
              onClick={() => setShowWorktreeForm(false)}
              className="px-3 py-1.5 text-xs text-neutral-400 hover:text-neutral-200 transition-colors"
            >
              Cancel
            </button>
            {wtError && (
              <span className="text-xs text-red-400 truncate">{wtError}</span>
            )}
            {wtSuccess && (
              <span className="text-xs text-green-400">Worktree created successfully</span>
            )}
          </div>
        </div>
      )}
```

**Step 8: Commit**

```bash
git add src/renderer/src/components/ConversationView.tsx
git commit -m "feat: add worktree navigation buttons and create form in ConversationView"
```

---

## Task 7: Manual Smoke Test

**Step 1: Run the app**

```bash
cd /Users/ronen/Desktop/dev/personal/claude-search && pnpm dev
```

**Step 2: Verify git icons in conversation list**

- Conversations from git repos should show a small branch icon after the project name
- Conversations from worktrees should show a fork icon; hover to see branch name
- Conversations from non-git directories should have no icon

**Step 3: Verify worktree navigation**

- Select a conversation that was created inside a git worktree
- Verify "Root" and "Worktree" buttons appear in the header
- Click "Root" — should navigate to the root project's latest conversation
- Click "Worktree" — should open inline form
- Type a branch name — path field should auto-fill
- Click "Create" — should create the worktree (test with a throwaway branch)
- Clean up: `git worktree remove <path>` from terminal

**Step 4: Verify non-worktree conversations**

- Select a conversation from a regular git repo
- Verify "Root" and "Worktree" buttons do NOT appear

**Step 5: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address smoke test issues"
```
