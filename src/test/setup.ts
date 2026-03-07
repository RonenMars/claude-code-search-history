import '@testing-library/jest-dom/vitest'

// Mock window.electronAPI for renderer tests
if (typeof window !== 'undefined') {
  const noop = (): void => {}
  const asyncNoop = async (): Promise<unknown> => ({})

  window.electronAPI = {
    search: vi.fn().mockResolvedValue([]),
    getConversation: vi.fn().mockResolvedValue(null),
    getProjects: vi.fn().mockResolvedValue([]),
    getStats: vi.fn().mockResolvedValue({ conversations: 0, projects: 0 }),
    rebuildIndex: vi.fn().mockResolvedValue(true),
    getLatestConversation: vi.fn().mockResolvedValue(null),
    exportConversation: vi.fn().mockResolvedValue({ success: true }),
    getPreferences: vi.fn().mockResolvedValue({}),
    setPreferences: vi.fn().mockResolvedValue(true),
    onIndexReady: vi.fn(noop),
    onScanProgress: vi.fn(() => noop),
    ptySpawn: vi.fn().mockResolvedValue({ success: true }),
    ptyInput: vi.fn(noop),
    ptyResize: vi.fn(noop),
    ptyKill: vi.fn().mockResolvedValue(true),
    ptyStatus: vi.fn().mockResolvedValue({ active: false }),
    onPtyData: vi.fn(() => noop),
    onPtyExit: vi.fn(() => noop),
    getSettings: vi.fn().mockResolvedValue({ maxChatInstances: 3, groupByProject: false }),
    setSettings: vi.fn().mockResolvedValue(true),
    selectDirectory: vi.fn().mockResolvedValue(null),
    getDailyStats: vi.fn().mockResolvedValue([]),
    getProfilesUsage: vi.fn().mockResolvedValue({}),
    getProfiles: vi.fn().mockResolvedValue([]),
    saveProfiles: vi.fn().mockResolvedValue(true),
    getWorktrees: vi.fn().mockResolvedValue([]),
    openInFinder: vi.fn(asyncNoop) as unknown as (path: string) => Promise<void>,
    isIndexReady: vi.fn().mockResolvedValue(true),
    getGitInfo: vi.fn().mockResolvedValue({}),
    createWorktree: vi.fn().mockResolvedValue({ success: true }),
  }
}
