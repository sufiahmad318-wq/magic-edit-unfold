import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MoreVertical, Trash2, Copy, Pencil } from 'lucide-react'
import type { Project } from '../types'

function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(ts).toLocaleDateString()
}

export function ProjectCard({
  project,
  onDelete,
  onDuplicate,
  onRename,
}: {
  project: Project
  onDelete: (id: string) => void
  onDuplicate: (id: string) => void
  onRename: (id: string, name: string) => void
}) {
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState(project.name)

  return (
    <div className="relative group animate-fade-up">
      <button
        onClick={() => navigate(`/editor/${project.id}`)}
        className="w-full aspect-[3/4] rounded-2xl overflow-hidden glass relative active:scale-[0.98] transition-transform"
      >
        <img
          src={project.currentData}
          alt={project.name}
          className="w-full h-full object-cover"
          style={{
            backgroundImage:
              'repeating-conic-gradient(#1c1c2a 0% 25%, #14141f 0% 50%) 50% / 16px 16px',
          }}
        />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-3 pt-8">
          {renaming ? (
            <input
              autoFocus
              value={name}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => {
                setRenaming(false)
                if (name.trim()) onRename(project.id, name.trim())
              }}
              className="w-full bg-transparent border-b border-white/30 text-sm font-medium outline-none pb-0.5"
            />
          ) : (
            <p className="text-sm font-medium truncate">{project.name}</p>
          )}
          <p className="text-[11px] text-white/50 mt-0.5">{timeAgo(project.updatedAt)}</p>
        </div>
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation()
          setMenuOpen((v) => !v)
        }}
        className="absolute top-2 right-2 w-7 h-7 rounded-lg bg-black/50 backdrop-blur flex items-center justify-center text-white/90"
      >
        <MoreVertical size={14} />
      </button>
      {menuOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
          <div className="absolute top-9 right-2 z-20 glass rounded-xl overflow-hidden w-36 text-sm shadow-xl">
            <button
              onClick={() => {
                setRenaming(true)
                setMenuOpen(false)
              }}
              className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-white/5 text-left"
            >
              <Pencil size={14} /> Rename
            </button>
            <button
              onClick={() => {
                onDuplicate(project.id)
                setMenuOpen(false)
              }}
              className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-white/5 text-left"
            >
              <Copy size={14} /> Duplicate
            </button>
            <button
              onClick={() => {
                onDelete(project.id)
                setMenuOpen(false)
              }}
              className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-red-500/10 text-left text-red-400"
            >
              <Trash2 size={14} /> Delete
            </button>
          </div>
        </>
      )}
    </div>
  )
}
