export type SortOption = 'recent' | 'oldest' | 'most-messages' | 'least-messages' | 'alphabetical'
export type DateRangeOption = 'all' | 'today' | 'week' | 'month'

interface FilterPanelProps {
  projects: string[]
  selectedProject: string
  onProjectChange: (project: string) => void
  sortBy: SortOption
  onSortChange: (sort: SortOption) => void
  dateRange: DateRangeOption
  onDateRangeChange: (range: DateRangeOption) => void
}

export default function FilterPanel({
  projects,
  selectedProject,
  onProjectChange,
  sortBy,
  onSortChange,
  dateRange,
  onDateRangeChange
}: FilterPanelProps): JSX.Element {
  return (
    <div className="mt-3 space-y-2">
      {/* Project Filter */}
      <select
        value={selectedProject}
        onChange={(e) => onProjectChange(e.target.value)}
        className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-neutral-300 text-sm focus:outline-none focus:border-claude-orange cursor-pointer"
      >
        <option value="">All Projects</option>
        {projects.map((project) => (
          <option key={project} value={project}>
            {getShortPath(project)}
          </option>
        ))}
      </select>

      {/* Sort and Date Range */}
      <div className="flex gap-2">
        <select
          value={sortBy}
          onChange={(e) => onSortChange(e.target.value as SortOption)}
          className="flex-1 px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-neutral-300 text-sm focus:outline-none focus:border-claude-orange cursor-pointer"
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
          className="flex-1 px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-neutral-300 text-sm focus:outline-none focus:border-claude-orange cursor-pointer"
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
