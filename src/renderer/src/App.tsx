import { useState, useEffect, useCallback, useMemo, useRef, JSX } from "react";
import { v4 as uuidv4 } from "uuid";
import ActiveChatList from "./components/ActiveChatList";
import ChatTerminal from "./components/ChatTerminal";
import ConversationView from "./components/ConversationView";
import DisplayModePicker from "./components/DisplayModePicker";
import ErrorBoundary from "./components/ErrorBoundary";
import FilterPanel from "./components/FilterPanel";
import KanbanBoard from "./components/KanbanBoard";
import ProfilePickerModal from "./components/ProfilePickerModal";
import ProfilesPanel from "./components/ProfilesPanel";
import ResultsList from "./components/ResultsList";
import SearchBar from "./components/SearchBar";
import SettingsModal from "./components/SettingsModal";
import WorktreesPanel from "./components/WorktreesPanel";
import { useSearch } from "./hooks/useSearch";
import type {
  Conversation,
  SortOption,
  DateRangeOption,
  Profile,
  GitInfo, ChatInstance, AppSettings, ActiveSession
} from "../../shared/types";

type RightPanelView =
  | "conversation"
  | "profiles"
  | "settings"
  | "worktrees"
  | "empty";

export default function App(): JSX.Element {
  const [selectedConversation, setSelectedConversation] =
    useState<Conversation | null>(null);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [sortBy, setSortBy] = useState<SortOption>("recent");
  const [dateRange, setDateRange] = useState<DateRangeOption>("all");
  const [projects, setProjects] = useState<string[]>([]);
  const [stats, setStats] = useState({ conversations: 0, projects: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [isIndexing, setIsIndexing] = useState(true);
  const [scanProgress, setScanProgress] = useState<{
    scanned: number;
    total: number;
  } | null>(null);
  const prefsDebounceRef = useRef<NodeJS.Timeout>(undefined);

  // Multi-instance chat state
  const [chatInstances, setChatInstances] = useState<ChatInstance[]>([]);
  const [activeChatInstanceId, setActiveChatInstanceId] = useState<
    string | null
  >(null);
  const [appSettings, setAppSettings] = useState<AppSettings>({
    maxChatInstances: 3,
    displayMode: "list",
  });
  const typingTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Profile picker state
  const [pendingChatConfig, setPendingChatConfig] = useState<{
    cwd: string | null;
    resumeSessionId?: string;
  } | null>(null);
  const [rightPanel, setRightPanel] = useState<RightPanelView>("empty");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [accountFilter, setAccountFilter] = useState<string | null>(null);
  const [defaultProfileId, setDefaultProfileId] = useState<string | null>(null);
  const [providerFilter, setProviderFilter] = useState<string[] | null>(null)
  const [enabledProviders, setEnabledProviders] = useState<string[]>(['claude'])
  const [availableProviders, setAvailableProviders] = useState<Array<{ id: string; displayName: string; available: boolean }>>([])
  const [newlyDetectedProviders, setNewlyDetectedProviders] = useState<Array<{ id: string; displayName: string }>>([])
  const [gitInfo, setGitInfo] = useState<Record<string, GitInfo>>({});

  // Sidebar resize state
  const [sidebarWidth, setSidebarWidth] = useState(384); // w-96 = 384px
  const isResizing = useRef(false);

  const handleSidebarMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const onMouseMove = (moveEvent: MouseEvent): void => {
      if (!isResizing.current) return;
      const newWidth = Math.min(Math.max(moveEvent.clientX, 240), 800);
      setSidebarWidth(newWidth);
    };

    const onMouseUp = (): void => {
      isResizing.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, []);

  const { query, setQuery, results, searching, hasSearched, refresh } =
    useSearch(selectedProject, !isIndexing);
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    const loadData = async (): Promise<void> => {
      try {
        const [
          projectList,
          statsData,
          prefs,
          profileList,
          settings,
          indexReady,
          providerList,
        ] = await Promise.all([
          window.electronAPI.getProjects(),
          window.electronAPI.getStats(),
          window.electronAPI.getPreferences(),
          window.electronAPI.getProfiles(),
          window.electronAPI.getSettings(),
          window.electronAPI.isIndexReady(),
          window.electronAPI.getProviders(),
        ]);
        setProjects(projectList);
        setStats(statsData);
        setProfiles(profileList);
        setAppSettings(settings);
        setEnabledProviders(providerList.filter(p => p.enabled).map(p => p.id))
        setAvailableProviders(providerList.map(p => ({ id: p.id, displayName: p.displayName, available: p.available })))
        if (indexReady) {
          setIsIndexing(false);
          window.electronAPI.getGitInfo().then(setGitInfo).catch(console.error);
        }

        // Restore saved preferences (non-filter prefs only)
        if (prefs.defaultProfileId) setDefaultProfileId(prefs.defaultProfileId);
        if (prefs.sidebarWidth) setSidebarWidth(prefs.sidebarWidth);
      } catch (err) {
        console.error("Failed to initialize:", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();

    // Listen for index ready (fires once)
    window.electronAPI.onIndexReady(() => {
      setIsIndexing(false);
      loadData();
      refreshRef.current();
      window.electronAPI.getGitInfo().then(setGitInfo).catch(console.error);
    });

    // Listen for scan progress
    const cleanupProgress = window.electronAPI.onScanProgress((progress) => {
      setScanProgress(progress);
    });

    // Listen for newly detected providers
    const cleanupProviderDetected = window.electronAPI.onProviderDetected((providers) => {
      setNewlyDetectedProviders(providers)
    })

    return () => {
      cleanupProgress()
      cleanupProviderDetected()
    }

  }, []);

  // Filter and sort results
  const sortedResults = useMemo(() => {
    // First, filter by date range
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    const filtered = results.filter((result) => {
      if (dateRange === "all") return true;
      const resultDate = new Date(result.timestamp);

      switch (dateRange) {
        case "today":
          return resultDate >= today;
        case "week":
          return resultDate >= weekAgo;
        case "month":
          return resultDate >= monthAgo;
        default:
          return true;
      }
    });

    // Then, sort
    const sorted = [...filtered];
    switch (sortBy) {
      case "recent":
        sorted.sort(
          (a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
        );
        break;
      case "oldest":
        sorted.sort(
          (a, b) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
        );
        break;
      case "most-messages":
        sorted.sort((a, b) => b.messageCount - a.messageCount);
        break;
      case "least-messages":
        sorted.sort((a, b) => a.messageCount - b.messageCount);
        break;
      case "alphabetical":
        sorted.sort((a, b) => a.projectName.localeCompare(b.projectName));
        break;
    }

    // Provider filter (after sort)
    const providerFiltered = providerFilter && providerFilter.length > 0
      ? sorted.filter(r => providerFilter.includes(r.provider ?? 'claude'))
      : sorted
    return providerFiltered
  }, [results, sortBy, dateRange, providerFilter]);

  // Persist preferences on change (debounced)
  useEffect(() => {
    if (prefsDebounceRef.current) {
      clearTimeout(prefsDebounceRef.current);
    }
    prefsDebounceRef.current = setTimeout(() => {
      window.electronAPI.setPreferences({ sidebarWidth });
    }, 500);

    return () => {
      if (prefsDebounceRef.current) {
        clearTimeout(prefsDebounceRef.current);
      }
    };
  }, [sidebarWidth]);

  useEffect(() => {
    const cleanup = window.electronAPI.onPtyData((instanceId) => {
      setChatInstances((prev) =>
        prev.map((inst) =>
          inst.instanceId === instanceId
            ? { ...inst, isClaudeTyping: true }
            : inst,
        ),
      );
      const existing = typingTimers.current.get(instanceId);
      if (existing) clearTimeout(existing);
      const timer = setTimeout(() => {
        setChatInstances((prev) =>
          prev.map((inst) =>
            inst.instanceId === instanceId
              ? { ...inst, isClaudeTyping: false }
              : inst,
          ),
        );
        typingTimers.current.delete(instanceId);
      }, 1500);
      typingTimers.current.set(instanceId, timer);
    });

    return () => {
      cleanup();
      for (const t of typingTimers.current.values()) clearTimeout(t);
      typingTimers.current.clear();
    };
  }, []);

  useEffect(() => {
    const cleanup = window.electronAPI.onPtyExit((instanceId, code) => {
      setChatInstances((prev) =>
        prev.map((inst) =>
          inst.instanceId === instanceId
            ? {
              ...inst,
              status: "exited",
              exitCode: code,
              isClaudeTyping: false,
            }
            : inst,
        ),
      );
    });
    return cleanup;
  }, []);

  const handleSelectResult = useCallback(async (id: string) => {
    try {
      const conversation = await window.electronAPI.getConversation(id);
      setSelectedConversation(conversation);
      setRightPanel(conversation ? "conversation" : "empty");
    } catch (err) {
      console.error("Failed to load conversation:", err);
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    setIsLoading(true);
    try {
      await window.electronAPI.rebuildIndex();
      const [projectList, statsData] = await Promise.all([
        window.electronAPI.getProjects(),
        window.electronAPI.getStats(),
      ]);
      setProjects(projectList);
      setStats(statsData);
    } catch (err) {
      console.error("Failed to refresh:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ─── Chat handlers ────────────────────────────────────────────────

  const startChat = useCallback(
    async (
      config: { cwd: string | null; resumeSessionId?: string },
      profile: Profile,
    ) => {
      let cwd = config.cwd;
      if (cwd === null) {
        const dir = await window.electronAPI.selectDirectory();
        if (!dir) return;
        cwd = dir;
      }

      const instanceId = uuidv4();
      const newInstance: ChatInstance = {
        instanceId,
        cwd,
        profile: profile.id as ChatInstance["profile"],
        status: "active",
        exitCode: null,
        resumeSessionId: config.resumeSessionId,
        configDir: profile.configDir,
        isClaudeTyping: false,
      };
      setChatInstances((prev) => [...prev, newInstance]);
      setActiveChatInstanceId(instanceId);
      setSelectedConversation(null);
    },
    [],
  );

  const handleNewChat = useCallback(async () => {
    const activeCount = chatInstances.filter(
      (i) => i.status === "active",
    ).length;
    if (activeCount >= appSettings.maxChatInstances) {
      window.alert(
        `Maximum of ${appSettings.maxChatInstances} active chats reached. Close one to start a new session.`,
      );
      return;
    }
    const defaultProfile = defaultProfileId
      ? profiles.find((p) => p.id === defaultProfileId && p.enabled)
      : null;
    if (defaultProfile) {
      await startChat({ cwd: null }, defaultProfile);
    } else {
      setPendingChatConfig({ cwd: null, resumeSessionId: undefined });
    }
  }, [
    chatInstances,
    appSettings.maxChatInstances,
    defaultProfileId,
    profiles,
    startChat,
  ]);

  const handleChatInProject = useCallback(
    async (projectPath: string) => {
      const activeCount = chatInstances.filter(
        (i) => i.status === "active",
      ).length;
      if (activeCount >= appSettings.maxChatInstances) {
        window.alert(
          `Maximum of ${appSettings.maxChatInstances} active chats reached. Close one to start a new session.`,
        );
        return;
      }
      const defaultProfile = defaultProfileId
        ? profiles.find((p) => p.id === defaultProfileId && p.enabled)
        : null;
      if (defaultProfile) {
        await startChat({ cwd: projectPath }, defaultProfile);
      } else {
        setPendingChatConfig({ cwd: projectPath, resumeSessionId: undefined });
      }
    },
    [
      chatInstances,
      appSettings.maxChatInstances,
      defaultProfileId,
      profiles,
      startChat,
    ],
  );

  const handleContinueChat = useCallback(
    async (projectPath: string, sessionId: string, account?: string) => {
      const activeCount = chatInstances.filter(
        (i) => i.status === "active",
      ).length;
      if (activeCount >= appSettings.maxChatInstances) {
        window.alert(
          `Maximum of ${appSettings.maxChatInstances} active chats reached. Close one to start a new session.`,
        );
        return;
      }
      // Prefer the conversation's own profile so CLAUDE_CONFIG_DIR matches
      const conversationProfile = account
        ? profiles.find((p) => p.id === account && p.enabled)
        : null;
      const defaultProfile = defaultProfileId
        ? profiles.find((p) => p.id === defaultProfileId && p.enabled)
        : null;
      const profile = conversationProfile || defaultProfile;
      if (profile) {
        await startChat(
          { cwd: projectPath, resumeSessionId: sessionId },
          profile,
        );
      } else {
        setPendingChatConfig({ cwd: projectPath, resumeSessionId: sessionId });
      }
    },
    [
      chatInstances,
      appSettings.maxChatInstances,
      defaultProfileId,
      profiles,
      startChat,
    ],
  );

  useEffect(() => {
    const cleanup = window.electronAPI.onContinueChatFromMenu((payload) => {
      handleContinueChat(payload.projectPath, payload.sessionId, payload.account);
    });
    return cleanup;
     
  }, [handleContinueChat]);

  const handleProfileSelected = useCallback(
    async (profile: Profile, remember: boolean) => {
      const pending = pendingChatConfig;
      setPendingChatConfig(null);
      if (!pending) return;

      if (remember) {
        setDefaultProfileId(profile.id);
        await window.electronAPI.setPreferences({
          defaultProfileId: profile.id,
        });
      }

      await startChat(pending, profile);
    },
    [pendingChatConfig, startChat],
  );

  const handleClearDefaultProfile = useCallback(async () => {
    setDefaultProfileId(null);
    await window.electronAPI.setPreferences({ defaultProfileId: undefined });
  }, []);

  const handleGoToRootProject = useCallback(async (rootProjectPath: string) => {
    try {
      const conversation =
        await window.electronAPI.getLatestConversation(rootProjectPath);
      if (conversation) {
        setSelectedConversation(conversation);
        setActiveChatInstanceId(null);
        setRightPanel("conversation");
      }
    } catch (err) {
      console.error("Failed to load root project conversation:", err);
    }
  }, []);

  const handleCreateWorktree = useCallback(
    async (rootPath: string, worktreePath: string, branch: string) => {
      const result = await window.electronAPI.createWorktree({
        rootPath,
        worktreePath,
        branch,
      });
      if (result.success) {
        window.electronAPI.getGitInfo().then(setGitInfo).catch(console.error);
      }
      return result;
    },
    [],
  );

  const handleContextMenu = useCallback(
    (data: {
      id: string;
      sessionId: string;
      sessionPath: string;
      title: string;
      projectPath: string;
      account?: string;
    }) => {
      window.electronAPI.showContextMenu(data);
    },
    [],
  );

  const handleProfilePickerCancel = useCallback(() => {
    setPendingChatConfig(null);
  }, []);

  const handleFocusInstance = useCallback((instanceId: string) => {
    setActiveChatInstanceId(instanceId);
    setSelectedConversation(null);
  }, []);

  const handleCloseInstance = useCallback(
    async (instanceId: string) => {
      const instance = chatInstances.find((i) => i.instanceId === instanceId);
      if (instance?.status === "active") {
        await window.electronAPI.ptyKill(instanceId);
      }
      setChatInstances((prev) =>
        prev.filter((i) => i.instanceId !== instanceId),
      );
      setActiveChatInstanceId((prev) => (prev === instanceId ? null : prev));
    },
    [chatInstances],
  );

  const handleFilterByProfile = useCallback(
    (profileId: string | null) => {
      setAccountFilter(profileId);
      setRightPanel(selectedConversation ? "conversation" : "empty");
    },
    [selectedConversation],
  );

  const handleProviderFilterChange = useCallback((filter: string[] | null) => {
    setProviderFilter(filter)
  }, [])

  const handleToggleProvider = useCallback(async (providerId: string, enabled: boolean) => {
    await window.electronAPI.setProviderEnabled(providerId, enabled)
    const providerList = await window.electronAPI.getProviders()
    setEnabledProviders(providerList.filter(p => p.enabled).map(p => p.id))
    setAvailableProviders(providerList.map(p => ({ id: p.id, displayName: p.displayName, available: p.available })))
  }, [])

  const handleSaveSettings = useCallback(
    async (partial: Partial<AppSettings>) => {
      const updated = { ...appSettings, ...partial };
      setAppSettings(updated);
      await window.electronAPI.setSettings(partial);
    },
    [appSettings],
  );

  const isScanning =
    isLoading ||
    isIndexing ||
    !hasSearched ||
    (searching && results.length === 0);

  // Derive ActiveSession[] from ChatInstance[] for the Kanban board.
  const boardSessions = useMemo<ActiveSession[]>(() => {
    const now = Date.now();
    return chatInstances.map((inst) => {
      let status: ActiveSession['status'] = 'idle';
      if (inst.status === 'exited') {
        status = inst.exitCode === 0 || inst.exitCode === null ? 'completed' : 'failed';
      } else if (inst.isClaudeTyping) {
        status = 'running';
      } else if (inst.status === 'active') {
        status = 'waiting_input';
      }
      return {
        id: inst.resumeSessionId ?? inst.instanceId,
        instanceId: inst.instanceId,
        projectPath: inst.cwd,
        projectName: inst.cwd.split('/').filter(Boolean).pop() ?? inst.cwd,
        status,
        lastOutput: '',
        elapsedMs: now - now, // placeholder — no start time tracked on ChatInstance yet
        promptCount: 0,
        startedAt: new Date(),
      };
    });
  }, [chatInstances]);

  const handleProfilesSaved = useCallback(
    async (updated: Profile[]) => {
      setProfiles(updated);
      await window.electronAPI.saveProfiles(updated);
      // Refresh project list and stats since index was rebuilt
      const [projectList, statsData] = await Promise.all([
        window.electronAPI.getProjects(),
        window.electronAPI.getStats(),
      ]);
      setProjects(projectList);
      setStats(statsData);
      refresh();

      // Clear account filter if the selected profile is no longer scannable,
      // or if only one scannable profile remains (filter becomes hidden)
      const scannableProfiles = updated.filter((p) => p.enabled && p.scanHistory !== false);
      setAccountFilter((prev) => {
        if (!prev) return prev;
        const stillScannable = scannableProfiles.some((p) => p.id === prev);
        if (!stillScannable || scannableProfiles.length <= 1) return null;
        return prev;
      });
    },
    [refresh],
  );

  return (
    <div className="bg-claude-darker flex h-screen flex-col">
      {/* Title bar */}
      <div className="titlebar-drag bg-claude-dark flex h-8 items-center justify-between border-b border-neutral-800 pr-4 pl-20">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-neutral-400">
            Claude Code Search
          </span>
        </div>
        <div className="titlebar-no-drag flex items-center gap-3 text-xs text-neutral-500">
          <button
            onClick={handleNewChat}
            disabled={isLoading}
            className="flex items-center gap-1 transition-colors hover:text-neutral-300 disabled:pointer-events-none disabled:opacity-50"
            title="New Claude Code chat"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            Chat
          </button>
          <button
            onClick={() => setRightPanel("worktrees")}
            disabled={isLoading}
            className="transition-colors hover:text-neutral-300 disabled:pointer-events-none disabled:opacity-50"
            title="Git worktrees"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <circle cx="6" cy="6" r="2" strokeWidth={2} />
              <circle cx="6" cy="18" r="2" strokeWidth={2} />
              <circle cx="18" cy="6" r="2" strokeWidth={2} />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 8v8M8 6h4a4 4 0 014 4v0"
              />
            </svg>
          </button>
          <button
            onClick={() => setRightPanel("settings")}
            disabled={isLoading}
            className="transition-colors hover:text-neutral-300 disabled:pointer-events-none disabled:opacity-50"
            title="Settings"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </button>
          <span>{stats.conversations} conversations</span>
          <span>{stats.projects} projects</span>
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="transition-colors hover:text-neutral-300 disabled:opacity-50"
            title="Refresh index"
          >
            <svg
              className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
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
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div
          className="bg-claude-dark relative flex flex-col border-r border-neutral-800"
          style={{ width: sidebarWidth, minWidth: 240, maxWidth: 800 }}
        >
          <ActiveChatList
            instances={chatInstances}
            activeChatInstanceId={activeChatInstanceId}
            onFocus={handleFocusInstance}
            onClose={handleCloseInstance}
          />
          {/* Provider discovery notification */}
          {newlyDetectedProviders.length > 0 && (
            <div className="mx-2 mb-2 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-xs text-neutral-300">
              <span>New provider detected: {newlyDetectedProviders.map(p => p.displayName).join(', ')}</span>
              <button
                onClick={() => setNewlyDetectedProviders([])}
                className="ml-2 text-neutral-500 hover:text-neutral-300"
              >
                Dismiss
              </button>
            </div>
          )}
          {/* Search */}
          <div className="border-b border-neutral-800 p-4">
            <SearchBar
              value={query}
              onChange={setQuery}
              isSearching={searching}
              disabled={isLoading}
            />
            <FilterPanel
              projects={projects}
              selectedProject={selectedProject}
              onProjectChange={setSelectedProject}
              sortBy={sortBy}
              onSortChange={setSortBy}
              dateRange={dateRange}
              onDateRangeChange={setDateRange}
              onChatInProject={handleChatInProject}
              profiles={profiles}
              accountFilter={accountFilter}
              onAccountFilterChange={setAccountFilter}
              disabled={isLoading}
              enabledProviders={enabledProviders}
              providerFilter={providerFilter}
              onProviderFilterChange={handleProviderFilterChange}
            />
          </div>

          {/* Results Counter + Display Mode */}
          <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-2">
            <div className="text-xs text-neutral-500">
              {!isScanning && sortedResults.length > 0 && (
                sortedResults.length === results.length ? (
                  <>
                    Showing{" "}
                    <span className="font-medium text-neutral-400">
                      {sortedResults.length}
                    </span>{" "}
                    conversations
                  </>
                ) : (
                  <>
                    Showing{" "}
                    <span className="font-medium text-neutral-400">
                      {sortedResults.length}
                    </span>{" "}
                    of{" "}
                    <span className="font-medium text-neutral-400">
                      {results.length}
                    </span>{" "}
                    conversations
                  </>
                )
              )}
            </div>
            <DisplayModePicker
              value={appSettings.displayMode}
              onChange={(mode) => handleSaveSettings({ displayMode: mode })}
              disabled={isScanning}
            />
          </div>

          {/* Board mode — replaces the results list with a full kanban view */}
          {appSettings.displayMode === 'board' && (
            <div className="flex-1 overflow-hidden">
              <KanbanBoard
                sessions={boardSessions}
                onSelectSession={(instanceId) => {
                  setActiveChatInstanceId(instanceId);
                  setSelectedConversation(null);
                }}
              />
            </div>
          )}

          {/* Results */}
          <div className={`flex-1 overflow-hidden ${appSettings.displayMode === 'board' ? 'hidden' : ''}`}>
            {isScanning ? (
              <div className="flex h-full flex-col">
                {scanProgress ? (
                  <div className="flex h-full flex-col items-center justify-center">
                    <div className="mb-2 animate-pulse text-neutral-500">
                      {`Scanning... ${scanProgress.scanned}/${scanProgress.total} files`}
                    </div>
                    {scanProgress.total > 0 && (
                      <div className="mx-auto h-1 w-48 overflow-hidden rounded-full bg-neutral-800">
                        <div
                          className="bg-claude-orange h-full transition-all duration-300"
                          style={{
                            width: `${(scanProgress.scanned / scanProgress.total) * 100}%`,
                          }}
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div
                        key={i}
                        className="animate-pulse border-b border-neutral-800 p-4"
                      >
                        <div className="mb-2 flex items-center justify-between">
                          <div className="h-3 w-24 rounded bg-neutral-800" />
                          <div className="h-3 w-16 rounded bg-neutral-800" />
                        </div>
                        <div className="mb-2 h-3 w-48 rounded bg-neutral-800/60" />
                        <div className="mb-1 h-3 w-full rounded bg-neutral-800/40" />
                        <div className="h-3 w-3/4 rounded bg-neutral-800/40" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <ResultsList
                results={sortedResults}
                selectedId={selectedConversation?.id || null}
                onSelect={handleSelectResult}
                onNewChat={handleChatInProject}
                onContextMenu={handleContextMenu}
                query={query}
                gitInfo={gitInfo}
                activeCwd={
                  chatInstances.find(
                    (i) => i.instanceId === activeChatInstanceId,
                  )?.cwd ?? null
                }
                activeChatSessionId={
                  chatInstances.find(
                    (i) => i.instanceId === activeChatInstanceId,
                  )?.resumeSessionId
                }
                isClaudeTyping={chatInstances.some((i) => i.isClaudeTyping)}
                activeChatProfile={
                  chatInstances.find(
                    (i) => i.instanceId === activeChatInstanceId,
                  )?.profile ?? null
                }
                accountFilter={accountFilter}
                profiles={profiles}
                displayMode={appSettings.displayMode}
                enabledProviders={enabledProviders}
              />
            )}
          </div>
          {/* Resize handle */}
          <div
            className={`absolute top-0 right-0 z-10 h-full w-1 transition-colors ${isLoading || isIndexing ? "cursor-default" : "hover:bg-claude-orange/40 active:bg-claude-orange/60 cursor-col-resize"}`}
            onMouseDown={
              isLoading || isIndexing ? undefined : handleSidebarMouseDown
            }
          />
        </div>

        {/* Right panel: Chat, Profiles, Conversation, or empty */}
        <div className="flex-1 overflow-hidden">
          {(() => {
            const activeInstance = chatInstances.find(
              (i) => i.instanceId === activeChatInstanceId,
            );
            if (activeInstance) {
              return (
                <ChatTerminal
                  key={activeInstance.instanceId}
                  instanceId={activeInstance.instanceId}
                  cwd={activeInstance.cwd}
                  resumeSessionId={activeInstance.resumeSessionId}
                  profile={activeInstance.profile ?? undefined}
                  configDir={activeInstance.configDir}
                  onExit={() => {
                    /* handled by global onPtyExit effect */
                  }}
                  onClose={() => setActiveChatInstanceId(null)}
                />
              );
            }
            if (rightPanel === "settings") {
              return (
                <SettingsModal
                  settings={appSettings}
                  onSave={handleSaveSettings}
                  profiles={profiles}
                  onFilterByProfile={handleFilterByProfile}
                  onProfilesSaved={handleProfilesSaved}
                  onClose={() =>
                    setRightPanel(
                      selectedConversation ? "conversation" : "empty",
                    )
                  }
                  defaultProfileId={defaultProfileId}
                  onClearDefaultProfile={handleClearDefaultProfile}
                  enabledProviders={enabledProviders}
                  availableProviders={availableProviders}
                  onToggleProvider={handleToggleProvider}
                />
              );
            }
            if (rightPanel === "worktrees") {
              return (
                <WorktreesPanel
                  onChatInWorktree={handleChatInProject}
                  onClose={() =>
                    setRightPanel(
                      selectedConversation ? "conversation" : "empty",
                    )
                  }
                />
              );
            }
            if (rightPanel === "profiles") {
              return (
                <ProfilesPanel
                  profiles={profiles}
                  onFilterByProfile={handleFilterByProfile}
                  onProfilesSaved={handleProfilesSaved}
                />
              );
            }
            if (selectedConversation) {
              return (
                <ErrorBoundary>
                  <ConversationView
                    conversation={selectedConversation}
                    query={query}
                    onContinueChat={handleContinueChat}
                    gitInfo={gitInfo}
                    onGoToRootProject={handleGoToRootProject}
                    onCreateWorktree={handleCreateWorktree}
                  />
                </ErrorBoundary>
              );
            }
            return (
              <div className="flex h-full items-center justify-center text-neutral-500">
                <div className="text-center">
                  <svg
                    className="mx-auto mb-4 h-16 w-16 opacity-50"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1}
                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                    />
                  </svg>
                  <p>Select a conversation to view</p>
                  <button
                    onClick={handleNewChat}
                    className="text-claude-orange bg-claude-orange/10 hover:bg-claude-orange/20 border-claude-orange/30 mt-4 rounded-lg border px-4 py-2 text-sm transition-colors"
                  >
                    Start a new chat
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {pendingChatConfig !== null && (
        <ProfilePickerModal
          profiles={profiles}
          onSelect={handleProfileSelected}
          onCancel={handleProfilePickerCancel}
        />
      )}
    </div>
  );
}
