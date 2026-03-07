# Claude Code Search History

A native macOS Electron application for searching, browsing, and interacting with your Claude Code conversation history across all local projects.

## Features

### Search Engine

- **Full-Text Search** — Uses FlexSearch for instant search across thousands of conversations. Results update as you type with 150ms debounce.
- **Two-Tier Indexing** — Metadata-only scanning on startup for speed; full conversation text loaded on demand with an LRU cache (5 entries).
- **Batched Scanning** — JSONL files are parsed in batches of 10 with a progress callback, keeping the UI responsive during indexing.
- **Search Highlighting** — Matched terms are highlighted in result previews and throughout the full conversation view (including inside code blocks and JSON).

### Filtering & Sorting

- **Project Filter** — Autocomplete dropdown with keyboard navigation (arrow keys, Enter, Escape). Projects are grouped by parent directory with short-path display and highlighted matching text.
- **Profile/Account Filter** — When multiple profiles are enabled, filter conversations by Claude profile (work, personal, custom). Appears automatically when >1 profile exists.
- **Sort Options** — Most Recent, Oldest First, Most Messages, Least Messages, Alphabetical (A-Z).
- **Date Range Filter** — All Time, Today, Last 7 Days, Last 30 Days.
- **Combined Filtering** — All filters compose: project + profile + date range + sort + search query all apply simultaneously.

### Conversation List (Sidebar)

- **Virtualized Rendering** — Uses `@tanstack/react-virtual` for smooth scrolling through thousands of results.
- **Resizable Sidebar** — Drag the right edge to resize (240px–800px); width persists across sessions.
- **Flat or Grouped View** — Toggle between flat list and group-by-project layout in settings.
- **Result Counter** — Shows "Showing X of Y conversations" when filters are active.
- **Git Status Badges** — Each conversation shows git branch name and worktree/git-repo icon when applicable.
- **Profile Badges** — Emoji profile badges on each conversation when multiple profiles are enabled.
- **Last Message Indicator** — Shows whether the last message was from user or assistant.
- **Live Chat Indicators** — Active chat sessions show "Live", "Typing...", or "Awaiting Reply" badges with colored dots.
- **Session Names** — Displays session name/preview with timestamp and message count.

### Conversation Viewer

- **Rich Markdown Rendering** — Full GFM support via `react-markdown` + `remark-gfm`: headings, lists, tables, blockquotes, links, bold/italic, horizontal rules.
- **Syntax-Highlighted Code Blocks** — Language-specific highlighting for JavaScript/TypeScript, Python, Go, Bash/Shell, and JSON. Each block shows the language label and a hover-to-reveal copy button.
- **Collapsible JSON Blocks** — Standalone JSON messages get a dedicated renderer with pretty-printing, syntax coloring, expand/collapse toggle, and copy button.
- **Tool Result Cards** — Structured display of Claude Code tool invocations with dedicated card components:
  - **Edit** — Unified diff view with file path header
  - **Bash** — Terminal-style card showing stdout/stderr with interrupted indicator
  - **Read/Write** — File path cards with appropriate icons
  - **Glob** — File list with count and truncation indicator
  - **Grep** — Matched files with line counts and content preview
  - **Task Agent/Create/Update** — Task management cards with status and prompt display
  - **Generic** — Fallback card for any other tool type
- **Tool Invocation Badges** — Inline badges per message showing which tools were called, with icon, short name, and key parameter (e.g. file path). Supports MCP tool name parsing.
- **Message Navigation** — Floating navigation bar with previous/next buttons, jump-to-first/last, and a click-to-edit message counter for direct index jumps. Virtualized scrolling for large conversations.
- **Token & Model Metadata** — Each assistant message shows model name, input/output tokens, cache read/creation tokens, stop reason, and git branch.
- **Conversation Export** — Export the current conversation as Markdown, JSON, or plain text via a native save dialog.
- **Continue Chat** — "Continue this conversation" button that opens an embedded Claude Code session resuming the selected session.
- **Copy Message** — Copy individual message content to clipboard.
- **Worktree Navigation** — For worktree conversations: shows root project link, current branch, and a "Create Worktree" form with branch name and path inputs.
- **Error Boundary** — Graceful crash recovery wrapping the conversation viewer.

### Embedded Claude Code Chat

- **Integrated Terminal** — Full xterm.js terminal running Claude Code via `node-pty`. Spawns `claude` CLI with proper environment, working directory, and optional session resume.
- **Multi-Instance Chat** — Run up to N concurrent Claude Code sessions (configurable in settings, default 3). Each instance is tracked by UUID.
- **Active Chat Sidebar** — Pinned list above the search results showing all running/exited chat instances with:
  - Project name and working directory
  - Typing indicator (debounced 1.5s after last PTY data)
  - Exit code display for finished sessions
  - Focus and close controls
- **Profile Selection** — Profile picker modal when starting a chat (skipped if a default profile is set). Supports "remember this choice" to set the default.
- **Chat in Project** — "Chat in this project" button appears when a project filter is selected. Also available from the worktrees panel.
- **Resume Sessions** — Continue any past conversation from the conversation viewer as a new embedded chat instance.
- **Force Stop** — Kill running PTY processes; handles race conditions on exit.

#### Multi-Terminal Architecture

The embedded chat system uses a layered architecture spanning the Electron main process, preload bridge, and React renderer:

**PtyManager (main process — `src/main/services/pty-manager.ts`)**

Each chat instance gets its own `PtyManager` class that owns a single `node-pty` pseudo-terminal process. The manager encapsulates the full PTY lifecycle:

- **Spawn** — Creates a login shell (`/bin/zsh -l -c "claude ..."` on macOS, `cmd.exe /c claude` on Windows) with the appropriate environment. The `CLAUDECODE` env var is explicitly unset to avoid "nested session" errors. Profile-specific `CLAUDE_CONFIG_DIR` is set based on the selected profile's `configDir`, or falls back to `~/.claude-work` / `~/.claude-personal` convention. The command is built dynamically: `claude --dangerously-skip-permissions` for new sessions, with `--resume <sessionId>` appended for resumed conversations.
- **Stale Process Guard** — If `spawn()` is called while a previous process is still alive (e.g. due to rapid re-creation), the stale process is force-killed (`SIGKILL`) synchronously before the new one starts. Exit resolvers for the stale process are drained immediately so no dangling promises remain.
- **Data & Exit Handlers** — Callbacks are registered via `setDataHandler` and `setExitHandler` before spawning. The exit handler fires only if the exiting process is still the active one (`this.process === proc` identity check), preventing a killed stale process from corrupting the manager's state.
- **Two-Phase Kill** — The `kill()` method implements escalating termination: first call sends `SIGINT` for graceful shutdown, second call sends `SIGKILL` for immediate termination. A 3-second timeout auto-escalates to `SIGKILL` if the process hasn't exited after the initial `SIGINT`. Returns a `Promise<void>` that resolves when the process actually exits (via internal `exitResolvers` array).
- **Resize** — Forwards terminal dimension changes (`cols × rows`) to the PTY so the child process receives accurate `SIGWINCH` signals.

**Instance Registry (main process — `src/main/index.ts`)**

A `Map<string, PtyManager>` keyed by `instanceId` (UUID) tracks all active chat sessions. IPC handlers expose five operations:

| IPC Channel    | Direction        | Purpose |
|---------------|-----------------|---------|
| `pty-spawn`   | renderer → main | Create a new PTY. Kills any stale manager with the same `instanceId` first. Enforces `maxChatInstances` limit from settings. |
| `pty-input`   | renderer → main | Forward keystrokes to the correct PTY by `instanceId`. |
| `pty-resize`  | renderer → main | Forward terminal resize events by `instanceId`. |
| `pty-kill`    | renderer → main | Gracefully kill a PTY and remove from the registry. |
| `pty-status`  | renderer → main | Query whether a PTY is still active and get its PID. |
| `pty-data`    | main → renderer | Stream PTY stdout/stderr to the renderer, tagged with `instanceId`. |
| `pty-exit`    | main → renderer | Notify the renderer when a process exits, with `instanceId` and exit code. |

The exit handler registered on each `PtyManager` includes an identity guard: it only deletes from the map and sends `pty-exit` to the renderer if the manager is still the active one for that `instanceId`. This prevents a race condition where React StrictMode's double-mount causes a stale manager's async exit callback to remove a newly-created replacement manager from the registry.

**ChatTerminal (renderer — `src/renderer/src/components/ChatTerminal.tsx`)**

A React component that owns an xterm.js `Terminal` instance and bridges it to the PTY:

- **Lifecycle** — A single `useEffect` (dependencies: `instanceId`, `cwd`, `resumeSessionId`, `profile`, `configDir`) creates the terminal, loads the `FitAddon`, opens it in the container div, registers `onData` → `ptyInput` forwarding, and calls `ptySpawn`. Cleanup removes IPC listeners, disconnects the `ResizeObserver`, and disposes the terminal.
- **Auto-Fit** — A `ResizeObserver` on the container div triggers `fitAddon.fit()` + `ptyResize` on every layout change, so the terminal always fills its panel.
- **Terminal Theme** — Custom dark theme with Claude-orange cursor and selection colors, SF Mono font stack.
- **Header Bar** — Shows working directory, a green/gray status dot (active vs. exited), exit code when finished, and a Stop button that calls `ptyKill`. The Stop button changes to "Force Stop" on second click (leveraging `PtyManager`'s two-phase kill).

**App-Level Coordination (renderer — `src/renderer/src/App.tsx`)**

- **Chat Instances State** — `chatInstances` array tracks all sessions with fields for `instanceId`, `cwd`, `profile`, `status` (active/exited), `exitCode`, `resumeSessionId`, `configDir`, and `isClaudeTyping`.
- **Typing Detection** — A global `onPtyData` listener sets `isClaudeTyping: true` on the matching instance and starts a 1.5-second debounce timer. When the timer fires without new data, typing is set back to `false`.
- **Exit Handling** — A global `onPtyExit` listener updates the instance's status to `"exited"` with the exit code.
- **New Chat Flow** — `startChat()` generates a UUID `instanceId`, creates the `ChatInstance` object, and sets it as the active panel. If no default profile is set, a `ProfilePickerModal` is shown first.
- **Resume Flow** — `handleContinueChat()` takes the conversation's `projectPath`, `sessionId`, and optional `account` (for profile matching), resolves the correct profile, and calls `startChat` with `resumeSessionId` set.
- **Instance Limit** — Before creating a new instance, the active count is checked against `appSettings.maxChatInstances`. If at the limit, an alert is shown.

### Profiles

- **Multi-Profile Support** — Define multiple Claude config directories (e.g. work, personal, custom). Each profile has an ID, label, emoji, config directory path, and enabled/disabled toggle.
- **Profile Dashboard** — Per-profile stats cards showing conversation count, message count, token usage this month, project count, and last-used timestamp.
- **Add/Edit/Delete** — Profile management modal with emoji picker, label input, config directory browser (native dialog), and enabled toggle. Prevents disabling the last active profile.
- **Default Profile** — Set a default profile to skip the picker modal. Clear button to reset.
- **Profiles Persistence** — Profiles stored in `profiles.json` in the app's userData directory. Changes trigger index rebuild and search refresh.
- **Integrated in Settings** — Profiles panel is embedded within the Settings page.

### Git Worktrees

- **Worktrees Panel** — Dedicated panel listing all git worktrees found across indexed projects. Tree layout grouped by root project, showing main vs. linked worktrees with branch name, HEAD SHA, and path.
- **Copyable Paths** — Click to copy worktree paths to clipboard.
- **Chat in Worktree** — Start a Claude Code chat scoped to any worktree directly from the panel.
- **Git/Worktree Badges** — Conversation list items show colorized git branch and worktree-type icons.
- **Create Worktrees** — Create new git worktrees from the conversation viewer header (for git-tracked projects). Auto-suggests path based on branch name.
- **Navigate to Root** — Jump from a worktree conversation to its root project's latest conversation.
- **Git Info Detection** — Automatically detects whether each project path is a plain directory, git repo, or git worktree, including branch name and root project path.

### Settings & Preferences

- **Settings Panel** — Right-panel page (not a modal overlay) with:
  - Max chat instances slider
  - Group-by-project toggle
  - Default profile management
  - Embedded profiles dashboard
- **Persisted Preferences** — Sidebar width and default profile ID saved to `preferences.json` with debounced writes.
- **Persisted Settings** — App settings saved to `settings.json`.
- **Custom App Icon** — Native macOS icon for the Electron window and Dock.
- **Scan Progress Indicator** — Animated progress bar with "Scanning... X/Y files" during initial indexing.
- **Refresh Button** — Manual index rebuild from the title bar.

### UI & Performance

- **Dark Theme** — Custom dark color scheme with Claude-orange accent colors.
- **Virtualized Scrolling** — Both the results list and conversation messages use `@tanstack/react-virtual` for efficient rendering of large datasets.
- **Debounced Search** — 150ms debounce prevents excessive re-indexing while typing.
- **LRU Conversation Cache** — Full conversation content is cached (5 entries) to avoid re-parsing JSONL files on revisit.
- **Error Boundary** — Catches render errors in the conversation viewer with a recovery UI.
- **Keyboard Shortcuts** — `Cmd/Ctrl + F` to focus search, `Escape` to clear.
- **Native macOS Title Bar** — Custom draggable title bar with stats, action buttons, and refresh control.

## Installation

### Development Mode

```bash
# Install dependencies
pnpm install

# Run in development mode
pnpm run dev
```

### Install as macOS Application

To build and install as a standalone macOS app:

```bash
# Build and package the app
pnpm run package
```

This creates a DMG installer in the `dist/` directory (filename includes architecture).

To install:

1. Double-click the DMG file
2. Drag "Claude Code Search" to your Applications folder
3. Launch from Applications or Spotlight

**Alternative: Direct .app install (no DMG)**

```bash
pnpm run build
npx electron-builder --mac --dir
```

This creates an unpacked `.app` in `dist/mac-arm64/` (Apple Silicon) or `dist/mac/` (Intel) that you can drag directly to Applications.

### Other Platforms

```bash
# Windows
pnpm run package:win

# Linux
pnpm run package:linux
```

## How It Works

The app scans your Claude Code conversation history stored in `~/.claude/projects/` (and any additional config directories defined in your profiles). Each project directory contains JSONL files with conversation data.

On startup, the app:

1. Loads profiles from `profiles.json` to determine which config directories to scan
2. Scans all project directories in batches, extracting metadata (not full text) for speed
3. Reports scan progress to the UI via IPC events
4. Builds a search index using FlexSearch over metadata snippets
5. Detects git status and worktree info for each project path
6. Displays the most recent conversations, ready for search

Full conversation content is loaded on demand when you select a conversation, and cached in an LRU cache for quick revisits.

## Keyboard Shortcuts

- `Cmd/Ctrl + F`: Focus search input
- `Escape`: Clear search / unfocus
- Arrow keys: Navigate project autocomplete dropdown
- Click message counter in navigation bar to jump to a specific message by number

## Tech Stack

- **Electron** — Cross-platform desktop app framework
- **React** — UI library
- **FlexSearch** — High-performance full-text search
- **Tailwind CSS** — Utility-first CSS framework
- **electron-vite** — Fast build tool for Electron
- **node-pty** — Pseudo-terminal for embedded Claude Code chat sessions
- **xterm.js** — Terminal emulator rendered in the browser
- **react-markdown + remark-gfm** — Markdown rendering with GitHub-flavored markdown
- **@tanstack/react-virtual** — Virtualized scrolling for large lists and conversations
- **uuid** — Instance ID generation for multi-chat management

## Project Structure

```
src/
├── main/                  # Electron main process
│   ├── index.ts          # App entry, IPC handlers (search, profiles, settings, git, PTY)
│   ├── utils/
│   │   └── execFileNoThrow.ts  # Safe child_process wrapper for git commands
│   └── services/
│       ├── scanner.ts    # JSONL conversation scanner with metadata extraction
│       ├── indexer.ts    # FlexSearch index with metadata-snippet storage
│       └── pty-manager.ts # PTY process lifecycle (spawn, write, resize, kill)
├── preload/              # Secure IPC bridge
│   ├── index.ts          # Typed API surface exposed to renderer
│   └── index.d.ts        # TypeScript declarations for window.electronAPI
├── shared/               # Shared types between main and renderer
│   └── types.ts          # All domain types (conversations, profiles, tools, git, PTY)
└── renderer/             # React UI
    └── src/
        ├── App.tsx                    # Root component, state management, panel routing
        ├── main.tsx                   # React entry point
        ├── components/
        │   ├── SearchBar.tsx          # Search input with loading indicator
        │   ├── FilterPanel.tsx        # Project autocomplete, sort, date range, profile filter
        │   ├── ResultsList.tsx        # Virtualized flat/grouped conversation list
        │   ├── ConversationView.tsx   # Full conversation display with virtualized messages
        │   ├── MessageContent.tsx     # Markdown + JSON rendering with syntax highlighting
        │   ├── MessageNavigation.tsx  # Prev/next/jump navigation bar
        │   ├── ToolResultCard.tsx     # Tool result dispatcher
        │   ├── ToolInvocationBadge.tsx # Inline tool-use badges
        │   ├── tool-cards/
        │   │   ├── BashTerminalCard.tsx   # Terminal-style stdout/stderr display
        │   │   ├── EditDiffCard.tsx        # Unified diff view
        │   │   ├── ReadFileCard.tsx        # File read indicator
        │   │   ├── WriteFileCard.tsx       # File write indicator
        │   │   ├── GlobResultCard.tsx      # File listing card
        │   │   ├── GrepResultCard.tsx      # Search results card
        │   │   └── GenericToolCard.tsx     # Fallback + task agent/create/update cards
        │   ├── ChatTerminal.tsx       # xterm.js terminal with PTY lifecycle
        │   ├── ActiveChatList.tsx     # Sidebar list of running chat instances
        │   ├── ProfilePickerModal.tsx # Profile selection dialog
        │   ├── ProfileEditModal.tsx   # Profile add/edit form with emoji picker
        │   ├── ProfileCard.tsx        # Profile stats card with actions
        │   ├── ProfilesPanel.tsx      # Profiles dashboard with CRUD
        │   ├── WorktreesPanel.tsx     # Git worktrees tree view
        │   ├── SettingsModal.tsx      # Settings page with profiles integration
        │   ├── SystemStats.tsx        # Stats display component
        │   └── ErrorBoundary.tsx      # Catch-all error recovery
        └── hooks/
            └── useSearch.ts           # Debounced search hook with project filter
```

## Testing

The project uses a two-layer testing strategy:

### Unit & Component Tests (Vitest)

Fast tests that run against isolated pieces — pure functions, React components (via `jsdom`), and hooks. No real Electron process is involved.

```bash
pnpm test              # Run all unit tests once
pnpm test:watch        # Run in watch mode (re-runs on file changes)
pnpm test:coverage     # Run with v8 coverage report
pnpm test:ui           # Open Vitest's interactive browser UI
```

### End-to-End Tests (Playwright + Electron)

Tests that launch the real built Electron app and interact with it like a user — typing, clicking, waiting for elements. Exercises the full stack: main process, preload bridge, and renderer together.

```bash
pnpm test:e2e          # Build app and run e2e tests headlessly
pnpm test:e2e:headed   # Build and run with a visible Electron window
pnpm test:e2e:ui       # Build and open Playwright's interactive UI (browse tests, traces, re-run selectively)
pnpm test:e2e:debug    # Build and run with Playwright Inspector (step through actions, inspect selectors)
```

> **Note:** E2E tests use Playwright's `_electron` API, which drives the real Chromium bundled inside Electron. This means they always run in Chromium — cross-browser testing (Firefox, WebKit) does not apply to Electron apps.

## License

MIT
