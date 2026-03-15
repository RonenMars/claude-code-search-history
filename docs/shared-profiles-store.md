# Shared Profiles Store

A single `profiles.json` file at `~/.config/threadbase/profiles.json` is the source of truth for Claude Code profile configuration across all apps in the Threadbase ecosystem (claude-search, intellij-claude-code-manager, vscode-claude-code-manager, cc-history).

---

## Why It Exists

Claude Code supports multiple configuration directories via the `CLAUDE_CONFIG_DIR` environment variable. A user can maintain separate profiles for different contexts (e.g. personal `~/.claude`, work `~/.claude-work`). Each profile's conversations are stored only inside that profile's config directory.

Without a shared store, each app had to maintain its own copy of the profile list. This led to:

- Duplicate definition burden — adding a new profile required updating every app separately
- Drift — apps could get out of sync, especially for custom `configDir` paths
- Resume failures — if an app didn't know which `configDir` a conversation belonged to, it couldn't pass `CLAUDE_CONFIG_DIR` to the `claude` CLI when resuming, causing "No conversation found" errors

The shared store solves all three by giving every app a single file to read from.

---

## File Location

| Scenario | Path |
|---|---|
| Default | `~/.config/threadbase/profiles.json` |
| Custom (via Settings) | Any directory chosen by the user, stored in app settings |

The directory is created automatically if it does not exist.

---

## File Schema

```json
{
  "profiles": [
    {
      "id": "default",
      "label": "Default",
      "emoji": "🏠",
      "configDir": "~/.claude",
      "enabled": true
    },
    {
      "id": "work",
      "label": "Work",
      "emoji": "💼",
      "configDir": "~/.claude-work",
      "enabled": true
    }
  ]
}
```

### Profile fields

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Stable identifier used as the `account` field on every conversation. Should be a slug or UUID — never changes even if the label/emoji is updated. |
| `label` | `string` | Human-readable display name shown in the UI. |
| `emoji` | `string` | Single emoji character used as an avatar. |
| `configDir` | `string` | Absolute path to the Claude config directory for this profile. A leading `~` is expanded to the user's home directory at runtime. |
| `enabled` | `boolean` | When `false`, the profile is hidden from the UI and its conversations are excluded from indexing. The record is preserved so it can be re-enabled without losing data. |

---

## How Each App Reads the Store

### claude-search (Electron)

`src/main/index.ts` exposes the current profiles path through `getProfilesPath()`:

```typescript
const DEFAULT_PROFILES_DIR = join(homedir(), ".config", "threadbase");
let activeProfilesDir = DEFAULT_PROFILES_DIR;

function getProfilesPath(): string {
  return join(activeProfilesDir, "profiles.json");
}
```

`activeProfilesDir` is:

1. Initialised to `DEFAULT_PROFILES_DIR` at module load.
2. Overridden at startup if `settings.profilesDir` is set (loaded before profiles are read).
3. Overridden at runtime when the user changes the folder via Settings — at that point the profile list and search index are reloaded immediately.

### intellij-claude-code-manager (Kotlin/IntelliJ)

`ProfileManager.kt` reads the store via:

```kotlin
val SHARED_PROFILES_FILE: Path = Path.of(
    System.getProperty("user.home"), ".config", "threadbase", "profiles.json"
)

fun loadSharedProfiles(): ProfilesConfig { ... }

fun resolveConfigDir(config: ProfilesConfig, accountId: String): String? {
    val home = System.getProperty("user.home")
    val profile = config.profiles.find { it.id == accountId && it.enabled } ?: return null
    return if (profile.configDir.startsWith("~")) home + profile.configDir.substring(1)
           else profile.configDir
}
```

`resolveConfigDir` is called just before launching a terminal session so the correct `CLAUDE_CONFIG_DIR` value is passed to `claude --resume`.

---

## Resume Flow: End to End

The profile store is essential for resuming Claude Code sessions from inside the IDE or the search app. Here is the full chain:

```
User clicks "Resume in Terminal"
        │
        ▼
Look up conversation's account field (e.g. "work")
        │
        ▼
loadSharedProfiles() → find profile with id == "work"
        │
        ▼
resolveConfigDir() → "/Users/alice/.claude-work"
        │
        ▼
TerminalManager.resumeSession(sessionId, projectPath, configDir)
        │
        ▼
buildResumeCommand():
  cd "/Users/alice/myproject" && \
  CLAUDE_CONFIG_DIR="/Users/alice/.claude-work" command claude --resume <sessionId>
        │
        ▼
Terminal tab opens; claude CLI finds the session inside ~/.claude-work
```

Key implementation details:

- `command claude` is used instead of `claude` to bypass any shell aliases (e.g. `_cl`) that might unconditionally override `CLAUDE_CONFIG_DIR`.
- If `configDir` is `null` (account not found in profiles, or profile disabled), the command is issued without `CLAUDE_CONFIG_DIR`, which causes the CLI to fall back to `~/.claude`.
- `cd "<projectPath>"` is prepended when `projectPath` is non-blank so the terminal starts in the right working directory.

---

## Legacy Migration

When claude-search first starts after this change is deployed it checks for a profiles file at the old location (`<app userData>/profiles.json`). If found and the new shared location does not yet exist, the old file is copied to `~/.config/threadbase/profiles.json`. This is a one-time silent migration — no user action required.

---

## Changing the Profiles Folder (claude-search)

Users who want to keep `profiles.json` somewhere other than `~/.config/threadbase` (e.g. inside a synced folder, a dotfiles repo, or a shared drive) can change the folder from Settings:

1. Open **Settings** (gear icon or `⌘,`).
2. Scroll to the **Storage** section.
3. Click **Browse…** and pick the target directory.
4. The app immediately reloads profiles and rebuilds the search index from the new location.
5. To go back to the default, click **Reset**.

The setting is persisted in the app's own settings file and restored on next launch.

### What changes at runtime

When `profilesDir` is updated via Settings:

1. `activeProfilesDir` is updated in the main process.
2. `ensureProfilesExist()` is called against the new path — the directory is created if needed, and a default profile is written if no `profiles.json` exists yet.
3. The search index is rebuilt against the enabled profiles found in the new location.
4. An `index-ready` event is sent to the renderer so the conversation list refreshes.

---

## Adding a New Integrating App

Any app that needs to read profile information should:

1. Resolve the profiles path as `<profilesDir>/profiles.json` where `profilesDir` defaults to `~/.config/threadbase` and can be overridden by user preference.
2. Parse the JSON with the schema above.
3. Filter to `enabled === true` before using profiles.
4. Expand a leading `~` in `configDir` to the home directory.
5. Match a conversation's `account` field to a profile's `id` to determine which `configDir` to pass to the `claude` CLI.

No write access is required for apps that only need to resume sessions. Write access is only needed if the app manages profiles (create/edit/delete).

---

## Related Files

| File | Role |
|---|---|
| `src/main/index.ts` | Reads/writes profiles; manages `activeProfilesDir`; handles `set-settings` reload |
| `src/shared/types.ts` | `Profile`, `ProfilesConfig`, `AppSettings.profilesDir` type definitions |
| `src/renderer/src/components/SettingsModal.tsx` | Storage section UI — Browse + Reset controls |
| `src/preload/index.ts` | Exposes `selectDirectory` IPC bridge used by Browse button |
| `ProfileManager.kt` (intellij plugin) | Reads shared store; resolves `configDir` for terminal resume |
| `TerminalManager.kt` (intellij plugin) | Builds and executes `claude --resume` command with correct env |
