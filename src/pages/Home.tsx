import { useEffect, useState } from 'react'
import { useNavigate } from '@/lib/router-compat'
import { ArrowRight, Wand2 } from 'lucide-react'
import { AnimatedLogo } from '../components/AnimatedLogo'
import { ProjectCard } from '../components/ProjectCard'
import { ToolCard } from '../components/ToolCard'
import { TOOLS } from '../types'
import type { Project } from '../types'
import { createProjectFromFile } from '../lib/projectActions'
import { loadProjects, deleteProject as removeProject, duplicateProject as copyProject, renameProject } from '../lib/storage'
import { CardGridSkeleton, Spinner } from '../components/Loaders'
import { toast } from 'sonner'

export function Home() {
  const navigate = useNavigate()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    try {
      setProjects(loadProjects())
    } catch {
      toast.error('Could not read your saved projects')
    } finally {
      setLoading(false)
    }
  }, [])

  const handleUpload = async (file: File) => {
    if (uploading) return
    if (!file.type.startsWith('image/')) {
      toast.error('That file isn\u2019t an image')
      return
    }
    setUploading(true)
    try {
      const project = await createProjectFromFile(file)
      navigate(`/editor/${project.id}`)
    } catch {
      toast.error('We couldn\u2019t open that image. Try a JPG or PNG.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div
      className="pb-28 pt-2 relative"
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        const file = e.dataTransfer.files?.[0]
        if (file) void handleUpload(file)
      }}
    >
      {dragging && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center pointer-events-none">
          <div className="glass rounded-3xl px-10 py-8 text-center border-2 border-dashed border-violet-400">
            <p className="font-display font-semibold">Drop your photo here</p>
          </div>
        </div>
      )}
      <div className="px-5 pt-3 pb-2 flex items-center gap-3 animate-fade-up">
        <AnimatedLogo size="md" />
        <div>
          <p className="text-sm text-white/50">Welcome back</p>
          <h1 className="font-display text-2xl font-bold leading-tight">
            <span className="aurora-text">Magic Edit</span> AI
          </h1>
        </div>
      </div>

      <div className="px-5 mt-6">
        <div className="relative rounded-3xl p-6 sm:p-8 hero-gradient overflow-hidden animate-fade-up delay-1">
          <div className="absolute inset-0 opacity-40" style={{ backgroundImage: 'radial-gradient(circle at 15% 15%, rgba(255,255,255,0.35), transparent 45%)' }} />
          <div className="pointer-events-none absolute -bottom-10 -right-10 w-40 h-40 rounded-full bg-white/10 blur-2xl" />
          <div className="relative z-10 text-center sm:text-left">
            <p className="text-xs font-semibold uppercase tracking-wider text-white/80">AI-powered editing</p>
            <h2 className="font-display text-2xl sm:text-3xl font-bold mt-1.5 text-white">
              Turn any photo into<br />something magic
            </h2>
            <p className="text-sm text-white/75 mt-2 max-w-sm mx-auto sm:mx-0">
              Enhance, remove backgrounds, erase clutter &mdash; all in a tap.
            </p>
            <button
              onClick={() => navigate('/editor')}
              className="mt-5 inline-flex items-center gap-2 bg-white text-[#1a1030] font-display font-semibold text-sm px-7 py-3.5 rounded-2xl animate-cta-glow active:scale-[0.97] transition-transform"
            >
              {uploading ? <Spinner className="w-[17px] h-[17px] border-[#1a1030]/25 border-t-[#1a1030]" /> : <Wand2 size={17} strokeWidth={2.5} />}
              Start Editing
            </button>
            <p className="text-[11px] text-white/60 mt-2.5">opens the full editor workspace</p>
          </div>
        </div>
      </div>

      <div className="px-5 mt-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display font-semibold text-base">AI Tools</h2>
          <button onClick={() => navigate('/tools')} className="text-xs text-white/50 flex items-center gap-1 hover:text-white/80 transition-colors">
            See all <ArrowRight size={12} />
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {TOOLS.map((tool, i) => (
            <div key={tool.id} className={`delay-${Math.min(i + 1, 5)}`}>
              <ToolCard tool={tool} to={`/tools/${tool.id}`} />
            </div>
          ))}
        </div>
      </div>

      <div className="px-5 mt-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display font-semibold text-base">Recent Projects</h2>
          {projects.length > 0 && (
            <button onClick={() => navigate('/projects')} className="text-xs text-white/50 flex items-center gap-1 hover:text-white/80 transition-colors">
              See all <ArrowRight size={12} />
            </button>
          )}
        </div>
        {loading ? (
          <CardGridSkeleton count={4} />
        ) : projects.length === 0 ? (
          <div className="glass rounded-2xl py-10 px-6 text-center animate-fade-up delay-2">
            <p className="text-sm text-white/50">No projects yet. Upload a photo to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {projects.slice(0, 4).map((p) => (
              <ProjectCard
                key={p.id}
                project={p}
                onDelete={(id) => setProjects(removeProject(id))}
                onDuplicate={(id) => setProjects(copyProject(id))}
                onRename={(id, name) => setProjects(renameProject(id, name))}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
