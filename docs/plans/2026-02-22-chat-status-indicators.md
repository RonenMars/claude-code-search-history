# Chat Status Indicators Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Show three status indicators in the chats list — "Live" (active terminal), "Typing…" (Claude generating), and "Awaiting reply" (Claude replied last).

**Architecture:** Add `lastMessageSender` to the scanner/indexer pipeline so every `SearchResult` knows who spoke last. Track PTY output activity with a debounced timer in `App`. Pass both signals down to `ResultsList` where `ResultItem` renders the appropriate badge.

**Tech Stack:** TypeScript, React, Electron (IPC/preload), Tailwind CSS, FlexSearch, node-pty

---

### Task 1: Extend types

**Files:**
- Modify: `src/shared/types.ts`

**Step 1: Add `lastMessageSender` to `ConversationMeta`**

In `types.ts`, find the `ConversationMeta` interface (line 13) and add one field:

```ts
export interface ConversationMeta {
  id: string
  filePath: string
  projectPath: string
  projectName: string
  sessionId: string
  sessionName: string
  timestamp: string
  messageCount: number
  preview: string
  contentSnippet: string
  lastMessageSender: 'user' | 'assistant'   // ← add this
}
```

**Step 2: Add `lastMessageSender` to `SearchResult`**

Find the `SearchResult` interface (line 39) and add the same field:

```ts
export interface SearchResult {
  id: string
  projectName: string
  projectPath: string
  sessionId: string
  sessionName: string
  preview: string
  timestamp: string
  messageCount: number
  score: number
  lastMessageSender: 'user' | 'assistant'   // ← add this
}
```

**Step 3: Verify TypeScript errors surface**

Run:
```bash
npm run typecheck 2>&1 | head -40
```
Expected: errors in `scanner.ts` and `indexer.ts` about missing `lastMessageSender`. That's correct — they're the next tasks.

**Step 4: Commit**

```bash
git add src/shared/types.ts
git commit -m "feat: add lastMessageSender to ConversationMeta and SearchResult types"
```

---

### Task 2: Track last message sender in scanner

**Files:**
- Modify: `src/main/services/scanner.ts` — specifically `parseConversationMeta` (~line 98)

**Step 1: Add tracking variable inside `parseConversationMeta`**

In `parseConversationMeta`, after the existing `let messageCount = 0` declaration, add:

```ts
let lastMessageSender: 'user' | 'assistant' = 'user'
```

**Step 2: Update it on each qualifying message**

Inside the `for await` loop, find the block that increments `messageCount` (the `if ((entry.type === 'user' || entry.type === 'assistant') && !entry.isMeta)` branch). After the `messageCount++` line in the branch that extracts content, update the sender:

```ts
if (entry.type === 'user' || entry.type === 'assistant') {
  lastMessageSender = entry.type   // ← add this line
}
```

Place it directly after the `messageCount++` that's inside the `if (content)` check, and also after the `messageCount++` in the `else if (entry.toolUseResult ...)` branch:

```ts
// In the `if (content)` branch:
messageCount++
lastMessageSender = entry.type      // ← add

// In the `else if (toolUseResult...)` branch:
messageCount++
lastMessageSender = entry.type      // ← add
```

**Step 3: Include `lastMessageSender` in the returned object**

In the `return { ... }` at the bottom of `parseConversationMeta`, add:

```ts
return {
  id: filePath,
  filePath,
  projectPath,
  projectName: this.getShortProjectName(projectPath),
  sessionId: sessionId || filePath.split('/').pop()?.replace('.jsonl', '') || '',
  sessionName: sessionName || '',
  timestamp: latestTimestamp || new Date().toISOString(),
  messageCount,
  preview,
  contentSnippet: snippetParts.join(' '),
  lastMessageSender,               // ← add
}
```

**Step 4: Verify TypeScript**

```bash
npm run typecheck 2>&1 | head -40
```
Expected: `scanner.ts` error gone, `indexer.ts` error still present.

**Step 5: Commit**

```bash
git add src/main/services/scanner.ts
git commit -m "feat: track lastMessageSender in conversation scanner"
```

---

### Task 3: Thread `lastMessageSender` through the indexer

**Files:**
- Modify: `src/main/services/indexer.ts`

**Step 1: Add `lastMessageSender` to `IndexedDocument`**

Find the local `IndexedDocument` interface (line 4) and add:

```ts
interface IndexedDocument {
  id: string
  projectName: string
  projectPath: string
  sessionId: string
  sessionName: string
  content: string
  timestamp: string
  messageCount: number
  preview: string
  lastMessageSender: 'user' | 'assistant'   // ← add
}
```

**Step 2: Store it in the FlexSearch store list**

In the `constructor`, find the `store` array inside the `FlexSearch.Document` config and add `'lastMessageSender'`:

```ts
store: ['id', 'projectName', 'projectPath', 'sessionId', 'sessionName', 'timestamp', 'messageCount', 'lastMessageSender']
```

**Step 3: Populate it when building the index**

In `buildIndex`, add the field to the `doc` object:

```ts
const doc: IndexedDocument = {
  id: meta.id,
  projectName: meta.projectName,
  projectPath: meta.projectPath,
  sessionId: meta.sessionId,
  sessionName: meta.sessionName,
  content: meta.contentSnippet,
  timestamp: meta.timestamp,
  messageCount: meta.messageCount,
  preview: meta.preview,
  lastMessageSender: meta.lastMessageSender,   // ← add
}
```

**Step 4: Return it from `search` and `getRecent`**

In `search`, inside the loop that builds `searchResults`, add:

```ts
searchResults.push({
  id: doc.id,
  projectName: doc.projectName,
  projectPath: doc.projectPath,
  sessionId: doc.sessionId,
  sessionName: doc.sessionName,
  preview,
  timestamp: doc.timestamp,
  messageCount: doc.messageCount,
  score: 1,
  lastMessageSender: doc.lastMessageSender,   // ← add
})
```

In `getRecent`, inside the `.map(doc => ...)`, add the same field:

```ts
return docs.slice(0, limit).map((doc) => ({
  id: doc.id,
  projectName: doc.projectName,
  projectPath: doc.projectPath,
  sessionId: doc.sessionId,
  sessionName: doc.sessionName,
  preview: doc.preview || this.truncateText(doc.content, 200),
  timestamp: doc.timestamp,
  messageCount: doc.messageCount,
  score: 1,
  lastMessageSender: doc.lastMessageSender,   // ← add
}))
```

**Step 5: Verify TypeScript is clean**

```bash
npm run typecheck 2>&1 | head -40
```
Expected: no errors.

**Step 6: Commit**

```bash
git add src/main/services/indexer.ts
git commit -m "feat: thread lastMessageSender through search indexer"
```

---

### Task 4: Add `isClaudeTyping` state and wire props in App

**Files:**
- Modify: `src/renderer/src/App.tsx`

**Step 1: Add `isClaudeTyping` state**

After the `chatKey` state declaration (~line 26), add:

```ts
const [isClaudeTyping, setIsClaudeTyping] = useState(false)
const claudeTypingTimerRef = useRef<NodeJS.Timeout | null>(null)
```

**Step 2: Subscribe to PTY data to drive the typing indicator**

Add a new `useEffect` after the chat handlers section (~line 220), before the `return`:

```ts
useEffect(() => {
  if (!chatCwd) {
    setIsClaudeTyping(false)
    return
  }

  const cleanup = window.electronAPI.onPtyData(() => {
    setIsClaudeTyping(true)
    if (claudeTypingTimerRef.current) clearTimeout(claudeTypingTimerRef.current)
    claudeTypingTimerRef.current = setTimeout(() => {
      setIsClaudeTyping(false)
    }, 1500)
  })

  return () => {
    cleanup()
    if (claudeTypingTimerRef.current) clearTimeout(claudeTypingTimerRef.current)
    setIsClaudeTyping(false)
  }
}, [chatCwd])
```

This effect re-runs whenever `chatCwd` changes — subscribing when a chat opens, unsubscribing and clearing when it closes.

**Step 3: Pass `activeCwd` and `isClaudeTyping` to `ResultsList`**

Find the `<ResultsList ...>` JSX (~line 325) and add two props:

```tsx
<ResultsList
  results={sortedResults}
  selectedId={selectedConversation?.id || null}
  onSelect={handleSelectResult}
  query={query}
  activeCwd={chatCwd}
  isClaudeTyping={isClaudeTyping}
/>
```

**Step 4: Verify TypeScript**

```bash
npm run typecheck 2>&1 | head -40
```
Expected: errors in `ResultsList.tsx` about unknown props — correct, next task fixes them.

**Step 5: Commit**

```bash
git add src/renderer/src/App.tsx
git commit -m "feat: add isClaudeTyping state with PTY debounce in App"
```

---

### Task 5: Render status indicators in ResultsList

**Files:**
- Modify: `src/renderer/src/components/ResultsList.tsx`

**Step 1: Add new props to `ResultsListProps`**

```ts
interface ResultsListProps {
  results: SearchResult[]
  selectedId: string | null
  onSelect: (id: string) => void
  query: string
  activeCwd: string | null          // ← add
  isClaudeTyping: boolean           // ← add
}
```

**Step 2: Forward new props through the component**

In the `ResultsList` function signature destructure the new props and forward them to each `ResultItem`:

```tsx
export default function ResultsList({
  results,
  selectedId,
  onSelect,
  query,
  activeCwd,
  isClaudeTyping
}: ResultsListProps): JSX.Element {
  // ...existing code...

  // In the virtualItems.map, update ResultItem:
  <ResultItem
    result={results[virtualRow.index]}
    isSelected={results[virtualRow.index].id === selectedId}
    onSelect={() => onSelect(results[virtualRow.index].id)}
    query={query}
    activeCwd={activeCwd}
    isClaudeTyping={isClaudeTyping}
  />
}
```

**Step 3: Add new props to `ResultItemProps`**

```ts
interface ResultItemProps {
  result: SearchResult
  isSelected: boolean
  onSelect: () => void
  query: string
  activeCwd: string | null     // ← add
  isClaudeTyping: boolean      // ← add
}
```

**Step 4: Compute indicator state in `ResultItem`**

At the top of the `ResultItem` function body, after the existing `useMemo` hooks, add:

```ts
const isActive = activeCwd === result.projectPath
const isTyping = isActive && isClaudeTyping
const isAwaitingReply = !isActive && result.lastMessageSender === 'assistant'
```

**Step 5: Replace the date/header row with indicator-aware version**

Find the existing header div (the one with `flex items-start justify-between gap-2 mb-1`). Replace the `<span>` that renders the date with a flex group that includes the badge:

```tsx
<div className="flex items-start justify-between gap-2 mb-1">
  <span className="text-xs font-medium text-claude-orange truncate max-w-[200px]">
    {result.projectName}
  </span>
  <div className="flex items-center gap-1.5 shrink-0">
    {isTyping ? (
      <TypingIndicator />
    ) : isActive ? (
      <LiveBadge />
    ) : isAwaitingReply ? (
      <AwaitingReplyBadge />
    ) : null}
    <span className="text-xs text-neutral-500 whitespace-nowrap">{formattedDate}</span>
  </div>
</div>
```

**Step 6: Add the three badge components**

Add these three small components after the `ResultItem` function (before `highlightText`):

```tsx
function LiveBadge(): JSX.Element {
  return (
    <span className="flex items-center gap-1 text-[10px] font-medium text-green-400">
      <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
      Live
    </span>
  )
}

function TypingIndicator(): JSX.Element {
  return (
    <span className="flex items-center gap-1 text-[10px] font-medium text-claude-orange">
      <span className="flex gap-0.5">
        <span className="w-1 h-1 rounded-full bg-claude-orange animate-bounce [animation-delay:0ms]" />
        <span className="w-1 h-1 rounded-full bg-claude-orange animate-bounce [animation-delay:150ms]" />
        <span className="w-1 h-1 rounded-full bg-claude-orange animate-bounce [animation-delay:300ms]" />
      </span>
      Typing…
    </span>
  )
}

function AwaitingReplyBadge(): JSX.Element {
  return (
    <span className="flex items-center gap-1 text-[10px] font-medium text-amber-400">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
      Awaiting reply
    </span>
  )
}
```

**Step 7: Verify TypeScript is clean**

```bash
npm run typecheck 2>&1 | head -40
```
Expected: no errors.

**Step 8: Commit**

```bash
git add src/renderer/src/components/ResultsList.tsx
git commit -m "feat: render Live, Typing, and Awaiting Reply indicators in chats list"
```

---

### Task 6: Manual smoke test

**Step 1: Start the dev app**

```bash
npm run dev
```

**Step 2: Verify "Awaiting reply" badge**

- In the chats list, look for conversations where Claude replied last.
- They should show the amber dot + "Awaiting reply" badge next to the date.
- Conversations where the user sent the last message should show no badge.

**Step 3: Verify "Live" badge**

- Click "Chat in this project" for any project.
- The corresponding conversation item in the list should immediately show the green pulsing dot + "Live".

**Step 4: Verify "Typing…" indicator**

- While a chat is open and Claude is generating output, the item should switch from "Live" to the animated three-dot "Typing…" indicator.
- After Claude stops generating (~1.5 s), it should revert to "Live".

**Step 5: Verify cleanup**

- Close the chat (click Close).
- The "Live" badge should disappear from the list item.

**Step 6: Final commit if needed**

```bash
git add -p
git commit -m "fix: <any tweaks found during smoke test>"
```
