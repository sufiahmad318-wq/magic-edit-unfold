import { useEffect, useMemo, useState } from 'react'
import { Search, Trash2 } from 'lucide-react'
import { TopBar } from '../components/TopBar'
import { ProjectCard } from '../components/ProjectCard'
import type { Project } from '../types'
import {
  loadProjects,
  deleteProject,
  duplicateProject,
  renameProject,
  clearAllData,
  storageBytesUsed,
} from '../lib/storage'

export function Projects() {
  const [projects, setProjects] = useState<Project[]>([])
  const [query, setQuery] = useState('')

  const [bytes, setBytes] = useState(0)

  useEffect(() => {
    setProjects(loadProjects())
    setBytes(storageBytesUsed())
  }, [])

  const filtered = useMemo(
    () => projects.filter((p) => p.name.toLowerCase().includes(query.toLowerCase())),
    [projects, query],
  )

  const kb = (bytes / 1024).toFixed(0)

  return (
    <div className="pb-28">
      <TopBar title="Projects" subtitle={`${projects.length} saved \u00b7 ${kb} KB used`} />

      <div className="px-5">
        <div className="glass rounded-xl flex items-center gap-2 px-3 py-2.5 mb-4">
          <Search size={15} className="text-white/40" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search projects"
            className="bg-transparent outline-none text-sm flex-1 placeholder:text-white/30"
          />
        </div>

        {filtered.length === 0 ? (
          <div className="glass rounded-2xl py-14 text-center text-sm text-white/50">
            {projects.length === 0 ? 'No projects yet. Start by uploading a photo.' : 'No matches found.'}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filtered.map((p) => (
              <ProjectCard
                key={p.id}
                project={p}
                onDelete={(id) => setProjects(deleteProject(id))}
                onDuplicate={(id) => setProjects(duplicateProject(id))}
                onRename={(id, name) => setProjects(renameProject(id, name))}
              />
            ))}
          </div>
        )}

        {projects.length > 0 && (
          <button
            onClick={() => {
              if (confirm('Delete all projects? This cannot be undone.')) {
                clearAllData()
                setProjects([])
              }
            }}
            className="mt-8 w-full flex items-center justify-center gap-2 text-xs text-red-400/80 py-3"
          >
            <Trash2 size={13} /> Clear all projects
          </button>
        )}
      </div>
    </div>
  )
}
