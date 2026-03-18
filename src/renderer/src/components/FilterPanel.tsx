import { useState, useRef, useEffect, useMemo, useCallback, Fragment, type JSX } from 'react'
import type { SortOption, DateRangeOption, Profile } from '../../../shared/types'

interface FilterPanelProps {
  projects: string[]
  selectedProject: string
  onProjectChange: (project: string) => void
  sortBy: SortOption
  onSortChange: (sort: SortOption) => void
  dateRange: DateRangeOption
  onDateRangeChange: (range: DateRangeOption) => void
  onChatInProject: (projectPath: string) => void
  profiles: Profile[]
  accountFilter: string | null
  onAccountFilterChange: (profileId: string | null) => void
  disabled?: boolean
}

export default function FilterPanel({
  projects,
  selectedProject,
  onProjectChange,
  sortBy,
  onSortChange,
  dateRange,
  onDateRangeChange,
  onChatInProject,
  profiles,
  accountFilter,
  onAccountFilterChange,
  disabled
}: FilterPanelProps): JSX.Element {
  const enabledProfiles = profiles.filter((p) => p.enabled && p.scanHistory !== false)
  const activeProfile = accountFilter ? enabledProfiles.find((p) => p.id === accountFilter) : null

  return (
    <div className={`mt-3 space-y-2${disabled ? " pointer-events-none opacity-50" : ""}`}>
      {/* Project Filter — autocomplete */}
      <ProjectAutocomplete
        projects={projects}
        selectedProject={selectedProject}
        onProjectChange={onProjectChange}
      />

      {selectedProject && (
        <button
          onClick={() => onChatInProject(selectedProject)}
          className="text-claude-orange bg-claude-orange/10 hover:bg-claude-orange/20 border-claude-orange/30 flex w-full items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors"
        >
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          Chat in this project
        </button>
      )}

      {/* Sort and Date Range */}
      <div className="flex gap-2">
        <select
          value={sortBy}
          onChange={(e) => onSortChange(e.target.value as SortOption)}
          className="custom-select focus:border-claude-orange flex-1 cursor-pointer rounded-lg border border-neutral-700 bg-neutral-900 py-2 pr-8 pl-3 text-sm text-neutral-300 focus:outline-none"
          title="Sort conversations"
        >
          <option value="recent">Most Recent</option>
          <option value="oldest">Oldest First</option>
          <option value="most-messages">Most Messages</option>
          <option value="least-messages">Least Messages</option>
          <option value="alphabetical">A-Z</option>
        </select>

        <select
          value={dateRange}
          onChange={(e) => onDateRangeChange(e.target.value as DateRangeOption)}
          className="custom-select focus:border-claude-orange flex-1 cursor-pointer rounded-lg border border-neutral-700 bg-neutral-900 py-2 pr-8 pl-3 text-sm text-neutral-300 focus:outline-none"
          title="Filter by date"
        >
          <option value="all">All Time</option>
          <option value="today">Today</option>
          <option value="week">Last 7 Days</option>
          <option value="month">Last 30 Days</option>
        </select>
      </div>

      {/* Profile Filter */}
      {enabledProfiles.length > 1 && (
        <div className="relative">
          <select
            value={accountFilter ?? ''}
            onChange={(e) => onAccountFilterChange(e.target.value || null)}
            className="custom-select focus:border-claude-orange w-full cursor-pointer rounded-lg border border-neutral-700 bg-neutral-900 py-2 pr-8 pl-3 text-sm text-neutral-300 focus:outline-none"
            title="Filter by profile"
          >
            <option value="">All Profiles</option>
            {enabledProfiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.emoji} {p.label}
              </option>
            ))}
          </select>
          {activeProfile && (
            <button
              onClick={() => onAccountFilterChange(null)}
              className="absolute top-1/2 right-2 -translate-y-1/2 text-neutral-500 transition-colors hover:text-neutral-300"
              title="Clear profile filter"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Project Autocomplete ──────────────────────────────────────────

interface ProjectAutocompleteProps {
  projects: string[]
  selectedProject: string
  onProjectChange: (project: string) => void
}

function ProjectAutocomplete({
  projects,
  selectedProject,
  onProjectChange
}: ProjectAutocompleteProps): JSX.Element {
  const [inputValue, setInputValue] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Display text when not editing: show short path of selected project
  const displayText = selectedProject ? getShortPath(selectedProject) : ''

  // Filter projects based on input (case-insensitive substring match on full path)
  const filtered = useMemo(() => {
    if (!inputValue) return projects
    const lower = inputValue.toLowerCase()
    return projects.filter((p) => p.toLowerCase().includes(lower))
  }, [projects, inputValue])

  // Reset highlight when filtered list changes
  useEffect(() => {
    setHighlightedIndex(0)
  }, [filtered.length])

  // Scroll highlighted item into view
  useEffect(() => {
    if (!isOpen || !listRef.current) return
    const item = listRef.current.querySelector(
      `[data-select-index="${highlightedIndex}"]`
    ) as HTMLElement | undefined
    item?.scrollIntoView({ block: 'nearest' })
  }, [highlightedIndex, isOpen])

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent): void => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
        setInputValue('')
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const selectProject = useCallback(
    (project: string) => {
      onProjectChange(project)
      setInputValue('')
      setIsOpen(false)
      inputRef.current?.blur()
    },
    [onProjectChange]
  )

  const handleFocus = (): void => {
    setIsOpen(true)
    setInputValue('')
  }

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    // "All Projects" is index 0, actual projects start at 1
    const totalItems = filtered.length + 1

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlightedIndex((i) => (i + 1) % totalItems)
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightedIndex((i) => (i - 1 + totalItems) % totalItems)
        break
      case 'Enter':
        e.preventDefault()
        if (highlightedIndex === 0) {
          selectProject('')
        } else {
          const project = filtered[highlightedIndex - 1]
          if (project) selectProject(project)
        }
        break
      case 'Escape':
        setIsOpen(false)
        setInputValue('')
        inputRef.current?.blur()
        break
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={isOpen ? inputValue : displayText}
          onChange={(e) => setInputValue(e.target.value)}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          placeholder="All Projects — type to filter..."
          className="focus:border-claude-orange w-full rounded-lg border border-neutral-700 bg-neutral-900 py-2 pr-8 pl-3 text-sm text-neutral-300 placeholder:text-neutral-500 focus:outline-none"
        />
        {/* Chevron / clear button */}
        {selectedProject && !isOpen ? (
          <button
            onMouseDown={(e) => {
              e.preventDefault()
              e.stopPropagation()
              selectProject('')
            }}
            className="absolute top-1/2 right-2 -translate-y-1/2 text-neutral-500 transition-colors hover:text-neutral-300"
            title="Clear filter"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        ) : (
          <svg
            className="pointer-events-none absolute top-1/2 right-2 h-4 w-4 -translate-y-1/2 text-neutral-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        )}
      </div>

      {/* Dropdown */}
      {isOpen && (
        <ul
          ref={listRef}
          className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-neutral-700 bg-neutral-900 shadow-lg"
        >
          {/* "All Projects" option */}
          <li
            data-select-index={0}
            onMouseDown={(e) => {
              e.preventDefault()
              selectProject('')
            }}
            onMouseEnter={() => setHighlightedIndex(0)}
            className={`cursor-pointer px-3 py-2 text-sm ${
              highlightedIndex === 0
                ? 'bg-claude-orange/20 text-neutral-200'
                : 'text-neutral-400 hover:bg-neutral-800'
            } ${!selectedProject ? 'text-claude-orange font-medium' : ''}`}
          >
            All Projects
          </li>

          {filtered.length === 0 && (
            <li className="px-3 py-2 text-sm text-neutral-500 italic">No matching projects</li>
          )}

          {filtered.map((project, i) => {
            const itemIndex = i + 1
            const isHighlighted = highlightedIndex === itemIndex
            const isSelected = project === selectedProject
            const parent = getParentPath(project)
            const prevParent = i > 0 ? getParentPath(filtered[i - 1]) : null
            const showGroupHeader = parent !== prevParent
            return (
              <Fragment key={project}>
                {showGroupHeader && (
                  <li
                    className={`pointer-events-none px-3 py-1 text-[10px] font-medium tracking-wider text-neutral-600 uppercase select-none ${i > 0 ? 'mt-1 border-t border-neutral-800 pt-1.5' : 'pt-0.5'}`}
                  >
                    {getShortPath(parent)}
                  </li>
                )}
                <li
                  data-select-index={itemIndex}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    selectProject(project)
                  }}
                  onMouseEnter={() => setHighlightedIndex(itemIndex)}
                  className={`cursor-pointer truncate px-3 py-1.5 text-sm ${
                    isHighlighted
                      ? 'bg-claude-orange/20 text-neutral-200'
                      : 'text-neutral-400 hover:bg-neutral-800'
                  } ${isSelected ? 'text-claude-orange font-medium' : ''}`}
                  title={project}
                >
                  <HighlightedPath path={project} query={inputValue} />
                </li>
              </Fragment>
            )
          })}
        </ul>
      )}
    </div>
  )
}

// ─── Highlighted path renderer ─────────────────────────────────────
// Shows the short path but highlights the matching substring

function HighlightedPath({ path, query }: { path: string; query: string }): JSX.Element {
  const short = getShortPath(path)
  if (!query) return <>{short}</>

  const lower = short.toLowerCase()
  const qLower = query.toLowerCase()
  const idx = lower.indexOf(qLower)

  if (idx === -1) return <>{short}</>

  return (
    <>
      {short.slice(0, idx)}
      <span className="text-claude-orange font-medium">{short.slice(idx, idx + query.length)}</span>
      {short.slice(idx + query.length)}
    </>
  )
}

// ─── Helpers ───────────────────────────────────────────────────────

function getParentPath(fullPath: string): string {
  const idx = fullPath.replace(/\/+$/, '').lastIndexOf('/')
  return idx > 0 ? fullPath.slice(0, idx) : '/'
}

function getShortPath(fullPath: string): string {
  const parts = fullPath.split('/').filter(Boolean)
  if (parts.length <= 3) return fullPath
  return `.../${  parts.slice(-3).join('/')}`
}
