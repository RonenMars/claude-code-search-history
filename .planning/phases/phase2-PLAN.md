# Phase 2 Plan: Type-to-Filter Speed Search

## Goal
While the conversation list has focus, typing characters filters items by title
substring in real time.

## Architecture

### SpeedSearch component
A small overlay positioned at the bottom of the conversation list container.
- Props: `{ query: string; onQueryChange: (q: string) => void; onDismiss: () => void }`
- Renders only when `query` is non-empty
- Shows the current query text
- Includes a visually-hidden `<input>` that receives focus to capture keyboard events
  and prevent browser default behaviors (e.g. Backspace triggering back navigation)

### ResultsList integration
The speed search state lives in `ResultsList` (the outer shell component).
This is the right place because:
1. The filtering applies to `filteredResults` before passing to internal list components
2. The `<div className="flex flex-col h-full">` wrapper in `ResultsList` is the natural
   container for the `keydown` listener

**State:** `speedSearchQuery: string` (local to `ResultsList`)

**Keydown logic on the list container (tabIndex=0):**
- If `Cmd/Ctrl+F` → do nothing (let it bubble to the search bar)
- If `Cmd/Ctrl+*` → do nothing (let shortcuts bubble)
- If `Alt+*` → do nothing
- If function key (F1-F12) → do nothing
- If ArrowUp, ArrowDown, Enter, Tab → do nothing (reserved for navigation)
- If Escape → clear query
- If Backspace → remove last character from query
- If printable character (key.length === 1) → append to query

**Auto-dismiss timer:** 1.5s debounce; reset on each keydown. Uses `useRef` for
the timer to avoid re-renders.

**Speed search filter:** Applied ON TOP OF existing filters (`filteredResults`
which already has `accountFilter` applied). When query is non-empty:
```
results.filter(r =>
  (r.sessionName || r.projectName).toLowerCase().includes(query.toLowerCase())
)
```

**Focus management:** The container div needs `tabIndex={0}` and `outline-none`
to receive keyboard events. When the list gets focus or a key is typed, focus
stays on the container div (not a hidden input). Backspace on a focused div
won't trigger browser back.

### SpeedSearch overlay
Positioned: `absolute bottom-2 left-2 right-2` inside the outer container which
must have `relative` class. The overlay shows the search text.

## Files to change
1. Create `src/renderer/src/components/SpeedSearch.tsx`
2. Modify `src/renderer/src/components/ResultsList.tsx`

## Testing
- `SpeedSearch.test.tsx`: renders query text, calls onDismiss on Escape
- `ResultsList.test.tsx`: speed search filtering tests

## Keyboard Safety Rules
- `e.metaKey || e.ctrlKey` → skip (preserves Cmd/Ctrl+F, Cmd+A, etc.)
- `e.altKey` → skip
- `key.startsWith('F') && key.length >= 2` → skip function keys
- `['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Tab'].includes(key)` → skip
- `key === 'Escape'` → clear query
- `key === 'Backspace'` → trim last char
- `key.length === 1` → append (printable character)
