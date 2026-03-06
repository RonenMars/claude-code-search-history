# Profiles Overview / Settings Panel — Design

> Date: 2026-03-06
> Status: Approved

## Summary

Add a dedicated Profiles panel to the right-panel area of the app. Users can view per-profile usage stats, filter the conversation list by profile, and fully manage profiles (add, edit label/emoji/configDir, enable/disable, delete). The default installation ships with a single "Default" profile pointing to `~/.claude`.

---

## Data Model

### `profiles.json`
Stored in `app.getPath('userData')` alongside `preferences.json`.

```json
{
  "profiles": [
    {
      "id": "default",
      "label": "Default",
      "emoji": "robot",
      "configDir": "~/.claude",
      "enabled": true
    }
  ]
}
```

### TypeScript types (added to `shared/types.ts`)

```ts
export interface Profile {
  id: string        // stable slug (e.g. "default", "work") or uuid for custom
  label: string     // display name
  emoji: string     // single emoji character
  configDir: string // path to CLAUDE_CONFIG_DIR (e.g. ~/.claude-work)
  enabled: boolean  // soft-disable without deleting
}

export interface ProfilesConfig {
  profiles: Profile[]
}
```

`Account` type changes from `'default' | 'work' | 'personal'` to `string` (the profile `id`).

### First-run migration
If `profiles.json` does not exist, the app writes a single Default profile pointing to `~/.claude`. Users with the dual-account tmux setup can add Work/Personal profiles through the UI.

---

## Architecture

### Files changed / created

| File | Change |
|---|---|
| `src/shared/types.ts` | Add `Profile`, `ProfilesConfig`; `Account` -> `string` |
| `src/main/index.ts` | `loadProfiles` / `saveProfiles`; migrate on startup; `get-profiles` and `save-profiles` IPC handlers |
| `src/main/services/scanner.ts` | Accept `Profile[]` in constructor; build `configDirs` dynamically |
| `src/preload/index.ts` | Expose `getProfiles`, `saveProfiles` |
| `src/renderer/src/App.tsx` | `rightPanel` state enum; `accountFilter` state; Profiles titlebar button |
| `src/renderer/src/components/ProfilesPanel.tsx` | NEW — full right-panel dashboard |
| `src/renderer/src/components/ProfileCard.tsx` | NEW — per-profile stat card |
| `src/renderer/src/components/ProfileEditModal.tsx` | NEW — add/edit form |
| `src/renderer/src/components/ProfilePickerModal.tsx` | Updated to read dynamic profiles |
| `src/renderer/src/components/ResultsList.tsx` | Accept `accountFilter` prop |

### Right-panel state

Replace the current `chatCwd ? ... : selectedConversation ? ...` ternary in `App.tsx` with:

```ts
type RightPanelView = 'conversation' | 'chat' | 'profiles' | 'empty'
const [rightPanel, setRightPanel] = useState<RightPanelView>('empty')
```

---

## UI / UX

### Titlebar
Add a "Profiles" button alongside the existing "Chat" button:
```
[+ Chat]  [Profiles]  · 42 conversations · 8 projects  [refresh]
```

### ProfilesPanel
- Header: "Profiles" title + "Add Profile" button (top-right)
- Grid of `ProfileCard` components (1-col on narrow, 2-col on wide)
- Empty state if all profiles are disabled

### ProfileCard
Each card shows:
- Emoji + label + config dir path
- Conversation count, last used date, tokens this month (from `getProfilesUsage` data)
- "Filter conversations" link — sets `accountFilter` to profile id and switches right panel to conversation/empty view
- Edit button — opens `ProfileEditModal` pre-populated
- Delete button — disabled (with tooltip) if it's the only enabled profile

### ProfileEditModal
Small centered modal reusing existing modal styles:
- Emoji: row of ~12 preset emojis (no free-form input)
- Label: text input
- Config dir: text input + "Browse..." button (calls existing `selectDirectory` IPC)
- Enabled: toggle
- Save / Cancel

### ProfilePickerModal (updated)
Maps over `profiles.filter(p => p.enabled)` instead of hardcoded `['work', 'personal']`. Uses `profile.emoji` and `profile.label` for each card.

### Account filter
- `accountFilter: string | null` in App state
- `ResultsList` filters `results` by `result.account === accountFilter` when set
- A "clear filter" chip appears in the sidebar counter row when active

---

## Data Flow

### Startup
1. `main/index.ts` loads `profiles.json` (or writes Default profile if missing)
2. `ConversationScanner` receives the enabled profiles array and builds `configDirs`
3. Scanner assigns each conversation the profile `id` as its `account` field
4. Renderer fetches profiles via `getProfiles` IPC alongside existing `getProjects` / `getStats`

### Edit/save
1. User edits profile in `ProfileEditModal` and hits Save
2. Renderer calls `saveProfiles(profiles[])` IPC
3. Main writes `profiles.json`
4. Main re-initializes scanner with updated profile list
5. Renderer calls `rebuildIndex` so new `account` assignments take effect
6. `ProfilesPanel` re-fetches usage stats

---

## Error Handling

| Scenario | Behavior |
|---|---|
| `configDir` does not exist | Scanner silently skips (existing ENOENT catch); card shows "0 conversations / Never used" |
| Delete last enabled profile | Button is disabled in UI; no IPC call |
| `profiles.json` malformed | Treated as missing; Default profile written silently |
| `selectDirectory` canceled | No change (IPC returns null, already handled) |

---

## Out of Scope

- Per-profile MCP configuration
- Profile import/export
- Profile-level token budget alerts
- Syncing profiles across machines
