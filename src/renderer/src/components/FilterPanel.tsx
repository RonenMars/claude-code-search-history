interface FilterPanelProps {
  projects: string[]
  selectedProject: string
  onProjectChange: (project: string) => void
}

export default function FilterPanel({
  projects,
  selectedProject,
  onProjectChange
}: FilterPanelProps): JSX.Element {
  return (
    <div className="mt-3">
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
    </div>
  )
}

function getShortPath(fullPath: string): string {
  const parts = fullPath.split('/').filter(Boolean)
  if (parts.length <= 3) return fullPath
  return '.../' + parts.slice(-3).join('/')
}
