# Chat Status Indicators Design

**Date:** 2026-02-22

## Problem

The chats list (left sidebar `ResultsList`) gives no visual signal about the lifecycle state
of a conversation. Users cannot tell at a glance which conversation is open in the live
terminal, whether Claude is currently generating a response, or which conversations Claude
already replied to and are awaiting the user's attention.

## Goals

Add two indicator types to every item in the chats list:

1. **Active** — the conversation is currently open in the embedded `ChatTerminal`.
2. **Pending** — Claude has already replied and the user owes a response (two sub-cases:
   live typing and historical).

## Indicators

### Active (green pulsing dot + "Live" badge)

Shown when `activeCwd === result.projectPath`. Rendered in the top-right corner of the
list item, replacing the plain timestamp row.

### Claude is typing (animated dots + "Typing…")

Supersedes the Active indicator when the same conversation is active **and**
`isClaudeTyping === true`. Uses a standard three-dot typing animation.

### Awaiting reply (amber dot + "Awaiting reply" badge)

Shown only when the conversation is **not** currently active and
`lastMessageSender === 'assistant'`. Signals that Claude replied last and the user has not
yet responded.

## Data flow

### 1. Scanner (`scanner.ts`)

`parseConversationMeta` already iterates every message. Track the `type` field of each
non-tool-result `user`/`assistant` entry. Set `lastMessageSender` to the final such value
seen. Add `lastMessageSender: 'user' | 'assistant'` to `ConversationMeta`.

### 2. Types (`types.ts`)

- Add `lastMessageSender: 'user' | 'assistant'` to `ConversationMeta`.
- Add `lastMessageSender: 'user' | 'assistant'` to `SearchResult`.

### 3. Indexer (`indexer.ts`)

- Add `lastMessageSender` to `IndexedDocument`.
- Store and pass it through to returned `SearchResult` objects.

### 4. App state (`App.tsx`)

- Pass `chatCwd` to `ResultsList` as `activeCwd` prop.
- Add `isClaudeTyping: boolean` state (default `false`).
  - Subscribe to `onPtyData` in a `useEffect`.
  - On each data event: set `isClaudeTyping = true`, restart a 1500 ms debounce timer.
  - On timer fire: set `isClaudeTyping = false`.
  - On PTY exit / chat close: clear timer, set `isClaudeTyping = false`.
- Pass `isClaudeTyping` to `ResultsList`.

### 5. ResultsList / ResultItem (`ResultsList.tsx`)

- Add `activeCwd: string | null` and `isClaudeTyping: boolean` props to `ResultsListProps`.
- Forward both to each `ResultItem`.
- In `ResultItem`, compute:
  - `isActive = activeCwd === result.projectPath`
  - `isTyping = isActive && isClaudeTyping`
  - `isAwaitingReply = !isActive && result.lastMessageSender === 'assistant'`
- Render badges inline with the existing timestamp in the header row.

## Visual spec

| State          | Indicator                                        |
|----------------|--------------------------------------------------|
| Active         | `●` green pulsing dot + `Live` orange badge      |
| Typing         | `···` animated dots + `Typing…` text (replaces Active) |
| Awaiting reply | `●` amber dot + `Awaiting reply` badge           |

Badges use the existing Tailwind palette (`claude-orange`, `green-500`, `amber-500`).

## Files changed

| File | Change |
|------|--------|
| `src/shared/types.ts` | Add `lastMessageSender` to `ConversationMeta` and `SearchResult` |
| `src/main/services/scanner.ts` | Track and emit `lastMessageSender` in `parseConversationMeta` |
| `src/main/services/indexer.ts` | Add `lastMessageSender` to `IndexedDocument` and `SearchResult` output |
| `src/renderer/src/App.tsx` | Add `isClaudeTyping` state + debounce; pass `activeCwd` + `isClaudeTyping` to `ResultsList` |
| `src/renderer/src/components/ResultsList.tsx` | Accept new props; render three indicator states in `ResultItem` |
