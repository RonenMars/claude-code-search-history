import type { SortOption, DateRangeOption } from '../../../shared/types'

interface FilterPanelProps {
  projects: string[]
  selectedProject: string
  onProjectChange: (project: string) => void
  sortBy: SortOption
  onSortChange: (sort: SortOption) => void
  dateRange: DateRangeOption
  onDateRangeChange: (range: DateRangeOption) => void
  onChatInProject: (projectPath: string) => void
}

export default function FilterPanel({
  projects,
  selectedProject,
  onProjectChange,
  sortBy,
  onSortChange,
  dateRange,
  onDateRangeChange,
  onChatInProject
}: FilterPanelProps): JSX.Element {
  return (
    <div className="mt-3 space-y-2">
      {/* Project Filter */}
      <select
        value={selectedProject}
        onChange={(e) => onProjectChange(e.target.value)}
        className="custom-select w-full pl-3 pr-8 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-neutral-300 text-sm focus:outline-none focus:border-claude-orange cursor-pointer"
      >
        <option value="">All Projects</option>
        {projects.map((project) => (
          <option key={project} value={project}>
            {getShortPath(project)}
          </option>
        ))}
      </select>

      {selectedProject && (
        <button
          onClick={() => onChatInProject(selectedProject)}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-claude-orange bg-claude-orange/10 hover:bg-claude-orange/20 border border-claude-orange/30 rounded-lg transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
          className="custom-select flex-1 pl-3 pr-8 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-neutral-300 text-sm focus:outline-none focus:border-claude-orange cursor-pointer"
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
          className="custom-select flex-1 pl-3 pr-8 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-neutral-300 text-sm focus:outline-none focus:border-claude-orange cursor-pointer"
          title="Filter by date"
        >
          <option value="all">All Time</option>
          <option value="today">Today</option>
          <option value="week">Last 7 Days</option>
          <option value="month">Last 30 Days</option>
        </select>
      </div>
    </div>
  )
}

function getShortPath(fullPath: string): string {
  const parts = fullPath.split('/').filter(Boolean)
  if (parts.length <= 3) return fullPath
  return '.../' + parts.slice(-3).join('/')
}
