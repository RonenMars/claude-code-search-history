import { useState, useEffect, useCallback, useMemo } from "react";
import type { Worktree } from "../../../shared/types";

interface WorktreesPanelProps {
  onChatInWorktree: (worktreePath: string) => Promise<void>;
  onClose: () => void;
}

export default function WorktreesPanel({
  onChatInWorktree,
  onClose,
}: WorktreesPanelProps): JSX.Element {
  const [worktrees, setWorktrees] = useState<Worktree[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await window.electronAPI.getWorktrees();
      setWorktrees(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const grouped = useMemo(() => {
    const map = new Map<string, Worktree[]>();
    for (const w of worktrees) {
      if (!map.has(w.projectPath)) map.set(w.projectPath, []);
      map.get(w.projectPath)!.push(w);
    }
    return Array.from(map.entries()).map(([projectPath, items]) => ({
      projectPath,
      main: items.find((w) => w.isMain),
      linked: items.filter((w) => !w.isMain),
    }));
  }, [worktrees]);

  return (
    <div className="h-full overflow-y-auto bg-claude-darker">
      {/* Header */}
      <div className="px-8 py-6 border-b border-neutral-800 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-neutral-200">
          Git Worktrees
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="text-neutral-500 hover:text-neutral-300 transition-colors disabled:opacity-50"
            title="Refresh worktrees"
          >
            <svg
              className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
          <button
            onClick={onClose}
            className="text-neutral-500 hover:text-neutral-300 transition-colors"
            title="Close worktrees"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Body */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <span className="text-neutral-500 animate-pulse text-sm">
            Loading worktrees...
          </span>
        </div>
      ) : grouped.length === 0 ? (
        <div className="flex items-center justify-center h-32">
          <div className="text-center">
            <p className="text-neutral-500 text-sm">
              No linked worktrees found
            </p>
            <p className="text-neutral-600 text-xs mt-1">
              Create one with{" "}
              <code className="font-mono">git worktree add</code>
            </p>
          </div>
        </div>
      ) : (
        grouped.map(({ projectPath, main, linked }) => (
          <div
            key={projectPath}
            className="border-b border-neutral-800 last:border-0"
          >
            {/* Main worktree — group header */}
            <div className="px-8 py-3 bg-claude-dark flex items-center gap-2">
              <svg
                className="w-3.5 h-3.5 text-neutral-500 shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                />
              </svg>
              <p
                className="text-xs font-semibold text-neutral-400 uppercase tracking-wider truncate"
                title={projectPath}
              >
                {main?.projectName ?? projectPath}
              </p>
              {main && (
                <>
                  <CopyableText
                    text={main.branch}
                    className="text-xs text-neutral-600 font-mono shrink-0"
                  />
                  <CopyableText
                    text={main.head}
                    className="text-xs text-neutral-600 font-mono shrink-0"
                  />
                  <button
                    type="button"
                    onClick={() => window.electronAPI.openInFinder(main.path)}
                    className="shrink-0 p-0.5 rounded text-neutral-500 hover:text-neutral-300 hover:bg-neutral-700 transition-colors"
                    title="Open in Finder"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      className="w-3 h-3"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                      />
                    </svg>
                  </button>
                </>
              )}
            </div>

            {/* Linked worktrees — tree children */}
            {linked.map((w, i) => (
              <LinkedWorktreeRow
                key={w.path}
                worktree={w}
                isLast={i === linked.length - 1}
                onChatInWorktree={onChatInWorktree}
              />
            ))}
          </div>
        ))
      )}
    </div>
  );
}

// ─── Copyable text with inline copy button ───────────────────────────────

function CopyableText({
  text,
  className,
}: {
  text: string;
  className?: string;
}): JSX.Element {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // no-op
    }
  };

  return (
    <span className={`inline-flex items-center gap-1 ${className ?? ""}`}>
      <span className="truncate">{text}</span>
      <button
        type="button"
        onClick={handleCopy}
        className="shrink-0 p-0.5 rounded text-neutral-500 hover:text-neutral-300 hover:bg-neutral-700 transition-colors"
        title={copied ? "Copied!" : `Copy ${text}`}
      >
        {copied ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            className="w-3 h-3"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M5 13l4 4L19 7"
            />
          </svg>
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            className="w-3 h-3"
          >
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" strokeWidth="2" />
            <rect x="3" y="3" width="13" height="13" rx="2" ry="2" strokeWidth="2" />
          </svg>
        )}
      </button>
    </span>
  );
}

// ─── Linked worktree row ──────────────────────────────────────────────────

interface LinkedWorktreeRowProps {
  worktree: Worktree;
  isLast: boolean;
  onChatInWorktree: (path: string) => Promise<void>;
}

function LinkedWorktreeRow({
  worktree,
  isLast,
  onChatInWorktree,
}: LinkedWorktreeRowProps): JSX.Element {
  return (
    <div className="relative flex items-center hover:bg-neutral-800/30 transition-colors">
      {/* Tree connector */}
      <div className="shrink-0 w-14 self-stretch relative">
        <div
          className="absolute left-8 top-0 w-px bg-neutral-700/50"
          style={{ height: isLast ? "50%" : "100%" }}
        />
        <div className="absolute left-8 top-1/2 w-3 h-px bg-neutral-700/50" />
      </div>

      {/* Content */}
      <div className="flex items-center gap-3 flex-1 min-w-0 py-3 pr-8">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <CopyableText
              text={worktree.branch}
              className="text-sm font-medium text-neutral-200"
            />
            <CopyableText
              text={worktree.head}
              className="text-xs text-neutral-600 font-mono shrink-0"
            />
            <button
              type="button"
              onClick={() => window.electronAPI.openInFinder(worktree.path)}
              className="shrink-0 p-0.5 rounded text-neutral-500 hover:text-neutral-300 hover:bg-neutral-700 transition-colors"
              title="Open in Finder"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                className="w-3 h-3"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                />
              </svg>
            </button>
          </div>
          <p
            className="text-xs text-neutral-500 truncate"
            title={worktree.path}
          >
            {worktree.path}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onChatInWorktree(worktree.path)}
            className="flex-shrink-0 px-3 py-1.5 text-xs text-claude-orange bg-claude-orange/10 hover:bg-claude-orange/20 border border-claude-orange/30 rounded-lg transition-colors"
          >
            Open Chat
          </button>
        </div>
      </div>
    </div>
  );
}

