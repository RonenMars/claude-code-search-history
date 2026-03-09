# VS Code Extension Migration — Design Document

**Date:** 2026-03-08
**Scope:** Stages 0–5 (core + backbone; no chat/worktrees)
**Target directory:** `../vscode-claude-code-manager`
**Source (read-only reference):** this repo (`claude-search`)

---

## 1. Architecture

The extension splits into two runtimes that cannot share modules directly:

```
VS Code Extension Host (Node.js, full access)
├── src/core/               ← ported platform-agnostic domain logic
│   ├── types.ts            ← shared types, Electron/PTY types dropped
│   ├── scanner.ts          ← ConversationScanner (no changes needed)
│   ├── indexer.ts          ← SearchIndexer (no changes needed)
│   ├── formatters.ts       ← formatAsMarkdown / formatAsText (no changes)
│   ├── worktree-parser.ts  ← parseWorktrees (no changes)
│   ├── execFileNoThrow.ts  ← util, no changes
│   ├── profiles.ts         ← NEW: profile config load/save (extracted from Electron main/index.ts)
│   ├── filters.ts          ← NEW: applyFilters / applySorting (extracted from renderer)
│   └── export.ts           ← NEW: exportConversation (extracted from Electron main/index.ts)
├── src/services/
│   └── HistoryService.ts   ← NEW: orchestrates scanner + indexer for VS Code
├── src/providers/
│   └── ConversationTreeProvider.ts  ← NEW: vscode.TreeDataProvider
├── src/commands/
│   ├── search.ts           ← NEW: QuickPick search command
│   ├── refresh.ts          ← NEW: rebuild index command
│   └── openConversation.ts ← NEW: open conversation in webview
├── src/webview/
│   └── ConversationPanel.ts  ← NEW: vscode.WebviewPanel factory
└── extension.ts            ← NEW: activate / deactivate

VS Code Webview (sandboxed iframe, no Node.js access)
└── src/webview-ui/
    ├── index.html          ← template with CSP nonce placeholder
    ├── main.tsx            ← React entry point
    ├── App.tsx             ← ConversationView root
    ├── components/
    │   ├── MessageContent.tsx          ← ported from renderer
    │   ├── ToolInvocationBadge.tsx     ← ported from renderer
    │   ├── MessageNavigation.tsx       ← ported from renderer
    │   ├── ToolResultCard.tsx          ← ported from renderer
    │   └── tool-cards/                 ← all 7 cards ported; ChatTerminal SKIPPED
    └── vscode.d.ts         ← type shim for acquireVsCodeApi()

Build
├── tsconfig.json           ← extension host (CommonJS, target ES2020)
├── tsconfig.webview.json   ← webview bundle (ESM via esbuild)
└── esbuild.js              ← builds both extension host + webview bundle
```

---

## 2. Key Electron → VS Code API Mappings

| Electron | VS Code Extension |
|---|---|
| `ipcMain.handle(channel, fn)` | Method on `HistoryService` called directly |
| `ipcRenderer.invoke(channel)` | `webview.postMessage(msg)` → typed handler |
| `BrowserWindow` | `vscode.WebviewPanel` |
| `dialog.showSaveDialog` | `vscode.window.showSaveDialog` |
| `app.getPath('userData')` | `context.globalStorageUri.fsPath` |
| `electron-store` / `writeFile` | `context.globalState.update` / `vscode.workspace.getConfiguration` |
| `scan-progress` IPC push event | `vscode.window.withProgress` |
| `node-pty` | **Out of scope** (Stage 6+) |
| FlexSearch | **No change** — pure JS, works in Node.js |

---

## 3. Types: What to Keep vs Drop

**Keep (no Electron dependency):**
`ConversationMessage`, `ConversationMeta`, `Conversation`, `SearchResult`, `ExportFormat`, `ExportResult`, `SortOption`, `DateRangeOption`, `UserPreferences`, all tool result types, `Profile`, `ProfilesConfig`, `Worktree`, `GitInfo`, `CreateWorktreeOptions`, `CreateWorktreeResult`, `StatsGranularity`, `PeriodStat`, `DisplayMode`

**Drop (Electron/PTY-specific):**
`PtySpawnOptions`, `PtyStatus`, `ChatInstance`, `AppSettings.maxChatInstances` (partial), `ClaudeProfile` (replace with `Profile.id`)

**Keep but adapt:**
`AppSettings` — keep `displayMode`, drop `maxChatInstances`; migrate to `vscode.workspace.getConfiguration`

---

## 4. Webview React Strategy

Each component was evaluated individually:

| Component | Decision | Reason |
|---|---|---|
| `MessageContent.tsx` | Port | react-markdown + remark-gfm work in webview |
| `ToolResultCard.tsx` | Port | Pure React, no Electron deps |
| `tool-cards/EditDiffCard.tsx` | Port | Pure React |
| `tool-cards/BashTerminalCard.tsx` | Port (no xterm) | Remove xterm.js, render as `<pre>` instead |
| `tool-cards/GrepResultCard.tsx` | Port | Pure React |
| `tool-cards/GlobResultCard.tsx` | Port | Pure React |
| `tool-cards/ReadFileCard.tsx` | Port | Pure React |
| `tool-cards/WriteFileCard.tsx` | Port | Pure React |
| `tool-cards/GenericToolCard.tsx` | Port | Pure React |
| `ToolInvocationBadge.tsx` | Port | Pure React |
| `MessageNavigation.tsx` | Port | Pure React |
| `ConversationView.tsx` | Port + adapt | Remove IPC calls, use webview message protocol |
| `ChatTerminal.tsx` | **Skip** | xterm + node-pty out of scope |
| `ActiveChatList.tsx` | **Skip** | Chat feature out of scope |
| `WorktreesPanel.tsx` | **Skip** | Out of scope for stages 0–5 |
| `ProfilesPanel.tsx` | **Skip** | Out of scope for stages 0–5 |
| `ResultsList.tsx` | **Not ported** | Replaced by VS Code TreeView |
| `SearchBar.tsx` | **Not ported** | Replaced by VS Code QuickPick |
| `FilterPanel.tsx` | **Not ported** | Replaced by VS Code QuickPick |

---

## 5. Webview Message Protocol

Typed, bidirectional messages replace IPC channels:

```typescript
// Extension host → Webview
type ExtensionMessage =
  | { type: 'loadConversation'; conversation: Conversation }
  | { type: 'highlightQuery'; query: string }

// Webview → Extension host
type WebviewMessage =
  | { type: 'ready' }
  | { type: 'copyMessage'; content: string }
  | { type: 'exportConversation'; format: ExportFormat }
  | { type: 'navigateMessage'; direction: 'prev' | 'next' }
```

---

## 6. Build System

**esbuild** (not webpack) — simpler config, no loader complexity:
- Extension host: `esbuild src/extension.ts --bundle --platform=node --external:vscode --outfile=out/extension.js`
- Webview bundle: `esbuild src/webview-ui/main.tsx --bundle --platform=browser --outfile=out/webview/main.js`

**Tests:**
- Core modules: Vitest (same as source project, same test fixture JSONL files)
- Extension integration: `@vscode/test-cli` (stages 0–5 don't require full E2E)

---

## 7. Stage Execution Plan

| Stage | Mode | Depends on |
|---|---|---|
| 0 — Analysis docs | Sequential | — |
| 1A — types + scanner + worktree-parser | Parallel | Stage 0 |
| 1B — indexer + formatters + execFileNoThrow | Parallel | Stage 0 |
| 1C — profiles + filters + export (new core) | Parallel | Stage 0 |
| 2 — Extension scaffold | Sequential | Stage 1 |
| 3 — HistoryService + TreeView | Sequential | Stage 2 |
| 4 — Webview infrastructure | Sequential | Stage 2 |
| 5 — Conversation viewer (React) | Sequential | Stage 4 |
