import { useState, useEffect, useCallback, useMemo } from 'react'
import type { Worktree } from '../../../shared/types'

interface WorktreesPanelProps {
  onChatInWorktree: (worktreePath: string) => Promise<void>
}

export default function WorktreesPanel({ onChatInWorktree }: WorktreesPanelProps): JSX.Element {
  const [worktrees, setWorktrees] = useState<Worktree[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await window.electronAPI.getWorktrees()
      setWorktrees(data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const grouped = useMemo(() => {
    const map = new Map<string, Worktree[]>()
    for (const w of worktrees) {
      if (!map.has(w.projectPath)) map.set(w.projectPath, [])
      map.get(w.projectPath)!.push(w)
    }
    return Array.from(map.entries())
  }, [worktrees])

  return (
    <div className="h-full overflow-y-auto bg-claude-darker">
      {/* Header */}
      <div className="px-8 py-6 border-b border-neutral-800 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-neutral-200">Git Worktrees</h2>
        <button
          onClick={load}
          disabled={loading}
          className="text-neutral-500 hover:text-neutral-300 transition-colors disabled:opacity-50"
          title="Refresh worktrees"
        >
          <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      {/* Body */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <span className="text-neutral-500 animate-pulse text-sm">Loading worktrees...</span>
        </div>
      ) : grouped.length === 0 ? (
        <div className="flex items-center justify-center h-32">
          <div className="text-center">
            <p className="text-neutral-500 text-sm">No linked worktrees found</p>
            <p className="text-neutral-600 text-xs mt-1">
              Create one with <code className="font-mono">git worktree add</code>
            </p>
          </div>
        </div>
      ) : (
        grouped.map(([projectPath, projectWorktrees]) => (
          <div key={projectPath} className="border-b border-neutral-800 last:border-0">
            <div className="px-8 py-3 bg-claude-dark">
              <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider truncate" title={projectPath}>
                {projectWorktrees[0].projectName}
              </p>
            </div>
            {projectWorktrees.map((w) => (
              <div
                key={w.path}
                className="px-8 py-4 flex items-center justify-between hover:bg-neutral-800/30 transition-colors"
              >
                <div className="min-w-0 flex-1 mr-4">
                  <div className="flex items-center gap-2 mb-0.5">
                    {w.isMain && (
                      <span className="text-xs text-neutral-600 font-medium">[main]</span>
                    )}
                    <span className="text-sm font-medium text-neutral-200 truncate">
                      {w.branch}
                    </span>
                    <span className="text-xs text-neutral-600 font-mono flex-shrink-0">{w.head}</span>
                  </div>
                  <p className="text-xs text-neutral-500 truncate" title={w.path}>{w.path}</p>
                </div>
                <button
                  onClick={() => onChatInWorktree(w.path)}
                  className="flex-shrink-0 px-3 py-1.5 text-xs text-claude-orange bg-claude-orange/10 hover:bg-claude-orange/20 border border-claude-orange/30 rounded-lg transition-colors"
                >
                  Open Chat
                </button>
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  )
}
