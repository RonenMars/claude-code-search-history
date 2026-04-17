---
phase: 3
slug: provider-abstraction-codex-cli-provider
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-27
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm run test:coverage` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test`
- **After every plan wave:** Run `npm run test:coverage`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 3-01-01 | 01 | 0 | Provider types | unit | `npm test` | ❌ W0 | ⬜ pending |
| 3-01-02 | 01 | 0 | ClaudeProvider interface | unit | `npm test` | ❌ W0 | ⬜ pending |
| 3-01-03 | 01 | 0 | CodexProvider JSONL parser | unit | `npm test` | ❌ W0 | ⬜ pending |
| 3-01-04 | 01 | 0 | ProviderRegistry merge/sort | unit | `npm test` | ❌ W0 | ⬜ pending |
| 3-02-01 | 02 | 1 | initializeSearch uses registry | unit | `npm test` | ✅ existing | ⬜ pending |
| 3-02-02 | 02 | 1 | SearchResult.provider in indexer | unit | `npm test` | ✅ existing | ⬜ pending |
| 3-02-03 | 02 | 1 | enabledProviders persists in settings | unit | `npm test` | ✅ existing | ⬜ pending |
| 3-03-01 | 03 | 2 | FilterPanel renders provider filter | unit | `npm test` | ✅ existing | ⬜ pending |
| 3-03-02 | 03 | 2 | ResultsList shows provider badge | unit | `npm test` | ✅ existing | ⬜ pending |
| 3-03-03 | 03 | 2 | Claude unaffected when Codex disabled | integration | `npm test` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/main/providers/claude.test.ts` — ClaudeProvider wrapping ConversationScanner
- [ ] `src/main/providers/codex.test.ts` — CodexProvider JSONL parsing (fixture-based, 4 line types)
- [ ] `src/main/providers/registry.test.ts` — ProviderRegistry merge/sort, auto-discovery, disabled provider exclusion

*(Existing test files for `indexer.test.ts`, `FilterPanel.test.tsx`, `ResultsList.test.tsx` need new test cases added, not new files.)*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Provider badge visible in running app | Phase 3 badge UI | Electron visual render | Launch app with Codex provider enabled, verify badge appears next to sessions |
| Auto-discovery notification shown on first run | Registry auto-detect | Notification timing/display | Delete settings, re-launch, verify "Codex detected" notification appears |
| "Continue Chat" hidden for Codex sessions | Phase 3 scope | UI interaction | Right-click Codex session, verify no "Open in New Chat" action |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
