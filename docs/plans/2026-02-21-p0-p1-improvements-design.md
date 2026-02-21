# P0/P1 Improvements Design

## Problem

The app holds all parsed conversations in memory (100s of MB for heavy users), scans files sequentially (slow startup), duplicates types across 5+ files, and lacks basic UX polish (no state persistence, no virtualized results list, no error boundaries, no progress indicator).

## Design

### 1. Two-Tier Memory Architecture (P0)

**Tier 1 — Metadata (always in memory):**
A new `ConversationMeta` type stores only: id, filePath, projectPath, projectName, sessionId, sessionName, timestamp, messageCount, preview (200 chars), contentSnippet (5000 chars for search indexing).

**Tier 2 — Full conversation (on-demand):**
When a user selects a conversation, re-parse the JSONL file from disk. An LRU cache (5 entries) keeps recently viewed conversations for fast back-and-forth browsing.

**Scanner changes:**
- New `scanAllMeta()` returns `ConversationMeta[]` (no messages, no fullText).
- `conversationsCache` replaced with `metadataCache: Map<string, ConversationMeta>` + `conversationLRU: Map<string, Conversation>` (size 5).
- `getConversation(id)` checks LRU first, re-parses on miss.

**Indexer changes:**
- `IndexedDocument.content` stores the 5000-char snippet, not full text.

### 2. Parallel File Scanning (P0)

Process JSONL files in batches of 10 using `Promise.all` instead of sequential `for` loop. Send `scan-progress` IPC events: `{ scanned: number, total: number }`.

### 3. Type Consolidation (P0)

Move all shared types to `src/shared/types.ts`:
- `ConversationMeta` (new)
- `Conversation`
- `ConversationMessage`
- `MessageMetadata`
- `SearchResult`
- `ExportFormat`, `ExportResult`

Remove duplicate definitions from scanner.ts, preload/index.ts, App.tsx, ConversationView.tsx, useSearch.ts.

### 4. State Persistence (P1)

Store preferences in a JSON file at `app.getPath('userData')/preferences.json`:
- `sortBy`, `dateRange`, `selectedProject`

New IPC channels: `get-preferences`, `set-preferences`. Load on startup, write on change (debounced in renderer).

### 5. ResultsList Virtualization (P1)

Add `useVirtualizer` to `ResultsList` using the same pattern as `ConversationView`. Estimated row height ~100px, overscan 3.

### 6. Scan Progress Indicator (P1)

New IPC channel `scan-progress` sends `{ scanned, total }` during `scanAllMeta()`. Renderer shows progress bar replacing "Loading conversations..." spinner.

### 7. React Error Boundary (P1)

Wrap `ConversationView` in an `ErrorBoundary` component that catches render errors and shows a recovery UI.

### 8. Bug Fixes (bundled)

- Remove double-search on project filter change in `useSearch.ts`
- Replace DOM-based `escapeHtml` in `ResultsList.tsx` with string-based version
- Change `ipcRenderer.on('index-ready')` to `ipcRenderer.once` to prevent listener stacking

## Files Changed

- `src/shared/types.ts` — add all shared types
- `src/main/services/scanner.ts` — two-tier storage, parallel scanning, progress events
- `src/main/services/indexer.ts` — index truncated content
- `src/main/index.ts` — new IPC handlers (preferences, progress), fix export types
- `src/preload/index.ts` — import shared types, add new API methods, fix listener leak
- `src/renderer/src/App.tsx` — import shared types, load preferences, show progress
- `src/renderer/src/components/ResultsList.tsx` — virtualize, fix escapeHtml
- `src/renderer/src/components/ConversationView.tsx` — import shared types
- `src/renderer/src/hooks/useSearch.ts` — fix double-search bug
- `src/renderer/src/components/ErrorBoundary.tsx` — new file
