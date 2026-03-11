# Tree View Design Playbook

Port the sidebar file-path tree UX from the VS Code extension into the Electron app's `FileTreeResultsList` / `FileTreeNode` component.

**Reference (source of truth):** `/Users/ronen/Desktop/dev/personal/vscode-claude-code-manager`
**Target (apply changes here):** `/Users/ronen/Desktop/dev/personal/claude-search`
**Single file to edit:** `src/renderer/src/components/ResultsList.tsx`

---

## Node Type Taxonomy

Both apps use identical `buildFileTree` + `compactTree` logic. Every rendered node falls into one of three types:

| Type | Condition | Name used below |
|---|---|---|
| Leaf | `!hasChildren && hasConversations` | **leaf** |
| Mixed | `hasChildren && hasConversations` | **mixed** |
| Pure folder | `hasChildren && !hasConversations` | **folder** |

---

## Target Behaviour (per node type)

### Leaf node
- **Icon:** Green `comment-discussion` (double speech-bubble, stroke/outline style, green fill)
- **Click (row):** Navigate directly to `onSelectDir(node.fullPath)` — no expand/collapse
- **Hover action button:** None — the row click itself is the action

### Mixed node
- **Icon:** Plain `folder` (open/closed variant based on expansion state, neutral colour)
- **Click (row):** Expand / collapse
- **Hover action button:** Shown on `group-hover`, triggers `onSelectDir(node.fullPath)`. Icon: same `comment-discussion` shape but rendered with `currentColor` (inherits neutral, turns orange on hover). Use `opacity-0 group-hover/tree:opacity-100` pattern already present in the codebase.

### Pure folder node
- **Icon:** Plain `folder` (unchanged from current behaviour)
- **Click (row):** Expand / collapse
- **Hover action button:** None

---

## Implementation Steps

All changes are inside `function FileTreeNode(...)` in `ResultsList.tsx`.

### Step 1 — Derive node type booleans

Add after the existing `hasChildren` / `hasConversations` lines:

```ts
const isLeaf  = !hasChildren && hasConversations
const isMixed = hasChildren  && hasConversations
```

### Step 2 — Split the click handler

Replace the single `onClick={() => onToggle(node.fullPath)}` on the row `<div>`:

```ts
onClick={isLeaf ? () => onSelectDir(node.fullPath) : () => onToggle(node.fullPath)}
```

### Step 3 — Replace the node icon

Replace the current single folder SVG block (the one that swaps open/closed paths) with a three-way switch:

```tsx
{isLeaf ? (
  /* Green comment-discussion — exact VS Code codicon path, filled to produce the
     stroke/outline appearance via compound path inner cutout */
  <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 16 16" fill="#4CAF50">
    <path d="M14.56 7.44C14.28 7.16 13.9 7 13.5 7H13V4c0-1.1-.9-2-2-2H3c-1.1 0-2 .9-2 2v5c0 1.1.9 2 2 2v1c0 .82.93 1.29 1.59.81L7 11.05v.45A1.499 1.499 0 0 0 8.5 13h1.79l1.86 1.85c.04.05.1.09.16.11.06.03.12.04.19.04s.13-.01.19-.04c.09-.04.17-.1.23-.18.05-.08.08-.18.08-.28V13h.5a1.499 1.499 0 0 0 1.5-1.5v-3c0-.4-.16-.78-.44-1.06ZM6.75 10 4 12v-2H3c-.55 0-1-.45-1-1V4c0-.55.45-1 1-1h8c.55 0 1 .45 1 1v3H8.5A1.499 1.499 0 0 0 7 8.5V10h-.25ZM14 11.5c0 .13-.05.26-.15.35a.47.47 0 0 1-.35.15h-1a.47.47 0 0 0-.35.15.47.47 0 0 0-.15.35v.79l-1.15-1.14a.355.355 0 0 0-.16-.11.406.406 0 0 0-.19-.04h-2a.47.47 0 0 1-.35-.15.47.47 0 0 1-.15-.35v-3c0-.13.05-.26.15-.35.09-.1.22-.15.35-.15h5c.13 0 .26.05.35.15.1.09.15.22.15.35v3Z"/>
  </svg>
) : (
  /* Plain folder — open or closed — for mixed and pure-folder nodes */
  <svg className="w-3.5 h-3.5 shrink-0 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    {isExpanded ? (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h5l2 2h7a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
    ) : (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    )}
  </svg>
)}
```

### Step 4 — Replace the hover action button

The current button guard is `{hasConversations && <button ...>}`. Replace it with `{isMixed && <button ...>}` and swap the arrow SVG for the `comment-discussion` icon in `currentColor`:

```tsx
{isMixed && (
  <button
    onClick={(e) => {
      e.stopPropagation()
      onSelectDir(node.fullPath)
    }}
    className="shrink-0 opacity-0 group-hover/tree:opacity-100 text-neutral-500 hover:text-claude-orange transition-all p-0.5"
    title={`Open ${node.conversations.length} conversation${node.conversations.length === 1 ? '' : 's'} in ${node.name}`}
  >
    <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
      <path d="M14.56 7.44C14.28 7.16 13.9 7 13.5 7H13V4c0-1.1-.9-2-2-2H3c-1.1 0-2 .9-2 2v5c0 1.1.9 2 2 2v1c0 .82.93 1.29 1.59.81L7 11.05v.45A1.499 1.499 0 0 0 8.5 13h1.79l1.86 1.85c.04.05.1.09.16.11.06.03.12.04.19.04s.13-.01.19-.04c.09-.04.17-.1.23-.18.05-.08.08-.18.08-.28V13h.5a1.499 1.499 0 0 0 1.5-1.5v-3c0-.4-.16-.78-.44-1.06ZM6.75 10 4 12v-2H3c-.55 0-1-.45-1-1V4c0-.55.45-1 1-1h8c.55 0 1 .45 1 1v3H8.5A1.499 1.499 0 0 0 7 8.5V10h-.25ZM14 11.5c0 .13-.05.26-.15.35a.47.47 0 0 1-.35.15h-1a.47.47 0 0 0-.35.15.47.47 0 0 0-.15.35v.79l-1.15-1.14a.355.355 0 0 0-.16-.11.406.406 0 0 0-.19-.04h-2a.47.47 0 0 1-.35-.15.47.47 0 0 1-.15-.35v-3c0-.13.05-.26.15-.35.09-.1.22-.15.35-.15h5c.13 0 .26.05.35.15.1.09.15.22.15.35v3Z"/>
    </svg>
  </button>
)}
```

### Step 5 — Chevron column (no change needed)

The existing `{hasChildren && <chevron svg>}` guard already hides the chevron for leaf nodes (which have no children). No edit required.

---

## What Does NOT Change

- `buildFileTree`, `compactTree`, `FileTreeResultsList` — identical logic, no edits
- The "back button + dir conversation list" view triggered by `onSelectDir` — unchanged
- `ResultItem`, `GroupedResultsList`, `FlatResultsList`, all other components — untouched
- Virtualisation, search highlighting, git badges, live chat indicators — untouched

---

## Icon Path Reference

The `comment-discussion` SVG path used above is the **exact VS Code codicon** extracted from
`@vscode/codicons/dist/codicon.svg` (id `comment-discussion`). It is a compound filled path — the inner cutout in the lower-right bubble creates the outline/stroke visual appearance without needing `stroke` attributes.

For the leaf node the fill is hardcoded `#4CAF50` (green).
For the mixed-node action button the fill is `currentColor`, so it inherits `text-neutral-500` at rest and `text-claude-orange` on hover via Tailwind.
