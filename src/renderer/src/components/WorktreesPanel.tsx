import { useState, useEffect, useCallback, useMemo, type JSX } from "react";
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
    <div className="bg-claude-darker h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-800 px-8 py-6">
        <h2 className="text-sm font-semibold text-neutral-200">
          Git Worktrees
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="text-neutral-500 transition-colors hover:text-neutral-300 disabled:opacity-50"
            title="Refresh worktrees"
          >
            <svg
              className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
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
            className="text-neutral-500 transition-colors hover:text-neutral-300"
            title="Close worktrees"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Body */}
      {loading ? (
        <div className="flex h-32 items-center justify-center">
          <span className="animate-pulse text-sm text-neutral-500">
            Loading worktrees...
          </span>
        </div>
      ) : grouped.length === 0 ? (
        <div className="flex h-32 items-center justify-center">
          <div className="text-center">
            <p className="text-sm text-neutral-500">
              No linked worktrees found
            </p>
            <p className="mt-1 text-xs text-neutral-600">
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
            <div className="bg-claude-dark flex items-center gap-2 px-8 py-3">
              <svg
                className="h-3.5 w-3.5 shrink-0 text-neutral-500"
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
                className="truncate text-xs font-semibold tracking-wider text-neutral-400 uppercase"
                title={projectPath}
              >
                {main?.projectName ?? projectPath}
              </p>
              {main && (
                <>
                  <CopyableText
                    text={main.branch}
                    className="shrink-0 font-mono text-xs text-neutral-600"
                  />
                  <CopyableText
                    text={main.head}
                    className="shrink-0 font-mono text-xs text-neutral-600"
                  />
                  <button
                    type="button"
                    onClick={() => window.electronAPI.openInFinder(main.path)}
                    className="shrink-0 rounded p-0.5 text-neutral-500 transition-colors hover:bg-neutral-700 hover:text-neutral-300"
                    title="Open in Finder"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      className="h-3 w-3"
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
        className="shrink-0 rounded p-0.5 text-neutral-500 transition-colors hover:bg-neutral-700 hover:text-neutral-300"
        title={copied ? "Copied!" : `Copy ${text}`}
      >
        {copied ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            className="h-3 w-3"
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
            className="h-3 w-3"
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
    <div className="relative flex items-center transition-colors hover:bg-neutral-800/30">
      {/* Tree connector */}
      <div className="relative w-14 shrink-0 self-stretch">
        <div
          className="absolute top-0 left-8 w-px bg-neutral-700/50"
          style={{ height: isLast ? "50%" : "100%" }}
        />
        <div className="absolute top-1/2 left-8 h-px w-3 bg-neutral-700/50" />
      </div>

      {/* Content */}
      <div className="flex min-w-0 flex-1 items-center gap-3 py-3 pr-8">
        <div className="min-w-0 flex-1">
          <div className="mb-0.5 flex items-center gap-2">
            <CopyableText
              text={worktree.branch}
              className="text-sm font-medium text-neutral-200"
            />
            <CopyableText
              text={worktree.head}
              className="shrink-0 font-mono text-xs text-neutral-600"
            />
            <button
              type="button"
              onClick={() => window.electronAPI.openInFinder(worktree.path)}
              className="shrink-0 rounded p-0.5 text-neutral-500 transition-colors hover:bg-neutral-700 hover:text-neutral-300"
              title="Open in Finder"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                className="h-3 w-3"
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
            className="truncate text-xs text-neutral-500"
            title={worktree.path}
          >
            {worktree.path}
          </p>
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={() => onChatInWorktree(worktree.path)}
            className="text-claude-orange bg-claude-orange/10 hover:bg-claude-orange/20 border-claude-orange/30 flex-shrink-0 rounded-lg border px-3 py-1.5 text-xs transition-colors"
          >
            Open Chat
          </button>
        </div>
      </div>
    </div>
  );
}

