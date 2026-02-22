# Embedded Claude Code Chat

## Summary

Add a live Claude Code chat experience to the app by embedding the real Claude Code CLI inside an xterm.js terminal in the right-hand panel. Users can start new sessions in any project directory or from the sidebar's project filter.

## Approach

Embed the actual `claude` CLI via `node-pty` (main process) and `xterm.js` (renderer), relaying data over IPC. This provides 100% feature parity with Claude Code (permissions, diffs, tool approvals, streaming) with minimal code.

### Why not a custom chat UI?

Claude Code is deeply interactive: permission approvals, diffs, tool results, slash commands, interrupt handling. Building a custom React UI for all of this via `--output-format stream-json` would be equivalent to rebuilding Claude Code's entire frontend. The stream-json protocol is also not a stable public API.

## Architecture

```
Renderer (xterm.js)  <──IPC──>  Main (node-pty)  ──spawns──>  claude CLI
     user types                    relay data                   runs in project dir
     terminal output               relay input                  streams output
```

The main process owns the `node-pty` instance. The renderer sends keystrokes via IPC, and the main process forwards PTY output back via IPC. This keeps `node-pty` (a native module) in the main process where it belongs.

## Dependencies

- `node-pty` — spawns a PTY in the main process
- `@xterm/xterm` + `@xterm/addon-fit` — renders the terminal in the renderer

## UI Layout

```
+--------------------------------------+
| Title Bar          [+ New Chat] btn  |
+------------ +------------------------+
| Search     | Terminal Header         |
| Filters    | project-name    [Stop]  |
|            +-------------------------+
| Results    |                         |
| List       |  xterm.js terminal      |
|            |  (full Claude Code)     |
|            |                         |
|            |                         |
+------------+-------------------------+
```

When no chat is active, the existing ConversationView or empty state shows as before.

## Launch Points

1. **"+ New Chat" button in title bar** — opens a native directory picker, spawns `claude` in that directory.
2. **"Chat in project" button in sidebar** — when a project is selected in the filter dropdown, a button appears that spawns `claude` in that project's path.

## Session Lifecycle

- One active session at a time.
- Starting a new chat when one is active shows a confirmation dialog.
- "Stop" button sends SIGINT (like Ctrl+C); a second click kills the process.
- When the Claude process exits, the terminal shows exit status and a "Start New Chat" prompt.

## Components

| Layer    | File                                        | Responsibility                                                        |
| -------- | ------------------------------------------- | --------------------------------------------------------------------- |
| Main     | `src/main/services/pty-manager.ts`          | Manages node-pty lifecycle, spawns claude with correct args/cwd       |
| Main     | `src/main/index.ts` (additions)             | New IPC handlers: pty-spawn, pty-input, pty-resize, pty-kill          |
| Preload  | `src/preload/index.ts` (additions)          | Expose PTY IPC methods to renderer                                    |
| Shared   | `src/shared/types.ts` (additions)           | PTY-related types (PtySpawnOptions, PtyStatus)                        |
| Renderer | `src/renderer/src/components/ChatTerminal.tsx` | xterm.js terminal wrapper, handles resize/fit, theming             |
| Renderer | `src/renderer/src/App.tsx` (modifications)  | New state for active chat, launch buttons, mode switching             |

## IPC Protocol

### Main process handlers (ipcMain.handle / ipcMain.on)

- `pty-spawn(options: { cwd: string })` — spawn a new claude process, returns success/error
- `pty-input(data: string)` — send keystrokes to the PTY
- `pty-resize(cols: number, rows: number)` — resize the PTY
- `pty-kill()` — send SIGINT, then SIGKILL if needed

### Main-to-renderer events (webContents.send)

- `pty-data(data: string)` — terminal output from the PTY
- `pty-exit(code: number)` — process exited

## Theme

xterm.js themed to match the app's dark palette:
- Background: `#0d0d0d` (claude-darker)
- Foreground: `#d4d4d4` (neutral-300)
- Cursor: `#e07a2f` (claude-orange)
- Selection: `rgba(224, 122, 47, 0.3)` (claude-orange with opacity)

## Electron Builder

`node-pty` is a native module that needs rebuilding for the target platform. The existing `postinstall` script (`electron-builder install-app-deps`) handles this. The `electron-builder.yml` may need `node-pty` added to `files` or `extraResources` if it doesn't get bundled automatically.
